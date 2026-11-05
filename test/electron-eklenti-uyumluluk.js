'use strict';

/*
 * EKLENTİ UYUMLULUK KATMANI GERÇEK ELECTRON'DA ÇALIŞIYOR MU?
 *
 * Electron chrome.storage.sync, chrome.history, chrome.history... uygulamıyor. Yaygın
 * eklentiler (ör. Return YouTube Dislike) bu yüzden ayarlarını yükleyemiyor ya da arka plan
 * betiği açılışta çöküyor. src/eklenti-uyumluluk-onyukleme.js bunu hem servis çalışanında
 * hem eklenti sayfalarında yamıyor; burada ikisi de gerçek bir eklentiyle ölçülüyor.
 *
 * Çalıştırma: electron test/electron-eklenti-uyumluluk.js
 */

const { app, session, BrowserWindow } = require('electron');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-uyum-'));
app.setPath('userData', path.join(tmp, 'userData'));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const DOSYALAR = {
  'manifest.json': JSON.stringify({
    manifest_version: 3, name: 'Uyumluluk Deneme', version: '1.0',
    background: { service_worker: 'sw.js' }, action: { default_popup: 'popup.html' }, permissions: ['storage']
  }),
  // Servis çalışanı: sync yazıp okur; history olayına dinleyici ekler (yamasız çöker).
  'sw.js': `
    chrome.history.onVisited.addListener(function () {});
    chrome.storage.sync.set({ a: 1 }, function () {
      chrome.storage.sync.get('a', function (r) {
        chrome.storage.local.set({ swSonuc: JSON.stringify(r) + (chrome.runtime.lastError ? ' HATA' : '') });
      });
    });
    chrome.storage.local.set({ swBasladi: true });
  `,
  'popup.html': '<!doctype html><title>x</title><script src="popup.js"></script>',
  // Sayfa: sync ve desteklenmeyen API'nin davranışı
  'popup.js': `
    chrome.storage.sync.set({ b: 2 }, function () {
      chrome.storage.sync.get('b', function (r) {
        var cerez = typeof chrome.history.search;
        chrome.history.search({ text: "" }).then(function () { document.title = 'beklenmedik'; }, function (e) {
          document.title = JSON.stringify(r) + '|' + cerez + '|' + !!e.message;
        });
      });
    });
  `
};

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:eklenti-uyum');
  const yol = path.join(__dirname, '..', 'src', 'eklenti-uyumluluk-onyukleme.js');
  ses.registerPreloadScript({ type: 'service-worker', id: 'uyum-sw', filePath: yol });
  ses.registerPreloadScript({ type: 'frame', id: 'uyum-frame', filePath: yol });

  const klasor = path.join(tmp, 'ham');
  fs.mkdirSync(klasor);
  for (const [ad, i] of Object.entries(DOSYALAR)) fs.writeFileSync(path.join(klasor, ad), i);

  try {
    const ext = await ses.extensions.loadExtension(klasor);
    await bekle(1500);

    const p = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } });
    await p.loadURL('chrome-extension://' + ext.id + '/popup.html');
    await bekle(1000);
    bak('sayfa: sync çalışıyor, history izinsiz reddediliyor', p.webContents.getTitle(), '{"b":2}|function|true');

    // Servis çalışanının yazdığı sonuçları sayfadan oku (aynı depo).
    const sw = await p.webContents.executeJavaScript(
      'new Promise((c) => chrome.storage.local.get(["swBasladi","swSonuc"], c))');
    bak('servis çalışanı: history olay dinleyicisi çökmedi, betik çalıştı', sw && sw.swBasladi, true);
    bak('servis çalışanı: storage.sync yazıp okudu', sw && sw.swSonuc, '{"a":1}');
    p.destroy();
  } catch (e) {
    hata++;
    sonuc.push('  HATA beklenmeyen: ' + (e && e.stack || e));
  }

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' uyumluluk testi başarısız.' : '\n✓ eklenti uyumluluk testlerinin hepsi geçti.');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temizlik */ }
  app.exit(hata ? 1 : 0);
});
