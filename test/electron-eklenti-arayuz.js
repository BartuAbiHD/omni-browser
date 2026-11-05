'use strict';

/*
 * EKLENTİ ARAYÜZÜ GERÇEK UYGULAMADA: kurulu + sabit bir eklenti araç çubuğunda
 * görünüyor mu, düğmesine tıklayınca açılır penceresi (popup) gerçekten yükleniyor
 * mu, eklentiler sayfası (omni://extensions) açılıp adres çubuğunda İngilizce
 * adres gösteriyor mu.
 *
 * Uygulama ayrı profille ve --remote-debugging-port ile başlatılıyor.
 */

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { acikAnahtardanKimlik } = require('../src/eklentiler');

const KOK = path.join(__dirname, '..');
const PORT = 9433;
const DBG = 9434;
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}

const TEK_PIKSEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-arayuz-'));
const eklentiDizini = path.join(profil, 'ham-eklenti');
fs.mkdirSync(eklentiDizini, { recursive: true });
const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = publicKey.export({ type: 'spki', format: 'der' });
const KIMLIK = acikAnahtardanKimlik(der);
fs.writeFileSync(path.join(eklentiDizini, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Arayuz Deneme', version: '2.0', key: der.toString('base64'),
  icons: { 16: 'i.png', 48: 'i.png' }, action: { default_popup: 'p.html', default_icon: 'i.png' }
}));
fs.writeFileSync(path.join(eklentiDizini, 'i.png'), TEK_PIKSEL_PNG);
fs.writeFileSync(path.join(eklentiDizini, 'p.html'), '<!doctype html><title>x</title><body style="width:200px;height:120px"><script src="p.js"></script>');
fs.writeFileSync(path.join(eklentiDizini, 'p.js'), "document.title = 'acildi:' + typeof chrome.runtime.id;");
fs.writeFileSync(path.join(profil, 'pusula-veri.json'), JSON.stringify({
  eklentiler: { [KIMLIK]: { yol: eklentiDizini, etkin: true, sabit: true, kaynak: 'dosya' } }
}), 'utf8');

const sunucu = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>Sayfa</title><p>x</p>'); });

async function hedefler() {
  const y = await fetch('http://127.0.0.1:' + DBG + '/json/list');
  return y.json();
}
async function arayuzHedefi() {
  for (let i = 0; i < 50; i++) {
    try {
      const h = (await hedefler()).find((t) => t.type === 'page' && /ui[/\\]index\.html/.test(t.url || ''));
      if (h && h.webSocketDebuggerUrl) return h;
    } catch { /* süreç henüz dinlemiyor */ }
    await bekle(400);
  }
  return null;
}
function degerlendir(wsUrl, ifade) {
  return new Promise((coz, red) => {
    const ws = new WebSocket(wsUrl);
    const zaman = setTimeout(() => { try { ws.close(); } catch { /* kapalı */ } red(new Error('CDP zaman aşımı')); }, 15000);
    ws.onerror = () => { clearTimeout(zaman); red(new Error('CDP bağlantı hatası')); };
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: ifade, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (o) => {
      const v = JSON.parse(o.data);
      if (v.id !== 1) return;
      clearTimeout(zaman);
      try { ws.close(); } catch { /* kapalı */ }
      if (v.result && v.result.exceptionDetails) return red(new Error('sayfa istisnası: ' + JSON.stringify(v.result.exceptionDetails)));
      coz(v.result && v.result.result ? v.result.result.value : undefined);
    };
  });
}

