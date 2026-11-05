'use strict';

/**
 * Tarayıcılardan Yer İmleri ve Geçmiş Aktarma Motoru (Browser Import Engine).
 *
 * Desteklenen tarayıcılar:
 * - Chromium tabanlı: Google Chrome, Brave, Microsoft Edge, Supermium, Vivaldi, Opera One, Opera GX
 * - Gecko tabanlı: Mozilla Firefox, Floorp
 * - HTML Yer İmi Dışa Aktarım Dosyası (Netscape formatı)
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// node:sqlite Node 22+ ve Electron 44+'te yerleşik olarak bulunur.
let sqliteModulu = null;
try {
  sqliteModulu = require('node:sqlite');
} catch {
  // SQLite yüklenemezse geçmiş aktarımı atlanır, yer imleri (JSON/HTML) çalışmaya devam eder.
}

const TARAYICILAR = [
  {
    id: 'chrome',
    ad: 'Google Chrome',
    tur: 'chromium',
    yollar: {
      win32: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
      linux: path.join(os.homedir(), '.config', 'google-chrome')
    }
  },
  {
    id: 'brave',
    ad: 'Brave Browser',
    tur: 'chromium',
    yollar: {
      win32: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'),
      linux: path.join(os.homedir(), '.config', 'BraveSoftware', 'Brave-Browser')
    }
  },
  {
    id: 'edge',
    ad: 'Microsoft Edge',
    tur: 'chromium',
    yollar: {
      win32: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge'),
      linux: path.join(os.homedir(), '.config', 'microsoft-edge')
    }
  },
  {
    id: 'supermium',
    ad: 'Supermium',
    tur: 'chromium',
    yollar: {
      win32: path.join(process.env.LOCALAPPDATA || '', 'Supermium', 'User Data'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Supermium'),
      linux: path.join(os.homedir(), '.config', 'supermium')
    }
  },
  {
    id: 'vivaldi',
    ad: 'Vivaldi',
    tur: 'chromium',
    yollar: {
      win32: path.join(process.env.LOCALAPPDATA || '', 'Vivaldi', 'User Data'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Vivaldi'),
      linux: path.join(os.homedir(), '.config', 'vivaldi')
    }
  },
  {
    id: 'opera',
    ad: 'Opera One',
    tur: 'chromium_opera',
    yollar: {
      win32: path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'com.operasoftware.Opera'),
      linux: path.join(os.homedir(), '.config', 'opera')
    }
  },
  {
    id: 'opera-gx',
    ad: 'Opera GX',
    tur: 'chromium_opera',
    yollar: {
      win32: path.join(process.env.APPDATA || '', 'Opera Software', 'Opera GX Stable'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'com.operasoftware.OperaGX'),
      linux: path.join(os.homedir(), '.config', 'opera-gx')
    }
  },
  {
    id: 'firefox',
    ad: 'Mozilla Firefox',
    tur: 'gecko',
    yollar: {
      win32: path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles'),
      linux: path.join(os.homedir(), '.mozilla', 'firefox')
    }
  },
  {
    id: 'floorp',
    ad: 'Floorp',
    tur: 'gecko',
    yollar: {
      win32: path.join(process.env.APPDATA || '', 'Floorp', 'Profiles'),
      darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Floorp', 'Profiles'),
      linux: path.join(os.homedir(), '.floorp')
    }
  }
];

function guvenliUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

/**
 * Sistemde kurulu ve profili bulunan tarayıcıları listeler.
 */
function kuruluTarayicilariBul() {
  const platform = process.platform;
  const bulunanlar = [];

  for (const t of TARAYICILAR) {
    const kok = t.yollar[platform];
    if (kok && fs.existsSync(kok)) {
      bulunanlar.push({
        id: t.id,
        ad: t.ad,
        tur: t.tur,
        kok
      });
    }
  }

  return bulunanlar;
}

/**
 * Chromium tabanlı profil dizinlerini tespit eder (Default, Profile 1, vb.).
 */
