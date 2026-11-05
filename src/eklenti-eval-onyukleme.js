'use strict';

/**
 * "userScripts" izinli eklentiler (PreMiD gibi) için eval köprüsü (sekme tarafı).
 *
 * Chrome'da chrome.userScripts betikleri, eklenti CSP'sinden bağımsız, 'unsafe-eval'e izin
 * veren ayrı bir dünyada çalışır. Electron'da böyle bir dünya yok: içerik betiği dünyasında
 * eval, eklentinin CSP'si yüzünden reddedilir. Bu önyükleme, izinli eklentinin içerik betiği
 * dünyasını bulur ve oradaki global eval'i, Electron'un CSP'den muaf çalıştırdığı
 * webFrame.executeJavaScriptInIsolatedWorld çağrısına yönlendirir (senkron çalışır).
 *
 * Güvenlik / kararlılık:
 *  - Ana süreç yalnızca manifestinde "userScripts" izni olan eklentilerin kimliklerini verir.
 *    Liste boşsa bu dosya HİÇBİR ŞEY yapmaz (dünya bile yaratmaz).
 *  - Yalnızca o kimliklerin dünyaları yamalanır; başka eklentilerin içerik betikleri eval kazanmaz.
 *  - Köprü kanalı, bu çerçeveye özel rastgele bir olay adıdır; yalnızca bu önyüklemede ve
 *    yamalı eklenti dünyasında bulunur. Sayfanın kendi dünyası bilemez, kod çalıştıramaz.
 *  - Dünya kimliği doğrudan öğrenilemediği için numara aralığı taranır. Henüz kullanılmamış bir
 *    numaraya dokunmak o dünyayı (CSP'siz, chrome.* bağlamasız) yaratır; bu yüzden tarama
 *    sayfa yüklendikten sonra yapılır, yalnızca üst çerçevede ve yalnızca etkin eklenti sayısı kadar numaraya dokunur.
 */
const { webFrame, ipcRenderer } = require('electron');

// Electron eklenti içerik betiği dünyalarını bu numaradan başlayarak sırayla ayırır.
const DUNYA_TABAN = 1 << 20;
const DUNYA_PAYI = 2; // etkin eklenti sayısına eklenen güvenlik payı

