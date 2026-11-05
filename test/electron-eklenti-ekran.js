'use strict';

/*
 * chrome.tabCapture (SEKME SESİ) GERÇEK UYGULAMADA.
 *
 * Shazam gibi eklentiler açılır pencerelerinden chrome.tabCapture.capture({audio:true}) çağırıp
 * çalan sesi dinliyor; Electron'da bu API yoktu ("Cannot read properties of undefined (reading
 * 'capture')") ve şarkı hiç bulunamıyordu.
 *
 * Etkin sekmede gerçek bir ses (440 Hz ton) çalınıyor, eklentinin popup sayfası capture çağırıyor
 * ve yakalanan akışın GERÇEKTEN ses taşıdığı (RMS) ölçülüyor. Ayrıca MV3 yolu
 * (getMediaStreamId + getUserMedia chromeMediaSource:'tab') ve iç sayfa reddi sınanıyor.
 */

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { acikAnahtardanKimlik } = require('../src/eklentiler');

const KOK = path.join(__dirname, '..');
const PORT = 9441;
const DBG = 9442;
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-ekran-'));
const dir = path.join(profil, 'ham');
fs.mkdirSync(dir);
const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = publicKey.export({ type: 'spki', format: 'der' });
const KIMLIK = acikAnahtardanKimlik(der);
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Ekran Deneme', version: '1.0', key: der.toString('base64'),
  background: { service_worker: 'sw.js' }, action: { default_popup: 'p.html' }, permissions: ['tabCapture']
}));
fs.writeFileSync(path.join(dir, 'sw.js'), '');
fs.writeFileSync(path.join(dir, 'p.html'), '<!doctype html><title>p</title><body style="width:200px;height:100px">x');
fs.writeFileSync(path.join(profil, 'pusula-veri.json'), JSON.stringify({
  eklentiler: { [KIMLIK]: { yol: dir, etkin: true, sabit: true, kaynak: 'klasor' } }
}));

const sunucu = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>Ton</title><p>ses</p>'); });

const liste = async () => (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json();
async function hedef(re, n = 40) {
  for (let i = 0; i < n; i++) {
    try { const t = (await liste()).find((x) => re.test(x.url)); if (t) return t; } catch { /* henüz yok */ }
    await bekle(400);
  }
  return null;
}
function cdp(wsUrl, yontem, params) {
  return new Promise((coz, red) => {
    const ws = new WebSocket(wsUrl);
    const z = setTimeout(() => { try { ws.close(); } catch { /* kapalı */ } red(new Error('CDP zaman aşımı')); }, 30000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: yontem, params }));
    ws.onmessage = (o) => { const v = JSON.parse(o.data); if (v.id === 1) { clearTimeout(z); ws.close(); v.error ? red(new Error(JSON.stringify(v.error))) : coz(v.result); } };
    ws.onerror = () => { clearTimeout(z); red(new Error('ws')); };
  });
}
const degerle = (hedefNesne, ifade, jest = true) => cdp(hedefNesne.webSocketDebuggerUrl, 'Runtime.evaluate',
  { expression: ifade, returnByValue: true, awaitPromise: true, userGesture: jest }).then((r) => (r.exceptionDetails ? { istisna: JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description) } : r.result.value));

// Akıştan RMS ölçen ortak betik gövdesi (popup sayfasında çalışır). Zaman aşımı korumalı.
let popup = null;
let ui = null;
async function popupAc() {
  await degerle(ui, "document.querySelector('#eklentiSabit button').click(); 1", false);
  popup = await hedef(new RegExp('chrome-extension://' + KIMLIK + '/p[.]html'));
  await bekle(800);
}
async function pDegerle(ifade) {
  for (let deneme = 0; deneme < 3; deneme++) {
    try { return await degerle(popup, ifade); }
    catch (e) { if (deneme === 2) throw e; await popupAc(); }
  }
  return undefined;
}