(async () => {
  await new Promise((c) => sunucu.listen(PORT, '127.0.0.1', c));
  const electron = require('electron');
  const cocuk = spawn(electron, ['.', 'http://127.0.0.1:' + PORT + '/', '--user-data-dir=' + profil, '--remote-debugging-port=' + DBG], {
    cwd: KOK, stdio: ['ignore', 'pipe', 'pipe']
  });
  const cikti = [];
  cocuk.stdout.on('data', (d) => cikti.push(String(d)));
  cocuk.stderr.on('data', (d) => cikti.push(String(d)));

  try {
    const ui = await arayuzHedefi();
    bak('arayüz penceresi bulundu', !!ui, true);
    if (ui) {
      await bekle(2500);
      const ws = ui.webSocketDebuggerUrl;
      bak('yapboz düğmesi var', await degerlendir(ws, "!!document.getElementById('btnEklentiler')"), true);
      bak('sabit eklenti düğmesi çizildi', await degerlendir(ws, "document.querySelectorAll('#eklentiSabit button').length"), 1);
      bak('düğme başlığı eklenti adı', await degerlendir(ws, "document.querySelector('#eklentiSabit button').title"), 'Arayuz Deneme');
      bak('düğmede simge var', await degerlendir(ws, "!!document.querySelector('#eklentiSabit button img')"), true);

      await degerlendir(ws, "document.querySelector('#eklentiSabit button').click(); 1");
      let popup = null;
      for (let i = 0; i < 20 && !popup; i++) {
        await bekle(300);
        popup = (await hedefler()).find((t) => (t.url || '').startsWith('chrome-extension://' + KIMLIK + '/p.html'));
      }
      bak('tıklayınca popup yüklendi', !!popup, true);
      if (popup) bak('popup chrome.runtime görüyor', popup.title, 'acildi:string');

      // Eklentiler sayfası
      await degerlendir(ws, "window.pusula.dahiliSayfaAc('eklentiler'); 1");
      await bekle(1200);
      bak('adres çubuğu İngilizce adres', await degerlendir(ws, "document.getElementById('adres').value"), 'omni://extensions');
      const panelMetni = await degerlendir(ws, "document.getElementById('panelIcerik').innerText");
      bak('panelde eklenti adı listeleniyor', /Arayuz Deneme/.test(panelMetni || ''), true);
      bak('panelde kaldır düğmesi', /Kaldır|Remove/.test(panelMetni || ''), true);
      // Chrome tarzı sayfa: kart ızgarası, arama, geliştirici modu, ayrıntı sayfası
      bak('eklenti kartı çizildi', await degerlendir(ws, "document.querySelectorAll('.eklenti-kart').length"), 1);
      bak('arama kutusu var', await degerlendir(ws, "!!document.querySelector('.eklenti-arama input')"), true);
      bak('geliştirici modu kapalıyken kimlik gizli', await degerlendir(ws, "document.querySelector('.eklenti-kart').innerText.includes('" + KIMLIK + "')"), false);
      await degerlendir(ws, "document.querySelector('.eklenti-gelistirici input').click(); 1");
      await bekle(600);
      bak('geliştirici modunda kimlik görünür', await degerlendir(ws, "document.querySelector('.eklenti-kart').innerText.includes('" + KIMLIK + "')"), true);
      await degerlendir(ws, "document.querySelector('.eklenti-arama input').value = 'zzz-yok'; document.querySelector('.eklenti-arama input').dispatchEvent(new Event('input')); 1");
      await bekle(400);
      bak('arama eşleşmeyeni gizledi', await degerlendir(ws, "document.querySelectorAll('.eklenti-kart').length"), 0);
      await degerlendir(ws, "document.querySelector('.eklenti-arama input').value = ''; document.querySelector('.eklenti-arama input').dispatchEvent(new Event('input')); 1");
      await bekle(400);
      await degerlendir(ws, "[...document.querySelectorAll('.eklenti-kart button')].find((b) => /Ayrıntılar|Details/.test(b.textContent)).click(); 1");
      await bekle(900);
      const ayrinti = await degerlendir(ws, "document.querySelector('.eklenti-ayrinti') ? document.querySelector('.eklenti-ayrinti').innerText : ''");
      bak('ayrıntı sayfası açıldı', /Arayuz Deneme/.test(ayrinti || ''), true);
      bak('ayrıntıda sürüm, boyut ve kimlik', /2.0/.test(ayrinti) && /(Boyut|Size)/.test(ayrinti) && ayrinti.includes(KIMLIK), true);
      bak('ayrıntıda kaldır satırı', /(Eklentiyi kaldır|Remove extension)/.test(ayrinti), true);
      await degerlendir(ws, "localStorage.removeItem('eklentiGelistirici'); 1");
    }
  } catch (e) {
    hata++;
    sonuc.push('  HATA beklenmeyen: ' + (e && e.stack || e));
  }

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' eklenti arayüz testi başarısız.' : '\n✓ eklenti arayüz testlerinin hepsi geçti.');
  if (hata) console.log(cikti.join('').split('\n').filter((s) => /Error|Eklenti|eklenti/.test(s)).slice(0, 12).join('\n'));
  try { cocuk.kill(); } catch { /* kapandı */ }
  await bekle(800);
  sunucu.close();
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch { /* Windows kilidi */ }
  process.exit(hata ? 1 : 0);
})();