function rastgele() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function baslat() {
  if (!/^https?:$/.test(location.protocol)) return;
  // Yalnızca üst çerçeve: her çerçevede onlarca dünya yaratmamak için.
  if (window !== window.top) return;

  let bilgi;
  try { bilgi = ipcRenderer.sendSync('cvs:eval-kopru'); } catch { return; }
  if (!bilgi || !Array.isArray(bilgi.kimlikler) || !bilgi.kimlikler.length) return;
  const izinliKume = new Set(bilgi.kimlikler.filter((k) => typeof k === 'string'));
  const aralik = Math.min(256, Math.max(1, Number(bilgi.dunyaSayisi) || 0) + DUNYA_PAYI);

  const OLAY = '__cvs_eval_' + rastgele();
  const yamali = new Set();
  let ilkKod = false;

  // Dünyanın eklenti kimliği; eklenti dünyası değilse ''.
  const YOKLAMA = '(function(){try{'
    + 'return (typeof chrome!=="undefined"&&chrome.runtime&&chrome.runtime.id)'
    + '?chrome.runtime.id:"";'
    + '}catch(e){return ""}})()';

  const yamaKodu = (id) => '(function(id,olay){'
    + 'if(window.__cvsEvalYamali)return;'
    + 'Object.defineProperty(window,"__cvsEvalYamali",{value:true});'
    + 'window.eval=function(kod){'
    + 'document.dispatchEvent(new CustomEvent(olay,{detail:{id:id,kod:String(kod)}}));'
    + '};'
    + '})(' + id + ',' + JSON.stringify(OLAY) + ');';

  // Yoklama + yama tek çağrıda: dünya yalnızca izinli bir eklentiyse yamalanır; "ok" ya da "".
  const tekCagri = (id) => '(function(){try{'
    + 'if(!(typeof chrome!=="undefined"&&chrome.runtime&&' + JSON.stringify(Array.from(izinliKume)) + '.indexOf(chrome.runtime.id)>=0))return "";'
    + '}catch(e){return ""}'
    + 'if(window.__cvsEvalYamali)return "ok";'
    + 'Object.defineProperty(window,"__cvsEvalYamali",{value:true});'
    + 'var olay=' + JSON.stringify(OLAY) + ';'
    + 'window.eval=function(kod){document.dispatchEvent(new CustomEvent(olay,{detail:{id:' + id + ',kod:String(kod)}}));};'
    + 'return "ok";})()';

  document.addEventListener(OLAY, (e) => {
    const d = e && e.detail;
    if (!d || typeof d.id !== 'number' || typeof d.kod !== 'string' || !yamali.has(d.id)) return;
    if (!ilkKod) { ilkKod = true; console.info('[premid] eval köprüsü: ilk kod çalıştırıldı (' + d.kod.length + ' bayt) +' + Math.round(performance.now()) + 'ms ' + location.href.slice(0, 60)); }
    webFrame.executeJavaScriptInIsolatedWorld(d.id, [{ code: d.kod }]).catch((hata) => {
      console.error('[CVS] eklenti betiği çalıştırılamadı:', hata && hata.message ? hata.message : hata);
    });
  });

  async function yamala(id, kimlik, etiket) {
    yamali.add(id);
    await webFrame.executeJavaScriptInIsolatedWorld(id, [{ code: yamaKodu(id) }]);
    console.info('[premid] eval köprüsü: dünya ' + (id - DUNYA_TABAN) + ' yamalandı (' + etiket + ') +' + Math.round(performance.now()) + 'ms ' + document.readyState + ' ' + location.href.slice(0, 60));
    try { ipcRenderer.send('cvs:eval-dunya', id - DUNYA_TABAN); } catch { /* ipucu kaydedilemedi */ }
  }

  let tarama = false;
  async function tara(son) {
    if (tarama) return;
    tarama = true;
    const gorulen = [];
    try {
      // Numaralar süreç genelinde ayrılır ama bağlamlar çerçeve başına yaratılır; bu çerçevede
      // henüz enjekte olmamış bir eklentinin numarası boş görünür. Bu yüzden durmadan taranır,
      // ama yalnızca etkin eklenti sayısı kadar numaraya dokunulur.
      for (let id = DUNYA_TABAN; id < DUNYA_TABAN + aralik; id++) {
        let kimlik;
        try { kimlik = await webFrame.executeJavaScriptInIsolatedWorld(id, [{ code: YOKLAMA }]); } catch { continue; }
        gorulen.push(kimlik ? kimlik.slice(0, 6) : '-');
        if (kimlik && izinliKume.has(kimlik) && !yamali.has(id)) await yamala(id, kimlik, 'tarama');
      }
      if (son && !yamali.size) console.info('[premid] eval köprüsü: izinli eklenti dünyası bulunamadı; görülen: ' + gorulen.join(','));
    } finally { tarama = false; }
  }

  // ERKEN YAMA: eklentinin eval'i sayfa yüklenmeden çalışabilir (PreMiD ~1,5 sn). Önceki
  // taramada öğrenilen dünya numarası (ana süreç ipucu verir; PreMiD tipik olarak ilk sıradadır)
  // belge öğesi oluşur oluşmaz yoklanır: document_start betikleri o ana kadar çalışmıştır, yani
  // o numaranın bağlamı hazırdır. Numara yanlışsa yalnızca yoklayıp bırakır; geç tarama düzeltir.
  const ipucu = Number.isInteger(bilgi.ipucu) && bilgi.ipucu >= 0 && bilgi.ipucu < 256 ? bilgi.ipucu : 0;
  async function erkenYamala() {
    const id = DUNYA_TABAN + ipucu;
    yamali.add(id); // olay, yamanın etkisinden önce gelebilir; yalnızca bu numaraya kod gider
    try {
      const sonuc = await webFrame.executeJavaScriptInIsolatedWorld(id, [{ code: tekCagri(id) }]);
      if (sonuc === 'ok') {
        console.info('[premid] eval köprüsü: dünya ' + ipucu + ' yamalandı (erken) +' + Math.round(performance.now()) + 'ms ' + document.readyState + ' ' + location.href.slice(0, 60));
        try { ipcRenderer.send('cvs:eval-dunya', ipucu); } catch { /* ipucu kaydedilemedi */ }
      } else yamali.delete(id);
    } catch { yamali.delete(id); /* geç tarama dener */ }
  }
  // Belge öğesi oluşur oluşmaz (belge-başlangıç betikleri çalışmış, bağlamları hazırdır) hemen yama.
  if (document.documentElement) erkenYamala();
  else {
    const mo = new MutationObserver(() => { if (document.documentElement) { mo.disconnect(); erkenYamala(); } });
    mo.observe(document, { childList: true });
  }

  // Dünyalar yüklenmeden önce dokunmamak için sayfa yüklendikten sonra tara; betik Presence'ı
  // asenkron başlatabildiği için birkaç kez tekrarla.
  const baslatTarama = () => [500, 2000, 6000, 15000, 30000].forEach((ms, i, a) => setTimeout(() => tara(i === a.length - 1), ms));
  if (document.readyState === 'complete') baslatTarama();
  else window.addEventListener('load', baslatTarama, { once: true });
  // eval engellendiyse (henüz yamalanmamış bir dünyada) hemen yeniden tara: engelleyen dünya
  // başlatılmış olduğundan yoklamak güvenlidir.
  document.addEventListener('securitypolicyviolation', (e) => {
    if (e.blockedURI !== 'eval') return;
    console.info('[premid] eval köprüsü: eval engellendi (yamalı dünya: ' + yamali.size + ') +' + Math.round(performance.now()) + 'ms ' + document.readyState + ' ' + location.href.slice(0, 60));
    tara(false);
  });
}

try { baslat(); } catch (e) { /* önyükleme sayfayı bozmamalı */ }
