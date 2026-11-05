'use strict';

/*
 * chrome.cookies VE chrome.downloads GERÇEK UYGULAMADA, GERÇEK BİR EKLENTİ SERVİS ÇALIŞANINDA
 * ÇALIŞIYOR MU?
 *
 * Uygulama ayrı profille başlatılıyor; profile kurulu bir eklenti yazılıyor. Eklentinin servis
 * çalışanı açılışta cookies/downloads API'lerini çağırıp sonucu yerel sunucuya raporluyor.
 * Ölçülenler: çerez yaz/oku/olay, host izni dışı reddi, izin vermeyen eklentinin reddi, dosya
 * indirme (ayarlı klasöre, alt dizinle) ve chrome.downloads.search.
 */

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { acikAnahtardanKimlik } = require('../src/eklentiler');

const KOK = path.join(__dirname, '..');
const PORT = 9437;
const DBG = 9438;
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-api-'));
const indirmeKlasoru = path.join(profil, 'indirilenler');
fs.mkdirSync(indirmeKlasoru);

function eklentiYaz(ad, izinler, sw, ekDosyalar = {}) {
  const dir = path.join(profil, 'ham-' + ad);
  fs.mkdirSync(dir);
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'Api ' + ad, version: '1.0', key: der.toString('base64'),
    background: { service_worker: 'sw.js' }, options_page: 'o.html',
    permissions: izinler, host_permissions: ['http://127.0.0.1/*']
  }));
  fs.writeFileSync(path.join(dir, 'sw.js'), sw);
  fs.writeFileSync(path.join(dir, 'o.html'), '<!doctype html><title>o</title><script src="o.js"></script>');
  fs.writeFileSync(path.join(dir, 'o.js'), ekDosyalar['o.js'] || '');
  return { kimlik: acikAnahtardanKimlik(der), dir };
}

const BASE = 'http://127.0.0.1:' + PORT;
const RAPOR = `
  async function rapor(ad, r) { try { await fetch('${BASE}/rapor?ad=' + ad + '&veri=' + encodeURIComponent(JSON.stringify(r))); } catch (e) {} }
`;

// İzinli eklenti: cookies + downloads
const izinli = eklentiYaz('izinli', ['cookies', 'downloads'], RAPOR + `
  (async () => {
    const r = {};
    chrome.cookies.onChanged.addListener((d) => { r.olay = d.cookie.name + ':' + d.removed; });
    try {
      await chrome.cookies.set({ url: '${BASE}/', name: 'ek', value: 'merhaba' });
      const tum = await chrome.cookies.getAll({ url: '${BASE}/' });
      r.cerez = tum.map((c) => c.name + '=' + c.value).join(',');
      const bir = await chrome.cookies.get({ url: '${BASE}/', name: 'ek' });
      r.get = bir && bir.value;
    } catch (e) { r.cerezHata = e.message; }
    try { await chrome.cookies.getAll({ url: 'http://example.invalid/' }); r.dis = 'izin verildi'; }
    catch (e) { r.dis = e.message; }
    // callback tarzı
    await new Promise((c) => chrome.cookies.getAllCookieStores((s) => { r.magaza = s && s[0] && s[0].id; c(); }));
    try {
      const id = await chrome.downloads.download({ url: '${BASE}/dosya', filename: 'alt/ek.txt' });
      r.indirmeId = typeof id;
      for (let i = 0; i < 20; i++) {
        const [o] = await chrome.downloads.search({ id });
        if (o && o.state === 'complete') { r.durum = 'complete'; r.dosya = o.filename.replace(/\\\\/g, '/').split('/').slice(-2).join('/'); break; }
        await new Promise((c) => setTimeout(c, 250));
      }
    } catch (e) { r.indirmeHata = e.message; }
    try { await chrome.downloads.download({ url: 'file:///c:/windows/win.ini' }); r.dosyaUrl = 'izin verildi'; }
    catch (e) { r.dosyaUrl = 'reddedildi'; }
    await rapor('izinli', r);
  })();
`, {
  // Seçenekler SAYFASI (servis çalışanı değil): ana süreç köprüsüne gönderen çerçevenin adresiyle ulaşır.
  'o.js': `
    (async () => {
      const r = {};
      chrome.cookies.getAll({ url: '${BASE}/' }, (l) => { r.cb = (l || []).map((c) => c.name).join(','); });
      try { r.cerez = (await chrome.cookies.getAll({ url: '${BASE}/' })).map((c) => c.name).join(','); } catch (e) { r.hata = e.message; }
      try { await chrome.cookies.getAll({ url: 'http://example.invalid/' }); r.dis = 'izin verildi'; } catch (e) { r.dis = /host izni/.test(e.message) ? 'reddedildi' : e.message; }
      await new Promise((c) => setTimeout(c, 300));
      await fetch('${BASE}/rapor?ad=sayfa&veri=' + encodeURIComponent(JSON.stringify(r)));
    })();
  `
});