const OLC = `(akis, bitti) => {
  const ac = new AudioContext(); const kaynak = ac.createMediaStreamSource(akis); const an = ac.createAnalyser(); an.fftSize = 2048;
  kaynak.connect(an);
  setTimeout(() => { const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v;
    bitti({ rms: Math.sqrt(s / b.length), turler: akis.getTracks().map((t) => t.kind).sort() }); }, 1500);
}`;
const SARMAL = (govde) => 'new Promise((coz) => { setTimeout(() => coz({ zaman: true }), 12000); ' + govde + ' })';

(async () => {
  await new Promise((c) => sunucu.listen(PORT, '127.0.0.1', c));
  const electron = require('electron');
  const cocuk = spawn(electron, ['.', 'http://127.0.0.1:' + PORT + '/', '--user-data-dir=' + profil, '--remote-debugging-port=' + DBG], { cwd: KOK, stdio: 'ignore' });

  try {
    const sayfa = await hedef(/127[.]0[.]0[.]1:9441/);
    ui = await hedef(/index[.]html/);
    await bekle(2500);

    // 1) Etkin sekmede gerçek ses: 440 Hz, genlik 0.3
    await degerle(sayfa, "window.__ctx = new AudioContext(); const o = __ctx.createOscillator(); o.frequency.value = 440; const g = __ctx.createGain(); g.gain.value = 0.3; o.connect(g).connect(__ctx.destination); o.start(); __ctx.resume().then(() => __ctx.state)");

    // 2) Açılır pencereyi aç (sabitlenmiş düğme)
    await degerle(ui, "document.querySelector('#eklentiSabit button').click(); 1", false);
    await popupAc();
    bak('popup açıldı', !!popup, true);
    bak('chrome.tabCapture tanımlı', await pDegerle("typeof chrome.tabCapture.capture"), 'function');

    // 3) Klasik yol: capture(callback) -> akış gerçekten ses taşıyor mu
    const o1 = await pDegerle(SARMAL('chrome.tabCapture.capture({ audio: true }, (akis) => { if (!akis) return coz({ hata: chrome.runtime.lastError && chrome.runtime.lastError.message }); (' + OLC + ')(akis, coz); });'));
    bak('capture: akış geldi', !!(o1 && !o1.hata && !o1.zaman && !o1.istisna), true);
    bak('capture: yalnızca ses izi', o1 && o1.turler, ['audio']);
    bak('capture: gerçek ses yakalandı (RMS > 0.005)', !!(o1 && o1.rms > 0.005), true);

    // 4) MV3 yolu: getMediaStreamId + getUserMedia({chromeMediaSource:'tab'})
    const o2 = await pDegerle(SARMAL("chrome.tabCapture.getMediaStreamId({}, (id) => { navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: id } } }).then((akis) => (" + OLC + ")(akis, coz), (e) => coz({ hata: e.message })); });"));
    bak('getUserMedia(tab): gerçek ses yakalandı', !!(o2 && o2.rms > 0.005), true);

    // 5) Onaysız getDisplayMedia (eklenti sayfası kendi başına ekran isterse) reddedilmeli
    const o3 = await pDegerle(`navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(() => 'verildi', (e) => 'reddedildi')`);
    bak('izinsiz getDisplayMedia reddedildi', o3, 'reddedildi');

    // 6) İç sayfa etkinken yakalama reddedilir (omni://extensions)
    await degerle(ui, "window.pusula.dahiliSayfaAc('eklentiler'); 1", false);
    await bekle(1200);
    const o4 = await pDegerle(`new Promise((coz) => chrome.tabCapture.capture({ audio: true }, (akis) => coz(akis ? 'verildi' : (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'null')))`);
    bak('iç sayfada yakalama reddedildi', /yakalanamıyor|iç sayfa/i.test(String(o4)), true);
  } catch (e) {
    hata++;
    sonuc.push('  HATA beklenmeyen: ' + (e && e.stack || e));
  }

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' sekme sesi testi başarısız.' : '\n✓ sekme sesi testlerinin hepsi geçti.');
  try { cocuk.kill(); } catch { /* kapandı */ }
  await bekle(800);
  sunucu.close();
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch { /* Windows kilidi */ }
  process.exit(hata ? 1 : 0);
})();
