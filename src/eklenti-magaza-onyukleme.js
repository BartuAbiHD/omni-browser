'use strict';

/**
 * Chrome Web Store sayfalarında "CVS Browser'a ekle" / "CVS Browser'dan kaldır" düğmesi.
 *
 * Mağazanın kendi "Chrome'a ekle" düğmesi Chrome'a özel bir API'ye (webstorePrivate)
 * dayanıyor ve burada çalışmaz. Bu betik yalnızca mağaza alan adlarında, bir eklenti
 * detay sayfasındayken (adreste 32 harflik kimlik var) çalışır: mağazanın kendi
 * düğmesini bulursa onun yerine (aynı konumda), bulamazsa sağ altta yüzen bir düğme
 * gösterir. Tıklanınca ana sürece YALNIZCA kimliği yollar; indirme, izin onayı ve
 * kurulum/kaldırma ana süreçte, kullanıcı onayıyla yapılır.
 */
const { ipcRenderer } = require('electron');

const MAGAZA = new Set(['chromewebstore.google.com', 'chrome.google.com']);
const KIMLIK = /^[a-p]{32}$/;

if (window.top === window && location.protocol === 'https:' && MAGAZA.has(location.hostname)) {
  let sunucu = null;       // gölge DOM taşıyıcısı
  let sonKimlik = null;
  let sonMod = null;       // 'satir' (mağazanın düğmesinin yerinde) | 'sabit' (yüzen)
  let gizlenen = null;     // yerine geçtiğimiz mağaza düğmesi

  const kimlikBul = () => {
    const parcalar = location.pathname.split('/').filter(Boolean);
    for (let i = parcalar.length - 1; i >= 0; i--) if (KIMLIK.test(parcalar[i])) return parcalar[i];
    return null;
  };

  // Mağazanın kendi "Chrome'a ekle" düğmesi: dile göre değişse de metninde "Chrome" geçiyor
  // ve başlığın yanında, sayfanın üst bölümünde duruyor.
  const yerelDugme = () => {
    for (const b of document.querySelectorAll('button')) {
      if (b.closest('[role="dialog"]')) continue;
      const metin = (b.textContent || '').trim();
      if (!metin || metin.length > 40 || !/chrome/i.test(metin)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 60 || r.top < 80 || r.top > 450) continue;
      return b;
    }
    return null;
  };

  const kaldir = () => {
    if (sunucu && sunucu.parentNode) sunucu.parentNode.removeChild(sunucu);
    sunucu = null;
    if (gizlenen) { try { gizlenen.style.removeProperty('display'); } catch { /* düğüm gitmiş */ } }
    gizlenen = null;
  };

  const kur = (kimlik, yerel) => {
    const bilgi = ipcRenderer.sendSync('eklenti:magaza-bilgi', kimlik);
    if (!bilgi) return;
    kaldir();
    const mod = yerel ? 'satir' : 'sabit';
    sunucu = document.createElement('div');
    const kok = sunucu.attachShadow({ mode: 'closed' });
    const stil = document.createElement('style');
    stil.textContent = ''
      + ':host{all:initial;display:inline-block}'
      + 'button{font:500 14px "Google Sans",system-ui,sans-serif;padding:0 24px;height:40px;border:0;'
      + 'border-radius:20px;background:#1a73e8;color:#fff;cursor:pointer;white-space:nowrap}'
      + 'button:hover{background:#1765cc}'
      + 'button.kaldir{background:#d93025}'
      + 'button.kaldir:hover{background:#b3261e}'
      + 'button[disabled]{background:#9aa0a6;cursor:default}'
      + (mod === 'sabit'
        ? 'button{position:fixed;right:20px;bottom:20px;z-index:2147483647;height:auto;padding:11px 18px;'
          + 'border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.35)}'
        : '');
    const dugme = document.createElement('button');
    dugme.type = 'button';
    dugme.className = bilgi.kurulu ? 'kaldir' : '';
    dugme.textContent = bilgi.kurulu ? bilgi.kaldir : bilgi.ekle;
    dugme.addEventListener('click', (e) => {
      if (!e.isTrusted) return;           // sayfanın betiği tıklamayı taklit edemesin
      dugme.disabled = true;
      dugme.textContent = bilgi.kurulu ? bilgi.kaldiriliyor : bilgi.kuruluyor;
      ipcRenderer.send(bilgi.kurulu ? 'eklenti:magaza-kaldir' : 'eklenti:magaza-kur', kimlik);
    });
    kok.append(stil, dugme);

    if (yerel && yerel.parentNode) {
      yerel.parentNode.insertBefore(sunucu, yerel);
      yerel.style.setProperty('display', 'none', 'important');
      gizlenen = yerel;
    } else {
      // Gövdeyi yeniden çizen mağaza uygulaması silmesin diye <html>'e ekleniyor.
      document.documentElement.appendChild(sunucu);
    }
    sonKimlik = kimlik;
    sonMod = mod;
  };

  const denetle = () => {
    const kimlik = kimlikBul();
    if (!kimlik) { kaldir(); sonKimlik = null; sonMod = null; return; }
    const yerel = gizlenen && gizlenen.isConnected ? gizlenen : yerelDugme();
    const mod = yerel ? 'satir' : 'sabit';
    const yerinde = sunucu && sunucu.isConnected && (mod === 'sabit' || sunucu.nextSibling === yerel);
    if (kimlik !== sonKimlik || mod !== sonMod || !yerinde) kur(kimlik, yerel);
  };

  // Kurulum/kaldırma bitince (ya da iptal edilince) durumu yeniden oku.
  ipcRenderer.on('eklenti:magaza-sonuc', (_e, s) => {
    if (s && s.kimlik === kimlikBul()) { sonKimlik = null; denetle(); }
  });

  // Mağaza tek sayfalık bir uygulama: adres ve düzen değişimini yoklayarak izle.
  setInterval(denetle, 800);
  document.addEventListener('DOMContentLoaded', denetle);
}