function chromiumProfilDizinleri(kok, tur) {
  if (tur === 'chromium_opera') {
    // Opera doğrudan profil dizinidir
    return [kok];
  }
  const dizinler = [];
  const varsayilan = path.join(kok, 'Default');
  if (fs.existsSync(varsayilan)) {
    dizinler.push(varsayilan);
  }
  try {
    const dosyalar = fs.readdirSync(kok, { withFileTypes: true });
    for (const d of dosyalar) {
      if (d.isDirectory() && d.name.startsWith('Profile ')) {
        dizinler.push(path.join(kok, d.name));
      }
    }
  } catch {
    // Okuma hatası
  }
  if (!dizinler.length && fs.existsSync(kok)) {
    dizinler.push(kok);
  }
  return dizinler;
}

/**
 * Gecko (Firefox/Floorp) profil dizinlerini tespit eder.
 */
function geckoProfilDizinleri(kok) {
  const dizinler = [];
  try {
    const dosyalar = fs.readdirSync(kok, { withFileTypes: true });
    for (const d of dosyalar) {
      if (d.isDirectory()) {
        const places = path.join(kok, d.name, 'places.sqlite');
        if (fs.existsSync(places)) {
          dizinler.push(path.join(kok, d.name));
        }
      }
    }
  } catch {
    // Okuma hatası
  }
  return dizinler;
}

/**
 * Chromium Bookmarks JSON ağacını düzleştirir (klasör yapısını korur).
 */
function chromiumYerImleriAyristir(icerik) {
  const yerImleri = [];
  try {
    const veri = typeof icerik === 'string' ? JSON.parse(icerik) : icerik;
    const kokler = veri.roots || {};

    function gez(dugum, klasor = '') {
      if (!dugum) return;
      if (dugum.type === 'url' && dugum.url) {
        const url = guvenliUrl(dugum.url);
        if (url) {
          yerImleri.push({
            url,
            baslik: (dugum.name || url).slice(0, 300),
            zaman: dugum.date_added ? Math.floor(Number(dugum.date_added) / 1000 - 11644473600000) : Date.now(),
            klasor: (klasor || '').trim()
          });
        }
      } else if (Array.isArray(dugum.children)) {
        for (const cocuk of dugum.children) {
          if (cocuk.type === 'folder') {
            const yeniKlasor = klasor ? klasor + '/' + (cocuk.name || '') : (cocuk.name || '');
            gez(cocuk, yeniKlasor);
          } else {
            gez(cocuk, klasor);
          }
        }
      }
    }

    for (const anahtar of Object.keys(kokler)) {
      const kok = kokler[anahtar];
      const kokKlasor = (anahtar === 'other' || anahtar === 'synced') ? (kok.name || 'Diğer yer işaretleri') : '';
      gez(kok, kokKlasor);
    }
  } catch {
    // JSON ayrıştırma hatası
  }
  return yerImleri;
}

/** &amp; &lt; &gt; &quot; &#39; ve sayısal varlıkları çözer (Netscape HTML'de hepsi kaçışlıdır). */
function htmlCoz(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _m; } })
    .replace(/&#(\d+);/g, (_m, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _m; } })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Netscape Bookmark HTML formatını ayrıştırır (klasör hiyerarşisini korur).
 */
function htmlYerImleriAyristir(html) {
  const yerImleri = [];
  if (!html || typeof html !== 'string') return yerImleri;

  const stack = [];
  const tokenRe = /(?:<H3\b[^>]*>(.*?)<\/H3>)|(?:<\/DL>)|(?:<A\b[^>]*\bHREF=["']([^"']+)["'][^>]*>(.*?)<\/A>)/gi;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1] !== undefined) {
      const klasorAdi = htmlCoz(m[1].replace(/<[^>]+>/g, '')).trim();
      stack.push(klasorAdi);
    } else if (m[0].toUpperCase().startsWith('</DL')) {
      if (stack.length > 0) stack.pop();
    } else if (m[2] !== undefined) {
      const url = guvenliUrl(htmlCoz(m[2]));
      if (url) {
        const baslik = htmlCoz((m[3] || '').replace(/<[^>]+>/g, '')).trim();
        yerImleri.push({
          url,
          baslik: baslik || url,
          zaman: Date.now(),
          klasor: stack.length > 0 ? stack[stack.length - 1] : ''
        });
      }
    }
  }
  return yerImleri;
}

