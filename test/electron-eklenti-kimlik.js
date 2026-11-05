'use strict';

/*
 * chrome.identity.launchWebAuthFlow VE chrome.permissions GERÇEK UYGULAMADA.
 *
 * Return YouTube Dislike gibi eklentilerin "Giriş yap" düğmesi iki şeye dayanıyor: isteğe bağlı
 * 'identity' iznini chrome.permissions ile istemek ve OAuth için launchWebAuthFlow. İkisi de
 * Electron'da yoktu ("Login requires the 'identity' permission" uyarısı).
 *
 * Eklentinin servis çalışanı açılışta akışı yürütüyor; izin penceresini bu test onaylıyor
 * (katmana CDP ile "onayla" gönderiyor), yetkilendirme sunucusu yerel.
 */

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { acikAnahtardanKimlik } = require('../src/eklentiler');

const KOK = path.join(__dirname, '..');
const PORT = 9439;
const DBG = 9440;
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}

const BASE = 'http://127.0.0.1:' + PORT;
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-kimlik-'));
const dir = path.join(profil, 'ham');
fs.mkdirSync(dir);
const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = publicKey.export({ type: 'spki', format: 'der' });
const KIMLIK = acikAnahtardanKimlik(der);

fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Kimlik Deneme', version: '1.0', key: der.toString('base64'),
  background: { service_worker: 'sw.js' },
  permissions: ['storage'], optional_permissions: ['identity'], host_permissions: ['http://127.0.0.1/*']
}));
fs.writeFileSync(path.join(dir, 'sw.js'), `
  (async () => {
    const r = {};
    r.redirect = chrome.identity.getRedirectURL('cb');
    r.izinOnce = await chrome.permissions.contains({ permissions: ['identity'] });
    try { await chrome.identity.launchWebAuthFlow({ url: '${BASE}/auth', interactive: true }); r.izinsizAkis = 'izin verildi'; }
    catch (e) { r.izinsizAkis = e.message; }
    try { await chrome.permissions.request({ permissions: ['cookies'] }); r.zorunlu = 'izin verildi'; }
    catch (e) { r.zorunlu = e.message; }
    r.istek = await chrome.permissions.request({ permissions: ['identity'] });   // test onaylıyor
    r.izinSonra = await chrome.permissions.contains({ permissions: ['identity'] });
    r.getAll = (await chrome.permissions.getAll()).permissions.join(',');
    try {
      r.cevap = await chrome.identity.launchWebAuthFlow({
        url: '${BASE}/auth?redirect_uri=' + encodeURIComponent(r.redirect) + '&state=xyz', interactive: true
      });
    } catch (e) { r.akisHata = e.message; }
    // callback tarzı + yabancı yönlendirme adresine DÖNMEMELİ
    r.yabanci = await new Promise((c) => chrome.identity.launchWebAuthFlow(
      { url: '${BASE}/auth?redirect_uri=' + encodeURIComponent('https://baska.chromiumapp.org/x'), interactive: false },
      (u) => c(u ? 'dondu' : 'reddedildi')));
    r.kaldir = await chrome.permissions.remove({ permissions: ['identity'] });
    r.izinKaldirSonra = await chrome.permissions.contains({ permissions: ['identity'] });
    try { await fetch('${BASE}/rapor?veri=' + encodeURIComponent(JSON.stringify(r))); } catch (e) {}
  })();
`);
fs.writeFileSync(path.join(profil, 'pusula-veri.json'), JSON.stringify({
  eklentiler: { [KIMLIK]: { yol: dir, etkin: true, sabit: false, kaynak: 'dosya' } }
}));

