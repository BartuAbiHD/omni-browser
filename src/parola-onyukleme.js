'use strict';

/**
 * Parola önerisi (sayfa tarafı). Sandbox preload'ı olduğu için yalnızca electron'a
 * dayanır. Parola alanına (ya da kullanıcı adı/e-posta alanına) tıklanınca ana
 * sürece alanın konumunu bildirir; ana sürecin yerel menüsünden bir kayıt
 * seçilirse 'parola:doldur' ile yalnızca O kaydın değerleri bu çerçeveye gelir.
 * Kayıtlar sayfaya önceden verilmez.
 */
const { ipcRenderer } = require('electron');

let sonAlan = null;       // en son öneri gösterilen alan
let sonGosterim = 0;
let sonDoldurma = 0;

const KULLANICI_TURLERI = new Set(['text', 'email', 'tel', 'search', '']);

function gorunur(el) {
  if (!el || el.disabled || el.readOnly) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function parolaAlani(el) {
  return el instanceof HTMLInputElement && el.type === 'password';
}

function kullaniciAlaniMi(el) {
  if (!(el instanceof HTMLInputElement) || !KULLANICI_TURLERI.has(el.type)) return false;
  const ipucu = ((el.autocomplete || '') + ' ' + (el.name || '') + ' ' + (el.id || '')).toLowerCase();
  if (/username|email|e-mail|login|user|kullanici|eposta|identifier/.test(ipucu) || el.type === 'email') return true;
  // Aynı sayfada görünür parola alanı varsa, ondan önceki metin alanı da kullanıcı adıdır.
  return !!document.querySelector('input[type="password"]');
}

function sayfadakiParola() {
  return Array.from(document.querySelectorAll('input[type="password"]')).find(gorunur) || null;
}

function kullaniciAlaniBul(parola) {
  const adaylar = Array.from(document.querySelectorAll('input')).filter(
    (i) => gorunur(i) && KULLANICI_TURLERI.has(i.type));
  if (!parola) return adaylar[0] || null;
  let secilen = null;
  for (const a of adaylar) {
    if (a.compareDocumentPosition(parola) & Node.DOCUMENT_POSITION_FOLLOWING) secilen = a;
  }
  return secilen;
}

function degerYaz(el, deger) {
  if (!el) return;
  // Prototip setter'ı React/Vue gibi çerçevelerin izleyicisini atlar, değişiklik fark edilir.
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(el, deger);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function oneriIste(el) {
  if (window.top !== window) return;               // çerçeve içi konum doğru hesaplanamaz
  if (!gorunur(el)) return;
  const parola = parolaAlani(el);
  if (!parola && !kullaniciAlaniMi(el)) return;
  const r = el.getBoundingClientRect();
  sonAlan = el;
  sonGosterim = Date.now();
  ipcRenderer.send('parola:oneri-iste', {
    x: r.left, y: r.bottom, genislik: r.width,
    alan: parola ? 'parola' : 'kullanici'
  });
}

document.addEventListener('focusin', (e) => {
  if (Date.now() - sonDoldurma < 1000) return;
  if (e.target !== sonAlan) oneriIste(e.target);
}, true);

document.addEventListener('click', (e) => {
  if (Date.now() - sonDoldurma < 1000 || Date.now() - sonGosterim < 700) return;
  if (e.isTrusted && e.target instanceof HTMLInputElement) oneriIste(e.target);
}, true);

ipcRenderer.on('parola:doldur', (_e, k) => {
  if (!k || typeof k.parola !== 'string') return;
  sonDoldurma = Date.now();
  const aktif = document.activeElement;
  let parola = parolaAlani(aktif) ? aktif : sayfadakiParola();
  let kullanici = null;
  if (aktif instanceof HTMLInputElement && !parolaAlani(aktif)) kullanici = aktif;
  else kullanici = kullaniciAlaniBul(parola);

  degerYaz(kullanici, k.kullaniciAdi || '');
  // Google gibi iki adımlı girişlerde parola alanı henüz yoktur; yalnızca kullanıcı adı yazılır.
  if (parola && k.alan !== 'kullanici') degerYaz(parola, k.parola);
});