// İzinsiz eklenti: yalnızca storage
const izinsiz = eklentiYaz('izinsiz', ['storage'], RAPOR + `
  (async () => {
    const r = {};
    r.cerezNs = typeof chrome.cookies.getAll;
    try { await chrome.cookies.getAll({ url: '${BASE}/' }); r.cerez = 'izin verildi'; } catch (e) { r.cerez = e.message; }
    try { await chrome.downloads.download({ url: '${BASE}/dosya' }); r.indirme = 'izin verildi'; } catch (e) { r.indirme = e.message; }
    await rapor('izinsiz', r);
  })();
`);

const kurulu = {};
for (const e of [izinli, izinsiz]) kurulu[e.kimlik] = { yol: e.dir, etkin: true, sabit: false, kaynak: 'dosya' };
fs.writeFileSync(path.join(profil, 'pusula-veri.json'), JSON.stringify({ eklentiler: kurulu, ayarlar: { indirmeKlasoru: indirmeKlasoru } }));

const raporlar = {};
const sunucu = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/rapor') {
    try { raporlar[u.searchParams.get('ad')] = JSON.parse(u.searchParams.get('veri')); } catch { /* bozuk */ }
    r.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    return r.end('ok');
  }
  if (u.pathname === '/dosya') {
    r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="x.txt"' });
    return r.end('eklenti indirdi');
  }
  r.writeHead(200, { 'Content-Type': 'text/html' });
  r.end('<!doctype html><title>t</title>');
});

(async () => {
  await new Promise((c) => sunucu.listen(PORT, '127.0.0.1', c));
  const electron = require('electron');
  const cocuk = spawn(electron, ['.', 'about:blank', '--user-data-dir=' + profil, '--remote-debugging-port=' + DBG], { cwd: KOK, stdio: ['ignore', 'pipe', 'pipe'] });
  const cikti = [];
  cocuk.stdout.on('data', (d) => cikti.push(String(d)));
  cocuk.stderr.on('data', (d) => cikti.push(String(d)));

  for (let i = 0; i < 60 && !(raporlar.izinli && raporlar.izinsiz); i++) await bekle(500);
  // Seçenekler sayfasını arayüzden aç (window.pusula.eklentiSecenekler) ve raporunu bekle.
  try {
    let ui = null;
    for (let k = 0; k < 30 && !ui; k++) {
      try { ui = (await (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json()).find((t) => /index[.]html/.test(t.url)); } catch { /* henüz yok */ }
      if (!ui) await bekle(400);
    }
    await new Promise((coz, red) => {
      const ws = new WebSocket(ui.webSocketDebuggerUrl);
      ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: "window.pusula.eklentiSecenekler('" + izinli.kimlik + "')", awaitPromise: true } }));
      ws.onmessage = (o) => { if (JSON.parse(o.data).id === 1) { ws.close(); coz(); } };
      ws.onerror = () => red(new Error('ws'));
    });
    for (let k = 0; k < 30 && !raporlar.sayfa; k++) await bekle(400);
  } catch (e) { sonuc.push('  HATA seçenekler sayfası açılamadı: ' + e.message); hata++; }
  const s = raporlar.sayfa || {};
  const i = raporlar.izinli || {};
  const z = raporlar.izinsiz || {};

  bak('izinli: çerez hatasız', i.cerezHata, undefined);
  bak('izinli: çerez yazıldı ve getAll okudu', i.cerez, 'ek=merhaba');
  bak('izinli: cookies.get', i.get, 'merhaba');
  bak('izinli: onChanged olayı servis çalışanına ulaştı', typeof i.olay === 'string' && i.olay.startsWith('ek:'), true);
  bak('izinli: host izni dışı adres reddedildi', /host izni/.test(i.dis || ''), true);
  bak('izinli: callback tarzı çağrı çalıştı', i.magaza, '0');
  bak('izinli: downloads.download id döndü', i.indirmeId, 'number');
  bak('izinli: indirme tamamlandı (search)', i.durum, 'complete');
  bak('izinli: alt dizinli dosya adı', i.dosya, 'alt/ek.txt');
  const hedef = path.join(indirmeKlasoru, 'alt', 'ek.txt');
  bak('izinli: dosya ayarlı klasörde', fs.existsSync(hedef) && fs.readFileSync(hedef, 'utf8'), 'eklenti indirdi');
  bak('izinli: file: adresi reddedildi', i.dosyaUrl, 'reddedildi');

  bak('sayfa: cookies.getAll Promise tarzı', s.cerez, 'ek');
  bak('sayfa: cookies.getAll callback tarzı', s.cb, 'ek');
  bak('sayfa: host izni dışı adres reddedildi', s.dis, 'reddedildi');
  bak('izinsiz: cookies ad alanı var', z.cerezNs, 'function');
  bak('izinsiz: cookies izni yok -> reddedildi', /izni/.test(z.cerez || ''), true);
  bak('izinsiz: downloads izni yok -> reddedildi', /izni/.test(z.indirme || ''), true);

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' eklenti api e2e testi başarısız.' : '\n✓ eklenti api e2e testlerinin hepsi geçti.');
  if (hata) console.log(cikti.join('').split('\n').filter((s) => /Message:|Error/.test(s)).slice(0, 15).join('\n'));
  try { cocuk.kill(); } catch { /* kapandı */ }
  await bekle(800);
  sunucu.close();
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch { /* Windows kilidi */ }
  process.exit(hata ? 1 : 0);
})();
