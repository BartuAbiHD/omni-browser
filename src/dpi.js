'use strict';

/**
 * DPI Sansür Aşma Modülü (ByeDPI Mimarisi)
 *
 * Yalnızca bu tarayıcıya özel çalışan, sistem geneline veya diğer tarayıcılara
 * hiçbir etkisi olmayan yerel kullanıcı-alanı SOCKS5 DPI atlatma motoru.
 *
 * Neden WinDivert (GoodbyeDPI / standart Zapret) DEĞİL?
 * - WinDivert bir çekirdek sürücüsüdür (kernel driver), tüm Windows trafiğini yakalar,
 *   diğer tarayıcıları ve oyunları etkiler, yönetici (UAC) yetkisi gerektirir.
 * - ByeDPI mimarisi ise yalnızca 127.0.0.1 üzerinde yerel bir SOCKS5 sunucusu açar
 *   ve tarayıcının oturum vekiline (session.setProxy) bağlanır. Sürücü gerekmez,
 *   yönetici yetkisi gerekmez, diğer programları ASLA etkilemez.
 */

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let _sunucu = null;
let _aktifPort = 0;
let _altSurec = null;
const _aktifSoketler = new Set();

/**
 * TLS ClientHello içinde SNI (Server Name Indication) uzantısının bayt ofsetini bulur.
 * @param {Buffer} buf
 * @returns {number} Bulunamazsa -1
 */
function sniOfsetiBul(buf) {
  try {
    if (!buf || buf.length < 44 || buf[0] !== 0x16) return -1;
    const sessionIdLen = buf[43];
    let pos = 44 + sessionIdLen;
    if (pos + 2 > buf.length) return -1;
    const cipherSuitesLen = buf.readUInt16BE(pos);
    pos += 2 + cipherSuitesLen;
    if (pos + 1 > buf.length) return -1;
    const compMethodsLen = buf[pos];
    pos += 1 + compMethodsLen;
    if (pos + 2 > buf.length) return -1;
    const extensionsLen = buf.readUInt16BE(pos);
    pos += 2;
    const end = Math.min(pos + extensionsLen, buf.length);
    while (pos + 4 <= end) {
      const extType = buf.readUInt16BE(pos);
      const extLen = buf.readUInt16BE(pos + 2);
      if (extType === 0) {
        // SNI uzantısı bulundu (pos = uzantı başlangıcı)
        return pos;
      }
      pos += 4 + extLen;
    }
  } catch (_) {}
  return -1;
}

/**
 * İlk veri paketini seçilen DPI stratejisine göre parçalayıp hedefe iletir.
 * @param {net.Socket} hedef
 * @param {Buffer} veri
 * @param {string} strateji 'split-1' | 'split-2' | 'split-sni' | 'fake-split'
 */
function dpiPaketGonder(hedef, veri, strateji = 'split-1') {
  if (hedef.destroyed) return;
  hedef.setNoDelay(true);

  // 1. HTTPS / TLS ClientHello kontrolü
  if (veri.length > 5 && veri[0] === 0x16 && veri[1] === 0x03) {
    let bolmeNoktasi = 1;

    if (strateji === 'split-2') {
      bolmeNoktasi = Math.min(2, veri.length - 1);
    } else if (strateji === 'split-sni') {
      const sniPos = sniOfsetiBul(veri);
      if (sniPos > 0 && sniPos + 4 < veri.length) {
        // SNI sunucu adı alanının tam ortasından böl
        bolmeNoktasi = sniPos + 4;
      } else {
        bolmeNoktasi = Math.min(2, veri.length - 1);
      }
    } else if (strateji === 'fake-split') {
      // Sahte / geçersiz küçük TLS kaydı gönder, ardından gerçek paketi bölerek yolla
      try {
        const sahtePaket = Buffer.from([0x16, 0x03, 0x01, 0x00, 0x01, 0x00]);
        hedef.write(sahtePaket);
      } catch (_) {}
      bolmeNoktasi = Math.min(2, veri.length - 1);
    } else {
      // Standart 'split-1': İlk 1 bayt ve kalanı (en yaygın DPI atlatma yöntemi)
      bolmeNoktasi = 1;
    }

    const parca1 = veri.subarray(0, bolmeNoktasi);
    const parca2 = veri.subarray(bolmeNoktasi);

    hedef.write(parca1);
    // Nagle algoritmasını aşmak ve ayrı TCP segmenti olarak göndermek için mikro gecikme
    setTimeout(() => {
      if (!hedef.destroyed) {
        hedef.write(parca2);
      }
    }, 8);
    return;
  }

  // 2. Düz HTTP (Port 80) istekleri için Host başlığını karartma (hOSt:)
  if (veri.length > 10 && (veri.subarray(0, 4).toString() === 'GET ' || veri.subarray(0, 5).toString() === 'POST ')) {
    let str = veri.toString('latin1');
    if (str.includes('Host: ')) {
      str = str.replace('Host: ', 'hOSt: ');
      hedef.write(Buffer.from(str, 'latin1'));
      return;
    }
  }

  // Diğer tüm protokollerde olduğu gibi ilet
  hedef.write(veri);
}

