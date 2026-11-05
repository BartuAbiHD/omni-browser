'use strict';

/**
 * Gerçek Electron: PreMiD tarzı eklentinin içerik betiği dünyasında eval köprüsü
 * (src/eklenti-eval-onyukleme.js).
 *  - "Presence" imzalı eklenti: (0,eval)(kod) çalışır (Chrome userScripts dünyası gibi).
 *  - İmzasız başka eklenti: eval eklenti CSP'since engellenir (yamalanmaz).
 *  - Sayfanın kendi (ana) dünyası, köprü kanalını bilemez: kod çalıştıramaz.
 *
 * Çalıştırma: electron test/electron-eklenti-eval.js
 */
const { app, session, BrowserWindow, ipcMain } = require('electron');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-eval-'));
app.setPath('userData', path.join(tmp, 'userData'));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

function eklentiYaz(ad, betik) {
  const k = path.join(tmp, ad);
  fs.mkdirSync(k);
  fs.writeFileSync(path.join(k, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: ad, version: '1',
    content_scripts: [{ matches: ['<all_urls>'], js: ['b.js'], run_at: 'document_start' }]
  }));
  fs.writeFileSync(path.join(k, 'b.js'), betik);
  return k;
}

// Eklenti betiği: bir süre sonra eval ile DOM'a işaret koyar; sonucu özniteliğe yazar.
const EVAL_DENE = (anahtar) => `
  setTimeout(function () {
    var root = document.documentElement;
    try {
      (0, eval)("document.documentElement.setAttribute('data-${anahtar}', 'calisti')");
      root.setAttribute('data-${anahtar}-hata', 'yok');
    } catch (e) { root.setAttribute('data-${anahtar}-hata', String(e.message).slice(0, 25)); }
    // eval senkron mu? Çağrıdan hemen sonra işaret var mı?
    root.setAttribute('data-${anahtar}-hemen', root.getAttribute('data-${anahtar}') || 'yok');
  }, 2500);
`;

const sunucu = http.createServer((q, r) => {
  r.setHeader('content-type', 'text/html');
  // Sayfanın ana dünyası: bilinmeyen kanal adlarına kod göndermeyi dener.
  r.end('<title>t</title><script>' +
    'for (const ad of ["__cvs_eval","cvs-eval","eval","__cvs_eval_0"]) {' +
    'document.dispatchEvent(new CustomEvent(ad,{detail:{id:1048576,kod:"document.documentElement.setAttribute(\'data-sayfa\',\'ele-gecirildi\')"}}));}' +
    '</script>');
}).listen(0);

// Ana sürecin işi: userScripts izinli eklenti kimliklerini verir.
let izinliKimlikler = [];
ipcMain.on('cvs:eval-kopru', (e) => { e.returnValue = { kimlikler: izinliKimlikler, dunyaSayisi: 2 }; });

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:eval-deneme');
  ses.registerPreloadScript({ type: 'frame', id: 'eval', filePath: path.join(__dirname, '..', 'src', 'eklenti-eval-onyukleme.js') });

  try {
    // Sıra önemli: ilk yüklenen eklenti ilk dünyayı (1<<20) alır.
    await ses.extensions.loadExtension(eklentiYaz('baska', EVAL_DENE('baska')));
    const presenceExt = await ses.extensions.loadExtension(eklentiYaz('presence', EVAL_DENE('presence')));
    izinliKimlikler = [presenceExt.id];

    await bekle(1500); // eklentiler içerik betiği kaydını bitirsin
    const w = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } });
    await w.loadURL('http://localhost:' + sunucu.address().port + '/');
    const oku = (a) => w.webContents.executeJavaScript('document.documentElement.getAttribute(' + JSON.stringify(a) + ')');
    // Her iki eklenti de eval denemesini bitirene kadar bekle (en çok 20 sn).
    for (let i = 0; i < 100; i++) {
      if ((await oku('data-presence-hemen')) && (await oku('data-baska-hemen'))) break;
      await bekle(200);
    }

    bak('Presence imzalı eklenti: eval çalıştı', await oku('data-presence'), 'calisti');
    bak('Presence imzalı eklenti: eval hata atmadı', await oku('data-presence-hata'), 'yok');
    bak('imzasız eklenti: eval çalışmadı', await oku('data-baska'), null);
    bak('imzasız eklenti: eval CSP ile engellendi', String(await oku('data-baska-hata')).startsWith('Evaluating a string'), true);
    bak('sayfa ana dünyası köprüyü tetikleyemedi', await oku('data-sayfa'), null);
    // Köprünün eval'i senkron: çağrıdan hemen sonra işaret konmuş olmalı (köprü bunu varsayar).
    bak('eval senkron çalışıyor', await oku('data-presence-hemen'), 'calisti');

    // Liste boşken köprü hiçbir şey yapmaz: eval engelli kalır, dünya yaratılmaz.
    izinliKimlikler = [];
    const w2 = w; // aynı pencere, yeni belge (yeni içerik dünyaları)
    await w2.loadURL('http://localhost:' + sunucu.address().port + '/?bos');
    const oku2 = (a) => w2.webContents.executeJavaScript('document.documentElement.getAttribute(' + JSON.stringify(a) + ')');
    for (let i = 0; i < 100; i++) {
      if ((await oku2('data-presence-hemen')) && (await oku2('data-baska-hemen'))) break;
      await bekle(200);
    }
    bak('izinli liste boşken: eval engelli', String(await oku2('data-presence-hata')).startsWith('Evaluating a string'), true);
    w.destroy();
  } catch (e) {
    hata++;
    sonuc.push('  HATA beklenmeyen: ' + (e && e.stack || e));
  }

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' eval köprüsü testi başarısız.' : '\n✓ eklenti eval köprüsü testlerinin hepsi geçti.');
  try { sunucu.close(); fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temizlik */ }
  app.exit(hata ? 1 : 0);
});