/**
 * Kilitli SQLite dosyaları için geçici güvenli kopya oluşturup okur.
 */
function geciciKopyadanOku(orijinalDosya, islemci) {
  if (!fs.existsSync(orijinalDosya) || !sqliteModulu) return [];

  const tempYol = path.join(os.tmpdir(), `cvs_import_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
  try {
    fs.copyFileSync(orijinalDosya, tempYol);
    const db = new sqliteModulu.DatabaseSync(tempYol, { readOnly: true });
    try {
      return islemci(db);
    } finally {
      db.close();
    }
  } catch (err) {
    return [];
  } finally {
    try {
      if (fs.existsSync(tempYol)) fs.unlinkSync(tempYol);
    } catch {
      // Geçici dosya silme hatası önemsiz
    }
  }
}

/**
 * Chromium History SQLite tablosundan geçmiş kayıtlarını çeker.
 */
function chromiumGecmisAyristir(historyDosyasi) {
  return geciciKopyadanOku(historyDosyasi, (db) => {
    const sonuc = [];
    const stmt = db.prepare(`SELECT url, title, last_visit_time/1000 AS last_visit_time FROM urls WHERE url LIKE 'http%' ORDER BY last_visit_time DESC LIMIT 2000`);
    for (const satir of stmt.all()) {
      const url = guvenliUrl(satir.url);
      if (url) {
        // Chromium zaman damgası: 1 Ocak 1601'den bu yana mikrosaniye
        const zamanMs = satir.last_visit_time
          ? Math.floor(Number(satir.last_visit_time) - 11644473600000)
          : Date.now();
        sonuc.push({
          url,
          baslik: (satir.title || url).slice(0, 300),
          zaman: zamanMs > 0 ? zamanMs : Date.now()
        });
      }
    }
    return sonuc;
  });
}

/**
 * Gecko (Firefox/Floorp) places.sqlite dosyasından yer imleri ve geçmişi çeker.
 */
function geckoVerileriniAyristir(placesDosyasi, { yerImleriAl = true, gecmisAl = true }) {
  const cikti = { yerImleri: [], gecmis: [] };
  if (!fs.existsSync(placesDosyasi) || !sqliteModulu) return cikti;

  return geciciKopyadanOku(placesDosyasi, (db) => {
    if (yerImleriAl) {
      try {
        const stmt = db.prepare(`
          SELECT p.url, b.title, b.dateAdded, parent.title AS folderTitle
          FROM moz_bookmarks b
          JOIN moz_places p ON b.fk = p.id
          LEFT JOIN moz_bookmarks parent ON b.parent = parent.id AND parent.type = 2
          WHERE b.type = 1 AND p.url LIKE 'http%'
          ORDER BY b.dateAdded DESC LIMIT 3000
        `);
        for (const satir of stmt.all()) {
          const url = guvenliUrl(satir.url);
          if (url) {
            const rawFolder = satir.folderTitle ? String(satir.folderTitle).trim() : '';
            const isStandard = ['toolbar', 'menu', 'unfiled', 'tags', 'places'].includes(rawFolder.toLowerCase());
            cikti.yerImleri.push({
              url,
              baslik: (satir.title || url).slice(0, 300),
              zaman: satir.dateAdded ? Math.floor(Number(satir.dateAdded) / 1000) : Date.now(),
              klasor: isStandard ? '' : rawFolder
            });
          }
        }
      } catch {
        // Tablo yapısı uyumsuzsa
      }
    }

    if (gecmisAl) {
      try {
        const stmt = db.prepare(`
          SELECT url, title, last_visit_date
          FROM moz_places
          WHERE url LIKE 'http%' AND last_visit_date IS NOT NULL
          ORDER BY last_visit_date DESC LIMIT 2000
        `);
        for (const satir of stmt.all()) {
          const url = guvenliUrl(satir.url);
          if (url) {
            cikti.gecmis.push({
              url,
              baslik: (satir.title || url).slice(0, 300),
              zaman: satir.last_visit_date ? Math.floor(Number(satir.last_visit_date) / 1000) : Date.now()
            });
          }
        }
      } catch {
        // Tablo okuma hatası
      }
    }

    return cikti;
  });
}

/**
 * Chromium History dosyasındaki downloads tablosundan tamamlanmış indirmeleri çeker.
 */
function chromiumIndirmeAyristir(historyDosyasi) {
  return geciciKopyadanOku(historyDosyasi, (db) => {
    const sonuc = [];
    const stmt = db.prepare(`SELECT target_path, tab_url, total_bytes, end_time/1000 AS end_time FROM downloads WHERE state = 1 AND target_path != '' ORDER BY end_time DESC LIMIT 500`);
    for (const satir of stmt.all()) {
      const yol = String(satir.target_path || '');
      if (!yol) continue;
      sonuc.push({
        yol,
        ad: path.basename(yol),
        url: guvenliUrl(satir.tab_url) || '',
        toplam: Number(satir.total_bytes) || 0,
        zaman: satir.end_time ? Math.floor(Number(satir.end_time) - 11644473600000) : Date.now()
      });
    }
    return sonuc;
  });
}

/**
 * Windows DPAPI ile (geçerli kullanıcı) şifre çözer. Yalnızca win32.
 */
function dpapiCoz(buf) {
  if (process.platform !== 'win32') return null;
  try {
    const { execFileSync } = require('node:child_process');
    const betik = 'Add-Type -AssemblyName System.Security;'
      + '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect('
      + '[Convert]::FromBase64String($env:CVS_DPAPI),$null,"CurrentUser"))';
    const cikti = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', betik], {
      env: { ...process.env, CVS_DPAPI: buf.toString('base64') },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000
    });
    return Buffer.from(cikti.trim(), 'base64');
  } catch {
    return null;
  }
}

/**
 * Chromium "Login Data" kayıtlarını çözer (v10/v11 AES-GCM; v20 uygulama-bağlı
 * şifreleme çözülemez ve atlanır).
 */
function chromiumParolaAyristir(kok, profilDizin) {
  const cikti = { liste: [], atlanan: 0 };
  const loginDosya = path.join(profilDizin, 'Login Data');
  const stateDosya = path.join(kok, 'Local State');
  if (!fs.existsSync(loginDosya) || !fs.existsSync(stateDosya)) return cikti;

  let anahtar = null;
  try {
    const state = JSON.parse(fs.readFileSync(stateDosya, 'utf8'));
    const sifreliAnahtar = Buffer.from(state.os_crypt.encrypted_key, 'base64');
    if (sifreliAnahtar.subarray(0, 5).toString() === 'DPAPI') {
      anahtar = dpapiCoz(sifreliAnahtar.subarray(5));
    }
  } catch {
    // Local State okunamadı
  }
  if (!anahtar) return cikti;

  const crypto = require('node:crypto');
  const satirlar = geciciKopyadanOku(loginDosya, (db) =>
    db.prepare('SELECT origin_url, username_value, password_value FROM logins WHERE blacklisted_by_user = 0 LIMIT 5000').all());

  for (const s of satirlar) {
    try {
      const veri = Buffer.from(s.password_value);
      const onek = veri.subarray(0, 3).toString();
      const origin = guvenliUrl(s.origin_url);
      if (!origin || !s.username_value) continue;
      if (onek !== 'v10' && onek !== 'v11') { cikti.atlanan++; continue; }
      const d = crypto.createDecipheriv('aes-256-gcm', anahtar, veri.subarray(3, 15));
      d.setAuthTag(veri.subarray(veri.length - 16));
      const parola = Buffer.concat([d.update(veri.subarray(15, veri.length - 16)), d.final()]).toString('utf8');
      cikti.liste.push({ origin, kullaniciAdi: s.username_value, parola });
    } catch {
      cikti.atlanan++;
    }
  }
  return cikti;
}

/**
 * Belirtilen tarayıcıdan yer imi, geçmiş, indirme ve parola verilerini toplar.
 */
function tarayicidanCek(tarayiciId, { yerImleri = true, gecmis = true, indirmeler = false, parolalar = false } = {}) {
  const hedef = TARAYICILAR.find((t) => t.id === tarayiciId);
  if (!hedef) {
    throw new Error('Bilinmeyen tarayıcı: ' + tarayiciId);
  }

  const platform = process.platform;
  const kok = hedef.yollar[platform];
  if (!kok || !fs.existsSync(kok)) {
    throw new Error(`${hedef.ad} profili sistemde bulunamadı.`);
  }

  const toplanan = {
    tarayici: hedef.ad,
    yerImleri: [],
    gecmis: [],
    indirmeler: [],
    parolalar: [],
    parolaAtlanan: 0
  };

  const gorulenYerImi = new Set();
  const gorulenGecmis = new Set();

  if (hedef.tur.startsWith('chromium')) {
    const profiller = chromiumProfilDizinleri(kok, hedef.tur);
    for (const p of profiller) {
      if (yerImleri) {
        const bmDosya = path.join(p, 'Bookmarks');
        if (fs.existsSync(bmDosya)) {
          try {
            const ham = fs.readFileSync(bmDosya, 'utf8');
            const liste = chromiumYerImleriAyristir(ham);
            for (const item of liste) {
              if (!gorulenYerImi.has(item.url)) {
                gorulenYerImi.add(item.url);
                toplanan.yerImleri.push(item);
              }
            }
          } catch {
            // Profilde yer imi okunamadı
          }
        }
      }

      if (indirmeler) {
        const histDosya = path.join(p, 'History');
        if (fs.existsSync(histDosya)) toplanan.indirmeler.push(...chromiumIndirmeAyristir(histDosya));
      }

      if (parolalar) {
        const r = chromiumParolaAyristir(kok, p);
        toplanan.parolalar.push(...r.liste);
        toplanan.parolaAtlanan += r.atlanan;
      }

      if (gecmis) {
        const histDosya = path.join(p, 'History');
        if (fs.existsSync(histDosya)) {
          const liste = chromiumGecmisAyristir(histDosya);
          for (const item of liste) {
            if (!gorulenGecmis.has(item.url)) {
              gorulenGecmis.add(item.url);
              toplanan.gecmis.push(item);
            }
          }
        }
      }
    }
  } else if (hedef.tur === 'gecko') {
    const profiller = geckoProfilDizinleri(kok);
    for (const p of profiller) {
      const places = path.join(p, 'places.sqlite');
      if (fs.existsSync(places)) {
        const veri = geckoVerileriniAyristir(places, { yerImleriAl: yerImleri, gecmisAl: gecmis });
        for (const item of veri.yerImleri) {
          if (!gorulenYerImi.has(item.url)) {
            gorulenYerImi.add(item.url);
            toplanan.yerImleri.push(item);
          }
        }
        for (const item of veri.gecmis) {
          if (!gorulenGecmis.has(item.url)) {
            gorulenGecmis.add(item.url);
            toplanan.gecmis.push(item);
          }
        }
      }
    }
  }

  return toplanan;
}

const { protonGecisCoz } = require('./proton-gecis');

/* ---------------- Proton Pass (dosyadan) ---------------- */

/** RFC 4180 CSV: tırnaklı alan, "" kaçışı, alan içi satır sonu. */
function csvAyristir(metin) {
  const satirlar = [];
  let satir = [], alan = '', tirnak = false;
  const s = String(metin || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (tirnak) {
      if (c === '"') { if (s[i + 1] === '"') { alan += '"'; i++; } else tirnak = false; }
      else alan += c;
    } else if (c === '"') tirnak = true;
    else if (c === ',') { satir.push(alan); alan = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      satir.push(alan); alan = '';
      if (satir.some((x) => x !== '')) satirlar.push(satir);
      satir = [];
    } else alan += c;
  }
  satir.push(alan);
  if (satir.some((x) => x !== '')) satirlar.push(satir);
  return satirlar;
}

/**
 * Proton Pass dışa aktarımı (şifrelenmemiş CSV ya da JSON). Yalnız giriş (login)
 * kayıtları alınır. Geçiş anahtarları yalnız JSON'da vardır (src/proton-gecis.js);
 * CSV'de bulunmaz.
 * @returns {{ parolalar: object[], atlanan: number, gecis: object[], gecisAtlanan: number }}
 */
function protonPassAyristir(metin) {
  const parolalar = [];
  const gecis = [];
  let atlanan = 0, gecisAtlanan = 0;
  const ekle = (url, kullanici, parola) => {
    const origin = guvenliUrl(url);
    if (!origin || !parola) { atlanan++; return; }
    parolalar.push({ origin, kullaniciAdi: String(kullanici || ''), parola: String(parola) });
  };
  const ham = String(metin || '').trim();
  if (!ham) return { parolalar, atlanan, gecis, gecisAtlanan };

  if (ham[0] === '{') {
    let j;
    try { j = JSON.parse(ham); } catch { throw new Error('Geçersiz Proton Pass JSON dosyası'); }
    if (j.encrypted === true) throw new Error('Dosya şifreli (PGP). Şifrelenmemiş JSON ya da CSV dışa aktarın.');
    for (const kasa of Object.values(j.vaults || {})) {
      for (const oge of (kasa && kasa.items) || []) {
        const d = oge && oge.data;
        if (!d || d.type !== 'login') continue;
        const c = d.content || {};
        const gecisler = Array.isArray(c.passkeys) ? c.passkeys : [];
        for (const g of gecisler) {
          const kayit = protonGecisCoz(g);
          if (kayit) gecis.push(kayit); else gecisAtlanan++;
        }
        // Yalnız geçiş anahtarı olan kayıtta parola boştur; bu "atlanan" sayılmaz.
        if (!c.password && gecisler.length) continue;
        const urller = Array.isArray(c.urls) && c.urls.length ? c.urls : [''];
        ekle(urller[0], c.itemUsername || c.itemEmail, c.password);
      }
    }
    return { parolalar, atlanan, gecis, gecisAtlanan };
  }

  const [baslik, ...satirlar] = csvAyristir(ham);
  if (!baslik) return { parolalar, atlanan, gecis, gecisAtlanan };
  const sutun = (ad) => baslik.findIndex((b) => b.trim().toLowerCase() === ad);
  const [iTur, iUrl, iEposta, iKullanici, iParola] =
    ['type', 'url', 'email', 'username', 'password'].map(sutun);
  if (iUrl < 0 || iParola < 0) throw new Error('Proton Pass CSV başlıkları tanınmadı');
  for (const s of satirlar) {
    if (iTur >= 0 && s[iTur] && s[iTur].trim().toLowerCase() !== 'login') continue;
    ekle(s[iUrl], (iKullanici >= 0 && s[iKullanici]) || (iEposta >= 0 && s[iEposta]) || '', s[iParola]);
  }
  return { parolalar, atlanan, gecis, gecisAtlanan };
}

module.exports = {
  protonPassAyristir,
  csvAyristir,
  TARAYICILAR,
  kuruluTarayicilariBul,
  chromiumYerImleriAyristir,
  htmlYerImleriAyristir,
  chromiumGecmisAyristir,
  chromiumIndirmeAyristir,
  chromiumParolaAyristir,
  geckoVerileriniAyristir,
  tarayicidanCek
};