/**
 * Yerleşik SOCKS5 DPI vekil sunucusunu başlatır.
 * @param {number} istenenPort
 * @param {string} strateji
 * @returns {Promise<number>} Dinlenen yerel port
 */
function yerlesikDpiBaslat(istenenPort = 0, strateji = 'split-1') {
  return new Promise((resolve, reject) => {
    try {
      durdur();

      const server = net.createServer((client) => {
        _aktifSoketler.add(client);
        let durum = 'AUTH';
        let hedef = null;
        let ilkPaketIslendi = false;

        client.on('error', () => {
          if (hedef && !hedef.destroyed) hedef.destroy();
          client.destroy();
        });

        client.on('close', () => {
          _aktifSoketler.delete(client);
          if (hedef && !hedef.destroyed) hedef.destroy();
        });

        client.on('data', (veri) => {
          try {
            if (durum === 'AUTH') {
              // SOCKS5 El Sıkışması: [0x05, nmethods, ...methods]
              if (veri[0] === 0x05) {
                client.write(Buffer.from([0x05, 0x00])); // Kimlik doğrulama yok
                durum = 'REQUEST';
              } else {
                client.destroy();
              }
            } else if (durum === 'REQUEST') {
              // SOCKS5 İsteği: [0x05, cmd, rsv, atyp, ...]
              if (veri[0] !== 0x05 || veri[1] !== 0x01) { // 0x01 = CONNECT
                client.destroy();
                return;
              }

              const atyp = veri[3];
              let hedefHost = '';
              let portOfset = 0;

              if (atyp === 0x01) { // IPv4
                hedefHost = `${veri[4]}.${veri[5]}.${veri[6]}.${veri[7]}`;
                portOfset = 8;
              } else if (atyp === 0x03) { // Alan Adı
                const uzunluk = veri[4];
                hedefHost = veri.subarray(5, 5 + uzunluk).toString('utf8');
                portOfset = 5 + uzunluk;
              } else if (atyp === 0x04) { // IPv6
                const parcalar = [];
                for (let i = 0; i < 16; i += 2) {
                  parcalar.push(veri.readUInt16BE(4 + i).toString(16));
                }
                hedefHost = parcalar.join(':');
                portOfset = 20;
              } else {
                client.destroy();
                return;
              }

              const hedefPort = veri.readUInt16BE(portOfset);

              hedef = net.connect(hedefPort, hedefHost, () => {
                // SOCKS5 Başarılı yanıtı: [0x05, 0x00, 0x00, 0x01, 0,0,0,0, 0,0]
                client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                durum = 'STREAM';
              });

              _aktifSoketler.add(hedef);

              hedef.on('error', () => client.destroy());
              hedef.on('close', () => {
                _aktifSoketler.delete(hedef);
                client.destroy();
              });
            } else if (durum === 'STREAM') {
              if (!hedef || hedef.destroyed) {
                client.destroy();
                return;
              }

              if (!ilkPaketIslendi) {
                ilkPaketIslendi = true;
                dpiPaketGonder(hedef, veri, strateji);
                // İlk parçalanmış paketten sonra çift yönlü doğrudan pipe
                client.pipe(hedef);
                hedef.pipe(client);
              }
            }
          } catch (e) {
            client.destroy();
            if (hedef && !hedef.destroyed) hedef.destroy();
          }
        });
      });

      server.on('error', (err) => {
        reject(err);
      });

      server.listen(istenenPort || 0, '127.0.0.1', () => {
        _sunucu = server;
        _aktifPort = server.address().port;
        resolve(_aktifPort);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Harici ciadpi.exe ikilisini çalıştırır.
 */
function hariciCiadpiBaslat(istenenPort = 10800, strateji = 'split-1') {
  return new Promise((resolve, reject) => {
    durdur();

    const olasiYollar = [
      path.join(process.cwd(), 'bin', 'ciadpi.exe'),
      path.join(process.cwd(), 'bin', 'ciadpi'),
      path.join(__dirname, '..', 'bin', 'ciadpi.exe'),
      'ciadpi'
    ];

    let binaryYolu = olasiYollar.find((y) => fs.existsSync(y));

    if (!binaryYolu) {
      // Harici ikili bulunamazsa güvenli ve kesintisiz şekilde yerleşik motora düş
      return yerlesikDpiBaslat(istenenPort, strateji).then(resolve).catch(reject);
    }

    const port = istenenPort || 10800;
    const args = ['-i', '127.0.0.1', '-p', String(port)];

    if (strateji === 'split-2') {
      args.push('--split', '2', '--disorder', '1');
    } else if (strateji === 'fake-split') {
      args.push('--split', '1', '--fake', '-1', '--ttl', '3');
    } else {
      args.push('--split', '1', '--disorder', '1');
    }

    try {
      _altSurec = spawn(binaryYolu, args, { stdio: 'ignore', windowsHide: true });
      _altSurec.on('error', () => {
        // İkili başlatılamazsa yerleşik motoru devreye sok
        yerlesikDpiBaslat(istenenPort, strateji).then(resolve).catch(reject);
      });

      _aktifPort = port;
      // İkili başlatma süresi için kısa bekleme
      setTimeout(() => resolve(port), 300);
    } catch (_) {
      yerlesikDpiBaslat(istenenPort, strateji).then(resolve).catch(reject);
    }
  });
}

/**
 * Ayarlara göre DPI motorunu başlatır.
 * @param {Object} ayarlar
 * @returns {Promise<number>} Aktif port
 */
async function baslat(ayarlar = {}) {
  const mod = ayarlar.dpiMod || 'dahili';
  const strateji = ayarlar.dpiStrateji || 'split-1';

  if (mod === 'ciadpi') {
    return hariciCiadpiBaslat(10800, strateji);
  }
  return yerlesikDpiBaslat(0, strateji);
}

/**
 * DPI motorunu ve açık bağlantıları sonlandırır.
 */
function durdur() {
  if (_altSurec) {
    try { _altSurec.kill(); } catch (_) {}
    _altSurec = null;
  }
  for (const s of _aktifSoketler) {
    try { s.destroy(); } catch (_) {}
  }
  _aktifSoketler.clear();
  if (_sunucu) {
    try { _sunucu.close(); } catch (_) {}
    _sunucu = null;
  }
  _aktifPort = 0;
}

/**
 * Chromium session.setProxy için vekil kuralı nesnesi döner.
 */
function vekilKurali() {
  if (!_aktifPort) return null;
  return {
    mode: 'fixed_servers',
    proxyRules: `socks5://127.0.0.1:${_aktifPort}`,
    proxyBypassRules: 'localhost,127.0.0.1,::1,<local>'
  };
}

function durum() {
  return {
    calisiyor: _aktifPort > 0,
    port: _aktifPort
  };
}

module.exports = {
  baslat,
  durdur,
  vekilKurali,
  durum,
  sniOfsetiBul,
  yerlesikDpiBaslat
};