let rapor = null;
const sunucu = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/rapor') {
    try { rapor = JSON.parse(u.searchParams.get('veri')); } catch { /* bozuk */ }
    r.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    return r.end('ok');
  }
  if (u.pathname === '/auth') {
    const hedef = u.searchParams.get('redirect_uri');
    if (hedef) {
      r.writeHead(302, { Location: hedef + (hedef.includes('?') ? '&' : '?') + 'code=abc&state=' + (u.searchParams.get('state') || '') });
      return r.end();
    }
  }
  r.writeHead(200, { 'Content-Type': 'text/html' });
  r.end('<!doctype html><title>Giris</title><p>Giris</p>');
});

async function hedefler() {
  return (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json();
}
function cdp(wsUrl, ifade) {
  return new Promise((coz, red) => {
    const ws = new WebSocket(wsUrl);
    const z = setTimeout(() => { try { ws.close(); } catch { /* kapalı */ } red(new Error('CDP zaman aşımı')); }, 15000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: ifade, returnByValue: true } }));
    ws.onmessage = (o) => { const v = JSON.parse(o.data); if (v.id === 1) { clearTimeout(z); ws.close(); coz(v.result && v.result.result && v.result.result.value); } };
    ws.onerror = () => { clearTimeout(z); red(new Error('ws')); };
  });
}

(async () => {
  await new Promise((c) => sunucu.listen(PORT, '127.0.0.1', c));
  const electron = require('electron');
  const cocuk = spawn(electron, ['.', 'about:blank', '--user-data-dir=' + profil, '--remote-debugging-port=' + DBG], { cwd: KOK, stdio: ['ignore', 'pipe', 'pipe'] });
  const cikti = [];
  cocuk.stdout.on('data', (d) => cikti.push(String(d)));
  cocuk.stderr.on('data', (d) => cikti.push(String(d)));

  // İzin penceresi açılınca onayla.
  let onaylandi = false;
  for (let i = 0; i < 80 && !rapor; i++) {
    await bekle(500);
    if (onaylandi) continue;
    try {
      const k = (await hedefler()).find((t) => /katman[.]html/.test(t.url));
      if (!k) continue;
      const metin = await cdp(k.webSocketDebuggerUrl, "document.getElementById('kutu').innerText");
      if (metin && /identity/.test(metin)) {
        bak('izin penceresi eklenti adını ve izni gösteriyor', /Kimlik Deneme/.test(metin), true);
        await cdp(k.webSocketDebuggerUrl, 'window.katman.onayKarar(true)');
        onaylandi = true;
      }
    } catch { /* henüz yok */ }
  }

  const r = rapor || {};
  bak('izin penceresi çıktı ve onaylandı', onaylandi, true);
  bak('getRedirectURL', r.redirect, 'https://' + KIMLIK + '.chromiumapp.org/cb');
  bak('başta identity izni yok', r.izinOnce, false);
  bak('izin yokken launchWebAuthFlow reddedildi', /izni/.test(r.izinsizAkis || ''), true);
  bak('isteğe bağlı olmayan izin istenemez', /isteğe bağlı/.test(r.zorunlu || ''), true);
  bak('permissions.request onay sonrası true', r.istek, true);
  bak('onay sonrası contains true', r.izinSonra, true);
  bak('getAll verilen izni içeriyor', /identity/.test(r.getAll || ''), true);
  bak('launchWebAuthFlow eklentinin yönlendirme adresini döndürdü', r.cevap, 'https://' + KIMLIK + '.chromiumapp.org/cb?code=abc&state=xyz');
  bak('başka eklentinin yönlendirme adresine dönülmedi', r.yabanci, 'reddedildi');
  bak('permissions.remove', r.kaldir, true);
  bak('kaldırınca contains false', r.izinKaldirSonra, false);

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' kimlik/izin e2e testi başarısız.' : '\n✓ kimlik/izin e2e testlerinin hepsi geçti.');
  if (hata) console.log(cikti.join('').split('\n').filter((s) => /Message:|Error/.test(s)).slice(0, 12).join('\n'));
  try { cocuk.kill(); } catch { /* kapandı */ }
  await bekle(800);
  sunucu.close();
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch { /* Windows kilidi */ }
  process.exit(hata ? 1 : 0);
})();
