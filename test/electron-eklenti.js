'use strict';

/*
 * EKLENTİLER GERÇEK ELECTRON'DA ÇALIŞIYOR MU?
 *
 * Birim testi sahte oturumla yönetici akışını sınıyor; burada gerçek
 * session.extensions kullanılıyor:
 *   - klasörden kurulum -> içerik betiği gerçek bir sayfaya enjekte oluyor mu
 *   - CRX3 kurulumu -> manifest.key sayesinde kimlik anahtardan türeyen kimlikle
 *     BİREBİR aynı mı (Web Store kimliği korunuyor mu)
 *   - popup sayfası chrome.runtime / chrome.storage görüyor mu
 *   - pasifleştirme ve kaldırma gerçekten boşaltıyor mu
 *
 * Çalıştırma: electron test/electron-eklenti.js
 */

const { app, session, BrowserWindow } = require('electron');
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { zipYap, crx3 } = require('./yardimci-crx');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-eklenti-e2e-'));
app.setPath('userData', path.join(tmp, 'userData'));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const MANIFEST = {
  manifest_version: 3,
  name: 'CVS Test Eklentisi',
  version: '1.0.0',
  action: { default_popup: 'popup.html' },
  options_page: 'options.html',
  permissions: ['storage'],
  content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['icerik.js'], run_at: 'document_start' }]
};
const DOSYALAR = {
  'manifest.json': JSON.stringify(MANIFEST),
  'icerik.js': "document.documentElement.dataset.cvsEkl = 'calisti';",
  'popup.html': '<!doctype html><meta charset="utf-8"><title>x</title><script src="popup.js"></script>',
  'popup.js': "document.title = typeof chrome.runtime.id + ':' + typeof chrome.storage.local;",
  'options.html': '<!doctype html><title>o</title>'
};

app.whenReady().then(async () => {
  const sunucu = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>t</title><p>x</p>'); });
  await new Promise((c) => sunucu.listen(0, '127.0.0.1', c));
  const port = sunucu.address().port;

  const { EklentiYoneticisi } = require('../src/eklentiler');
  const ses = session.fromPartition('persist:eklenti-test');
  const store = { veri: { eklentiler: {} }, kaydet() {} };
  const y = new EklentiYoneticisi({
    ses, store, dizin: path.join(tmp, 'eklentiler'), indir: async () => { throw new Error('ağ yok'); }, dil: 'tr'
  });
  fs.mkdirSync(y.dizin, { recursive: true });

  const pencere = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } });

  async function sayfaDeneme() {
    await pencere.loadURL('http://127.0.0.1:' + port + '/');
    await bekle(300);
    return pencere.webContents.executeJavaScript("document.documentElement.dataset.cvsEkl || ''");
  }
  async function popupBasligi(id) {
    const p = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true } });
    try {
      await p.loadURL('chrome-extension://' + id + '/popup.html');
      await bekle(400);
      return p.webContents.getTitle();
    } finally { p.destroy(); }
  }

  try {
    /* ---- 1. klasörden kurulum ---- */
    const klasor = path.join(tmp, 'ham');
    fs.mkdirSync(klasor);
    for (const [ad, i] of Object.entries(DOSYALAR)) fs.writeFileSync(path.join(klasor, ad), i);

    const hazir = y.hazirlaDosya(klasor);
    bak('klasör: ad okundu', hazir.ad, 'CVS Test Eklentisi');
    bak('klasör: izinler', hazir.izinler, ['storage']);
    const id1 = await y.tamamla(hazir, 'dosya');
    bak('klasör: yüklendi', ses.extensions.getAllExtensions().some((e) => e.id === id1), true);
    bak('klasör: içerik betiği çalıştı', await sayfaDeneme(), 'calisti');
    bak('klasör: popup chrome.runtime/storage görüyor', await popupBasligi(id1), 'string:object');
    bak('klasör: liste popup', y.liste()[0].popup, 'popup.html');
    bak('klasör: liste seçenekler', y.liste()[0].secenekler, 'options.html');

    /* ---- 2. pasif / aktif ---- */
    await y.etkinYap(id1, false);
    bak('pasif: boşaltıldı', ses.extensions.getAllExtensions().some((e) => e.id === id1), false);
    bak('pasif: içerik betiği artık çalışmıyor', await sayfaDeneme(), '');
    await y.etkinYap(id1, true);
    bak('tekrar etkin: içerik betiği döndü', await sayfaDeneme(), 'calisti');

    /* ---- 3. kaldır ---- */
    await y.kaldir(id1);
    bak('kaldır: boşaltıldı', ses.extensions.getAllExtensions().some((e) => e.id === id1), false);
    bak('kaldır: kayıt silindi', y.kurulu(id1), false);
    bak('kaldır: kullanıcının klasörüne dokunulmadı', fs.existsSync(path.join(klasor, 'manifest.json')), true);

    /* ---- 4. CRX3 (Web Store biçimi): kimlik anahtardan korunuyor mu ---- */
    const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const der = publicKey.export({ type: 'spki', format: 'der' });
    const { acikAnahtardanKimlik } = require('../src/eklentiler');
    const beklenen = acikAnahtardanKimlik(der);
    const zip = zipYap({ ...DOSYALAR, '_metadata/verified_contents.json': '{}' });
    const y2 = new EklentiYoneticisi({
      ses, store: { veri: { eklentiler: {} }, kaydet() {} }, dizin: path.join(tmp, 'eklentiler2'),
      indir: async () => crx3(zip, der), dil: 'tr'
    });
    fs.mkdirSync(y2.dizin, { recursive: true });
    const h2 = await y2.hazirlaMagaza(beklenen);
    const id2 = await y2.tamamla(h2, 'magaza');
    bak('crx3: kimlik Web Store kimliğiyle aynı', id2, beklenen);
    bak('crx3: yüklendi', ses.extensions.getAllExtensions().some((e) => e.id === beklenen), true);
    bak('crx3: içerik betiği çalıştı', await sayfaDeneme(), 'calisti');
    bak('crx3: _metadata atlandı', fs.existsSync(path.join(y2.dizinOf(beklenen), '_metadata')), false);
    await y2.kaldir(id2);
    bak('crx3: kaldırıldı', fs.existsSync(y2.dizinOf(beklenen)), false);
  } catch (e) {
    hata++;
    sonuc.push('  HATA beklenmeyen: ' + (e && e.stack || e));
  }

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' eklenti e2e testi başarısız.' : '\n✓ eklenti e2e testlerinin hepsi geçti.');
  sunucu.close();
  pencere.destroy();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temizlik */ }
  app.exit(hata ? 1 : 0);
});
