'use strict';

const $ = (id) => document.getElementById(id);

const el = {
  chrome: $('chrome'),
  sekmeler: $('sekmeler'),
  yeniSekme: $('yeniSekme'),
  arac: $('arac'),
  geri: $('btnGeri'), ileri: $('btnIleri'), yenile: $('btnYenile'), anasayfa: $('btnAnasayfa'),
  adresKutu: $('adresKutu'), adresAlan: $('adresAlan'), adres: $('adres'), adresGoster: $('adresGoster'), kilit: $('kilit'),
  kalkan: $('btnKalkan'), engelSayi: $('engelSayi'), yerImi: $('btnYerImi'),
  reklamEngel: $('btnReklamEngel'),
  sayfaGoruntu: $('sayfaGoruntu'),
  gecmis: $('btnGecmis'), indirmeler: $('btnIndirmeler'),
  onbellek: $('btnOnbellek'), ayarlar: $('btnAyarlar'),
  vpn: $('btnVpn'), istatistik: $('btnIstatistik'),
  eklentiler: $('btnEklentiler'), eklentiSabit: $('eklentiSabit'),
  yerImleriCubugu: $('yerImleriCubugu'),
  oneriler: $('oneriler'),
  bulCubugu: $('bulCubugu'), bulGirdi: $('bulGirdi'), bulSayac: $('bulSayac'),
  bulOnceki: $('bulOnceki'), bulSonraki: $('bulSonraki'), bulKapat: $('bulKapat'),
  panel: $('panel'), panelAd: $('panelAd'), panelArac: $('panelArac'),
  panelIcerik: $('panelIcerik'), panelKapat: $('panelKapat'),
  gizliGosterge: $('gizliGosterge'),
  varsayilanBanner: $('varsayilanBanner'),
  varsayilanMetin: $('varsayilanMetin'),
  btnVarsayilanYap: $('btnVarsayilanYap'),
  btnVarsayilanKapat: $('btnVarsayilanKapat'),
  yanCubuk: $('yanCubuk'),
  btnYanCubuk: $('btnYanCubuk'),
  btnYanCubukGecis: $('btnYanCubukGecis'),
  yanCubukWebPaneller: $('yanCubukWebPaneller'),
  btnYanYerImleri: $('btnYanYerImleri'),
  btnYanGecmis: $('btnYanGecmis'),
  btnYanIndirmeler: $('btnYanIndirmeler'),
  btnYanPanelEkle: $('btnYanPanelEkle'),
  yanPanelCerceve: $('yanPanelCerceve'),
  yanPanelSimge: $('yanPanelSimge'),
  yanPanelBaslikMetin: $('yanPanelBaslikMetin'),
  btnYanPanelMobil: $('btnYanPanelMobil'),
  btnYanPanelGeri: $('btnYanPanelGeri'),
  btnYanPanelIleri: $('btnYanPanelIleri'),
  btnYanPanelYenile: $('btnYanPanelYenile'),
  btnYanPanelAnasayfa: $('btnYanPanelAnasayfa'),
  btnYanPanelSekmedeAc: $('btnYanPanelSekmedeAc'),
  btnYanPanelKapat: $('btnYanPanelKapat'),
  yanPanelIcerik: $('yanPanelIcerik'),
  yanPanelAyirici: $('yanPanelAyirici'),
  yanPanelEkleModal: $('yanPanelEkleModal'),
  yanPanelEkleAd: $('yanPanelEkleAd'),
  yanPanelEkleUrl: $('yanPanelEkleUrl'),
  btnYanPanelEkleIptal: $('btnYanPanelEkleIptal'),
  btnYanPanelEkleOnayla: $('btnYanPanelEkleOnayla')
};

let durum = {
  sekmeler: [], aktifId: null, ayarlar: {}, motorlar: {}, yerImleri: [],
  indirmeler: [], listeler: [], diller: [], izinTurleri: [], toplamEngellenen: 0,
  pencereGizli: false, surumBilgisi: null
};

// Çeviri tablosu ana süreçten 'durum' ile geliyor.
let ceviri = { dil: 'tr', yon: 'ltr', yerel: 'tr-TR', metin: {} };

/*
 * Yer imi şeridi yalnızca yer imleri değiştiğinde yeniden kuruluyor. Ana süreç
 * yerImleri'ni yalnızca değişince gönderdiği (durum yükü küçük) ve şeridi her
 * durumda 40 düğme + yüzlerce dinleyiciyle yeniden kurmak boşa CPU olduğu için:
 * yerImYeni gelen durumda yerImleri varsa true olur, yerImCizildi şeridin o an
 * çizili olup olmadığını tutar (gizlenince sıfırlanır ki tekrar görününce çizilsin).
 */
let yerImYeni = true;
let yerImCizildi = false;

function cev(anahtar, degerler) {
  const kalip = ceviri.metin[anahtar] || anahtar;
  if (!degerler) return kalip;
  return String(kalip).replace(/\{(\w+)\}/g, (t, k) =>
    (Object.hasOwn(degerler, k) ? String(degerler[k]) : t));
}

// Sabit HTML'deki ipucu ve yer tutucu metinleri dil değişince yenilenmeli.
function statikMetinler() {
  document.documentElement.lang = ceviri.dil;
  document.documentElement.dir = ceviri.yon;
  el.geri.title = cev('arac.geri');
  el.ileri.title = cev('arac.ileri');
  el.anasayfa.title = cev('arac.anasayfa');
  el.yeniSekme.title = cev('arac.yeniSekme');
  el.gecmis.title = cev('arac.gecmis');
  el.indirmeler.title = cev('arac.indirilenler');
  el.ayarlar.title = cev('arac.menu');
  el.vpn.title = cev('arac.vpn');
  el.istatistik.title = cev('arac.istatistik');
  el.eklentiler.title = cev('arac.eklentiler');
  eklentiSabitImza = '';   // başlıklar yeni dile geçsin
  eklentiSabitCiz();
  el.adres.placeholder = cev('arac.adresIpucu');
  el.bulGirdi.placeholder = cev('bul.ipucu');
  el.bulOnceki.title = cev('bul.onceki');
  el.bulSonraki.title = cev('bul.sonraki');
  el.bulKapat.title = cev('bul.kapat');
  el.panelKapat.title = cev('panel.kapat');
  if (el.btnYanCubuk) el.btnYanCubuk.title = cev('arac.yanCubuk');
  if (el.btnYanCubukGecis) el.btnYanCubukGecis.title = cev('arac.yanCubuk');
  if (el.btnYanYerImleri) el.btnYanYerImleri.title = cev('panel.yerImleri');
  if (el.btnYanGecmis) el.btnYanGecmis.title = cev('panel.gecmis');
  if (el.btnYanIndirmeler) el.btnYanIndirmeler.title = cev('panel.indirilenler');
  if (el.btnYanPanelEkle) el.btnYanPanelEkle.title = cev('panel.yanPanelEkle');
  if (el.btnYanPanelMobil) el.btnYanPanelMobil.title = cev('panel.yanPanelMobil');
  if (el.btnYanPanelSekmedeAc) el.btnYanPanelSekmedeAc.title = cev('panel.yanPanelSekmedeAc');
  if (el.btnYanPanelKapat) el.btnYanPanelKapat.title = cev('panel.yanPanelKapat');
  if (el.gizliGosterge) el.gizliGosterge.textContent = '🕶️ ' + (cev('arac.gizli') || 'Gizli');
  if (el.varsayilanBanner && !el.varsayilanBanner.hidden) {
    el.varsayilanMetin.textContent = cev('banner.varsayilanMetin');
    el.btnVarsayilanYap.textContent = cev('banner.varsayilanYap');
    el.btnVarsayilanKapat.title = cev('banner.simdiDegil');
  }
}
let adresDuzenleniyor = false;
// Enter'a basılmadan sekmeden ayrılınca yazılan metin kaybolmasın: sekme başına taslak.
// 'taban' taslağın yazıldığı andaki adres; sayfa başka yere giderse taslak düşer.
const adresTaslak = new Map();
function adresTaslagi(t) {
  if (!t) return null;
  const k = adresTaslak.get(t.id);
  if (!k) return null;
  if (k.taban !== (t.gorunenUrl || '') || k.gezinme !== (t.gezinme || 0)) { adresTaslak.delete(t.id); return null; }
  return k;
}
let oneriListesi = [];
let oneriSecim = -1;
let oneriIstek = 0;
let acikPanel = null;
let panelArama = null;

/* ---------------- yardımcılar ---------------- */

// Yön değiştirme ve kontrol karakterleri XSS değil ama sekme başlığında,
// öneri listesinde ve indirme adında metni ters okutmaya yarıyor.
const GORUNMEZ = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function temizMetin(s) {
  return String(s == null ? '' : s).replace(GORUNMEZ, '');
}

function aktif() {
  return durum.sekmeler.find(t => t.id === durum.aktifId) || null;
}

function boyutMetni(bayt) {
  if (!bayt || bayt < 0) return '';
  const birim = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bayt;
  while (n >= 1024 && i < birim.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(1)) + ' ' + birim[i];
}

function saatMetni(zaman) {
  return new Date(zaman).toLocaleTimeString(ceviri.yerel, { hour: '2-digit', minute: '2-digit' });
}

function gunMetni(zaman) {
  const d = new Date(zaman);
  const bugun = new Date();
  const dun = new Date(Date.now() - 86400000);
  const ayniGun = (a, b) => a.toDateString() === b.toDateString();
  if (ayniGun(d, bugun)) return cev('gecmis.bugun');
  if (ayniGun(d, dun)) return cev('gecmis.dun');
  return d.toLocaleDateString(ceviri.yerel, { day: 'numeric', month: 'long', year: 'numeric' });
}

function kisaUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch { return url; }
}

function alanAdi(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Favicon'a güvenmek yerine alan adından tutarlı bir harf/renk üretiyoruz:
// listeler favicon indirilmesini beklemeden dolu görünüyor.
const ROZET_RENKLERI = ['#2867ff', '#0f766e', '#2563eb', '#b45309', '#7c3aed', '#be185d', '#15803d', '#0891b2'];

function rozetYap(url) {
  const host = alanAdi(url);
  const d = document.createElement('span');
  d.className = 'rozet-alan';
  d.textContent = (host[0] || '?').toLocaleUpperCase('tr');
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  d.style.background = ROZET_RENKLERI[h % ROZET_RENKLERI.length];
  return d;
}

// Sitenin gerçek simgesi yerel önbellekte varsa onu göster, yoksa harf rozeti.
// Kaynak her zaman pusula-favicon:// — uzak adresten görsel çekilmiyor.
function simgeYap(url, favicon) {
  if (!favicon) return rozetYap(url);
  const i = document.createElement('img');
  i.className = 'rozet-img';
  i.src = favicon;
  i.alt = '';
  // Simge henüz indirilmemişse bir kez daha dene, sonra harf rozetine düş.
  let denendi = false;
  i.addEventListener('error', () => {
    if (denendi) { i.replaceWith(rozetYap(url)); return; }
    denendi = true;
    setTimeout(() => { i.src = favicon + '?y=' + Date.now(); }, 1800);
  });
  return i;
}

/*
 * Arayüz simgeleri gerçek SVG. Emoji ya da "»" gibi karakterler yazı tipine
 * göre değişiyor, tema rengini almıyor ve boyutları oynuyordu.
 */
const SIMGE = {
  kilit: '<svg viewBox="0 0 16 16"><path d="M4.6 7.2V5.1a3.4 3.4 0 0 1 6.8 0v2.1"/>'
    + '<rect x="3" y="7.2" width="10" height="6.3" rx="1.6"/></svg>',
  uyari: '<svg viewBox="0 0 16 16"><path d="M8 2.6l5.9 10.8H2.1z"/>'
    + '<path d="M8 6.4v3.1"/><path d="M8 11.4v.3"/></svg>',
  indir: '<svg viewBox="0 0 16 16"><path d="M8 2.8v7.1"/><path d="M5.2 7.2 8 10l2.8-2.8"/>'
    + '<path d="M3.4 13h9.2"/></svg>',
  tasma: '<svg viewBox="0 0 16 16"><path d="M4 4l4 4-4 4"/><path d="M9 4l4 4-4 4"/></svg>',
  kapat: '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  eklenti: '<svg viewBox="0 0 16 16"><path d="M5 3.5a1.5 1.5 0 0 1 3 0V5h3.5v3h1a1.5 1.5 0 0 1 0 3h-1v2.5H8.2v-1a1.5 1.5 0 0 0-3 0v1H2.5V10h1a1.5 1.5 0 0 0 0-3h-1V5H5z"/></svg>',
  yenile: '<svg viewBox="0 0 16 16"><path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2v3.2h-3.2"/></svg>',
  geri: '<svg viewBox="0 0 16 16"><path d="M13 8H3M7 4L3 8l4 4"/></svg>',
  sag: '<svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',
  dis: '<svg viewBox="0 0 16 16"><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3"/></svg>',
  klasor: '<svg viewBox="0 0 16 16"><path d="M2 4.6h4.2L7.4 6.2H14v7.2H2z"/></svg>',
  ara: '<svg viewBox="0 0 16 16"><circle cx="7.1" cy="7.1" r="4.3"/>'
    + '<path d="M10.3 10.3 13.5 13.5"/></svg>',
  dunya: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6"/><path d="M2.4 8h11.2"/>'
    + '<path d="M8 2.4c1.5 1.7 2.3 3.5 2.3 5.6S9.5 11.9 8 13.6C6.5 11.9 5.7 10.1 5.7 8S6.5 4.1 8 2.4z"/></svg>',
  /*
   * Marka işareti (pusula): yeni sekme sayfasındaki logonun 16px'e indirilmiş
   * hâli. Sekme şeridinde uygulamanın KENDİ sayfasını temsil ediyor -
   * tarayıcılar iç sayfaları için kendi simgelerini gösterir, boş kutu değil.
   */
  pusula: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.8"/>'
    + '<path d="M10.4 5.6l-1.68 3.28L5.44 10.4l1.68-3.28z" fill="currentColor" stroke="none"/></svg>'
};

// Panel içeriklerini ortalanmış bir kart içine alır.
function kartYap() {
  const d = document.createElement('div');
  d.className = 'liste-kart';
  return d;
}

// Pencere denetimleri Windows/Linux'ta sağ üstte, macOS'ta sol üstte duruyor;
// panel başlığı onların altında kalmasın diye CSS'e platformu bildiriyoruz.
document.documentElement.dataset.platform = window.pusula.platform;

/* Chrome yüksekliği değişince ana sürece bildir; sayfa görünümü ona göre konumlanır. */
const yukseklikGozcusu = new ResizeObserver(() => {
  const y = el.chrome.getBoundingClientRect().height;
  window.pusula.yukseklikBildir(y);
  // Panel bu yuksekligin altindan basliyor; tum pencereyi kaplamasin.
  document.documentElement.style.setProperty('--chrome-y', Math.round(y) + 'px');
});
yukseklikGozcusu.observe(el.chrome);

// Adres kutusu genişleyip daralınca öneri listesi hizasını kaybetmesin.
new ResizeObserver(() => {
  if (!el.oneriler.hidden) oneriHizala();
  olculeriBildir();
}).observe(el.adresKutu);

/* ---------------- çizim ---------------- */

function sekmeleriCiz() {
  el.sekmeler.replaceChildren();
  for (const t of durum.sekmeler) {
    const d = document.createElement('div');
    d.className = 'sekme' + (t.id === durum.aktifId ? ' aktif' : '') + (t.gizli ? ' gizli' : '');
    d.setAttribute('role', 'tab');
    d.title = temizMetin(t.baslik) + (t.gorunenUrl ? '\n' + t.gorunenUrl : '');

    if (t.yukleniyor) {
      const s = document.createElement('div');
      s.className = 'donuyor';
      d.appendChild(s);
    } else if (t.favicon) {
      const i = document.createElement('img');
      i.className = 'favikon';
      i.src = t.favicon;
      i.alt = '';
      // Simge inmediyse gri kutuya değil, sitenin ne olduğunu anlatan
      // dünya simgesine düşüyoruz.
      i.addEventListener('error', () => { i.replaceWith(sekmeSimgesi(!t.gorunenUrl)); });
      d.appendChild(i);
    } else {
      // gorunenUrl boşsa bu bir iç sayfa (yeni sekme): marka simgesi.
      d.appendChild(sekmeSimgesi(!t.gorunenUrl));
    }

    const ad = document.createElement('span');
    ad.className = 'ad';
    ad.textContent = temizMetin(t.baslik) || cev('arac.yeniSekmeBaslik');
    d.appendChild(ad);

    const kapat = document.createElement('button');
    kapat.className = 'kapat';
    kapat.title = cev('arac.sekmeyiKapat');
    kapat.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    kapat.addEventListener('click', (e) => { e.stopPropagation(); window.pusula.sekmeKapat(t.id); });
    d.appendChild(kapat);

    d.dataset.id = String(t.id);
    d.addEventListener('click', () => {
      // Sürükleme bittiğinde tarayıcı bir de 'click' üretiyor; taşınan sekmeyi
      // ayrıca seçmemek için o tıklamayı yutuyoruz.
      if (d._suruklendi) { d._suruklendi = false; return; }
      window.pusula.sekmeSec(t.id);
    });
    d.addEventListener('auxclick', (e) => { if (e.button === 1) window.pusula.sekmeKapat(t.id, true); });
    sekmeSuruklemeKur(d);
    el.sekmeler.appendChild(d);
  }
}

/*
 * SEKME TAŞIMA (sürükle-bırak).
 *
 * HTML5 drag-and-drop yerine fare olayları: başlık çubuğu -webkit-app-region
 * ile pencere sürüklemesine karışıyor ve HTML5 sürüklemesi orada güvenilmez
 * çalışıyor. Burada sekme DOM'da canlı yer değiştiriyor (Chrome'daki gibi),
 * bırakınca yeni sıra ana sürece bildiriliyor.
 *
 * EŞİK: 5px'ten kısa hareketler sürükleme sayılmıyor, yoksa her tıklama
 * kazara sıralamayı bozardı.
 */
const SURUKLE_ESIGI = 5;

function sekmeSuruklemeKur(d) {
  d.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('.kapat')) return;
    const baslangicX = e.clientX;
    let basladi = false;

    const hareket = (ev) => {
      if (!basladi) {
        if (Math.abs(ev.clientX - baslangicX) < SURUKLE_ESIGI) return;
        basladi = true;
        d._suruklendi = true;
        d.classList.add('suruklenen');
        document.body.classList.add('sekme-tasiniyor');
      }
      // İşaretçi hangi kardeşin ortasını geçtiyse oraya taşı.
      const kardesler = [...el.sekmeler.children].filter((x) => x !== d);
      let hedef = null;
      for (const k of kardesler) {
        const r = k.getBoundingClientRect();
        if (ev.clientX < r.left + r.width / 2) { hedef = k; break; }
      }
      if (hedef) el.sekmeler.insertBefore(d, hedef);
      else el.sekmeler.appendChild(d);
    };

    const birak = () => {
      document.removeEventListener('mousemove', hareket);
      document.removeEventListener('mouseup', birak);
      d.classList.remove('suruklenen');
      document.body.classList.remove('sekme-tasiniyor');
      if (!basladi) return;
      const sira = [...el.sekmeler.children]
        .map((x) => Number(x.dataset.id))
        .filter((n) => Number.isFinite(n));
      window.pusula.sekmeSirala(sira);
    };

    document.addEventListener('mousemove', hareket);
    document.addEventListener('mouseup', birak);
  });
}

/*
 * Favicon'u olmayan sekmenin simgesi.
 *
 * Eskiden burada düz gri bir kutu vardı; yeni sekme açıldığında sekme şeridi
 * boş bir kareyle başlıyordu. İki ayrı durum var ve ikisi farklı şey anlatır:
 *   - iç sayfa / yeni sekme (adres yok) -> uygulamanın kendi markası (pusula)
 *   - gerçek bir site ama simgesi yok   -> dünya
 * Gri kutu artık yalnızca yükleme sırasındaki kısa boşluk için değil, hiç
 * kullanılmıyor: her durumun kendi anlamı var.
 */
function sekmeSimgesi(icSayfa) {
  const d = document.createElement('div');
  d.className = 'sekme-simge' + (icSayfa ? ' marka' : '');
  d.innerHTML = icSayfa ? SIMGE.pusula : SIMGE.dunya;
  return d;
}

function aracCiz() {
  const t = aktif();
  el.geri.disabled = !t || !t.geriGidebilir;
  el.ileri.disabled = !t || !t.ileriGidebilir;
  el.arac.classList.toggle('yukleniyor', !!(t && t.yukleniyor));

  if (t && !adresDuzenleniyor && document.activeElement !== el.adres) {
    const taslak = adresTaslagi(t);
    el.adres.value = taslak ? taslak.metin : (t.gorunenUrl || '');
  }

  const engelleyiciAcik = !!durum.ayarlar.engelleyiciAcik && !(t && t.siteIzinli);
  el.kalkan.classList.toggle('acik', engelleyiciAcik);
  el.kalkan.classList.toggle('kapali', !engelleyiciAcik);
  el.engelSayi.textContent = t ? String(t.engellenen) : '0';
  el.kalkan.title = engelleyiciAcik
    ? cev('arac.kalkanAcik', { n: t ? t.engellenen : 0 })
    : cev('arac.kalkanKapali');

  // VPN açıkken araç çubuğu ikonu yeşil yanar: bağlantının sürdüğü ve o
  // ikonun VPN olduğu bir bakışta anlaşılsın (durum her yayında tazelenir).
  const vpnAcik = !!durum.ayarlar.vpnAcik;
  el.vpn.classList.toggle('vpn-acik', vpnAcik);
  el.vpn.title = vpnAcik ? cev('arac.vpnAcik') : cev('arac.vpn');

  // Genel reklam engelleyici düğmesi: SİTE bazlı kalkandan farklı olarak
  // store.ayarlar.engelleyiciAcik'ı yansıtır (tüm siteler).
  const genelAcik = !!durum.ayarlar.engelleyiciAcik;
  el.reklamEngel.classList.toggle('etkin', genelAcik);
  el.reklamEngel.setAttribute('aria-pressed', genelAcik ? 'true' : 'false');
  el.reklamEngel.title = cev(genelAcik ? 'arac.reklamEngelAcik' : 'arac.reklamEngelKapali');

  el.kilit.className = 'rozet';
  el.kilit.hidden = !(t && t.url);
  if (t && t.url) {
    el.kilit.classList.add(t.guvenli ? 'guvenli' : 'guvensiz');
    el.kilit.innerHTML = t.guvenli ? SIMGE.kilit : SIMGE.uyari;
    el.kilit.title = cev(t.guvenli ? 'arac.guvenli' : 'arac.guvensiz');
  }

  el.yerImi.classList.toggle('dolu', !!(t && t.yerImi));
  el.yerImi.title = cev(t && t.yerImi ? 'arac.yerImiCikar' : 'arac.yerImiEkle');
  el.adresKutu.classList.toggle('tam-ekran', !!(t && t.tamEkran));
  adresGosterCiz(t);
}

/*
 * Adres çubuğu, odakta değilken düz metin yerine vurgulu bir katman gösterir:
 * kayıtlanabilir alan adı koyu, şema ve alt alan adı ile yol soluk. Amaç
 * "accounts.google.com.giris.evil.com" gibi alt alan adı doldurmasında gerçek
 * sahibin gözden kaçmaması — 2026'da Chrome'un omnibox sahteciliği
 * düzeltmelerinin (CVE-2026-11666, -13988) hedeflediği sınıf.
 */
function adresGosterCiz(t) {
  const goster = t && t.gorunenUrl && document.activeElement !== el.adres && !adresDuzenleniyor && !adresTaslagi(t);
  el.adresGoster.hidden = !goster;
  if (!goster) return;

  el.adresGoster.replaceChildren();
  const parca = (sinif, metin) => {
    if (!metin) return;
    const s = document.createElement('span');
    s.className = sinif;
    s.textContent = metin;
    el.adresGoster.appendChild(s);
  };

  const metin = t.gorunenUrl;
  const host = alanAdi(t.url) || '';
  const kok = t.alanAdi || host;
  const i = host ? metin.indexOf(host) : -1;

  if (i < 0 || !kok || !host.endsWith(kok)) {
    parca('a-sonuk', metin);        // ayrıştıramadıysak hepsini soluk göster
    return;
  }
  parca('a-sonuk', metin.slice(0, i) + host.slice(0, host.length - kok.length));
  parca('a-alan', kok);
  parca('a-sonuk', metin.slice(i + host.length));
}

let suruklenenYerImi = null;
let duzenlenenYerImi = null;

// Sürüklenen yer imini hedefin önüne taşır ve yeni sırayı ana sürece bildirir.
function yerImiTasi(kaynakUrl, hedefUrl) {
  if (!kaynakUrl || kaynakUrl === hedefUrl) return;
  const sira = durum.yerImleri.map((y) => y.url);
  const i = sira.indexOf(kaynakUrl);
  if (i < 0) return;
  sira.splice(i, 1);
  const j = sira.indexOf(hedefUrl);
  sira.splice(j < 0 ? sira.length : j, 0, kaynakUrl);
  window.pusula.yerImiSirala(sira);
}

// Yer imi adını çubuğun içinde yerinde düzenlemek için küçük bir girdi.
function yerImiDuzenleKutusu(y) {
  const g = document.createElement('input');
  g.type = 'text';
  g.className = 'yerimi-duzenle';
  g.value = temizMetin(y.baslik || '') || alanAdi(y.url);
  g.spellcheck = false;

  const bitir = (kaydet) => {
    if (duzenlenenYerImi !== y.url) return;
    duzenlenenYerImi = null;
    if (kaydet) window.pusula.yerImiGuncelle(y.url, g.value, undefined);
    else yerImleriCiz();
  };

  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); bitir(true); }
    else if (e.key === 'Escape') { e.preventDefault(); bitir(false); }
  });
  g.addEventListener('blur', () => bitir(true));
  setTimeout(() => { g.focus(); g.select(); }, 0);
  return g;
}

// Yer imi etiketi: uzun sayfa başlığı yerine kısa ve tanınır bir ad.
function yerImiEtiketi(y) {
  const host = alanAdi(y.url);
  const baslik = temizMetin(y.baslik || '').trim();
  if (!baslik) return host || y.url;
  // "PayX.gg - Sanal Kartlar ve Gider Yönetimi" -> "PayX.gg"
  const ilkParca = baslik.split(/\s+[|–—-]\s+/)[0].trim();
  const aday = ilkParca.length >= 3 ? ilkParca : baslik;
  return aday.length > 22 ? (host || aday.slice(0, 22)) : aday;
}

// Menü sayfanın üstündeki katmanda çiziliyor (sitedeyken sayfa görünümü
// arayüzün üstünde olduğu için HTML menü altında kalırdı).
// ogeler: { tur: 'yerimi', y } | { tur: 'klasor', ad, yol, alt } | { tur: 'eylem', ad } | { tur: 'ayrac' }
function yerImiMenuAc(buton, ogeler, sagaHizala) {
  const donustur = (liste) => liste.map((o) => {
    if (o.tur === 'yerimi') return { tur: 'yerimi', url: o.y.url, baslik: temizMetin(o.y.baslik || ''), favicon: o.y.favicon || '' };
    if (o.tur === 'klasor') return { tur: 'klasor', ad: o.ad, yol: o.yol, alt: donustur(o.alt) };
    return { tur: o.tur, ad: o.ad };
  });
  const r = buton.getBoundingClientRect();
  window.pusula.yerImiKatmani({
    sol: r.left, sag: r.right, ust: r.bottom + 2, sagaHizala: !!sagaHizala,
    ogeler: donustur(ogeler)
  });
}

// Klasör adları 'A/B' yoluyla iç içe: ağaç kurar, menü öğelerine çevirir.
function yerImiAgaci() {
  const kok = { alt: new Map(), ogeler: [] };
  const yolaGit = (k) => {
    let d = kok;
    for (const seg of k.split('/').map((x) => x.trim()).filter(Boolean)) {
      if (!d.alt.has(seg)) d.alt.set(seg, { alt: new Map(), ogeler: [] });
      d = d.alt.get(seg);
    }
    return d;
  };
  for (const k of (durum.yerImiKlasorleri || [])) if (k && k.trim()) yolaGit(k);
  for (const y of durum.yerImleri) {
    const k = (y.klasor || '').trim();
    (k ? yolaGit(k) : kok).ogeler.push(y);
  }
  return kok;
}

function yerImiAgacOgeleri(d, onek) {
  const klasorler = Array.from(d.alt.entries()).map(([ad, c]) => {
    const yol = onek ? onek + '/' + ad : ad;
    return { tur: 'klasor', ad, yol, alt: yerImiAgacOgeleri(c, yol) };
  });
  return [...klasorler, ...d.ogeler.map((y) => ({ tur: 'yerimi', y }))];
}

// Yıldız / Ctrl+D kutusu sayfanın üstündeki katmanda çiziliyor (sitedeyken
// sayfa görünümü arayüzün üstünde olduğu için HTML kutu kesilirdi).
async function yerImiPopoverAc() {
  const t = aktif();
  if (!t || !t.url || t.dahiliPanel || t.hatali) return;

  const url = t.url;
  const mevcut = durum.yerImleri.find(y => y.url === url);
  const zatenEkli = !!mevcut;

  if (!zatenEkli) {
    await window.pusula.yerImiEkle({ url, baslik: t.baslik || url, klasor: '' });
  }
  const guncel = durum.yerImleri.find(y => y.url === url) || { url, baslik: t.baslik || url, klasor: '' };

  const klasorSet = new Set(durum.yerImiKlasorleri || []);
  for (const y of durum.yerImleri) {
    if (y.klasor && y.klasor.trim()) klasorSet.add(y.klasor.trim());
  }

  const r = el.yerImi.getBoundingClientRect();
  window.pusula.yerImiPopover({
    ust: r.bottom + 8,
    kenar: Math.max(6, document.documentElement.clientWidth - r.right),
    url,
    baslik: guncel.baslik || t.baslik || '',
    klasor: guncel.klasor || '',
    klasorler: Array.from(klasorSet).sort(),
    favicon: 'pusula-favicon://' + alanAdi(url),
    metin: {
      baslik: cev(zatenEkli ? 'yerimi.duzenleBaslik' : 'yerimi.eklendi'),
      duzenleBaslik: cev('yerimi.duzenleBaslik'), baskaKlasor: cev('yerimi.baskaKlasor'), url: cev('yerimi.url'),
      kaydet: cev('anaparola.kaydet'), iptal: cev('dialog.iptal'), kapat: cev('bul.kapat'),
      ad: cev('yerimi.adi'), klasor: cev('yerimi.klasor'), cubuk: cev('yerimi.cubuk'),
      yeniKlasor: cev('yerimi.yeniKlasor'), klasorAdi: cev('yerimi.klasorAdi'),
      kaldir: cev('panel.kaldir'), bitti: cev('yerimi.bitti')
    }
  });
}

function yerImleriCiz() {
  const goster = !!durum.ayarlar.yerImleriCubugu;
  el.yerImleriCubugu.hidden = !goster;
  if (!goster) { yerImCizildi = false; return; }   // gizli: tekrar görününce çizilsin

  // Ad düzenlenirken çubuğu yeniden çizmek girdiyi ve yazılanı siler;
  // durum yayını saniyede birkaç kez geliyor.
  if (duzenlenenYerImi && el.yerImleriCubugu.querySelector('.yerimi-duzenle')) return;

  // Yer imleri değişmedi ve şerit zaten çizili: pahalı yeniden kurmayı atla.
  if (yerImCizildi && !yerImYeni) return;
  yerImYeni = false;
  yerImCizildi = true;

  el.yerImleriCubugu.replaceChildren();
  if (!durum.yerImleri.length) {
    const b = document.createElement('span');
    b.className = 'bos';
    b.textContent = cev('yerimi.cubukBos');
    el.yerImleriCubugu.appendChild(b);
    return;
  }

  // Kök yer imleri ve klasörleri ayır
  const kokOgeler = [];
  const klasorGruplari = new Map();
  for (const y of durum.yerImleri) {
    const k = (y.klasor || '').trim();
    if (k) {
      if (!klasorGruplari.has(k)) klasorGruplari.set(k, []);
      klasorGruplari.get(k).push(y);
    } else {
      kokOgeler.push(y);
    }
  }

  // 1. Kök yer imlerini çiz (ilk 30)
  for (const y of kokOgeler) {
    if (y.url === duzenlenenYerImi) {
      el.yerImleriCubugu.appendChild(yerImiDuzenleKutusu(y));
      continue;
    }

    const b = document.createElement('button');
    b.className = 'yerimi';
    b.title = temizMetin(y.baslik || '') + '\n' + y.url;
    b.draggable = true;
    b.appendChild(simgeYap(y.url, y.favicon));
    const ad = document.createElement('span');
    ad.className = 'yerimi-ad';
    ad.textContent = yerImiEtiketi(y);
    b.appendChild(ad);

    b.addEventListener('click', () => window.pusula.git(y.url));
    b.addEventListener('auxclick', (e) => { if (e.button === 1) window.pusula.yeniSekme(y.url); });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.pusula.yerImiMenu(y.url);
    });

    // Sürükleyip sıralama
    b.addEventListener('dragstart', (e) => {
      suruklenenYerImi = y.url;
      e.dataTransfer.effectAllowed = 'move';
      // Firefox uyumu için bir veri koymak gerekiyor.
      e.dataTransfer.setData('text/plain', y.url);
    });
    b.addEventListener('dragend', () => {
      suruklenenYerImi = null;
      for (const e2 of el.yerImleriCubugu.children) e2.classList.remove('surukle-hedef');
    });
    b.addEventListener('dragover', (e) => {
      if (!suruklenenYerImi || suruklenenYerImi === y.url) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      b.classList.add('surukle-hedef');
    });
    b.addEventListener('dragleave', () => b.classList.remove('surukle-hedef'));
    b.addEventListener('drop', (e) => {
      e.preventDefault();
      b.classList.remove('surukle-hedef');
      yerImiTasi(suruklenenYerImi, y.url);
    });

    el.yerImleriCubugu.appendChild(b);
  }

  // Sığmayanlar "»" menüsüne gider (Chrome gibi).
  const ogeDugmeleri = Array.from(el.yerImleriCubugu.children);
  const kokMenu = kokOgeler.map((y) => ({ tur: 'yerimi', y }));
  const tumOgeler = yerImiAgacOgeleri(yerImiAgaci(), '');

  const tumu = document.createElement('button');
  tumu.className = 'yerimi yerimi-tumu';
  tumu.title = cev('yerimi.tumu');
  tumu.innerHTML = '<span class="yerimi-klasor-simge">' + SIMGE.klasor + '</span><span class="yerimi-ad">' +
    temizMetin(cev('yerimi.tumu')) + '</span>';
  tumu.addEventListener('click', (e) => {
    e.stopPropagation();
    yerImiMenuAc(tumu, [
      { tur: 'eylem', ad: cev('yerimi.tumu') },
      { tur: 'ayrac' },
      ...tumOgeler
    ], true);
  });

  const tasma = document.createElement('button');
  tasma.className = 'yerimi yerimi-tasma';
  tasma.title = cev('yerimi.tumu');
  tasma.innerHTML = SIMGE.tasma;
  tasma.hidden = true;

  el.yerImleriCubugu.append(tasma, tumu);

  const bosluk = el.yerImleriCubugu.clientWidth - 16 - tumu.offsetWidth - 40;
  let toplam = 0;
  let ilkTasan = -1;
  for (let i = 0; i < ogeDugmeleri.length; i++) {
    toplam += ogeDugmeleri[i].offsetWidth + 1;
    if (toplam > bosluk) { ilkTasan = i; break; }
  }
  if (ilkTasan >= 0 && el.yerImleriCubugu.clientWidth > 0) {
    for (let i = ilkTasan; i < ogeDugmeleri.length; i++) ogeDugmeleri[i].hidden = true;
    const tasanlar = kokMenu.slice(ilkTasan);
    tasma.hidden = false;
    tasma.addEventListener('click', (e) => {
      e.stopPropagation();
      yerImiMenuAc(tasma, tasanlar, false);
    });
  }
}

let yerImBoyutZamani = null;
window.addEventListener('resize', () => {
  clearTimeout(yerImBoyutZamani);
  yerImBoyutZamani = setTimeout(() => { yerImCizildi = false; yerImleriCiz(); }, 80);
});

// Çubuğun boş alanına sağ tık: ekleme, yönetme, gizleme.
el.yerImleriCubugu.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.pusula.yerImiMenu(null);
});

window.pusula.siteIzinleriDinle((origin) => { siteIzinleriAc(origin); });

window.pusula.yerImiDuzenleDinle((url) => {
  duzenlenenYerImi = url;
  yerImleriCiz();
});

let hakkindaGuncellemeTazele = null;

function ciz() {
  sekmeleriCiz();
  aracCiz();
  yerImleriCiz();
  // Geçmiş ve Ayarlar panellerinde girdi alanları var; durum yayını saniyede
  // birkaç kez geldiği için bunları yeniden çizmek kullanıcının yazdığını siler.
  if (acikPanel === 'indirmeler') { if (!indirmePaneliYamala()) panelCiz(); }
  else if (acikPanel === 'yerImleri' && yerImPanelImzasi() !== yerImPanelImza) panelCiz();
  if (acikPanel === 'ayarlar') guncellemeTazele();
  if (acikPanel === 'hakkinda' && hakkindaGuncellemeTazele) hakkindaGuncellemeTazele();
  indirmeGostergesiCiz();
  eklentiSabitCiz();
  yanCubukCiz();
}

/* ---------------- eklentiler: araç çubuğu ---------------- */

let eklentiSabitImza = '';

// Sabitlenmiş eklentilerin düğmeleri. Durum saniyede birkaç kez geldiği için
// yalnızca liste değişince yeniden çizilir.
function eklentiSabitCiz() {
  const liste = durum.eklentiSabit || [];
  const imza = liste.map((e) => e.id + ':' + e.ad + ':' + (e.simge ? e.simge.length : 0)).join('|');
  if (imza === eklentiSabitImza) return;
  eklentiSabitImza = imza;
  el.eklentiSabit.replaceChildren();
  for (const e of liste) {
    const b = document.createElement('button');
    b.className = 'ikon eklenti-dugme';
    b.dataset.id = e.id;
    if (e.id === eklentiAcikId) b.classList.add('basili');
    b.title = e.ad;
    b.setAttribute('aria-label', e.ad);
    if (e.simge) {
      const img = document.createElement('img');
      img.src = e.simge;
      img.alt = '';
      img.draggable = false;
      b.appendChild(img);
    } else {
      const h = document.createElement('span');
      h.className = 'eklenti-harf';
      h.textContent = (e.ad || '?').trim().charAt(0).toUpperCase();
      b.appendChild(h);
    }
    b.addEventListener('click', () => {
      const r = b.getBoundingClientRect();
      onerileriKapat();
      window.pusula.eklentiAc({ id: e.id, sag: r.right, y: r.bottom + 2 });
    });
    b.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      window.pusula.eklentiBaglam({ id: e.id, x: Math.round(ev.clientX), y: Math.round(ev.clientY) });
    });
    el.eklentiSabit.appendChild(b);
  }
}

el.eklentiler.addEventListener('click', () => {
  const r = el.eklentiler.getBoundingClientRect();
  onerileriKapat();
  window.pusula.eklentiMenu({ sol: r.left, sag: r.right, y: r.bottom + 2 });
});

/* ---------------- kenar çubuğu ve yan paneller ---------------- */

const PANEL_SIMGELERI = {
  wikipedia: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M14.67 4.25c.34.8.71 1.76 1.1 2.87.5 1.45.98 3 1.44 4.63.39-1.57.77-3.1 1.15-4.6.35-1.37.66-2.33.93-2.9h2.38l-4.5 14.86h-2.14l-2.48-6.95-2.58 6.95H7.81L3.3 4.25h2.46c.35.84.71 1.83 1.08 2.97.47 1.46.94 3.01 1.41 4.65.37-1.57.74-3.1 1.12-4.6.35-1.37.66-2.38.93-3.02z"/></svg>',
  gemini: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2C12 7.523 7.523 12 2 12c5.523 0 10 4.477 10 10 0-5.523 4.477-10 10-10-5.523 0-10-4.477-10-10z"/></svg>',
  claude: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v3.2a1.5 1.5 0 0 1-3 0V3.5A1.5 1.5 0 0 1 12 2zm7.07 4.93a1.5 1.5 0 0 1 0 2.12l-2.26 2.26a1.5 1.5 0 1 1-2.12-2.12l2.26-2.26a1.5 1.5 0 0 1 2.12 0zm2.93 7.07a1.5 1.5 0 0 1-1.5 1.5h-3.2a1.5 1.5 0 0 1 0-3h3.2a1.5 1.5 0 0 1 1.5 1.5zm-4.93 7.07a1.5 1.5 0 0 1-2.12 0l-2.26-2.26a1.5 1.5 0 0 1 2.12-2.12l2.26 2.26a1.5 1.5 0 0 1 0 2.12zM12 22a1.5 1.5 0 0 1-1.5-1.5v-3.2a1.5 1.5 0 0 1 3 0v3.2A1.5 1.5 0 0 1 12 22zm-7.07-4.93a1.5 1.5 0 0 1 0-2.12l2.26-2.26a1.5 1.5 0 0 1 2.12 2.12l-2.26 2.26a1.5 1.5 0 0 1-2.12 0zM2 12a1.5 1.5 0 0 1 1.5-1.5h3.2a1.5 1.5 0 0 1 0 3H3.5A1.5 1.5 0 0 1 2 12zm4.93-7.07a1.5 1.5 0 0 1 2.12 0l2.26 2.26a1.5 1.5 0 0 1-2.12 2.12L7.05 7.05a1.5 1.5 0 0 1 0-2.12z"/></svg>',
  chatgpt: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M22.28 9.37a5.54 5.54 0 0 0-.48-4.63 5.66 5.66 0 0 0-5.83-2.6 5.6 5.6 0 0 0-4.32-1.92 5.66 5.66 0 0 0-5.38 3.9 5.6 5.6 0 0 0-3.9 2.82 5.66 5.66 0 0 0 .73 6.32 5.55 5.55 0 0 0 .48 4.63 5.66 5.66 0 0 0 5.83 2.6 5.6 5.6 0 0 0 4.32 1.92 5.66 5.66 0 0 0 5.38-3.9 5.6 5.6 0 0 0 3.9-2.82 5.66 5.66 0 0 0-.72-6.32zm-7.66 11.23a4.13 4.13 0 0 1-2.62-.94l.13-.08 4.35-2.52a.77.77 0 0 0 .39-.67v-6.14l1.84 1.06a.07.07 0 0 1 .04.05v5.1a4.15 4.15 0 0 1-4.13 4.14zm-8.87-4.2a4.14 4.14 0 0 1-.5-2.74l.13.08 4.35 2.51a.76.76 0 0 0 .77 0l5.32-3.07v2.13a.08.08 0 0 1-.03.06l-4.42 2.55a4.15 4.15 0 0 1-5.62-1.52zm-1.25-9.36a4.14 4.14 0 0 1 2.12-1.8l-.01.15v5.03a.77.77 0 0 0 .38.67l5.32 3.07-1.84 1.06a.08.08 0 0 1-.07 0l-4.42-2.55a4.15 4.15 0 0 1-1.48-5.63zm13.1 3.53l-5.32-3.07 1.84-1.06a.08.08 0 0 1 .07 0l4.42 2.55a4.15 4.15 0 0 1-1.01 7.66v-5.08a.77.77 0 0 0-.39-.67zm2.34-1.73l-.13-.08-4.35-2.51a.76.76 0 0 0-.77 0l-5.32 3.07V7.19a.08.08 0 0 1 .03-.06l4.42-2.55a4.15 4.15 0 0 1 6.12 4.29zm-8.24 4.76l-2.38-1.38 2.38-1.37 2.38 1.37z"/></svg>',
  deepseek: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4.5 13.5c1.2-4.2 5.1-7.5 9.5-7.5 3.3 0 6.2 1.8 7.8 4.6l-2.4 1.4C18.2 10.3 16 9 14 9c-3.1 0-5.8 2.1-6.7 5.1-.3 1-.3 2.1 0 3.1 1 2.8 3.6 4.8 6.7 4.8 2 0 4.2-1.3 5.4-3l2.4 1.4c-1.6 2.8-4.5 4.6-7.8 4.6-4.4 0-8.3-3.3-9.5-7.5-.4-1.3-.4-2.7 0-4z"/><circle cx="14" cy="14" r="2.5"/></svg>',
  grok: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.24 2.25h3.49L14.1 11.01l8.97 10.74h-7.03l-5.5-6.47-6.3 6.47H.74l8.1-9.33L.24 2.25h7.21l4.98 5.86zm-1.22 17.51h1.93L7.14 4.19H5.07z"/></svg>',
  kure: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
};

let yanPanelSonGenislik = 380;
let yanCubukImza = '';

function yanCubukCiz() {
  const ayarlar = durum.ayarlar || {};
  const yanCubukGoster = !!ayarlar.yanCubukGoster;
  const yanPanelAcik = yanCubukGoster && !!ayarlar.yanPanelAcik;
  const aktifPanelId = ayarlar.yanPanelAktif || 'wikipedia';
  const paneller = Array.isArray(ayarlar.yanPaneller) ? ayarlar.yanPaneller : [];

  el.yanCubuk.hidden = !yanCubukGoster;
  if (el.btnYanCubuk) {
    el.btnYanCubuk.classList.toggle('aktif', yanCubukGoster);
  }

  const genislik = Math.max(260, Math.min(800, ayarlar.yanPanelGenislik || 380));
  yanPanelSonGenislik = genislik;
  document.documentElement.style.setProperty('--yan-panel-genislik', genislik + 'px');

  el.yanPanelCerceve.hidden = !yanPanelAcik;

  const imza = paneller.map((p) => p.id + ':' + p.ad).join('|') + '|' + (yanPanelAcik ? aktifPanelId : 'kapali');
  if (imza !== yanCubukImza) {
    yanCubukImza = imza;
    el.yanCubukWebPaneller.replaceChildren();

    for (const p of paneller) {
      const b = document.createElement('button');
      b.className = 'yan-btn';
      if (yanPanelAcik && aktifPanelId === p.id) b.classList.add('aktif');
      b.title = p.ad;
      b.setAttribute('aria-label', p.ad);

      const simgeHtml = PANEL_SIMGELERI[p.ikon] || PANEL_SIMGELERI[p.id] || PANEL_SIMGELERI.kure;
      b.innerHTML = simgeHtml;

      if (p.ozel) {
        b.addEventListener('contextmenu', async (ev) => {
          ev.preventDefault();
          if (confirm(cev('panel.yanPanelSil') + ': ' + p.ad + '?')) {
            await window.pusula.yanPanelSil(p.id);
          }
        });
      }

      b.addEventListener('click', () => {
        el.yanPanelIcerik.hidden = true;
        el.yanPanelIcerik.replaceChildren();
        window.pusula.yanPanelAc(p.id);
      });

      el.yanCubukWebPaneller.appendChild(b);
    }
  }

  el.btnYanYerImleri.classList.toggle('aktif', yanPanelAcik && aktifPanelId === 'yerImleri');
  el.btnYanGecmis.classList.toggle('aktif', yanPanelAcik && aktifPanelId === 'gecmis');
  el.btnYanIndirmeler.classList.toggle('aktif', yanPanelAcik && aktifPanelId === 'indirilenler');

  if (yanPanelAcik) {
    const aktifPanel = paneller.find((p) => p.id === aktifPanelId);
    if (aktifPanel) {
      el.yanPanelBaslikMetin.textContent = (durum.yanPanel && durum.yanPanel.baslik) ? durum.yanPanel.baslik : aktifPanel.ad;
      const simgeHtml = PANEL_SIMGELERI[aktifPanel.ikon] || PANEL_SIMGELERI[aktifPanel.id] || PANEL_SIMGELERI.kure;
      el.yanPanelSimge.innerHTML = simgeHtml;
      el.btnYanPanelMobil.hidden = false;
      el.btnYanPanelGeri.hidden = false;
      el.btnYanPanelIleri.hidden = false;
      el.btnYanPanelYenile.hidden = false;
      el.btnYanPanelAnasayfa.hidden = false;
      el.btnYanPanelSekmedeAc.hidden = false;

      el.btnYanPanelMobil.classList.toggle('aktif', !!ayarlar.yanPanelMobil);

      if (durum.yanPanel) {
        el.btnYanPanelGeri.disabled = !durum.yanPanel.geriGidebilir;
        el.btnYanPanelIleri.disabled = !durum.yanPanel.ileriGidebilir;
        if (durum.yanPanel.yukleniyor) {
          el.btnYanPanelYenile.classList.add('ikon-donuyor');
        } else {
          el.btnYanPanelYenile.classList.remove('ikon-donuyor');
        }
      }
    } else if (aktifPanelId === 'yerImleri' || aktifPanelId === 'gecmis' || aktifPanelId === 'indirilenler') {
      el.yanPanelBaslikMetin.textContent = cev('panel.' + aktifPanelId);
      el.btnYanPanelMobil.hidden = true;
      el.btnYanPanelGeri.hidden = true;
      el.btnYanPanelIleri.hidden = true;
      el.btnYanPanelYenile.hidden = true;
      el.btnYanPanelAnasayfa.hidden = true;
      el.btnYanPanelSekmedeAc.hidden = true;
    }
  }
}

function yanPanelAracGoster(tur) {
  if (durum.ayarlar && durum.ayarlar.yanPanelAcik && durum.ayarlar.yanPanelAktif === tur) {
    window.pusula.yanPanelKapat();
    el.yanPanelIcerik.hidden = true;
    el.yanPanelIcerik.replaceChildren();
    return;
  }
  window.pusula.yanPanelAc(tur);
  el.yanPanelIcerik.hidden = false;
  el.yanPanelIcerik.replaceChildren();

  if (tur === 'yerImleri') {
    const list = durum.yerImleri || [];
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'liste-bos';
      p.textContent = cev('yerimi.bos');
      el.yanPanelIcerik.appendChild(p);
      return;
    }
    for (const y of list) {
      const a = document.createElement('a');
      a.className = 'yan-panel-liste-oge';
      a.textContent = y.baslik || y.url;
      a.href = y.url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.pusula.yeniSekme(y.url);
      });
      el.yanPanelIcerik.appendChild(a);
    }
  } else if (tur === 'gecmis') {
    window.pusula.gecmisListele('').then((list) => {
      if (!list || !list.length) {
        const p = document.createElement('p');
        p.className = 'liste-bos';
        p.textContent = cev('gecmis.bos');
        el.yanPanelIcerik.appendChild(p);
        return;
      }
      for (const g of list.slice(0, 50)) {
        const a = document.createElement('a');
        a.className = 'yan-panel-liste-oge';
        a.textContent = g.baslik || g.url;
        a.href = g.url;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          window.pusula.yeniSekme(g.url);
        });
        el.yanPanelIcerik.appendChild(a);
      }
    });
  } else if (tur === 'indirilenler') {
    const list = durum.indirmeler || [];
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'liste-bos';
      p.textContent = cev('indirme.bos');
      el.yanPanelIcerik.appendChild(p);
      return;
    }
    for (const ind of list) {
      const div = document.createElement('div');
      div.className = 'yan-panel-liste-oge';
      div.textContent = ind.ad || ind.url;
      el.yanPanelIcerik.appendChild(div);
    }
  }
}

function yanPanelEkleModalAc() {
  el.yanPanelEkleAd.value = '';
  el.yanPanelEkleUrl.value = '';
  el.yanPanelEkleModal.hidden = false;
  el.yanPanelEkleAd.focus();
}

function yanPanelEkleModalKapat() {
  el.yanPanelEkleModal.hidden = true;
}

async function yanPanelEkleOnayla() {
  const ad = el.yanPanelEkleAd.value.trim();
  const url = el.yanPanelEkleUrl.value.trim();
  if (!url) return;
  await window.pusula.yanPanelEkle({ ad, url });
  yanPanelEkleModalKapat();
}

el.btnYanCubuk.addEventListener('click', () => window.pusula.yanCubukGecis());
el.btnYanCubukGecis.addEventListener('click', () => window.pusula.yanCubukGecis());
el.btnYanYerImleri.addEventListener('click', () => yanPanelAracGoster('yerImleri'));
el.btnYanGecmis.addEventListener('click', () => yanPanelAracGoster('gecmis'));
el.btnYanIndirmeler.addEventListener('click', () => yanPanelAracGoster('indirilenler'));
el.btnYanPanelMobil.addEventListener('click', () => window.pusula.yanPanelMobilGecis());
el.btnYanPanelGeri.addEventListener('click', () => window.pusula.yanPanelGeri());
el.btnYanPanelIleri.addEventListener('click', () => window.pusula.yanPanelIleri());
el.btnYanPanelYenile.addEventListener('click', () => window.pusula.yanPanelYenile());
el.btnYanPanelAnasayfa.addEventListener('click', () => window.pusula.yanPanelAnasayfa());
el.btnYanPanelSekmedeAc.addEventListener('click', () => window.pusula.yanPanelSekmedeAc());
el.btnYanPanelKapat.addEventListener('click', () => window.pusula.yanPanelKapat());
el.btnYanPanelEkle.addEventListener('click', yanPanelEkleModalAc);
el.btnYanPanelEkleIptal.addEventListener('click', yanPanelEkleModalKapat);
el.btnYanPanelEkleOnayla.addEventListener('click', yanPanelEkleOnayla);
el.yanPanelEkleModal.addEventListener('click', (e) => {
  if (e.target === el.yanPanelEkleModal) yanPanelEkleModalKapat();
});
el.yanPanelEkleUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') yanPanelEkleOnayla();
  else if (e.key === 'Escape') yanPanelEkleModalKapat();
});

let ayiriciSurukleme = false;
let baslangicX = 0;
let baslangicGenislik = 380;

el.yanPanelAyirici.addEventListener('mousedown', (e) => {
  ayiriciSurukleme = true;
  baslangicX = e.clientX;
  baslangicGenislik = yanPanelSonGenislik;
  el.yanPanelAyirici.classList.add('surukleniyor');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

window.addEventListener('mousemove', (e) => {
  if (!ayiriciSurukleme) return;
  const farkX = e.clientX - baslangicX;
  const yeniG = Math.max(260, Math.min(800, baslangicGenislik + farkX));
  yanPanelSonGenislik = yeniG;
  document.documentElement.style.setProperty('--yan-panel-genislik', yeniG + 'px');
  window.pusula.yanPanelGenislik(yeniG);
});

window.addEventListener('mouseup', () => {
  if (!ayiriciSurukleme) return;
  ayiriciSurukleme = false;
  el.yanPanelAyirici.classList.remove('surukleniyor');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

/*
 * Araç çubuğundaki indirme düğmesi, panel kapalıyken de indirmenin sürdüğünü
 * göstersin: ok canlanır ve düğmenin altında toplam ilerleme çizgisi belirir.
 * Boyutu bilinmeyen indirmelerde yüzde hesaplanamaz; o durumda yalnızca
 * animasyon kalır, çizgi belirsiz kipte akar.
 */
function indirmeGostergesiCiz() {
  const suren = (durum.indirmeler || []).filter((i) => i.durum === 'devam');
  el.indirmeler.classList.toggle('iniyor', suren.length > 0);

  const olculebilir = suren.filter((i) => i.toplam > 0);
  const belirsiz = suren.length > 0 && olculebilir.length === 0;
  el.indirmeler.classList.toggle('belirsiz', belirsiz);

  if (olculebilir.length) {
    const alinan = olculebilir.reduce((t, i) => t + i.alinan, 0);
    const toplam = olculebilir.reduce((t, i) => t + i.toplam, 0);
    el.indirmeler.style.setProperty('--ilerleme', String(Math.round((alinan / toplam) * 100)));
  } else {
    el.indirmeler.style.removeProperty('--ilerleme');
  }
}

/*
 * Güncelleme göstergesini yerinde tazeler. Durum adı değişmediyse yalnızca
 * yüzde ve metin güncellenir; panel yeniden çizilmez, böylece kullanıcının
 * ayarlardaki girdilere yazdığı silinmez. Durum adı değiştiyse düğmenin
 * eylemi de değişmiş demektir, o zaman panel baştan çizilir.
 */
function guncellemeTazele() {
  const cubuk = document.getElementById('gncIlerleme');
  if (!cubuk) return;
  const gu = durum.guncelleme || { durum: 'kapali', ilerleme: 0 };

  if (cubuk.dataset.durum !== gu.durum) { panelCiz(); return; }

  if (gu.durum === 'iniyor') {
    const ic = cubuk.firstElementChild;
    if (ic) ic.style.width = (gu.ilerleme || 0) + '%';
    const metin = document.getElementById('gncDurum');
    if (metin) metin.textContent = cev('guncelleme.iniyor', { n: gu.ilerleme });
  }
}

/* ---------------- adres çubuğu ve öneriler ---------------- */

function motorAdi() {
  const m = durum.motorlar[durum.ayarlar.aramaMotoru];
  return m ? m.ad : cev('ayar.aramaMotoru');
}

function adresGibiMi(s) {
  return /^[a-z][a-z0-9+.-]*:/i.test(s) || /^[^\s]+\.[^\s]{2,}/.test(s) || /^localhost(:\d+)?/.test(s);
}

async function onerileriTazele() {
  const q = el.adres.value.trim();
  const benim = ++oneriIstek;
  if (!q) return onerileriKapat();

  const gecmis = await window.pusula.gecmisListele(q);
  // IPC gidiş-dönüşü sırasında kullanıcı Escape'e basmış ya da başka bir
  // sorgu yazmış olabilir; eski sonuç listeyi geri açmasın.
  if (benim !== oneriIstek || !adresDuzenleniyor || document.activeElement !== el.adres) return;

  const liste = [];

  if (adresGibiMi(q)) liste.push({ tur: 'adres', baslik: q, url: q, etiket: cev('oneri.adreseGit') });
  liste.push({ tur: 'arama', baslik: q, url: q, etiket: cev('oneri.ara', { motor: motorAdi() }) });

  const gorulen = new Set();
  for (const g of gecmis) {
    if (gorulen.has(g.url)) continue;
    gorulen.add(g.url);
    // Başlık yoksa kısa adres başlığa çıkıyor; aynı metni iki kez yazmayalım.
    const baslik = temizMetin(g.baslik);
    liste.push({
      tur: 'gecmis',
      baslik: baslik || kisaUrl(g.url),
      url: g.url,
      etiket: baslik ? kisaUrl(g.url) : ''
    });
    if (liste.length >= 8) break;
  }

  oneriListesi = liste;
  oneriSecim = 0;
  onerileriCiz();
}

/*
 * Liste chrome akışında duruyor (sayfa görünümü yerel bir katman olduğu için
 * üstüne binemiyoruz), ama pencere genişliğinde bir bant gibi durmasın diye
 * adres kutusuyla aynı hizaya ve genişliğe oturtuyoruz.
 */
function oneriHizala() {
  const k = el.adresKutu.getBoundingClientRect();
  if (!k.width) return;
  const sag = Math.max(0, document.documentElement.clientWidth - k.right);
  el.oneriler.style.setProperty('--oneri-sol', Math.round(k.left) + 'px');
  el.oneriler.style.setProperty('--oneri-sag', Math.round(sag) + 'px');
  // Liste mutlak konumlu; üst kenarı adres kutusunun hemen altına gelsin.
  el.oneriler.style.setProperty('--oneri-ust', Math.round(k.bottom + 4) + 'px');
}

function onerileriCiz() {
  el.oneriler.replaceChildren();
  oneriHizala();
  oneriListesi.forEach((o, i) => {
    const d = document.createElement('div');
    d.className = 'oneri';
    d.setAttribute('role', 'option');
    d.title = o.tur === 'gecmis' ? o.url : o.baslik;

    const simge = document.createElement('span');
    simge.className = 'o-simge';
    // Geçmiş satırlarında sitenin kendi simgesi, aksi hâlde eylem simgesi.
    if (o.tur === 'gecmis') simge.appendChild(simgeYap(o.url, 'pusula-favicon://' + alanAdi(o.url)));
    else simge.innerHTML = o.tur === 'arama' ? SIMGE.ara : SIMGE.dunya;
    d.appendChild(simge);

    const b = document.createElement('span');
    b.className = 'o-baslik';
    b.textContent = temizMetin(o.baslik);
    d.appendChild(b);

    if (o.etiket) {
      const ek = document.createElement('span');
      ek.className = 'o-ek';
      ek.textContent = o.etiket;
      d.appendChild(ek);
    }

    d.addEventListener('mousedown', (e) => { e.preventDefault(); oneriUygula(i); });
    el.oneriler.appendChild(d);
  });
  el.oneriler.hidden = oneriListesi.length === 0;
  oneriSecimiCiz();
  oneriGorunurlukGuncelle();
}

/*
 * Öneri açık/kapandığında main'e haber ver: sayfa görünümü gizlenip anlık
 * görüntüsü #sayfaGoruntu'ya konsun, böylece liste sayfayı aşağı itmek yerine
 * üstüne binsin. Yalnızca DURUM DEĞİŞİMİNDE tetikleniyor (her tuş vuruşunda
 * değil), yoksa her harfte capturePage çağrılırdı.
 */
let oneriAcikDurum = false;
function oneriGorunurlukGuncelle() {
  const acik = !el.oneriler.hidden;
  if (acik === oneriAcikDurum) return;
  oneriAcikDurum = acik;
  if (acik) {
    window.pusula.oneriDurum(true);
  } else {
    window.pusula.oneriDurum(false);
    el.sayfaGoruntu.hidden = true;
    el.sayfaGoruntu.style.backgroundImage = '';
  }
}

// Ok tuşlarında bütün listeyi yeniden kurmuyoruz: satırlar yeniden kurulunca
// simge <img>'leri de sıfırlanır ve favicon yeniden istenirdi.
function oneriSecimiCiz() {
  const satirlar = el.oneriler.children;
  for (let i = 0; i < satirlar.length; i++) {
    const secili = i === oneriSecim;
    satirlar[i].classList.toggle('secili', secili);
    satirlar[i].setAttribute('aria-selected', secili ? 'true' : 'false');
    if (secili) satirlar[i].scrollIntoView({ block: 'nearest' });
  }
}

function onerileriKapat() {
  oneriIstek++;            // bekleyen sorgular listeyi geri açmasın
  oneriListesi = [];
  oneriSecim = -1;
  el.oneriler.hidden = true;
  el.oneriler.replaceChildren();
  oneriGorunurlukGuncelle();
}

function oneriUygula(i) {
  const o = oneriListesi[i];
  if (!o) return;
  adresDuzenleniyor = false;
  if (aktif()) adresTaslak.delete(aktif().id);
  onerileriKapat();
  el.adres.blur();
  window.pusula.git(o.tur === 'gecmis' || o.tur === 'adres' ? o.url : o.baslik);
}

el.adres.addEventListener('focus', () => {
  adresDuzenleniyor = true;
  el.adresGoster.hidden = true;   // düzenlerken gerçek metin görünsün
  el.adres.select();
});
el.adresGoster.addEventListener('mousedown', (e) => { e.preventDefault(); el.adres.focus(); });

function adresBaglamMenusuAc(e) {
  e.preventDefault();
  e.stopPropagation();
  el.adresGoster.hidden = true;
  el.adres.focus();
  const seciliVarMi = el.adres.selectionStart !== el.adres.selectionEnd;
  const deger = el.adres.value;
  if (!seciliVarMi && deger) {
    el.adres.select();
  }
  const seciliMetin = el.adres.value.substring(el.adres.selectionStart, el.adres.selectionEnd);
  window.pusula.adresMenu({
    x: Math.round(e.clientX),
    y: Math.round(e.clientY),
    bosMu: !deger,
    seciliVarMi: Boolean(seciliMetin)
  });
}

el.adres.addEventListener('contextmenu', adresBaglamMenusuAc);
el.adresAlan.addEventListener('contextmenu', adresBaglamMenusuAc);
el.adresGoster.addEventListener('contextmenu', adresBaglamMenusuAc);
el.adresKutu.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('button')) {
    adresBaglamMenusuAc(e);
  }
});
el.adres.addEventListener('input', () => {
  adresDuzenleniyor = true;
  const t = aktif();
  if (t) {
    const taban = t.gorunenUrl || '';
    if (el.adres.value === taban) adresTaslak.delete(t.id);
    else adresTaslak.set(t.id, { metin: el.adres.value, taban, gezinme: t.gezinme || 0 });
  }
  onerileriTazele();
});
el.adres.addEventListener('blur', () => {
  adresDuzenleniyor = false;
  setTimeout(onerileriKapat, 0);
  aracCiz();
});

el.adres.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!oneriListesi.length) return;
    e.preventDefault();
    oneriSecim = (oneriSecim + (e.key === 'ArrowDown' ? 1 : -1) + oneriListesi.length) % oneriListesi.length;
    oneriSecimiCiz();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (oneriSecim >= 0 && oneriListesi.length) return oneriUygula(oneriSecim);
    const v = el.adres.value.trim();
    if (!v) return;
    adresDuzenleniyor = false;
    if (aktif()) adresTaslak.delete(aktif().id);
    onerileriKapat();
    el.adres.blur();
    window.pusula.git(v);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    onerileriKapat();
    adresDuzenleniyor = false;
    if (aktif()) adresTaslak.delete(aktif().id);
    el.adres.blur();
    aracCiz();
  }
});

/* ---------------- araç çubuğu düğmeleri ---------------- */

el.yeniSekme.addEventListener('click', () => window.pusula.yeniSekme());
el.geri.addEventListener('click', () => window.pusula.geri());
el.ileri.addEventListener('click', () => window.pusula.ileri());
el.anasayfa.addEventListener('click', () => window.pusula.anasayfa());
el.yenile.addEventListener('click', () => {
  const t = aktif();
  if (t && t.yukleniyor) window.pusula.dur(); else window.pusula.yenile();
});
el.yerImi.addEventListener('click', () => yerImiPopoverAc());
el.kalkan.addEventListener('click', () => {
  const t = aktif();
  if (t && t.alanAdi) window.pusula.siteEngelleyici();
  else panelAc('ayarlar');
});
// Kilit simgesi Chrome'daki gibi site bilgisi menüsünü açar.
el.kilit.addEventListener('click', () => {
  const r = el.kilit.getBoundingClientRect();
  onerileriKapat();
  window.pusula.siteMenu({ sol: r.left, y: r.bottom + 6 });
});

/*
 * Onbellegi sifirla: HTTP onbellegini bosaltip acik sayfayi onbelleksiz
 * yeniden yukler. Kullanicilarin en sik takildigi sey eski surumu gormek.
 * Dugme, isin bittigini kisa bir durum degisikligiyle soyluyor - sessizce
 * hicbir sey olmamasi burada "calismiyor" diye okunurdu.
 */
el.onbellek.addEventListener('click', async () => {
  if (el.onbellek.disabled) return;
  el.onbellek.disabled = true;
  el.onbellek.classList.add('calisiyor');
  const oldu = await window.pusula.onbellekTemizle();
  el.onbellek.classList.remove('calisiyor');
  el.onbellek.classList.toggle('tamam', !!oldu);
  el.onbellek.title = cev(oldu ? 'arac.onbellekTemizlendi' : 'arac.onbellekHata');
  setTimeout(() => {
    el.onbellek.classList.remove('tamam');
    el.onbellek.disabled = false;
    el.onbellek.title = cev('arac.onbellek');
  }, 1600);
});

/*
 * Genel reklam engelleyiciyi aç/kapat. Site bazlı kalkandan (siteEngelleyici)
 * ayrı: bu, tüm siteler için geçerli olan store.ayarlar.engelleyiciAcik'ı
 * çeviriyor. Yeni bir IPC yok - mevcut ayarDegistir kanalı kullanılıyor;
 * main.js toggle sonrası aktif sekmeyi yeniliyor (ağ + kozmetik + karşı-önlem
 * yeni değere göre uygulansın).
 */
el.reklamEngel.addEventListener('click', () => {
  window.pusula.ayarDegistir('engelleyiciAcik', !durum.ayarlar.engelleyiciAcik);
});

el.gecmis.addEventListener('click', () => window.pusula.dahiliSayfaAc('gecmis'));
el.vpn.addEventListener('click', () => vpnMenusuAc());
el.istatistik.addEventListener('click', () => window.pusula.dahiliSayfaAc('istatistik'));
el.indirmeler.addEventListener('click', () => indirmeMenusuAc());
// ≡ düğmesi ana menüyü açar. Menü yerel (native) çiziliyor: sayfa görünümü
// arayüzün üstünde bir katman olduğu için HTML açılır menü altında kalırdı.
el.ayarlar.addEventListener('click', () => {
  const r = el.ayarlar.getBoundingClientRect();
  onerileriKapat();
  // Sağ kenar hizalaması için düğmenin sağ kenarını gönderiyoruz.
  window.pusula.anaMenu({ sag: r.right, y: r.bottom + 2 });
});

/* ---------------- indirilenler açılır menüsü ---------------- */


/*
 * İndirilenler kutusu artık chrome içinde değil, sayfanın üstündeki katmanda
 * çiziliyor (bkz. main.js katmanGoster). Chrome içinde açıldığında paneli
 * büyütüp sayfayı aşağı itiyordu. Burada yalnızca düğmenin konumunu ölçüp
 * ana sürece bildiriyoruz.
 */
function indirmeMenusuAc() {
  const r = el.indirmeler.getBoundingClientRect();
  const sagKenar = Math.max(0, document.documentElement.clientWidth - r.right);
  // Yerel menülerle aynı çapa: düğmenin alt kenarı.
  window.pusula.indirmeMenu({ sagKenar, y: r.bottom + 2 });
}

// VPN kutusu da (indirilenler gibi) sayfanın üstündeki katmanda açılıyor;
// burada yalnızca düğmenin konumunu ölçüp ana sürece bildiriyoruz.
function vpnMenusuAc() {
  const r = el.vpn.getBoundingClientRect();
  const sagKenar = Math.max(0, document.documentElement.clientWidth - r.right);
  window.pusula.vpnMenu({ sagKenar, y: r.bottom + 2 });
}

// İzin kutusu bir tıklamayla açılmadığı için kilidin konumunu önceden
// bildiriyoruz; chrome yeniden boyutlandıkça tazeleniyor.
function olculeriBildir() {
  const k = el.kilit.getBoundingClientRect();
  if (!k.width && !k.height) return;
  window.pusula.olcuBildir({ kilitSol: k.left, kilitAlt: k.bottom });
}

/* ---------------- sayfada bul ---------------- */

function bulmaAc() {
  el.bulCubugu.hidden = false;
  el.bulGirdi.focus();
  el.bulGirdi.select();
}

function bulmaKapat() {
  el.bulCubugu.hidden = true;
  el.bulGirdi.value = '';
  el.bulSayac.textContent = '0/0';
  window.pusula.bulmaKapat();
}

el.bulGirdi.addEventListener('input', () => window.pusula.bul(el.bulGirdi.value, true, false));
el.bulGirdi.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    window.pusula.bul(el.bulGirdi.value, !e.shiftKey, true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    bulmaKapat();
  }
});
el.bulOnceki.addEventListener('click', () => window.pusula.bul(el.bulGirdi.value, false, true));
el.bulSonraki.addEventListener('click', () => window.pusula.bul(el.bulGirdi.value, true, true));
el.bulKapat.addEventListener('click', bulmaKapat);

/* ---------------- panel ---------------- */

function panelAc(ad, sekmeModu = false) {
  acikPanel = ad;
  if (sekmeModu) {
    el.panel.classList.add('sekme-sayfasi');
    el.panelKapat.hidden = true;
  } else {
    el.panel.classList.remove('sekme-sayfasi');
    el.panelKapat.hidden = false;
  }
  el.panel.hidden = false;
  window.pusula.panelBildir(true);
  panelCiz();
}

function panelKapat() {
  acikPanel = null;
  clearTimeout(panelArama);
  el.panel.classList.remove('sekme-sayfasi');
  el.panelKapat.hidden = false;
  el.panel.hidden = true;
  el.panelArac.replaceChildren();
  el.panelIcerik.replaceChildren();
  window.pusula.panelBildir(false);
}

el.panelKapat.addEventListener('click', panelKapat);

// Panel kimliği -> çeviri anahtarı
const PANEL_ANAHTARI = {
  gecmis: 'panel.gecmis',
  yerImleri: 'panel.yerImleri',
  indirmeler: 'panel.indirilenler',
  ayarlar: 'panel.ayarlar',
  siteIzinleri: 'panel.siteIzinleri',
  istatistik: 'panel.istatistik',
  parolalar: 'panel.parolalar',
  hizTesti: 'panel.hizTesti',
  hakkinda: 'panel.hakkinda',
  aktarma: 'aktarma.baslik',
  eklentiler: 'panel.eklentiler',
  bayraklar: 'panel.bayraklar'
};

function panelCiz() {
  el.panelAd.textContent = acikPanel ? cev(PANEL_ANAHTARI[acikPanel]) : '';
  el.panelArac.replaceChildren();
  el.panelIcerik.replaceChildren();
  if (acikPanel === 'gecmis') gecmisPaneli();
  else if (acikPanel === 'yerImleri') yerImleriPaneli();
  else if (acikPanel === 'indirmeler') indirmelerPaneli();
  else if (acikPanel === 'ayarlar') ayarlarPaneli();
  else if (acikPanel === 'siteIzinleri') siteIzinleriPaneli();
  else if (acikPanel === 'istatistik') istatistikPaneli();
  else if (acikPanel === 'parolalar') parolalarPaneli();
  else if (acikPanel === 'hizTesti') hizTestiPaneli();
  else if (acikPanel === 'hakkinda') hakkindaPaneli();
  else if (acikPanel === 'aktarma') aktarmaPaneli();
  else if (acikPanel === 'eklentiler') eklentilerPaneli();
  else if (acikPanel === 'bayraklar') bayraklarPaneli();
}

/* ---------------- bayraklar paneli (omni://flags) ---------------- */

/*
 * chrome://flags benzeri. Her bayrak: Varsayılan / Etkin / Devre dışı. Seçim
 * ayar dosyasına yazılır, komut satırı anahtarları yalnızca açılışta verilebildiği
 * için "Yeniden başlat" çubuğu çıkar. "Varsayılan" = katalogdaki değer (WebRTC
 * Kyber varsayılan olarak devre dışıdır).
 */
async function bayraklarPaneli(sorgu = '') {
  const liste = await window.pusula.bayrakListe();
  if (acikPanel !== 'bayraklar') return;
  const durumlar = {};
  for (const b of liste) if (b.durum !== 'varsayilan') durumlar[b.id] = b.durum;
  const ara = document.createElement('input');
  ara.type = 'search';
  ara.placeholder = cev('bayrak.ara');
  ara.value = sorgu;

  const sifirla = document.createElement('button');
  sifirla.className = 'dugme';
  sifirla.textContent = cev('bayrak.sifirla');
  el.panelArac.replaceChildren(ara, sifirla);

  const uyari = document.createElement('div');
  uyari.className = 'a-aciklama';
  uyari.style.padding = '8px 4px 12px';
  uyari.textContent = cev('bayrak.uyari');

  const kap = kartYap();
  const yenidenBar = document.createElement('div');
  yenidenBar.className = 'ayar';
  yenidenBar.style.display = 'none';
  const yenidenMetin = document.createElement('div');
  yenidenMetin.className = 'a-ad';
  yenidenMetin.textContent = cev('bayrak.yenidenBaslatNot');
  const yenidenDugme = document.createElement('button');
  yenidenDugme.className = 'dugme dugme-vurgulu';
  yenidenDugme.textContent = cev('bayrak.yenidenBaslat');
  yenidenDugme.addEventListener('click', () => window.pusula.bayrakYenidenBaslat());
  yenidenBar.append(yenidenMetin, yenidenDugme);

  const secimler = [];
  const durumMetni = (v) => cev(v ? 'bayrak.etkin' : 'bayrak.devreDisi');

  async function kaydet() {
    await window.pusula.ayarDegistir('bayraklar', durumlar);
    yenidenBar.style.display = '';
  }

  for (const b of liste) {
    const sec = document.createElement('select');
    for (const [deger, etiket] of [
      ['varsayilan', cev('bayrak.varsayilan') + ' (' + durumMetni(b.varsayilan) + ')'],
      ['etkin', cev('bayrak.etkin')],
      ['kapali', cev('bayrak.devreDisi')]
    ]) {
      const o = document.createElement('option');
      o.value = deger;
      o.textContent = etiket;
      if (b.durum === deger) o.selected = true;
      sec.appendChild(o);
    }
    sec.addEventListener('change', () => {
      if (sec.value === 'varsayilan') delete durumlar[b.id];
      else durumlar[b.id] = sec.value;
      kaydet();
    });
    const satir = ayarSatiri(b.ad, b.aciklama, sec);
    satir.dataset.arama = (b.ad + ' ' + b.aciklama + ' ' + b.id).toLowerCase();
    secimler.push({ satir, sec, b });
    kap.appendChild(satir);
  }

  const bos = document.createElement('div');
  bos.className = 'a-aciklama';
  bos.style.padding = '16px';
  bos.textContent = cev('bayrak.bulunamadi');
  bos.hidden = true;

  function filtrele() {
    const q = ara.value.trim().toLowerCase();
    let gorunen = 0;
    for (const { satir } of secimler) {
      const goster = !q || satir.dataset.arama.includes(q);
      satir.style.display = goster ? '' : 'none';
      if (goster) gorunen++;
    }
    bos.hidden = gorunen > 0;
  }
  ara.addEventListener('input', filtrele);

  sifirla.addEventListener('click', async () => {
    for (const k of Object.keys(durumlar)) delete durumlar[k];
    for (const { sec } of secimler) sec.value = 'varsayilan';
    await kaydet();
  });

  el.panelIcerik.replaceChildren(uyari, yenidenBar, kap, bos);
  filtrele();
  ara.focus();
}

/* ---------------- eklentiler paneli (omni://extensions) ---------------- */

/*
 * Chrome'un chrome://extensions sayfası gibi: üstte arama ve geliştirici modu, kart ızgarası
 * (ad, sürüm, açıklama, aç/kapat, Ayrıntılar, Kaldır) ve her eklenti için ayrıntı sayfası
 * (izinler, site erişimi, boyut, kimlik, kaynak, araç çubuğuna sabitleme...).
 * Geliştirici modu yalnızca bu cihazın tarayıcısında (localStorage) hatırlanır.
 */
let eklentiGelistirici = false;
try { eklentiGelistirici = localStorage.getItem('eklentiGelistirici') === '1'; } catch { /* depolama yok */ }
let eklentiArama = '';
let eklentiAyrinti = null;     // ayrıntı sayfası açıksa eklenti kimliği

const EKLENTI_TUM_SITELER = new Set(['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*']);

function eklentiSimgesi(e, boyut) {
  const k = document.createElement('span');
  k.className = 'eklenti-simge' + (boyut === 'buyuk' ? ' buyuk' : '');
  if (e.simge) {
    const img = document.createElement('img');
    img.src = e.simge;
    img.alt = '';
    img.draggable = false;
    k.appendChild(img);
  } else {
    k.textContent = (e.ad || '?').trim().charAt(0).toUpperCase();
  }
  return k;
}

function eklentiDugme(metin, tikla, sinif) {
  const b = document.createElement('button');
  b.className = 'dugme' + (sinif ? ' ' + sinif : '');
  b.textContent = metin;
  b.addEventListener('click', tikla);
  return b;
}

async function eklentilerPaneli() {
  el.panelArac.replaceChildren();

  const sayfa = document.createElement('div');
  sayfa.className = 'eklenti-sayfa';

  /* ---- üst çubuk: arama + geliştirici modu ---- */
  const ust = document.createElement('div');
  ust.className = 'eklenti-ust';
  const aramaKutu = document.createElement('div');
  aramaKutu.className = 'eklenti-arama';
  aramaKutu.innerHTML = SIMGE.ara;
  const arama = document.createElement('input');
  arama.type = 'search';
  arama.spellcheck = false;
  arama.placeholder = cev('eklenti.ara');
  arama.value = eklentiArama;
  aramaKutu.appendChild(arama);

  const gelistirici = document.createElement('label');
  gelistirici.className = 'eklenti-gelistirici';
  const gelistiriciMetin = document.createElement('span');
  gelistiriciMetin.textContent = cev('eklenti.gelistirici');
  gelistirici.append(gelistiriciMetin, anahtar(eklentiGelistirici, (v) => {
    eklentiGelistirici = !!v;
    try { localStorage.setItem('eklentiGelistirici', v ? '1' : '0'); } catch { /* depolama yok */ }
    govdeCiz();
  }));
  ust.append(aramaKutu, gelistirici);

  /* ---- gövde: kenar çubuğu + içerik ---- */
  const govde = document.createElement('div');
  govde.className = 'eklenti-govde';
  const kenar = document.createElement('nav');
  kenar.className = 'eklenti-kenar';
  const nav = document.createElement('button');
  nav.className = 'eklenti-nav aktif';
  nav.innerHTML = SIMGE.eklenti;
  nav.appendChild(document.createTextNode(cev('eklenti.eklentilerim')));
  nav.addEventListener('click', () => { eklentiAyrinti = null; govdeCiz(); });
  const magazaNot = document.createElement('div');
  magazaNot.className = 'eklenti-kenar-not';
  const magazaLink = document.createElement('button');
  magazaLink.className = 'eklenti-baglanti';
  magazaLink.textContent = cev('eklenti.magaza');
  magazaLink.addEventListener('click', () => window.pusula.eklentiMagazaAc());
  const magazaMetin = document.createElement('div');
  magazaMetin.textContent = cev('eklenti.magazaKesfet');
  magazaNot.append(magazaLink, magazaMetin);
  kenar.append(nav, magazaNot);

  const icerik = document.createElement('div');
  icerik.className = 'eklenti-icerik';
  govde.append(kenar, icerik);

  sayfa.append(ust, govde);
  el.panelIcerik.appendChild(sayfa);

  arama.addEventListener('input', () => { eklentiArama = arama.value; if (!eklentiAyrinti) govdeCiz(); });

  const mesajKutu = document.createElement('div');
  mesajKutu.className = 'aktarma-durum eklenti-mesaj';
  mesajKutu.style.display = 'none';
  const mesaj = (metin, hata) => {
    mesajKutu.style.display = metin ? 'block' : 'none';
    mesajKutu.style.color = hata ? '#f87171' : '#34d399';
    mesajKutu.textContent = metin || '';
  };
  const sonucMesaji = (s) => {
    if (!s || s.iptal) return mesaj('');
    if (s.basarili) mesaj(cev('eklenti.kuruldu', { ad: s.ad || '' }));
    else if (s.hata && s.hata !== 'busy') mesaj(s.hata, true);
    else mesaj('');
  };

  let liste = [];

  async function veriYukle() {
    liste = (await window.pusula.eklentiListe()) || [];
  }

  async function govdeCiz() {
    if (acikPanel !== 'eklentiler') return;
    if (!liste.length && !eklentiAyrinti) await veriYukle();
    icerik.replaceChildren();
    if (eklentiAyrinti) {
      const e = liste.find((x) => x.id === eklentiAyrinti);
      if (e) return ayrintiCiz(e);
      eklentiAyrinti = null;
    }
    listeCiz();
  }

  async function yenidenYukleCiz() {
    await veriYukle();
    await govdeCiz();
  }

  /* ---- kurulum alanı + liste ---- */
  function listeCiz() {
    // Kurulum kutusu: Web Store adresi / kimlik (+ geliştirici modunda dosya/klasör/güncelleme)
    const kur = document.createElement('div');
    kur.className = 'eklenti-kur';
    const satir = document.createElement('div');
    satir.className = 'eklenti-kur-satir';
    const girdi = document.createElement('input');
    girdi.type = 'text';
    girdi.spellcheck = false;
    girdi.placeholder = cev('eklenti.magazaGirdi');
    const kurBtn = eklentiDugme(cev('eklenti.kur'), () => magazadanKur(), 'dugme-vurgulu');
    satir.append(girdi, kurBtn);
    kur.appendChild(satir);

    const dugmeler = [kurBtn];
    const calistir = async (is) => {
      for (const d of dugmeler) d.disabled = true;
      mesaj(cev('eklenti.kuruluyor'));
      try { sonucMesaji(await is()); }
      catch (err) { mesaj(err.message || cev('eklenti.kurulamadi'), true); }
      finally { for (const d of dugmeler) d.disabled = false; await yenidenYukleCiz(); }
    };
    const magazadanKur = () => {
      const v = girdi.value.trim();
      if (!v) return;
      calistir(async () => {
        const s = await window.pusula.eklentiKurMagaza(v);
        if (s && s.basarili) girdi.value = '';
        return s;
      });
    };
    girdi.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') magazadanKur(); });

    if (eklentiGelistirici) {
      const arac = document.createElement('div');
      arac.className = 'eklenti-kur-satir eklenti-arac';
      const klasor = eklentiDugme(cev('eklenti.klasorYukle'), () => calistir(() => window.pusula.eklentiKurDosya('klasor')));
      const crx = eklentiDugme(cev('eklenti.crxYukle'), () => calistir(() => window.pusula.eklentiKurDosya('crx')));
      const guncelle = eklentiDugme(cev('eklenti.guncelle'), () => {
        calistir(async () => {
          mesaj(cev('eklenti.guncelleniyor'));
          const s = await window.pusula.eklentiGuncelle();
          if (s.guncellenen) mesaj(cev('eklenti.guncellendi', { n: s.guncellenen }));
          else if (s.hata) mesaj(cev('eklenti.guncelHata', { n: s.hata }), true);
          else mesaj(cev('eklenti.guncelHepsi'));
          return { iptal: true, _mesajVar: true };
        }).then(() => {});
      });
      dugmeler.push(klasor, crx, guncelle);
      arac.append(klasor, crx, guncelle);
      kur.appendChild(arac);
    }
    kur.appendChild(mesajKutu);
    icerik.appendChild(kur);

    const baslik = document.createElement('h2');
    baslik.className = 'eklenti-baslik';
    baslik.textContent = cev('eklenti.tumEklentiler');
    icerik.appendChild(baslik);

    const q = eklentiArama.trim().toLowerCase();
    const gorunen = liste.filter((e) => !q || (e.ad + ' ' + (e.aciklama || '')).toLowerCase().includes(q));
    if (!liste.length) { icerik.appendChild(bosDurum(cev('eklenti.yok'))); return; }
    if (!gorunen.length) { icerik.appendChild(bosDurum(cev('eklenti.sonuclarYok'))); return; }

    const izgara = document.createElement('div');
    izgara.className = 'eklenti-izgara';
    for (const e of gorunen) izgara.appendChild(kartCiz(e));
    icerik.appendChild(izgara);
  }

  function durumMetni(e) {
    return e.isciCalisiyor ? cev('eklenti.etkin') : cev('eklenti.etkinDegil');
  }

  function kartCiz(e) {
    const k = document.createElement('div');
    k.className = 'eklenti-kart' + (e.etkin ? '' : ' pasif');

    const ustSatir = document.createElement('div');
    ustSatir.className = 'eklenti-kart-ust';
    const bilgi = document.createElement('div');
    bilgi.className = 'eklenti-kart-bilgi';
    const ad = document.createElement('div');
    ad.className = 'eklenti-kart-ad';
    const adMetin = document.createElement('span');
    adMetin.className = 'eklenti-kart-adi';
    adMetin.textContent = temizMetin(e.ad);
    const surum = document.createElement('span');
    surum.className = 'eklenti-kart-surum';
    surum.textContent = e.surum;
    ad.append(adMetin, surum);
    const aciklama = document.createElement('div');
    aciklama.className = 'eklenti-kart-aciklama';
    aciklama.textContent = e.hata || e.aciklama || '';
    if (e.hata) aciklama.style.color = '#f87171';
    bilgi.append(ad, aciklama);
    ustSatir.append(eklentiSimgesi(e), bilgi);
    k.appendChild(ustSatir);

    if (eklentiGelistirici) {
      const meta = document.createElement('div');
      meta.className = 'eklenti-kart-meta';
      const kimlik = document.createElement('div');
      kimlik.textContent = cev('eklenti.kimlik') + ': ' + e.id;
      meta.appendChild(kimlik);
      if (e.isci) {
        const g = document.createElement('div');
        g.append(document.createTextNode(cev('eklenti.gorunumler') + ': '));
        const l = document.createElement('span');
        l.className = 'eklenti-baglanti-metin';
        l.textContent = cev('eklenti.hizmetCalisani') + ' (' + durumMetni(e) + ')';
        g.appendChild(l);
        meta.appendChild(g);
      }
      k.appendChild(meta);
    }

    const alt = document.createElement('div');
    alt.className = 'eklenti-kart-alt';
    alt.append(
      eklentiDugme(cev('eklenti.ayrintilar'), () => { eklentiAyrinti = e.id; govdeCiz(); }),
      eklentiDugme(cev('eklenti.kaldir'), async () => { await window.pusula.eklentiKaldir(e.id); await yenidenYukleCiz(); })
    );
    const bosluk = document.createElement('span');
    bosluk.className = 'eklenti-bosluk';
    alt.appendChild(bosluk);
    if (eklentiGelistirici && e.kaynak === 'klasor') {
      const yenile = document.createElement('button');
      yenile.className = 'ikon kucuk';
      yenile.title = cev('eklenti.yenile');
      yenile.innerHTML = SIMGE.yenile;
      yenile.addEventListener('click', async () => {
        const s = await window.pusula.eklentiYenile(e.id);
        if (s && s.hata) mesaj(s.hata, true);
        await yenidenYukleCiz();
      });
      alt.appendChild(yenile);
    }
    alt.appendChild(anahtar(e.etkin, async (v) => {
      const s = await window.pusula.eklentiEtkin(e.id, v);
      if (s && s.hata) mesaj(s.hata, true);
      await yenidenYukleCiz();
    }));
    k.appendChild(alt);
    return k;
  }

  /* ---- ayrıntı sayfası ---- */
  async function ayrintiCiz(e) {
    const d = (await window.pusula.eklentiDetay(e.id)) || {};
    if (acikPanel !== 'eklentiler' || eklentiAyrinti !== e.id) return;

    const kutu = document.createElement('div');
    kutu.className = 'eklenti-ayrinti';

    const bas = document.createElement('div');
    bas.className = 'eklenti-ayrinti-bas';
    const geri = document.createElement('button');
    geri.className = 'ikon';
    geri.title = cev('eklenti.geri');
    geri.innerHTML = SIMGE.geri;
    geri.addEventListener('click', () => { eklentiAyrinti = null; govdeCiz(); });
    const adi = document.createElement('span');
    adi.className = 'eklenti-ayrinti-adi';
    adi.textContent = temizMetin(e.ad);
    bas.append(geri, eklentiSimgesi(e), adi);
    kutu.appendChild(bas);

    const satir = (etiket, govde, sinif) => {
      const s = document.createElement('div');
      s.className = 'eklenti-ayrinti-satir' + (sinif ? ' ' + sinif : '');
      const m = document.createElement('div');
      m.className = 'eklenti-ayrinti-metin';
      const l = document.createElement('div');
      l.className = 'eklenti-ayrinti-etiket';
      l.textContent = etiket;
      m.appendChild(l);
      if (govde instanceof Node) m.appendChild(govde);
      else if (govde) {
        const v = document.createElement('div');
        v.className = 'eklenti-ayrinti-deger';
        v.textContent = govde;
        m.appendChild(v);
      }
      s.appendChild(m);
      kutu.appendChild(s);
      return s;
    };
    const anahtarSatiri = (etiket, aciklama, deger, degisti) => {
      const s = satir(etiket, aciklama);
      s.appendChild(anahtar(deger, degisti));
      return s;
    };
    const baglantiSatiri = (etiket, tikla) => {
      const s = satir(etiket, null, 'tiklanir');
      s.insertAdjacentHTML('beforeend', '<span class="eklenti-ok">' + SIMGE.dis + '</span>');
      s.addEventListener('click', tikla);
      return s;
    };

    anahtarSatiri(e.etkin ? cev('eklenti.acik') : cev('eklenti.kapali'), '', e.etkin, async (v) => {
      const s = await window.pusula.eklentiEtkin(e.id, v);
      if (s && s.hata) mesaj(s.hata, true);
      await yenidenYukleCiz();
    });
    if (e.aciklama) satir(cev('eklenti.aciklamaEtiket'), e.aciklama);
    satir(cev('eklenti.surum'), e.surum);
    if (d.boyut) satir(cev('eklenti.boyut'), boyutMetni(d.boyut));
    satir(cev('eklenti.kimlik'), e.id);
    if (d.isci) satir(cev('eklenti.gorunumler'), cev(d.isciTuru === 'hizmet' ? 'eklenti.hizmetCalisani' : 'eklenti.arkaPlanSayfasi')
      + ' (' + (d.isciCalisiyor ? cev('eklenti.etkin') : cev('eklenti.etkinDegil')) + ')');

    const izinListesi = document.createElement('ul');
    izinListesi.className = 'eklenti-ayrinti-liste';
    for (const p of (d.izinler || [])) { const li = document.createElement('li'); li.textContent = p; izinListesi.appendChild(li); }
    satir(cev('eklenti.izinler'), (d.izinler || []).length ? izinListesi : cev('eklenti.izinYok'));

    const siteler = d.siteler || [];
    const siteKap = document.createElement('div');
    const siteAciklama = document.createElement('div');
    siteAciklama.className = 'eklenti-ayrinti-deger';
    siteAciklama.textContent = siteler.length ? cev('eklenti.siteErisimiAciklama') : cev('eklenti.siteYok');
    siteKap.appendChild(siteAciklama);
    if (siteler.length) {
      const rozetler = document.createElement('div');
      rozetler.className = 'onay-rozetler eklenti-rozetler';
      const tum = siteler.some((s) => EKLENTI_TUM_SITELER.has(s));
      for (const s of (tum ? [cev('eklenti.tumSiteler')] : siteler)) {
        const r = document.createElement('span');
        r.className = 'onay-rozet' + (tum ? '' : ' mono');
        r.textContent = s;
        rozetler.appendChild(r);
      }
      siteKap.appendChild(rozetler);
    }
    satir(cev('eklenti.siteErisimi'), siteKap);

    anahtarSatiri(cev('eklenti.sabitle'), '', e.sabit, async (v) => {
      await window.pusula.eklentiSabitle(e.id, v);
      await yenidenYukleCiz();
    });
    anahtarSatiri(cev('eklenti.dosyaErisimi'), '', !!d.dosyaErisimi, async (v) => {
      const s = await window.pusula.eklentiDosyaErisimi(e.id, v);
      if (s && s.hata) mesaj(s.hata, true);
    });
    if (e.etkin && e.secenekler) baglantiSatiri(cev('eklenti.secenekler'), () => window.pusula.eklentiSecenekler(e.id));
    if (d.magazaUrl) baglantiSatiri(cev('eklenti.magazadaGoster'), () => window.pusula.eklentiMagazadaGoster(e.id));
    const kaynakAd = { magaza: 'eklenti.kaynakMagaza', crx: 'eklenti.kaynakCrx', klasor: 'eklenti.kaynakKlasor' }[d.kaynak];
    satir(cev('eklenti.kaynak'), kaynakAd ? cev(kaynakAd) : cev('eklenti.kaynakCrx'));

    const kaldir = satir(cev('eklenti.eklentiyiKaldir'), null, 'tiklanir tehlike');
    kaldir.insertAdjacentHTML('beforeend', '<span class="eklenti-ok">' + SIMGE.sag + '</span>');
    kaldir.addEventListener('click', async () => {
      const silindi = await window.pusula.eklentiKaldir(e.id);
      if (silindi) { eklentiAyrinti = null; }
      await yenidenYukleCiz();
    });

    icerik.appendChild(kutu);
  }

  await veriYukle();
  await govdeCiz();
}

/*
 * Site izin duvarı: TEK bir sitenin bütün izinleri tek ekranda, üç durumlu.
 * Adres çubuğundaki kilit menüsünden açılıyor. "Sor" kaydı siler, yani site
 * genel varsayılanı izlemeye döner; hangi varsayılanın geçerli olduğu her
 * satırda yazıyor ki kullanıcı neyi değiştirdiğini görsün.
 */
let siteIzinVeri = null;

async function siteIzinleriPaneli() {
  el.panelAd.textContent = cev('panel.siteIzinleri');

  const kap = kartYap();
  el.panelIcerik.appendChild(kap);

  const veri = siteIzinVeri;
  if (!veri) {
    const b = document.createElement('div');
    b.className = 'liste-bos';
    b.textContent = cev('izin.siteYok');
    kap.appendChild(b);
    return;
  }

  const ust = document.createElement('div');
  ust.className = 'izin-site-baslik';
  ust.textContent = veri.origin;
  kap.appendChild(ust);

  for (const tur of veri.turler) {
    const kayitli = veri.kayitli[tur];
    const varsayilan = veri.varsayilan[tur] || 'sor';

    const sec = document.createElement('select');
    for (const [deger, anahtar] of [
      ['sor', 'izin.durumSor'], ['izin', 'izin.durumIzin'], ['ret', 'izin.durumRet']
    ]) {
      const o = document.createElement('option');
      o.value = deger;
      o.textContent = cev(anahtar) +
        (deger === varsayilan ? ' (' + cev('izin.varsayilanEk') + ')' : '');
      if ((kayitli || 'sor') === deger) o.selected = true;
      sec.appendChild(o);
    }
    sec.addEventListener('change', async () => {
      await window.pusula.izinSiteAyarla(veri.origin, tur, sec.value);
      siteIzinVeri = await window.pusula.izinSiteOku(veri.origin);
      // Panel yeniden çizilmezse ekran kaydedilenle çelişen bir durum gösterir:
      // "genel varsayılan uygulanıyor" yazısı eski kalıyordu.
      if (acikPanel === 'siteIzinleri') panelCiz();
    });

    kap.appendChild(ayarSatiri(
      cev('izin.' + tur),
      kayitli ? cev('izin.siteKarari') : cev('izin.varsayilanIzleniyor'),
      sec
    ));
  }
}

async function siteIzinleriAc(origin) {
  siteIzinVeri = await window.pusula.izinSiteOku(origin);
  panelAc('siteIzinleri');
}

function satirYap({ baslik, url, zaman, silGeriCagirim }) {
  const d = document.createElement('div');
  d.className = 'satir';
  d.title = url;

  d.appendChild(simgeYap(url, 'pusula-favicon://' + alanAdi(url)));

  const metin = document.createElement('div');
  metin.className = 'satir-metin';
  const b = document.createElement('div');
  b.className = 's-baslik';
  b.textContent = temizMetin(baslik) || kisaUrl(url);
  const u = document.createElement('div');
  u.className = 's-url';
  u.textContent = kisaUrl(url);
  metin.append(b, u);
  d.appendChild(metin);

  if (zaman) {
    const z = document.createElement('span');
    z.className = 's-zaman';
    z.textContent = saatMetni(zaman);
    d.appendChild(z);
  }
  if (silGeriCagirim) {
    const s = document.createElement('button');
    s.className = 'ikon kucuk s-sil';
    s.title = cev('panel.kaldir');
    s.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';
    s.addEventListener('click', (e) => { e.stopPropagation(); silGeriCagirim(); });
    d.appendChild(s);
  }

  d.addEventListener('click', () => { panelKapat(); window.pusula.git(url); });
  d.addEventListener('auxclick', (e) => { if (e.button === 1) window.pusula.yeniSekme(url); });
  return d;
}

function bosDurum(metin) {
  const p = document.createElement('p');
  p.className = 'bos-durum';
  p.textContent = metin;
  return p;
}

async function gecmisPaneli(sorgu = '') {
  const ara = document.createElement('input');
  ara.type = 'search';
  ara.placeholder = cev('gecmis.ara');
  ara.value = sorgu;
  ara.addEventListener('input', () => {
    clearTimeout(panelArama);
    panelArama = setTimeout(() => gecmisListesiCiz(ara.value), 150);
  });

  const temizle = document.createElement('button');
  temizle.className = 'dugme';
  temizle.textContent = cev('gecmis.temizle');
  temizle.addEventListener('click', async () => {
    await window.pusula.gecmisTemizle();
    gecmisListesiCiz('');
  });

  el.panelArac.replaceChildren(ara, temizle);
  gecmisListesiCiz(sorgu);
  ara.focus();
}

async function gecmisListesiCiz(sorgu) {
  const kayitlar = await window.pusula.gecmisListele(sorgu);
  // Bekleyen sorgu dönerken kullanıcı başka panele geçmiş olabilir.
  if (acikPanel !== 'gecmis') return;
  el.panelIcerik.replaceChildren();
  if (!kayitlar.length) {
    el.panelIcerik.appendChild(bosDurum(cev(sorgu ? 'gecmis.eslesmeYok' : 'gecmis.bos')));
    return;
  }
  let sonGun = null;
  let kart = null;
  for (const k of kayitlar) {
    const gun = gunMetni(k.zaman);
    if (gun !== sonGun) {
      sonGun = gun;
      const h = document.createElement('div');
      h.className = 'gun-basligi';
      h.textContent = gun;
      el.panelIcerik.appendChild(h);
      kart = kartYap();
      el.panelIcerik.appendChild(kart);
    }
    const ogeKart = kart;
    const satir = satirYap({
      baslik: k.baslik,
      url: k.url,
      zaman: k.zaman,
      silGeriCagirim: async () => {
        await window.pusula.gecmisTekilSil({ url: k.url, zaman: k.zaman });
        satir.remove();
        if (ogeKart && !ogeKart.children.length) {
          if (ogeKart.previousElementSibling && ogeKart.previousElementSibling.className === 'gun-basligi') {
            ogeKart.previousElementSibling.remove();
          }
          ogeKart.remove();
        }
      }
    });
    kart.appendChild(satir);
  }
}

// Chrome'un yer imi yöneticisi gibi: solda klasör ağacı, sağda seçili klasörün
// listesi, üstte arama. '' = yer imleri çubuğu (kök).
let yerImSeciliKlasor = '';
let yerImAramaMetni = '';
let yerImPanelImza = '';

function yerImPanelImzasi() {
  return JSON.stringify([
    durum.yerImleri.map((y) => [y.url, y.baslik, y.klasor || '']),
    durum.yerImiKlasorleri || []
  ]);
}

function yerImleriPaneli() {
  yerImPanelImza = yerImPanelImzasi();

  const aktarDugme = document.createElement('button');
  aktarDugme.className = 'dugme';
  aktarDugme.textContent = cev('ayar.iceAktarDugme');
  aktarDugme.addEventListener('click', () => window.pusula.dahiliSayfaAc('aktarma'));

  const ara = document.createElement('input');
  ara.type = 'search';
  ara.placeholder = cev('gecmis.ara');
  ara.value = yerImAramaMetni;
  el.panelArac.append(ara, aktarDugme);

  // Klasör adları 'A/B' yoluyla iç içe: ağaç olarak göster.
  const agac = yerImiAgaci();
  const dugumBul = (yol) => {
    let d = agac;
    for (const seg of yol.split('/').filter(Boolean)) {
      d = d.alt.get(seg);
      if (!d) return null;
    }
    return d;
  };
  const toplamSayi = (d) => d.ogeler.length + Array.from(d.alt.values()).reduce((t, c) => t + toplamSayi(c), 0);
  if (yerImSeciliKlasor && !dugumBul(yerImSeciliKlasor)) yerImSeciliKlasor = '';

  const duzen = document.createElement('div');
  duzen.className = 'yim-duzen';
  const yan = document.createElement('div');
  yan.className = 'yim-yan';
  const ana = document.createElement('div');
  ana.className = 'yim-ana';
  duzen.append(yan, ana);
  el.panelIcerik.appendChild(duzen);

  function yanOge(etiket, yol, derinlik) {
    const b = document.createElement('div');
    b.className = 'yim-klasor' + (!yerImAramaMetni && yerImSeciliKlasor === yol ? ' secili' : '');
    b.style.paddingLeft = (12 + derinlik * 16) + 'px';
    const simge = document.createElement('span');
    simge.className = 'yim-klasor-simge';
    simge.innerHTML = SIMGE.klasor;
    const metin = document.createElement('span');
    metin.className = 'yim-klasor-ad';
    metin.textContent = etiket;
    b.append(simge, metin);
    b.addEventListener('click', () => {
      yerImSeciliKlasor = yol;
      yerImAramaMetni = '';
      panelCiz();
    });
    if (yol) {
      const dugmeler = document.createElement('span');
      dugmeler.className = 'yim-klasor-dugmeler';
      const adlandir = document.createElement('button');
      adlandir.type = 'button';
      adlandir.className = 'ikon kucuk';
      adlandir.textContent = '✏';
      adlandir.title = cev('yerimi.klasorAdlandir');
      // prompt() Electron'da yok: ad yerinde düzenlenir.
      adlandir.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.querySelector('.yim-adlandir-girdi')) return;
        const girdi = document.createElement('input');
        girdi.type = 'text';
        girdi.className = 'yim-adlandir-girdi';
        girdi.value = etiket;
        girdi.placeholder = cev('yerimi.klasorAdi');
        metin.replaceWith(girdi);
        dugmeler.hidden = true;
        let bitti = false;
        const iptal = () => {
          if (bitti) return;
          bitti = true;
          girdi.replaceWith(metin);
          dugmeler.hidden = false;
        };
        const uygula = async () => {
          if (bitti) return;
          const yeni = girdi.value.trim().split('/').join('-');
          if (!yeni || yeni === etiket) return iptal();
          bitti = true;
          const ust = yol.includes('/') ? yol.slice(0, yol.lastIndexOf('/') + 1) : '';
          const yeniYol = ust + yeni;
          await window.pusula.yerImiKlasorAdlandir({ eskiAd: yol, yeniAd: yeniYol });
          if (yerImSeciliKlasor === yol || yerImSeciliKlasor.startsWith(yol + '/')) {
            yerImSeciliKlasor = yeniYol + yerImSeciliKlasor.slice(yol.length);
          }
          panelCiz();
        };
        girdi.addEventListener('click', (ev) => ev.stopPropagation());
        girdi.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') uygula();
          else if (ev.key === 'Escape') iptal();
        });
        girdi.addEventListener('blur', () => { uygula(); });
        girdi.focus();
        girdi.select();
      });
      const sil = document.createElement('button');
      sil.type = 'button';
      sil.className = 'ikon kucuk';
      sil.textContent = '🗑';
      sil.title = cev('yerimi.klasorSil');
      sil.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(yol + ' - ' + cev('yerimi.klasorSil') + '?')) {
          await window.pusula.yerImiKlasorSil(yol);
          panelCiz();
        }
      });
      dugmeler.append(adlandir, sil);
      b.appendChild(dugmeler);
    }
    return b;
  }

  // Sol ağaç: üst düzey klasörler; seçili klasörün yolu üzerindekiler açılır.
  yan.appendChild(yanOge(cev('yerimi.cubuk'), '', 0));
  function yanCiz(d, onek, derinlik) {
    for (const [ad, c] of d.alt) {
      const yol = onek ? onek + '/' + ad : ad;
      yan.appendChild(yanOge(ad, yol, derinlik + 1));
      if (yerImSeciliKlasor === yol || yerImSeciliKlasor.startsWith(yol + '/')) yanCiz(c, yol, derinlik + 1);
    }
  }
  yanCiz(agac, '', 0);

  function satir(y) {
    const d = document.createElement('div');
    d.className = 'yim-satir';
    d.title = temizMetin(y.baslik || '') + '\n' + y.url;
    const simge = simgeYap(y.url, 'pusula-favicon://' + alanAdi(y.url));
    const b = document.createElement('span');
    b.className = 'yim-baslik';
    b.textContent = temizMetin(y.baslik) || kisaUrl(y.url);
    const u = document.createElement('span');
    u.className = 'yim-url';
    u.textContent = kisaUrl(y.url);
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'ikon kucuk yim-menu';
    menu.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="8" cy="3.5" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="12.5" r="1.2"/></svg>';
    menu.addEventListener('click', (e) => { e.stopPropagation(); window.pusula.yerImiMenu(y.url); });
    d.append(simge, b, u, menu);
    d.addEventListener('click', () => { panelKapat(); window.pusula.git(y.url); });
    d.addEventListener('auxclick', (e) => { if (e.button === 1) window.pusula.yeniSekme(y.url); });
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); window.pusula.yerImiMenu(y.url); });
    return d;
  }

  function listeCiz() {
    ana.replaceChildren();
    const q = yerImAramaMetni.trim().toLowerCase();
    const kart = document.createElement('div');
    kart.className = 'yim-kart';
    let liste;
    if (q) {
      liste = durum.yerImleri.filter((y) => ((y.baslik || '') + ' ' + y.url).toLowerCase().includes(q));
    } else {
      const dugum = yerImSeciliKlasor ? dugumBul(yerImSeciliKlasor) : agac;
      liste = dugum.ogeler;
      for (const [ad, c] of dugum.alt) {
        const yol = yerImSeciliKlasor ? yerImSeciliKlasor + '/' + ad : ad;
        const k = document.createElement('div');
        k.className = 'yim-satir yim-klasor-satir';
        const si = document.createElement('span');
        si.className = 'yim-klasor-simge';
        si.innerHTML = SIMGE.klasor;
        const m = document.createElement('span');
        m.className = 'yim-baslik';
        m.textContent = ad;
        const n = document.createElement('span');
        n.className = 'yim-url';
        n.textContent = String(toplamSayi(c));
        k.append(si, m, n);
        k.addEventListener('click', () => { yerImSeciliKlasor = yol; panelCiz(); });
        kart.appendChild(k);
      }
    }
    for (const y of liste) kart.appendChild(satir(y));
    if (!kart.children.length) {
      ana.appendChild(bosDurum(cev('yerimi.bos')));
      return;
    }
    ana.appendChild(kart);
  }
  listeCiz();

  ara.addEventListener('input', () => {
    yerImAramaMetni = ara.value;
    for (const k of yan.querySelectorAll('.yim-klasor')) {
      if (yerImAramaMetni) k.classList.remove('secili');
    }
    listeCiz();
  });
}

/*
 * İndirmeler paneli. Durum yayını saniyede birkaç kez geldiği için tüm satırları
 * her seferinde yeniden kurmak basılı düğmeyi araya girip tıklamayı yutardı:
 * satır kümesi ve eylem durumları aynıysa yalnızca metin/çubuk güncellenir.
 */
let indirmePanelImza = '';
const indirmePanelSatirlari = new Map();   // id -> { alt, cubuk, ic }

function indirmePanelImzasi() {
  return (durum.indirmeler || []).map((i) => [i.id, i.durum, i.duraklatildi, i.surdurulebilir,
    i.duraklatilabilir, i.iptalEdilebilir, i.silinebilir, i.yuzde === null ? 0 : 1, i.belirsiz ? 1 : 0].join(':')).join('|');
}

function indirmePaneliYamala() {
  if (indirmePanelImzasi() !== indirmePanelImza) return false;
  for (const i of durum.indirmeler) {
    const r = indirmePanelSatirlari.get(i.id);
    if (!r) return false;
    r.alt.textContent = indirmeAltMetniUI(i);
    if (r.ic && i.yuzde !== null && i.yuzde !== undefined) r.ic.style.width = i.yuzde + '%';
  }
  return true;
}

// Ana süreçten gelen hazır alt metin; sürmeyen indirmelere tarih de eklenir.
function indirmeAltMetniUI(i) {
  const surer = i.durum === 'devam' || i.durum === 'kesildi';
  return i.alt + (!surer && i.zaman ? ' · ' + gunMetni(i.zaman) + ' ' + saatMetni(i.zaman) : '');
}

function indirmelerPaneli() {
  indirmePanelSatirlari.clear();
  indirmePanelImza = indirmePanelImzasi();
  if (!durum.indirmeler.length) {
    el.panelIcerik.appendChild(bosDurum(cev('indirme.bos')));
    return;
  }

  if (durum.indirmeler.some((i) => i.silinebilir)) {
    const arac = document.createElement('div');
    arac.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:8px';
    const temizle = document.createElement('button');
    temizle.className = 'dugme';
    temizle.textContent = cev('indirme.listeyiTemizle');
    temizle.addEventListener('click', () => window.pusula.indirmeTemizle());
    arac.appendChild(temizle);
    el.panelIcerik.appendChild(arac);
  }

  const kart = kartYap();
  el.panelIcerik.appendChild(kart);

  const dugme = (metin, fn) => {
    const b = document.createElement('button');
    b.className = 'dugme';
    b.textContent = metin;
    b.addEventListener('click', fn);
    return b;
  };

  for (const i of durum.indirmeler) {
    const d = document.createElement('div');
    d.className = 'satir';
    d.title = i.url;

    const ikon = document.createElement('span');
    ikon.className = 'rozet-alan' + (i.calistirilabilir ? ' riskli' : '');
    ikon.innerHTML = i.calistirilabilir ? SIMGE.uyari : SIMGE.indir;
    if (!i.calistirilabilir) ikon.style.background = '#5b6472';
    d.appendChild(ikon);

    const sol = document.createElement('div');
    sol.className = 'satir-metin';

    const ad = document.createElement('div');
    ad.className = 's-baslik';
    ad.textContent = temizMetin(i.ad);

    const alt = document.createElement('div');
    alt.className = 's-url';
    alt.textContent = indirmeAltMetniUI(i);
    sol.append(ad, alt);

    let cubuk = null, ic = null;
    if ((i.yuzde !== null && i.yuzde !== undefined) || i.belirsiz) {
      cubuk = document.createElement('div');
      cubuk.className = 'ilerleme' + (i.duraklatildi ? ' duraklatildi' : '') + (i.belirsiz ? ' belirsiz' : '');
      ic = document.createElement('div');
      if (!i.belirsiz) ic.style.width = i.yuzde + '%';
      cubuk.appendChild(ic);
      sol.appendChild(cubuk);
    }
    indirmePanelSatirlari.set(i.id, { alt, cubuk, ic });
    d.appendChild(sol);

    const eylem = (e) => () => window.pusula.indirmeEylem(i.id, e);
    if (i.duraklatilabilir) d.appendChild(dugme(cev('indirme.duraklat'), eylem('duraklat')));
    if (i.surdurulebilir) d.appendChild(dugme(cev('indirme.surdur'), eylem('surdur')));
    if (i.iptalEdilebilir) d.appendChild(dugme(cev('indirme.iptalEt'), eylem('iptal')));
    if (i.durum === 'tamam') {
      d.append(
        dugme(cev('indirme.ac'), () => window.pusula.indirmeAc(i.id)),
        dugme(cev('indirme.klasor'), () => window.pusula.indirmeKlasor(i.id))
      );
    }
    if (i.silinebilir) d.appendChild(dugme(cev('indirme.listedenKaldir'), eylem('sil')));
    kart.appendChild(d);
  }
}

function ayarSatiri(ad, aciklama, kontrol) {
  const d = document.createElement('div');
  d.className = 'ayar';
  const m = document.createElement('div');
  m.className = 'a-metin';
  const a1 = document.createElement('div');
  a1.className = 'a-ad';
  a1.textContent = ad;
  const a2 = document.createElement('div');
  a2.className = 'a-aciklama';
  a2.textContent = aciklama;
  m.append(a1, a2);
  d.append(m, kontrol);
  return d;
}

/*
 * Aç/kapa anahtarı: tarayıcı varsayılanı onay kutusu yerine kaydırmalı
 * anahtar. Gerçek <input type=checkbox> içeride kalır (erişilebilirlik,
 * klavye, testler); görüntüyü .anahtar-yuva çizer.
 */
function anahtar(deger, degisti) {
  const l = document.createElement('label');
  l.className = 'anahtar';
  const k = document.createElement('input');
  k.type = 'checkbox';
  k.checked = !!deger;
  k.addEventListener('change', () => degisti(k.checked));
  const yuva = document.createElement('span');
  yuva.className = 'anahtar-yuva';
  l.append(k, yuva);
  return l;
}

function listeSatiri(l) {
  let durumMetni;
  if (l.hata) {
    durumMetni = cev('ayar.listeHata', { hata: l.hata });
  } else if (!l.indirilme) {
    durumMetni = cev('ayar.listeIndirilmedi');
  } else {
    const gun = Math.floor((Date.now() - l.indirilme) / 86400000);
    const ne = gun === 0 ? cev('ayar.bugun') : (gun === 1 ? cev('ayar.dun') : cev('ayar.gunOnce', { n: gun }));
    durumMetni = cev('ayar.listeDurum', { n: l.kural.toLocaleString(ceviri.yerel), ne });
  }

  let kontrol;
  if (l.ozel) {
    kontrol = document.createElement('button');
    kontrol.className = 'dugme';
    kontrol.textContent = cev('ayar.listeKaldir');
    kontrol.addEventListener('click', async () => {
      kontrol.disabled = true;
      await window.pusula.listeSil(l.id);
      if (acikPanel === 'ayarlar') panelCiz();
    });
  } else {
    kontrol = document.createElement('span');
    kontrol.className = 'a-aciklama';
    // Varsayılan listelerin açıklaması çeviri tablosundan gelir.
    kontrol.textContent = cev('liste.' + l.id);
  }

  const satir = ayarSatiri(l.ad, durumMetni, kontrol);
  satir.title = l.url;
  return satir;
}

// Metni geciken bir geri bildirimle değiştirir, sonra eski hâline döner.
function dugmeDurum(dugme, gecici, eski, sure = 1500) {
  dugme.textContent = gecici;
  setTimeout(() => { dugme.disabled = false; dugme.textContent = eski; }, sure);
}

/*
 * Ayarlar altı bölüme ayrılmış tek bir uzun liste. Bölümleri sekmeye
 * çeviriyoruz ama bölümlerin kendi kodunu değiştirmiyoruz: çizim bittikten
 * sonra <h2> başlıklarına göre gruplayıp sarmalıyoruz. Böylece yeni bir
 * bölüm eklemek yine tek satır (baslik(...)) kalıyor.
 */
let aktifAyarSekmesi = 0;

// Bölüm anahtarına göre sekme ikonu (16x16, çizgi). Bilinmeyen bölüm: nokta.
const AYAR_SEKME_IKON = {
  'ayar.bolumArama': '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>',
  'ayar.bolumGizlilik': '<path d="M8 1.6l5 2v3.6c0 3.2-2.1 5.6-5 6.8-2.9-1.2-5-3.6-5-6.8V3.6z"/>',
  'ayar.bolumVekil': '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2.5 3 2.5 9 0 12M8 2c-2.5 3-2.5 9 0 12"/>',
  'ayar.bolumListeler': '<path d="M3 4h10M3 8h10M3 12h7"/>',
  'ayar.bolumIzinler': '<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  'ayar.bolumGuncelleme': '<path d="M13 8a5 5 0 0 1-8.7 3.4M3 8a5 5 0 0 1 8.7-3.4M11.7 2v2.6H9.1M4.3 14v-2.6h2.6"/>',
  'ayar.bolumGorunum': '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3"/>'
};

/*
 * Ardışık .ayar satırlarını tek karta toplar; aradaki uyarı/ilerleme gibi
 * öğeler kartı böler ve kendi başına kalır. Böylece satır köşe yuvarlaması
 * kırılgan :has()/:first-of-type kurallarına değil, açık bir kaba dayanır.
 */
function ayarKartla(ogeler) {
  const cikti = [];
  let kart = null;
  for (const o of ogeler) {
    if (o.classList && o.classList.contains('ayar')) {
      if (!kart) { kart = document.createElement('div'); kart.className = 'ayar-kart'; cikti.push(kart); }
      kart.appendChild(o);
    } else {
      kart = null;
      cikti.push(o);
    }
  }
  return cikti;
}

function ayarlariSekmele(g) {
  const cocuklar = [...g.children];
  const oncesi = [];
  const bolumler = [];
  let simdiki = null;

  for (const c of cocuklar) {
    if (c.tagName === 'H2') {
      simdiki = { ad: c.textContent, anahtar: c.dataset.anahtar || '', ogeler: [] };
      bolumler.push(simdiki);
    } else if (simdiki) {
      simdiki.ogeler.push(c);
    } else {
      oncesi.push(c);   // istatistik kutuları: her sekmede üstte kalır
    }
  }
  if (bolumler.length < 2) return;

  g.replaceChildren(...oncesi);
  if (aktifAyarSekmesi >= bolumler.length) aktifAyarSekmesi = 0;

  // Dikey düzen: solda sekme listesi (yapışkan), sağda etkin bölümün gövdesi.
  const duzen = document.createElement('div');
  duzen.className = 'ayar-duzen';
  const serit = document.createElement('nav');
  serit.className = 'ayar-sekmeler';
  serit.setAttribute('role', 'tablist');
  serit.setAttribute('aria-orientation', 'vertical');
  const govde = document.createElement('div');
  govde.className = 'ayar-govde';
  duzen.append(serit, govde);
  g.appendChild(duzen);

  const kutular = bolumler.map((b, i) => {
    const d = document.createElement('div');
    d.className = 'ayar-bolum';
    d.hidden = i !== aktifAyarSekmesi;
    const h = document.createElement('h3');
    h.className = 'ayar-bolum-baslik';
    h.textContent = b.ad;
    d.append(h, ...ayarKartla(b.ogeler));
    govde.appendChild(d);
    return d;
  });

  bolumler.forEach((b, i) => {
    const dugme = document.createElement('button');
    dugme.className = 'ayar-sekme' + (i === aktifAyarSekmesi ? ' etkin' : '');
    dugme.setAttribute('role', 'tab');
    dugme.setAttribute('aria-selected', i === aktifAyarSekmesi ? 'true' : 'false');
    const ikon = document.createElement('span');
    ikon.className = 'ayar-sekme-ikon';
    ikon.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">'
      + (AYAR_SEKME_IKON[b.anahtar] || '<circle cx="8" cy="8" r="2.5"/>') + '</svg>';
    const ad = document.createElement('span');
    ad.className = 'ayar-sekme-ad';
    ad.textContent = b.ad;
    dugme.append(ikon, ad);
    dugme.addEventListener('click', () => {
      aktifAyarSekmesi = i;
      kutular.forEach((k, j) => { k.hidden = j !== i; });
      [...serit.children].forEach((d, j) => {
        d.classList.toggle('etkin', j === i);
        d.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
    });
    serit.appendChild(dugme);
  });
}

/*
 * İstatistik paneli: engellenen izleyici (toplam + bu sekme), yüklü kural,
 * yer imi sayısı ve VPN durumu.
 */
function istatistikPaneli() {
  const g = document.createElement('div');
  g.className = 'ayar-grup';
  const say = (n) => Number(n || 0).toLocaleString(ceviri.yerel);
  const kuralToplam = (durum.listeler || []).reduce((t, l) => t + l.kural, 0);
  const t = (durum.sekmeler || []).find((s) => s.id === durum.aktifId);

  const ist = document.createElement('div');
  ist.className = 'istatistik';
  for (const [sayi, etiket] of [
    [say(durum.toplamEngellenen), cev('ayar.engellenenSayi')],
    [say(t ? t.engellenen : 0), cev('ist.buSekme')],
    [say(kuralToplam), cev('ayar.yukluAlan')],
    [say((durum.yerImleri || []).length), cev('ayar.yerImiSayi')]
  ]) {
    const kutu = document.createElement('div');
    kutu.className = 'kutu';
    const s = document.createElement('div');
    s.className = 'sayi';
    s.textContent = sayi;
    const e = document.createElement('div');
    e.className = 'etiket';
    e.textContent = etiket;
    kutu.append(s, e);
    ist.appendChild(kutu);
  }
  g.appendChild(ist);

  const a = durum.ayarlar;
  const lok = (durum.vpnKatalog || []).find((s) => s.id === a.vpnLokasyon);
  const h = document.createElement('h2');
  h.textContent = cev('panel.vpn');
  g.appendChild(h);
  const vd = document.createElement('div');
  vd.className = 'vpn-durum ' + (a.vpnAcik ? 'acik' : 'kapali');
  vd.textContent = a.vpnAcik
    ? cev('vpn.durumBagli', { lokasyon: lok ? lok.ad : '', limit: lok ? lok.limitMbps : 100 })
    : cev('vpn.durumKapali');
  g.appendChild(vd);

  el.panelIcerik.appendChild(g);
}

async function parolalarPaneli() {
  const ara = document.createElement('input');
  ara.type = 'search';
  ara.placeholder = cev('parola.ara');
  ara.autofocus = true;

  const ekleBtn = document.createElement('button');
  ekleBtn.className = 'dugme';
  ekleBtn.textContent = '+ ' + cev('parola.ekle');

  el.panelArac.replaceChildren(ara, ekleBtn);

  let formAcik = false;
  const formKutu = document.createElement('div');
  formKutu.className = 'parola-form';
  formKutu.style.display = 'none';

  const siteGirdi = document.createElement('input');
  siteGirdi.type = 'text';
  siteGirdi.placeholder = cev('parola.site') + ' (https://...)';

  const kullaniciGirdi = document.createElement('input');
  kullaniciGirdi.type = 'text';
  kullaniciGirdi.placeholder = cev('parola.kullanici');

  const parolaGirdi = document.createElement('input');
  parolaGirdi.type = 'password';
  parolaGirdi.placeholder = cev('parola.parola');

  const kaydetBtn = document.createElement('button');
  kaydetBtn.className = 'dugme dugme-vurgulu';
  kaydetBtn.textContent = cev('anaparola.kaydet');

  formKutu.append(siteGirdi, kullaniciGirdi, parolaGirdi, kaydetBtn);

  ekleBtn.addEventListener('click', () => {
    formAcik = !formAcik;
    formKutu.style.display = formAcik ? 'flex' : 'none';
    if (formAcik) siteGirdi.focus();
  });

  kaydetBtn.addEventListener('click', async () => {
    const origin = siteGirdi.value.trim();
    const kullaniciAdi = kullaniciGirdi.value.trim();
    const parola = parolaGirdi.value;
    if (!origin || !parola) return;
    await window.pusula.parolaKaydet({ origin, kullaniciAdi, parola });
    siteGirdi.value = '';
    kullaniciGirdi.value = '';
    parolaGirdi.value = '';
    formKutu.style.display = 'none';
    formAcik = false;
    parolaListesiCiz(ara.value);
  });

  const listeKap = document.createElement('div');
  listeKap.className = 'parola-kutu';
  const bolumBaslik = (metin) => {
    const h = document.createElement('div');
    h.textContent = metin;
    h.style.cssText = 'font-weight:600;font-size:13px;margin:14px 4px 6px;color:var(--metin2)';
    return h;
  };
  const gecisKap = document.createElement('div');
  el.panelIcerik.replaceChildren(formKutu, bolumBaslik(cev('gecis.parolaBolum')), listeKap,
    bolumBaslik(cev('gecis.bolum')), gecisKap);

  async function gecisListesiCiz(filtre = '') {
    const { liste, yerel } = (await window.pusula.gecisAnahtarListele(filtre)) || { liste: [] };
    gecisKap.replaceChildren();
    if (!liste || !liste.length) {
      gecisKap.appendChild(bosDurum(cev('gecis.bos')));
      return;
    }
    const kart = kartYap();
    for (const k of liste) {
      const satir = document.createElement('div');
      satir.className = 'satir';
      satir.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;gap:8px';

      const sol = document.createElement('div');
      sol.style.cssText = 'flex:1;overflow:hidden';
      const site = document.createElement('div');
      site.style.cssText = 'font-weight:bold;font-size:13px';
      site.textContent = '🔑 ' + k.rpId;
      const kullanici = document.createElement('div');
      kullanici.style.cssText = 'font-size:12px;color:var(--metin2)';
      kullanici.textContent = (k.kullaniciGoruntu || k.kullaniciAdi || '—') + ' · '
        + (k.sonKullanim
          ? cev('gecis.sonKullanim') + ': ' + new Date(k.sonKullanim).toLocaleDateString(yerel || undefined)
          : cev('gecis.hic'));
      sol.append(site, kullanici);

      const silBtn = document.createElement('button');
      silBtn.className = 'dugme';
      silBtn.textContent = '🗑';
      silBtn.title = cev('panel.kaldir');
      silBtn.addEventListener('click', async () => {
        await window.pusula.gecisAnahtarSil(k.id);
        gecisListesiCiz(ara.value);
      });
      satir.append(sol, silBtn);
      kart.appendChild(satir);
    }
    gecisKap.appendChild(kart);
  }

  async function parolaListesiCiz(filtre = '') {
    const liste = await window.pusula.parolaListele(filtre);
    listeKap.replaceChildren();
    if (!liste || !liste.length) {
      listeKap.appendChild(bosDurum(cev('parola.bos')));
      return;
    }

    const kart = kartYap();
    for (const p of liste) {
      const satir = document.createElement('div');
      satir.className = 'satir';
      satir.style.display = 'flex';
      satir.style.alignItems = 'center';
      satir.style.justifyContent = 'space-between';
      satir.style.padding = '8px 12px';
      satir.style.gap = '8px';

      const sol = document.createElement('div');
      sol.style.flex = '1';
      sol.style.overflow = 'hidden';

      const site = document.createElement('div');
      site.style.fontWeight = 'bold';
      site.style.fontSize = '13px';
      site.textContent = p.origin;

      const kullanici = document.createElement('div');
      kullanici.style.fontSize = '12px';
      kullanici.style.color = 'var(--metin2)';
      kullanici.textContent = p.kullaniciAdi || '—';

      sol.append(site, kullanici);

      const sag = document.createElement('div');
      sag.style.display = 'flex';
      sag.style.alignItems = 'center';
      sag.style.gap = '6px';

      const parolaGoster = document.createElement('span');
      parolaGoster.style.fontFamily = 'monospace';
      parolaGoster.style.fontSize = '13px';
      parolaGoster.textContent = '••••••••';

      const gozBtn = document.createElement('button');
      gozBtn.className = 'dugme';
      gozBtn.textContent = '👁';
      let gizliMi = true;
      gozBtn.addEventListener('click', () => {
        gizliMi = !gizliMi;
        parolaGoster.textContent = gizliMi ? '••••••••' : p.parola;
      });

      const kopyalaBtn = document.createElement('button');
      kopyalaBtn.className = 'dugme';
      kopyalaBtn.textContent = '📋';
      kopyalaBtn.title = cev('menu.kopyala');
      kopyalaBtn.addEventListener('click', async () => {
        const tamam = await window.pusula.panoyaYaz(p.parola);
        if (!tamam) return;
        kopyalaBtn.textContent = '✓';
        setTimeout(() => { kopyalaBtn.textContent = '📋'; }, 1500);
      });

      const silBtn = document.createElement('button');
      silBtn.className = 'dugme';
      silBtn.textContent = '🗑';
      silBtn.title = cev('panel.kaldir');
      silBtn.addEventListener('click', async () => {
        await window.pusula.parolaSil(p.id);
        parolaListesiCiz(ara.value);
      });

      sag.append(parolaGoster, gozBtn, kopyalaBtn, silBtn);
      satir.append(sol, sag);
      kart.appendChild(satir);
    }
    listeKap.appendChild(kart);
  }

  ara.addEventListener('input', () => {
    parolaListesiCiz(ara.value);
    gecisListesiCiz(ara.value);
  });

  parolaListesiCiz();
  gecisListesiCiz();
}

function hizTestiPaneli() {
  const kap = kartYap();
  kap.style.padding = '20px';
  kap.style.display = 'flex';
  kap.style.flexDirection = 'column';
  kap.style.alignItems = 'center';
  kap.style.gap = '16px';

  const baslikKutu = document.createElement('div');
  baslikKutu.style.textAlign = 'center';
  const apiEtiket = document.createElement('div');
  apiEtiket.style.fontSize = '12px';
  apiEtiket.style.color = '#38bdf8';
  apiEtiket.style.fontWeight = 'bold';
  apiEtiket.textContent = 'Speedtest.net API & Cloudflare Engine';

  const durumEtiket = document.createElement('div');
  durumEtiket.style.fontSize = '14px';
  durumEtiket.style.color = 'var(--metin2)';
  durumEtiket.textContent = cev('hiz.baslat');

  baslikKutu.append(apiEtiket, durumEtiket);

  const gostergeler = document.createElement('div');
  gostergeler.className = 'hiz-gosterge-kap';

  function kutuUret(etiketMetni, varsayilanBirim) {
    const kutu = document.createElement('div');
    kutu.className = 'ayar-grup';
    kutu.style.padding = '12px';
    kutu.style.textAlign = 'center';
    kutu.style.margin = '0';

    const etiket = document.createElement('div');
    etiket.style.fontSize = '12px';
    etiket.style.color = 'var(--metin2)';
    etiket.textContent = etiketMetni;

    const deger = document.createElement('div');
    deger.style.fontSize = '24px';
    deger.style.fontWeight = 'bold';
    deger.style.color = 'var(--vurgu)';
    deger.textContent = '—';

    const birim = document.createElement('div');
    birim.style.fontSize = '11px';
    birim.style.color = 'var(--metin2)';
    birim.textContent = varsayilanBirim;

    kutu.append(etiket, deger, birim);
    return { kutu, deger };
  }

  const pingKutu = kutuUret(cev('hiz.gecikme'), 'ms');
  const jitterKutu = kutuUret(cev('hiz.titreme'), 'ms');
  const indirmeKutu = kutuUret(cev('hiz.indirme'), 'Mbps');
  const yuklemeKutu = kutuUret(cev('hiz.yukleme'), 'Mbps');

  gostergeler.append(pingKutu.kutu, jitterKutu.kutu, indirmeKutu.kutu, yuklemeKutu.kutu);

  const ilerlemeKapsayici = document.createElement('div');
  ilerlemeKapsayici.className = 'ilerleme';
  ilerlemeKapsayici.style.width = '100%';
  ilerlemeKapsayici.style.height = '6px';
  ilerlemeKapsayici.style.backgroundColor = 'var(--cizgi)';
  ilerlemeKapsayici.style.borderRadius = '3px';
  ilerlemeKapsayici.style.overflow = 'hidden';

  const ilerlemeCubuk = document.createElement('div');
  ilerlemeCubuk.style.width = '0%';
  ilerlemeCubuk.style.height = '100%';
  ilerlemeCubuk.style.backgroundColor = '#38bdf8';
  ilerlemeCubuk.style.transition = 'width 0.2s';
  ilerlemeKapsayici.appendChild(ilerlemeCubuk);

  const islemBtn = document.createElement('button');
  islemBtn.className = 'dugme dugme-vurgulu';
  islemBtn.style.padding = '8px 24px';
  islemBtn.style.fontSize = '14px';
  islemBtn.textContent = cev('hiz.baslat');

  let testCalisiyor = false;

  window.pusula.speedtestIlerlemeDinle((veri) => {
    if (!veri) return;
    if (veri.sunucu) apiEtiket.textContent = 'Ookla Speedtest: ' + veri.sunucu;
    if (typeof veri.ping === 'number' && veri.ping > 0) pingKutu.deger.textContent = String(veri.ping);
    if (typeof veri.jitter === 'number' && veri.jitter > 0) jitterKutu.deger.textContent = String(veri.jitter);
    if (typeof veri.indirmeMbps === 'number' && veri.indirmeMbps > 0) indirmeKutu.deger.textContent = String(veri.indirmeMbps);
    if (typeof veri.yuklemeMbps === 'number' && veri.yuklemeMbps > 0) yuklemeKutu.deger.textContent = String(veri.yuklemeMbps);
    if (typeof veri.ilerleme === 'number') ilerlemeCubuk.style.width = veri.ilerleme + '%';

    if (veri.asama === 'tamam') {
      durumEtiket.textContent = cev('hiz.tamamlandi');
      islemBtn.textContent = cev('hiz.baslat');
      testCalisiyor = false;
    } else if (veri.asama === 'hata') {
      durumEtiket.textContent = 'Hata oluştu';
      islemBtn.textContent = cev('hiz.baslat');
      testCalisiyor = false;
    } else {
      durumEtiket.textContent = cev('hiz.olculuyor');
    }
  });

  islemBtn.addEventListener('click', async () => {
    if (testCalisiyor) {
      await window.pusula.speedtestDurdur();
      testCalisiyor = false;
      islemBtn.textContent = cev('hiz.baslat');
      durumEtiket.textContent = cev('hiz.durdur');
    } else {
      testCalisiyor = true;
      islemBtn.textContent = cev('hiz.durdur');
      durumEtiket.textContent = cev('hiz.olculuyor');
      pingKutu.deger.textContent = '—';
      jitterKutu.deger.textContent = '—';
      indirmeKutu.deger.textContent = '—';
      yuklemeKutu.deger.textContent = '—';
      ilerlemeCubuk.style.width = '0%';
      await window.pusula.speedtestBaslat();
    }
  });

  kap.append(baslikKutu, gostergeler, ilerlemeKapsayici, islemBtn);
  el.panelIcerik.appendChild(kap);
}

function hakkindaPaneli() {
  const kap = kartYap();
  kap.className = 'liste-kart hakkinda-kart';

  const logoKutu = document.createElement('div');
  logoKutu.className = 'hakkinda-logo-kutu';

  const logo = document.createElement('div');
  logo.className = 'hakkinda-logo';
  logo.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path d="M10.4 5.6l-1.68 3.28L5.44 10.4l1.68-3.28z" fill="currentColor"/></svg>';

  const baslik = document.createElement('h1');
  baslik.className = 'hakkinda-baslik';
  baslik.textContent = cev('hakkinda.baslik');

  const aciklama = document.createElement('p');
  aciklama.className = 'hakkinda-aciklama';
  aciklama.textContent = cev('hakkinda.aciklama');

  logoKutu.append(logo, baslik, aciklama);

  const surumKart = document.createElement('div');
  surumKart.className = 'hakkinda-surum-kart';

  const surumBilgi = durum.surumBilgisi || {
    surum: '1.0.0', electron: '32.x', chrome: '128.x', node: '20.x', mimari: 'x64'
  };

  const surumSatir = document.createElement('div');
  surumSatir.className = 'hakkinda-surum-satir';

  const surumRozet = document.createElement('span');
  surumRozet.className = 'hakkinda-rozet';
  surumRozet.textContent = cev('hakkinda.surum') + ' ' + (surumBilgi.surum || '1.0.0') + ' (' + (surumBilgi.mimari || 'x64') + ')';

  const guncelMetin = document.createElement('span');
  guncelMetin.className = 'hakkinda-durum-metin';
  surumSatir.append(surumRozet, guncelMetin);

  const denetleBtn = document.createElement('button');
  denetleBtn.className = 'dugme dugme-vurgulu';
  // Kullanıcı bu sayfada "denetle"ye bastıktan sonra "güncel" yazısını göstermek
  // için (açılışta henüz denetlenmediyse hiçbir şey iddia etmiyoruz).
  let denetlendi = false;

  // Metin ve düğme, ayarlardaki güncelleme satırıyla aynı durumdan çizilir.
  const hakkindaTazele = () => {
    const gu = durum.guncelleme || { durum: 'kapali', ilerleme: 0 };
    const meşgul = gu.durum === 'kontrol' || gu.durum === 'iniyor';
    let metin = '';
    if (gu.durum === 'bulundu') metin = cev('guncelleme.bulundu', { surum: gu.bulunanSurum });
    else if (gu.durum === 'iniyor') metin = cev('guncelleme.iniyor', { n: gu.ilerleme });
    else if (gu.durum === 'hazir') metin = cev('guncelleme.hazir', { surum: gu.bulunanSurum });
    else if (gu.durum === 'kontrol') metin = cev('ayar.guncelleniyor');
    else if (gu.durum === 'hata') metin = gu.sebep === 'vekil'
      ? cev('guncelleme.hataVekil')
      : cev('guncelleme.hata', { sebep: gu.sebep || '?' });
    else if (denetlendi && gu.durum === 'guncel') metin = '✓ ' + cev('hakkinda.guncel');
    guncelMetin.textContent = metin;

    denetleBtn.disabled = meşgul;
    denetleBtn.onclick = null;
    if (gu.durum === 'hazir') {
      denetleBtn.textContent = cev('ayar.guncellemeKur');
      denetleBtn.onclick = () => window.pusula.guncellemeKur();
    } else if (gu.durum === 'bulundu') {
      denetleBtn.textContent = cev('ayar.guncellemeIndirDugme');
      denetleBtn.onclick = async () => {
        denetleBtn.disabled = true;
        await window.pusula.guncellemeIndir();
      };
    } else {
      denetleBtn.textContent = meşgul ? cev('ayar.guncelleniyor') : cev('hakkinda.denetle');
      denetleBtn.onclick = async () => {
        denetlendi = true;
        denetleBtn.disabled = true;
        denetleBtn.textContent = cev('ayar.guncelleniyor');
        try { await window.pusula.guncellemeKontrol(); } catch { /* durum yayını hatayı gösterir */ }
        hakkindaTazele();
      };
    }
  };
  hakkindaGuncellemeTazele = hakkindaTazele;
  hakkindaTazele();

  surumKart.append(surumSatir, denetleBtn);

  const motorlarKutu = document.createElement('div');
  motorlarKutu.className = 'hakkinda-motorlar-kutu';

  const motorBaslik = document.createElement('h3');
  motorBaslik.className = 'hakkinda-motor-baslik';
  motorBaslik.textContent = cev('hakkinda.motorlar');

  const bilesenler = [
    ['Chromium', surumBilgi.chrome || '128.0'],
    ['Electron', surumBilgi.electron || '32.0'],
    ['Node.js', surumBilgi.node || '20.0'],
    ['uBlock Origin (SNFE)', '1.58+'],
    ['ByeDPI Core', 'SOCKS5']
  ];

  const bilesenGrid = document.createElement('div');
  bilesenGrid.className = 'hakkinda-grid';

  for (const [ad, sur] of bilesenler) {
    const oge = document.createElement('div');
    oge.className = 'hakkinda-grid-oge';
    const ogeAd = document.createElement('span');
    ogeAd.className = 'hakkinda-oge-ad';
    ogeAd.textContent = ad;
    const ogeDeger = document.createElement('span');
    ogeDeger.className = 'hakkinda-oge-deger';
    ogeDeger.textContent = sur;
    oge.append(ogeAd, ogeDeger);
    bilesenGrid.appendChild(oge);
  }

  motorlarKutu.append(motorBaslik, bilesenGrid);

  const telif = document.createElement('div');
  telif.className = 'hakkinda-telif';
  telif.textContent = cev('hakkinda.telif');

  kap.append(logoKutu, surumKart, motorlarKutu, telif);
  el.panelIcerik.appendChild(kap);
}

const TARAYICI_SIMGELERI = {
  "protonpass": "<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path fill=\"#6d4aff\" d=\"M12 1.5 3.5 4.6v6.2c0 5.1 3.5 9.6 8.5 11.7 5-2.1 8.5-6.6 8.5-11.7V4.6z\"/><path fill=\"#fff\" d=\"M9 11V9.5a3 3 0 0 1 6 0V11h.8v6H8.2v-6zm1.5 0h3V9.5a1.5 1.5 0 0 0-3 0z\"/></svg>",
  "chrome": "<svg xmlns=\"http://www.w3.org/2000/svg\" preserveAspectRatio=\"xMidYMid\" viewBox=\"0 0 190.5 190.5\"><path fill=\"#fff\" d=\"M95.252 142.873c26.304 0 47.627-21.324 47.627-47.628s-21.323-47.628-47.627-47.628-47.627 21.324-47.627 47.628 21.323 47.628 47.627 47.628z\"/><path fill=\"#229342\" d=\"m54.005 119.07-41.24-71.43a95.227 95.227 0 0 0-.003 95.25 95.234 95.234 0 0 0 82.496 47.61l41.24-71.43v-.011a47.613 47.613 0 0 1-17.428 17.443 47.62 47.62 0 0 1-47.632.007 47.62 47.62 0 0 1-17.433-17.437z\"/><path fill=\"#fbc116\" d=\"m136.495 119.067-41.239 71.43a95.229 95.229 0 0 0 82.489-47.622A95.24 95.24 0 0 0 190.5 95.248a95.237 95.237 0 0 0-12.772-47.623H95.249l-.01.007a47.62 47.62 0 0 1 23.819 6.372 47.618 47.618 0 0 1 17.439 17.431 47.62 47.62 0 0 1-.001 47.633z\"/><path fill=\"#1a73e8\" d=\"M95.252 132.961c20.824 0 37.705-16.881 37.705-37.706S116.076 57.55 95.252 57.55 57.547 74.431 57.547 95.255s16.881 37.706 37.705 37.706z\"/><path fill=\"#e33b2e\" d=\"M95.252 47.628h82.479A95.237 95.237 0 0 0 142.87 12.76 95.23 95.23 0 0 0 95.245 0a95.222 95.222 0 0 0-47.623 12.767 95.23 95.23 0 0 0-34.856 34.872l41.24 71.43.011.006a47.62 47.62 0 0 1-.015-47.633 47.61 47.61 0 0 1 41.252-23.815z\"/></svg>",
  "brave": "<svg viewBox=\"0 0 256 301\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" preserveAspectRatio=\"xMidYMid\">\n    <defs>\n        <linearGradient x1=\"0%\" y1=\"50.017894%\" x2=\"100.096998%\" y2=\"50.017894%\" id=\"linearGradient-1\">\n            <stop stop-color=\"#FFFFFF\" offset=\"0%\"></stop>\n            <stop stop-color=\"#FFFFFF\" stop-opacity=\"0.9576\" offset=\"14.13%\"></stop>\n            <stop stop-color=\"#FFFFFF\" stop-opacity=\"0.7\" offset=\"100%\"></stop>\n        </linearGradient>\n        <linearGradient x1=\"-0.0390588235%\" y1=\"49.9824538%\" x2=\"100%\" y2=\"49.9824538%\" id=\"linearGradient-2\">\n            <stop stop-color=\"#F1F1F2\" offset=\"0%\"></stop>\n            <stop stop-color=\"#E4E5E6\" offset=\"9.191442%\"></stop>\n            <stop stop-color=\"#D9DADB\" offset=\"23.57%\"></stop>\n            <stop stop-color=\"#D2D4D5\" offset=\"43.8%\"></stop>\n            <stop stop-color=\"#D0D2D3\" offset=\"100%\"></stop>\n        </linearGradient>\n    </defs>\n\t<g>\n\t\t<path d=\"M256,97.1 L246.7,72 L253.1,57.6 C253.9,55.7 253.5,53.6 252.1,52.1 L234.6,34.4 C226.9,26.7 215.5,24 205.2,27.6 L200.3,29.3 L173.5,0.3 L128.2,0 L127.9,0 L82.3,0.4 L55.6,29.6 L50.8,27.9 C40.4,24.2 28.9,26.9 21.2,34.8 L3.4,52.8 C2.2,54 1.9,55.7 2.5,57.2 L9.2,72.2 L0,97.3 L6,120 L33.2,223.3 C36.3,235.2 43.5,245.6 53.6,252.8 C53.6,252.8 86.6,276.1 119.1,297.2 C122,299.1 125,300.4 128.2,300.4 C131.4,300.4 134.4,299.1 137.3,297.2 C173.9,273.2 202.8,252.7 202.8,252.7 C212.8,245.5 220,235.1 223.1,223.2 L250.1,119.9 L256,97.1 Z\" fill=\"#F15A22\"></path>\n\t\t<path d=\"M34.5,227.7 L0,99.5 L10.1,74.4 L3.1,55.8 L19.8,38.8 C25.3,33.9 36.1,32.2 41.1,35.1 L67.2,50.1 L101.2,58 L127.7,47 L129.9,274.7 C129.5,307.5 131.6,304 107.5,288.5 L48,248.6 C41.6,242.5 36.7,235.6 34.5,227.7 Z\" fill=\"url(#linearGradient-1)\" opacity=\"0.15\" style=\"mix-blend-mode: lighten;\"></path>\n\t\t<path d=\"M202.2,252.245742 L151.6,286.845742 C137.5,294.545742 130.7,302.145742 129.6,298.445742 C128.7,295.545742 129.4,287.045742 129.1,273.845742 L128.5,51.1457423 C128.6,48.9457423 130.1,45.2457423 132.7,45.6457423 L158.5,53.4457423 L195.7,47.6457423 L220.3,29.5457423 C222.9,27.5457423 226.7,27.7457423 229.1,30.0457423 L251.1,51.0457423 C253.1,53.1457423 253.2,57.2457423 252,59.8457423 L245.9,71.1457423 L256,97.2457423 L221.2,226.645742 C215.8,242.745742 208.2,246.945742 202.2,252.245742 Z\" fill=\"url(#linearGradient-2)\" opacity=\"0.4\" style=\"mix-blend-mode: darken;\"></path>\n\t\t<path d=\"M134,184.801367 C132.8,184.301367 131.5,183.901367 131.1,183.901367 L129.5,183.901367 L127.9,183.901367 C127.5,183.901367 126.2,184.301367 125,184.801367 L112,190.201367 C110.8,190.701367 108.8,191.601367 107.6,192.201367 L88,202.401367 C86.8,203.001367 86.7,204.101367 87.8,204.901367 L105.1,217.101367 C106.2,217.901367 107.9,219.201367 108.9,220.101367 L116.6,226.701367 C117.6,227.601367 119.2,229.001367 120.2,229.901367 L127.6,236.501367 C128.6,237.401367 130.2,237.401367 131.2,236.501367 L138.8,229.901367 C139.8,229.001367 141.4,227.601367 142.4,226.701367 L150.1,220.001367 C151.1,219.101367 152.8,217.801367 153.9,217.001367 L171.2,204.701367 C172.3,203.901367 172.2,202.801367 171,202.201367 L151.4,192.201367 C150.2,191.601367 148.2,190.701367 147,190.201367 L134,184.801367 Z\" fill=\"#FFFFFF\"></path>\n\t\t<path d=\"M227.813299,101.557129 C228.213299,100.257129 228.213299,99.7571289 228.213299,99.7571289 C228.213299,98.4571289 228.113299,96.2571289 227.913299,94.9571289 L226.913299,92.0571289 C226.313299,90.8571289 225.313299,88.9571289 224.513299,87.8571289 L213.213299,71.1571289 C212.513299,70.0571289 211.213299,68.3571289 210.313299,67.2571289 L195.713299,48.9571289 C194.913299,47.9571289 194.113299,47.0571289 194.013299,47.1571289 L193.813299,47.1571289 C193.813299,47.1571289 192.713299,47.3571289 191.413299,47.5571289 L169.113299,51.9571289 C167.813299,52.2571289 165.713299,52.6571289 164.413299,52.8571289 L164.013299,52.9571289 C162.713299,53.1571289 160.613299,53.0571289 159.313299,52.6571289 L140.613299,46.6571289 C139.313299,46.2571289 137.213299,45.6571289 136.013299,45.3571289 C136.013299,45.3571289 132.213299,44.4571289 129.113299,44.5571289 C126.013299,44.5571289 122.213299,45.3571289 122.213299,45.3571289 C120.913299,45.6571289 118.813299,46.2571289 117.613299,46.6571289 L98.9132993,52.6571289 C97.6132993,53.0571289 95.5132993,53.1571289 94.2132993,52.9571289 L93.8132993,52.8571289 C92.5132993,52.6571289 90.4132993,52.1571289 89.1132993,51.9571289 L66.6132993,47.7571289 C65.3132993,47.4571289 64.2132993,47.3571289 64.2132993,47.3571289 L64.0132993,47.3571289 C63.9132993,47.3571289 63.1132993,48.1571289 62.3132993,49.1571289 L47.7132993,67.4571289 C46.9132993,68.4571289 45.6132993,70.2571289 44.8132993,71.3571289 L33.5132993,88.0571289 C32.8132993,89.1571289 31.7132993,91.0571289 31.1132993,92.2571289 L30.1132993,95.1571289 C29.9132993,96.4571289 29.7132993,98.6571289 29.8132993,99.9571289 C29.8132993,99.9571289 29.8132993,100.357129 30.2132993,101.757129 C30.9132993,104.157129 32.6132993,106.357129 32.6132993,106.357129 C33.4132993,107.357129 34.9132993,109.057129 35.8132993,109.957129 L68.9132993,145.157129 C69.8132993,146.157129 70.1132993,147.957129 69.6132993,149.157129 L62.7132993,165.457129 C62.2132993,166.657129 62.1132993,168.657129 62.6132993,169.957129 L64.5132993,175.057129 C66.1132993,179.357129 68.8132993,183.157129 72.4132993,186.057129 L79.1132993,191.457129 C80.1132993,192.257129 81.9132993,192.557129 83.1132993,191.957129 L104.313299,181.857129 C105.513299,181.257129 107.313299,180.057129 108.313299,179.157129 L123.513299,165.457129 C125.713299,163.457129 125.813299,160.057129 123.813299,157.857129 L91.9132993,136.357129 C90.8132993,135.657129 90.4132993,134.057129 91.0132993,132.857129 L105.013299,106.457129 C105.613299,105.257129 105.713299,103.357129 105.213299,102.157129 L103.513299,98.2571289 C103.013299,97.0571289 101.513299,95.6571289 100.313299,95.1571289 L59.2132993,79.7571289 C58.0132993,79.2571289 58.0132993,78.7571289 59.3132993,78.6571289 L85.8132993,76.1571289 C87.1132993,76.0571289 89.2132993,76.2571289 90.5132993,76.5571289 L114.113299,83.1571289 C115.413299,83.5571289 116.213299,84.8571289 116.013299,86.1571289 L107.813299,131.057129 C107.613299,132.357129 107.613299,134.157129 107.913299,135.157129 C108.213299,136.157129 109.513299,137.057129 110.813299,137.357129 L127.213299,140.857129 C128.513299,141.157129 130.613299,141.157129 131.913299,140.857129 L147.213299,137.357129 C148.513299,137.057129 149.813299,136.057129 150.113299,135.157129 C150.413299,134.257129 150.513299,132.357129 150.213299,131.057129 L142.113299,86.1571289 C141.913299,84.8571289 142.713299,83.4571289 144.013299,83.1571289 L167.613299,76.5571289 C168.913299,76.1571289 171.013299,76.0571289 172.313299,76.1571289 L198.813299,78.6571289 C200.113299,78.7571289 200.213299,79.2571289 198.913299,79.7571289 L157.813299,95.3571289 C156.613299,95.8571289 155.113299,97.1571289 154.613299,98.4571289 L152.913299,102.357129 C152.413299,103.557129 152.413299,105.557129 153.113299,106.657129 L167.213299,133.057129 C167.813299,134.257129 167.413299,135.757129 166.313299,136.557129 L134.413299,158.157129 C132.313299,160.257129 132.513299,163.757129 134.713299,165.757129 L149.913299,179.457129 C150.913299,180.357129 152.713299,181.557129 153.913299,182.057129 L175.213299,192.157129 C176.413299,192.757129 178.213299,192.457129 179.213299,191.657129 L185.913299,186.157129 C189.513299,183.257129 192.213299,179.457129 193.713299,175.157129 L195.613299,170.057129 C196.113299,168.857129 196.013299,166.757129 195.513299,165.557129 L188.613299,149.257129 C188.113299,148.057129 188.413299,146.257129 189.313299,145.257129 L222.413299,110.057129 C223.313299,109.057129 224.713299,107.457129 225.613299,106.457129 C225.413299,106.157129 227.213299,103.957129 227.813299,101.557129 Z\" fill=\"#FFFFFF\"></path>\n\t</g>\n</svg>",
  "edge": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\">\n  <defs>\n    <radialGradient id=\"b\" cx=\"161.8\" cy=\"68.9\" r=\"95.4\" gradientTransform=\"matrix(1 0 0 -.95 0 248.8)\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\".7\" stop-opacity=\"0\"/>\n      <stop offset=\".9\" stop-opacity=\".5\"/>\n      <stop offset=\"1\"/>\n    </radialGradient>\n    <radialGradient id=\"d\" cx=\"-340.3\" cy=\"63\" r=\"143.2\" gradientTransform=\"matrix(.15 -.99 -.8 -.12 176.6 -125.4)\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\".8\" stop-opacity=\"0\"/>\n      <stop offset=\".9\" stop-opacity=\".5\"/>\n      <stop offset=\"1\"/>\n    </radialGradient>\n    <radialGradient id=\"e\" cx=\"113.4\" cy=\"570.2\" r=\"202.4\" gradientTransform=\"matrix(-.04 1 2.13 .08 -1179.5 -106.7)\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"0\" stop-color=\"#35c1f1\"/>\n      <stop offset=\".1\" stop-color=\"#34c1ed\"/>\n      <stop offset=\".2\" stop-color=\"#2fc2df\"/>\n      <stop offset=\".3\" stop-color=\"#2bc3d2\"/>\n      <stop offset=\".7\" stop-color=\"#36c752\"/>\n    </radialGradient>\n    <radialGradient id=\"f\" cx=\"376.5\" cy=\"568\" r=\"97.3\" gradientTransform=\"matrix(.28 .96 .78 -.23 -303.8 -148.5)\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"0\" stop-color=\"#66eb6e\"/>\n      <stop offset=\"1\" stop-color=\"#66eb6e\" stop-opacity=\"0\"/>\n    </radialGradient>\n    <linearGradient id=\"a\" x1=\"63.3\" x2=\"241.7\" y1=\"84\" y2=\"84\" gradientTransform=\"matrix(1 0 0 -1 0 266)\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"0\" stop-color=\"#0c59a4\"/>\n      <stop offset=\"1\" stop-color=\"#114a8b\"/>\n    </linearGradient>\n    <linearGradient id=\"c\" x1=\"157.3\" x2=\"46\" y1=\"161.4\" y2=\"40.1\" gradientTransform=\"matrix(1 0 0 -1 0 266)\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"0\" stop-color=\"#1b9de2\"/>\n      <stop offset=\".2\" stop-color=\"#1595df\"/>\n      <stop offset=\".7\" stop-color=\"#0680d7\"/>\n      <stop offset=\"1\" stop-color=\"#0078d4\"/>\n    </linearGradient>\n  </defs>\n  <path fill=\"url(#a)\" d=\"M235.7 195.5a93.7 93.7 0 0 1-10.6 4.7 101.9 101.9 0 0 1-35.9 6.4c-47.3 0-88.5-32.5-88.5-74.3a31.5 31.5 0 0 1 16.4-27.3c-42.8 1.8-53.8 46.4-53.8 72.5 0 74 68.1 81.4 82.8 81.4 7.9 0 19.8-2.3 27-4.6l1.3-.4a128.3 128.3 0 0 0 66.6-52.8 4 4 0 0 0-5.3-5.6Z\" transform=\"translate(-4.6 -5)\"/>\n  <path fill=\"url(#b)\" d=\"M235.7 195.5a93.7 93.7 0 0 1-10.6 4.7 101.9 101.9 0 0 1-35.9 6.4c-47.3 0-88.5-32.5-88.5-74.3a31.5 31.5 0 0 1 16.4-27.3c-42.8 1.8-53.8 46.4-53.8 72.5 0 74 68.1 81.4 82.8 81.4 7.9 0 19.8-2.3 27-4.6l1.3-.4a128.3 128.3 0 0 0 66.6-52.8 4 4 0 0 0-5.3-5.6Z\" opacity=\".35\" style=\"isolation:isolate\" transform=\"translate(-4.6 -5)\"/>\n  <path fill=\"url(#c)\" d=\"M110.3 246.3A79.2 79.2 0 0 1 87.6 225a80.7 80.7 0 0 1 29.5-120c3.2-1.5 8.5-4.1 15.6-4a32.4 32.4 0 0 1 25.7 13 31.9 31.9 0 0 1 6.3 18.7c0-.2 24.5-79.6-80-79.6-43.9 0-80 41.6-80 78.2a130.2 130.2 0 0 0 12.1 56 128 128 0 0 0 156.4 67 75.5 75.5 0 0 1-62.8-8Z\" transform=\"translate(-4.6 -5)\"/>\n  <path fill=\"url(#d)\" d=\"M110.3 246.3A79.2 79.2 0 0 1 87.6 225a80.7 80.7 0 0 1 29.5-120c3.2-1.5 8.5-4.1 15.6-4a32.4 32.4 0 0 1 25.7 13 31.9 31.9 0 0 1 6.3 18.7c0-.2 24.5-79.6-80-79.6-43.9 0-80 41.6-80 78.2a130.2 130.2 0 0 0 12.1 56 128 128 0 0 0 156.4 67 75.5 75.5 0 0 1-62.8-8Z\" opacity=\".41\" style=\"isolation:isolate\" transform=\"translate(-4.6 -5)\"/>\n  <path fill=\"url(#e)\" d=\"M157 153.8c-.9 1-3.4 2.5-3.4 5.6 0 2.6 1.7 5.2 4.8 7.3 14.3 10 41.4 8.6 41.5 8.6a59.6 59.6 0 0 0 30.3-8.3 61.4 61.4 0 0 0 30.4-52.9c.3-22.4-8-37.3-11.3-43.9C228 28.8 182.3 5 132.6 5a128 128 0 0 0-128 126.2c.5-36.5 36.8-66 80-66 3.5 0 23.5.3 42 10a72.6 72.6 0 0 1 30.9 29.3c6.1 10.6 7.2 24.1 7.2 29.5s-2.7 13.3-7.8 19.9Z\" transform=\"translate(-4.6 -5)\"/>\n  <path fill=\"url(#f)\" d=\"M157 153.8c-.9 1-3.4 2.5-3.4 5.6 0 2.6 1.7 5.2 4.8 7.3 14.3 10 41.4 8.6 41.5 8.6a59.6 59.6 0 0 0 30.3-8.3 61.4 61.4 0 0 0 30.4-52.9c.3-22.4-8-37.3-11.3-43.9C228 28.8 182.3 5 132.6 5a128 128 0 0 0-128 126.2c.5-36.5 36.8-66 80-66 3.5 0 23.5.3 42 10a72.6 72.6 0 0 1 30.9 29.3c6.1 10.6 7.2 24.1 7.2 29.5s-2.7 13.3-7.8 19.9Z\" transform=\"translate(-4.6 -5)\"/>\n</svg>",
  "firefox": "<svg viewBox=\"0 0 256 265\" xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"265\" preserveAspectRatio=\"xMidYMid\"><defs><radialGradient id=\"firefox__b\" cx=\"-7907.187\" cy=\"-8515.121\" r=\"80.797\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".129\" stop-color=\"#ffbd4f\"/><stop offset=\".186\" stop-color=\"#ffac31\"/><stop offset=\".247\" stop-color=\"#ff9d17\"/><stop offset=\".283\" stop-color=\"#ff980e\"/><stop offset=\".403\" stop-color=\"#ff563b\"/><stop offset=\".467\" stop-color=\"#ff3750\"/><stop offset=\".71\" stop-color=\"#f5156c\"/><stop offset=\".782\" stop-color=\"#eb0878\"/><stop offset=\".86\" stop-color=\"#e50080\"/></radialGradient><radialGradient id=\"firefox__c\" cx=\"-7936.711\" cy=\"-8482.089\" r=\"80.797\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".3\" stop-color=\"#960e18\"/><stop offset=\".351\" stop-color=\"#b11927\" stop-opacity=\".74\"/><stop offset=\".435\" stop-color=\"#db293d\" stop-opacity=\".343\"/><stop offset=\".497\" stop-color=\"#f5334b\" stop-opacity=\".094\"/><stop offset=\".53\" stop-color=\"#ff3750\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"firefox__d\" cx=\"-7926.97\" cy=\"-8533.457\" r=\"58.534\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".132\" stop-color=\"#fff44f\"/><stop offset=\".252\" stop-color=\"#ffdc3e\"/><stop offset=\".506\" stop-color=\"#ff9d12\"/><stop offset=\".526\" stop-color=\"#ff980e\"/></radialGradient><radialGradient id=\"firefox__e\" cx=\"-7945.648\" cy=\"-8460.984\" r=\"38.471\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".353\" stop-color=\"#3a8ee6\"/><stop offset=\".472\" stop-color=\"#5c79f0\"/><stop offset=\".669\" stop-color=\"#9059ff\"/><stop offset=\"1\" stop-color=\"#c139e6\"/></radialGradient><radialGradient id=\"firefox__f\" cx=\"-7935.62\" cy=\"-8491.546\" r=\"20.397\" gradientTransform=\"matrix(3.21411 -.77707 .90934 3.76302 33365.914 25904.014)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".206\" stop-color=\"#9059ff\" stop-opacity=\"0\"/><stop offset=\".278\" stop-color=\"#8c4ff3\" stop-opacity=\".064\"/><stop offset=\".747\" stop-color=\"#7716a8\" stop-opacity=\".45\"/><stop offset=\".975\" stop-color=\"#6e008b\" stop-opacity=\".6\"/></radialGradient><radialGradient id=\"firefox__g\" cx=\"-7937.731\" cy=\"-8518.427\" r=\"27.676\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#ffe226\"/><stop offset=\".121\" stop-color=\"#ffdb27\"/><stop offset=\".295\" stop-color=\"#ffc82a\"/><stop offset=\".502\" stop-color=\"#ffa930\"/><stop offset=\".732\" stop-color=\"#ff7e37\"/><stop offset=\".792\" stop-color=\"#ff7139\"/></radialGradient><radialGradient id=\"firefox__h\" cx=\"-7915.977\" cy=\"-8535.981\" r=\"118.081\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".113\" stop-color=\"#fff44f\"/><stop offset=\".456\" stop-color=\"#ff980e\"/><stop offset=\".622\" stop-color=\"#ff5634\"/><stop offset=\".716\" stop-color=\"#ff3647\"/><stop offset=\".904\" stop-color=\"#e31587\"/></radialGradient><radialGradient id=\"firefox__i\" cx=\"-7927.165\" cy=\"-8522.859\" r=\"86.499\" gradientTransform=\"matrix(.3472 3.29017 -2.15928 .22816 -15491.597 28008.376)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#fff44f\"/><stop offset=\".06\" stop-color=\"#ffe847\"/><stop offset=\".168\" stop-color=\"#ffc830\"/><stop offset=\".304\" stop-color=\"#ff980e\"/><stop offset=\".356\" stop-color=\"#ff8b16\"/><stop offset=\".455\" stop-color=\"#ff672a\"/><stop offset=\".57\" stop-color=\"#ff3647\"/><stop offset=\".737\" stop-color=\"#e31587\"/></radialGradient><radialGradient id=\"firefox__j\" cx=\"-7938.383\" cy=\"-8508.176\" r=\"73.72\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".137\" stop-color=\"#fff44f\"/><stop offset=\".48\" stop-color=\"#ff980e\"/><stop offset=\".592\" stop-color=\"#ff5634\"/><stop offset=\".655\" stop-color=\"#ff3647\"/><stop offset=\".904\" stop-color=\"#e31587\"/></radialGradient><radialGradient id=\"firefox__k\" cx=\"-7918.923\" cy=\"-8503.861\" r=\"80.686\" gradientTransform=\"translate(26367.938 28186.305) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".094\" stop-color=\"#fff44f\"/><stop offset=\".231\" stop-color=\"#ffe141\"/><stop offset=\".509\" stop-color=\"#ffaf1e\"/><stop offset=\".626\" stop-color=\"#ff980e\"/></radialGradient><linearGradient id=\"firefox__a\" x1=\"70.786\" x2=\"6.447\" y1=\"12.393\" y2=\"74.468\" gradientTransform=\"translate(-2.999 -.01) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".048\" stop-color=\"#fff44f\"/><stop offset=\".111\" stop-color=\"#ffe847\"/><stop offset=\".225\" stop-color=\"#ffc830\"/><stop offset=\".368\" stop-color=\"#ff980e\"/><stop offset=\".401\" stop-color=\"#ff8b16\"/><stop offset=\".462\" stop-color=\"#ff672a\"/><stop offset=\".534\" stop-color=\"#ff3647\"/><stop offset=\".705\" stop-color=\"#e31587\"/></linearGradient><linearGradient id=\"firefox__l\" x1=\"70.013\" x2=\"15.267\" y1=\"12.061\" y2=\"66.806\" gradientTransform=\"translate(-2.999 -.01) scale(3.3067)\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".167\" stop-color=\"#fff44f\" stop-opacity=\".8\"/><stop offset=\".266\" stop-color=\"#fff44f\" stop-opacity=\".634\"/><stop offset=\".489\" stop-color=\"#fff44f\" stop-opacity=\".217\"/><stop offset=\".6\" stop-color=\"#fff44f\" stop-opacity=\"0\"/></linearGradient></defs><path fill=\"url(#firefox__a)\" d=\"M248.033 88.713c-5.569-13.399-16.864-27.866-25.71-32.439a133.169 133.169 0 0 1 12.979 38.9l.023.215c-14.49-36.126-39.062-50.692-59.13-82.41a155.1 155.1 0 0 1-3.019-4.907 40.605 40.605 0 0 1-1.412-2.645 23.31 23.31 0 0 1-1.912-5.076.331.331 0 0 0-.291-.331.469.469 0 0 0-.241 0c-.016 0-.043.03-.063.037-.02.006-.063.036-.092.049l.049-.086c-32.19 18.849-43.113 53.741-44.118 71.194a64.108 64.108 0 0 0-35.269 13.593 38.336 38.336 0 0 0-3.307-2.506 59.417 59.417 0 0 1-.36-31.324 94.912 94.912 0 0 0-30.848 23.841h-.06c-5.079-6.438-4.722-27.667-4.431-32.102a22.957 22.957 0 0 0-4.279 2.272 93.435 93.435 0 0 0-12.526 10.73 111.954 111.954 0 0 0-11.98 14.375v.019-.023A108.26 108.26 0 0 0 4.841 108.92l-.171.846a203.818 203.818 0 0 0-1.26 8.003c0 .096-.02.185-.03.281a122.12 122.12 0 0 0-2.08 17.667v.662c.086 98.661 106.944 160.23 192.344 110.825a128.165 128.165 0 0 0 62.12-89.153c.215-1.653.39-3.29.582-4.96a131.8 131.8 0 0 0-8.313-64.378ZM100.322 189.031c.599.288 1.161.599 1.776.873l.089.057a68.838 68.838 0 0 1-1.865-.93Zm29.357-77.297Zm105.656-16.315v-.123l.023.136-.023-.013Z\"/><path fill=\"url(#firefox__b)\" d=\"M248.033 88.713c-5.569-13.399-16.864-27.866-25.71-32.439a133.169 133.169 0 0 1 12.979 38.9v.122l.023.136a116.067 116.067 0 0 1-3.988 86.497c-14.688 31.516-50.242 63.819-105.894 62.248-60.132-1.703-113.089-46.323-122.989-104.766-1.802-9.216 0-13.888.906-21.378a95.444 95.444 0 0 0-2.06 17.684v.662c.086 98.661 106.944 160.23 192.344 110.825a128.165 128.165 0 0 0 62.12-89.153c.215-1.653.39-3.29.582-4.96a131.8 131.8 0 0 0-8.313-64.378Z\"/><path fill=\"url(#firefox__c)\" d=\"M248.033 88.713c-5.569-13.399-16.864-27.866-25.71-32.439a133.169 133.169 0 0 1 12.979 38.9v.122l.023.136a116.067 116.067 0 0 1-3.988 86.497c-14.688 31.516-50.242 63.819-105.894 62.248-60.132-1.703-113.089-46.323-122.989-104.766-1.802-9.216 0-13.888.906-21.378a95.444 95.444 0 0 0-2.06 17.684v.662c.086 98.661 106.944 160.23 192.344 110.825a128.165 128.165 0 0 0 62.12-89.153c.215-1.653.39-3.29.582-4.96a131.8 131.8 0 0 0-8.313-64.378Z\"/><path fill=\"url(#firefox__d)\" d=\"M185.754 103.778c.278.195.536.39.797.585a69.775 69.775 0 0 0-11.904-15.525C134.815 48.999 164.208 2.457 169.165.093l.049-.073c-32.19 18.849-43.113 53.741-44.118 71.194 1.495-.103 2.976-.229 4.504-.229a64.68 64.68 0 0 1 56.154 32.793Z\"/><path fill=\"url(#firefox__e)\" d=\"M129.683 111.734c-.212 3.188-11.475 14.182-15.413 14.182-36.443 0-42.359 22.046-42.359 22.046 1.614 18.564 14.55 33.854 30.187 41.942.714.371 1.439.705 2.163 1.032a70.572 70.572 0 0 0 3.763 1.541 56.974 56.974 0 0 0 16.675 3.217c63.876 2.996 76.25-76.384 30.154-99.419a44.241 44.241 0 0 1 30.901 7.503A64.68 64.68 0 0 0 129.6 70.985c-1.521 0-3.009.126-4.504.229a64.108 64.108 0 0 0-35.269 13.593c1.954 1.654 4.16 3.863 8.806 8.442 8.696 8.568 31 17.443 31.05 18.485Z\"/><path fill=\"url(#firefox__f)\" d=\"M129.683 111.734c-.212 3.188-11.475 14.182-15.413 14.182-36.443 0-42.359 22.046-42.359 22.046 1.614 18.564 14.55 33.854 30.187 41.942.714.371 1.439.705 2.163 1.032a70.572 70.572 0 0 0 3.763 1.541 56.974 56.974 0 0 0 16.675 3.217c63.876 2.996 76.25-76.384 30.154-99.419a44.241 44.241 0 0 1 30.901 7.503A64.68 64.68 0 0 0 129.6 70.985c-1.521 0-3.009.126-4.504.229a64.108 64.108 0 0 0-35.269 13.593c1.954 1.654 4.16 3.863 8.806 8.442 8.696 8.568 31 17.443 31.05 18.485Z\"/><path fill=\"url(#firefox__g)\" d=\"M83.852 80.545a81.51 81.51 0 0 1 2.645 1.756 59.407 59.407 0 0 1-.36-31.324 94.926 94.926 0 0 0-30.849 23.841c.625-.017 19.216-.351 28.564 5.727Z\"/><path fill=\"url(#firefox__h)\" d=\"M2.471 139.411c9.89 58.443 62.857 103.063 122.989 104.766 55.652 1.574 91.205-30.732 105.894-62.248a116.067 116.067 0 0 0 3.988-86.497v-.122c0-.096-.02-.153 0-.123l.023.215c4.547 29.684-10.552 58.443-34.155 77.889l-.073.166c-45.989 37.455-90.002 22.598-98.91 16.533a64.67 64.67 0 0 1-1.865-.929c-26.814-12.817-37.891-37.247-35.517-58.198a32.912 32.912 0 0 1-30.359-19.096 48.336 48.336 0 0 1 47.117-1.891 63.821 63.821 0 0 0 48.119 1.891c-.049-1.042-22.353-9.92-31.05-18.484-4.646-4.58-6.851-6.786-8.805-8.442a38.145 38.145 0 0 0-3.307-2.507c-.761-.519-1.617-1.081-2.645-1.756-9.348-6.078-27.939-5.744-28.554-5.727h-.059c-5.079-6.438-4.722-27.667-4.431-32.101a22.862 22.862 0 0 0-4.279 2.271 93.373 93.373 0 0 0-12.526 10.73 112.062 112.062 0 0 0-12.03 14.342v.019-.023A108.26 108.26 0 0 0 4.841 108.92c-.062.261-4.616 20.167-2.37 30.491Z\"/><path fill=\"url(#firefox__i)\" d=\"M174.654 88.838a69.818 69.818 0 0 1 11.904 15.542 26.607 26.607 0 0 1 1.921 1.574c29.056 26.784 13.832 64.646 12.698 67.341 23.603-19.447 38.688-48.205 34.155-77.89-14.497-36.142-39.069-50.708-59.137-82.426a155.1 155.1 0 0 1-3.019-4.907 40.605 40.605 0 0 1-1.412-2.645 23.31 23.31 0 0 1-1.912-5.076.331.331 0 0 0-.291-.331.469.469 0 0 0-.241 0c-.016 0-.043.03-.063.037-.02.006-.063.036-.092.049-4.957 2.351-34.35 48.893 5.489 88.732Z\"/><path fill=\"url(#firefox__j)\" d=\"M188.459 105.937a26.822 26.822 0 0 0-1.921-1.574c-.261-.195-.519-.39-.797-.585a44.243 44.243 0 0 0-30.901-7.503c46.095 23.048 33.728 102.415-30.154 99.419a56.974 56.974 0 0 1-16.675-3.217 67.38 67.38 0 0 1-3.763-1.541c-.725-.331-1.449-.661-2.163-1.032l.089.057c8.908 6.081 52.907 20.938 98.91-16.534l.073-.165c1.147-2.679 16.371-40.55-12.698-67.325Z\"/><path fill=\"url(#firefox__k)\" d=\"M71.911 147.962s5.916-22.046 42.359-22.046c3.938 0 15.211-10.994 15.413-14.182a63.817 63.817 0 0 1-48.119-1.892 48.341 48.341 0 0 0-47.118 1.892 32.912 32.912 0 0 0 30.359 19.096c-2.374 20.955 8.703 45.385 35.517 58.198.599.288 1.161.599 1.776.873-15.65-8.085-28.573-23.375-30.187-41.939Z\"/><path fill=\"url(#firefox__l)\" d=\"M248.033 88.713c-5.569-13.399-16.864-27.866-25.71-32.439a133.169 133.169 0 0 1 12.979 38.9l.023.215c-14.49-36.126-39.062-50.692-59.13-82.41a155.1 155.1 0 0 1-3.019-4.907 40.605 40.605 0 0 1-1.412-2.645 23.31 23.31 0 0 1-1.912-5.076.331.331 0 0 0-.291-.331.469.469 0 0 0-.241 0c-.016 0-.043.03-.063.037-.02.006-.063.036-.092.049l.049-.086c-32.19 18.849-43.113 53.741-44.118 71.194 1.495-.103 2.976-.229 4.504-.229a64.68 64.68 0 0 1 56.154 32.793 44.241 44.241 0 0 0-30.901-7.503c46.096 23.048 33.729 102.415-30.154 99.419a56.974 56.974 0 0 1-16.675-3.217 67.38 67.38 0 0 1-3.763-1.541c-.724-.331-1.449-.661-2.163-1.032l.089.057a68.838 68.838 0 0 1-1.865-.93c.599.288 1.161.599 1.776.873-15.65-8.088-28.573-23.378-30.187-41.942 0 0 5.916-22.046 42.359-22.046 3.938 0 15.211-10.994 15.413-14.182-.05-1.042-22.354-9.92-31.05-18.485-4.646-4.579-6.852-6.785-8.806-8.442a38.336 38.336 0 0 0-3.307-2.506 59.417 59.417 0 0 1-.36-31.324 94.912 94.912 0 0 0-30.848 23.841h-.06c-5.079-6.438-4.722-27.667-4.431-32.102a22.957 22.957 0 0 0-4.279 2.272 93.435 93.435 0 0 0-12.526 10.73 111.954 111.954 0 0 0-11.98 14.375v.019-.023A108.26 108.26 0 0 0 4.841 108.92l-.171.846c-.242 1.128-1.323 6.855-1.479 8.085 0 .093 0-.096 0 0A149.15 149.15 0 0 0 1.3 135.717v.662c.086 98.661 106.944 160.23 192.344 110.825a128.165 128.165 0 0 0 62.12-89.153c.215-1.653.39-3.29.582-4.96a131.8 131.8 0 0 0-8.313-64.378Zm-12.715 6.583.024.136-.024-.136Z\"/></svg>",
  "opera": "<svg xmlns=\"http://www.w3.org/2000/svg\" xml:space=\"preserve\" viewBox=\"0 0 1000 1000\"><linearGradient id=\"opera__a\" x1=\"416.6229\" x2=\"416.6229\" y1=\"16.304\" y2=\"985.446\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".3\" stop-color=\"#ff1b2d\"/><stop offset=\".4381\" stop-color=\"#fa1a2c\"/><stop offset=\".5939\" stop-color=\"#ed1528\"/><stop offset=\".7581\" stop-color=\"#d60e21\"/><stop offset=\".9272\" stop-color=\"#b70519\"/><stop offset=\"1\" stop-color=\"#a70014\"/></linearGradient><path fill=\"url(#opera__a)\" d=\"M335.4 781.8c-55.3-65.3-91.1-161.7-93.5-270v-23.6c2.4-108.3 38.2-204.7 93.5-270C407.2 125.1 513.8 66 632.8 66c73.2 0 141.8 22.4 200.4 61.3C745.2 48.5 629.2.5 501.9 0H500C223.9 0 0 223.9 0 500c0 268.2 211.1 487 476.2 499.4 7.9.4 15.8.6 23.8.6 128 0 244.8-48.1 333.2-127.2-58.6 38.8-127.1 61.2-200.4 61.2-119 0-225.6-59.1-297.4-152.2z\"/><linearGradient id=\"opera__b\" x1=\"667.7092\" x2=\"667.7092\" y1=\"73.4257\" y2=\"930.5844\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#9c0000\"/><stop offset=\".7\" stop-color=\"#ff4b4b\"/></linearGradient><path fill=\"url(#opera__b)\" d=\"M335.4 218.2c45.9-54.2 105.1-86.8 169.9-86.8 145.6 0 263.5 165 263.5 368.6s-118 368.6-263.5 368.6c-64.7 0-124-32.7-169.9-86.8C407.2 874.9 513.8 934 632.8 934c73.2 0 141.8-22.4 200.4-61.2C935.6 781.2 1000 648.1 1000 500c0-148.1-64.4-281.2-166.8-372.7C774.6 88.4 706.1 66 632.8 66c-119 0-225.6 59.1-297.4 152.2z\"/></svg>",
  "opera-gx": "<svg viewBox=\"0 0 58 58\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m46.336 48.414c-3.0657 2.0229-6.5705 3.095-10.145 3.095-5.8513 0-11.399-2.8626-15.221-7.8536-0.013635-0.017137-0.026587-0.032903-0.040222-0.05004-2.9314-3.4795-4.6821-8.5911-4.8028-13.993l-6.818e-4 -1.2675c0.12135-5.4338 1.872-10.545 4.843-14.074 3.8225-4.991 9.371-7.8536 15.222-7.8536 3.575 0 7.0804 1.0721 10.148 3.0963 5.4736 4.9622 8.613 12.044 8.613 19.45 0 7.4066-3.14 14.489-8.615 19.451m-18.668 6.7026c-13.906-0.65601-24.8-12.144-24.8-26.154 0-14.438 11.682-26.185 26.067-26.185 0.0061355 0 0.065446 6.855e-4 0.072263 6.855e-4 2.2777 0.0082258 4.5233 0.31601 6.6857 0.90209-6.5187 0.15629-12.648 3.3856-16.845 8.8674-3.3275 3.9491-5.3134 9.6845-5.4484 15.765v1.3291c0.13498 6.0364 2.1127 11.761 5.4279 15.711 4.2349 5.5154 10.358 8.7351 16.867 8.8914-2.5878 0.70193-5.3338 1.0008-8.0274 0.87193m20.416-47.717c-5.2479-4.7216-12.019-7.336-19.096-7.3628-0.0088625-6.8548e-4 -0.069536-0.001371-0.077717-0.001371-15.863 0-28.769 12.977-28.769 28.927 0 15.477 12.035 28.169 27.401 28.893 0.45335 0.02125 0.90943 0.032903 1.3682 0.032903 7.0818 0 13.889-2.6124 19.165-7.3573l0.0061354-0.0041132c6.0987-5.4852 9.5967-13.345 9.5967-21.565 0-8.2189-3.4973-16.079-9.5946-21.563\" fill=\"#FA1E4E\"/><path d=\"m34.182 10.741c5.1323 3.3139 8.6661 10.243 8.6661 18.259 0 8.0159-3.5338 14.946-8.6661 18.259 6.5512-0.54591 11.75-8.511 11.75-18.259 0-9.7482-5.199-17.713-11.75-18.259\" fill=\"#FA1E4E\"/></svg>",
  "supermium": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 94 90\" width=\"94\" height=\"90\"><path d=\"M21.34 10.35C12.37 15.35 25.16 24.79 26.34 29.69C25.66 29.29 24.97 28.9 24.28 28.5C23.61 40.26 24.36 46.41 33.88 53.95C34.6 54.52 34.39 55.11 35.33 55.5C35.83 55.22 36.33 54.94 36.83 54.66C37.13 54.79 37.43 54.92 37.72 55.04C37.54 55.39 37.35 55.74 37.17 56.09C33.67 56.84 22.31 64.72 23.26 68.9C24.46 74.11 32.21 78.35 36.33 80.92C39.08 82.57 42.81 83.52 46 83.3C46.33 83.43 46.67 83.56 47 83.69C44.39 83.9 41.78 84.12 39.17 84.33C37.48 82.65 33.28 82.59 30.56 81.94C25.94 80.83 20.42 76.56 16.68 73.82C12.24 70.58 8.45 65.33 6.06 60.44C4.87 58 4.5 53.85 2.57 52.17C3.67 48.47 -0.03 43.14 1.63 38.84C2.24 37.26 2.11 35.41 2.68 33.84C4.18 29.76 5.56 25.52 7.8 21.67C10.71 16.69 15.63 13.82 19.5 9.9C20.11 10.05 20.73 10.2 21.34 10.35ZM25.31 25.68C25.54 25.29 25.77 24.89 26 24.5C24.06 24.47 25.71 22.16 24 22.17C24.06 21.22 24.11 20.28 24.17 19.33C25.25 21.49 25.52 25.11 28.43 24.83C28.12 25.89 27.81 26.94 27.5 28C26.77 27.23 26.04 26.45 25.31 25.68ZM29.29 28.21C30.45 28.79 30.64 29.76 30.42 31C30.36 31.11 30.31 31.22 30.25 31.33C30 32.21 29.75 33.08 29.5 33.96C29.1 32.88 28.69 31.8 28.29 30.72C28.41 30.65 28.54 30.57 28.67 30.5C28.56 29.94 28.44 29.39 28.33 28.83C28.65 28.63 28.97 28.42 29.29 28.21ZM26.34 29.69C26.52 29.85 26.69 30.01 26.87 30.17C26.89 33.22 26.91 36.28 26.93 39.33C26.79 39.92 26.64 40.51 26.5 41.1C25.79 39.2 24.45 33.44 26.33 32.17C26.34 31.34 26.34 30.51 26.34 29.69ZM67.97 31.94C67.64 32.09 67.32 32.24 66.99 32.39C65.93 31.77 64.03 30.7 63 31.5C65.24 35.98 64.97 44.85 60.3 48.03C63.6 40.33 64.19 38.9 61.83 30.46C63.09 29.98 67.53 30.73 67.97 31.94ZM34.83 59.26C32.16 61.67 29.48 64.09 26.8 66.5C27.02 64.58 33.1 58.87 34.83 59.26Z\" fill=\"#d5d7c8\" fill-rule=\"evenodd\" stroke=\"#d5d7c8\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/><path d=\"M81.06 21.33C81.85 24.39 82.64 27.44 83.43 30.5C82.97 30.77 82.5 31.05 82.04 31.32C78.73 24.75 60.1 30.63 58.63 23.24C60.79 24.43 62 25.91 64.5 26.67C64.55 26.28 64.59 25.89 64.64 25.5C58.01 17.89 51.68 13.12 40.84 14.97C38.58 15.35 32.87 18.92 31.67 18.83C30.28 20.46 28.89 22.09 27.5 23.72C26.99 23.2 26.49 22.68 25.98 22.17C25.63 20.62 24.37 19.45 24.09 17.83C23.79 16.06 25.02 14.98 24.5 13.31C24.03 13.32 23.56 13.33 23.09 13.33C22.82 12.83 22.54 12.33 22.27 11.83C22.41 11.5 22.54 11.17 22.67 10.83C22.56 10.58 22.44 10.32 22.33 10.06C24.34 5.82 29.38 4.96 33.79 3.6C44.06 0.46 54.86 1.89 64.23 6.51C67.54 8.15 71.77 9.61 73.83 12.67C75.65 13.08 80.98 19.75 81.06 21.33ZM56.78 21.65C53.22 21.15 50.88 18.37 46 18.24C40.97 18.11 37.22 20.92 34.2 20.99C37.66 16.23 54.33 15.94 56.78 21.65ZM49.33 24.02C47.65 24 46.36 22.15 44.49 21.97C42.3 21.76 40.85 23.32 39.01 23.81C39.28 23.32 39.56 22.83 39.83 22.34C40.39 22.09 40.94 21.85 41.5 21.61C44.32 21.01 46.42 21.61 49.03 23.17C49.13 23.45 49.23 23.74 49.33 24.02ZM30.25 31.33C30.31 31.22 30.36 31.11 30.42 31C32.06 28.51 33.37 26.75 36.33 25.75C35.75 28.41 31.02 29.3 33.5 33.1C34.17 32.35 34.83 31.6 35.5 30.85C38.14 33.81 37.7 37.87 41.5 39.76C43.19 38.21 45.98 38.78 48.05 37.86C50.63 36.72 51.25 34.48 53.95 33.83C54.7 32.08 54.22 30.86 55.63 29.5C54.01 28.64 53.95 26.45 52.58 25.58C51.53 24.91 49.82 25.32 49.33 24.02C49.83 24.13 50.33 24.23 50.83 24.33C52.06 24.08 53.28 23.82 54.5 23.57C55.08 24.64 55.23 24.86 56.43 24.83C56.9 25.5 57.37 26.17 57.84 26.83C57.42 28.86 58.44 29.84 58.43 31.83C58.41 36.02 53.44 44.51 48.5 42.21C39.61 46.61 32.03 40.58 30.25 31.33Z\" fill=\"#336985\" fill-rule=\"evenodd\" stroke=\"#336985\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/><path d=\"M81.06 21.33C81.26 21.61 81.46 21.89 81.67 22.17C81.89 22.5 82.11 22.83 82.33 23.17C83.13 24.56 83.93 25.94 84.72 27.33C84.43 27.67 84.13 28 83.83 28.33C84.73 30.62 86.04 33.86 84.58 36.17C83.53 36.39 82.48 36.61 81.43 36.83C79.89 36.72 78.35 36.61 76.81 36.5C77.29 37.06 77.77 37.61 78.25 38.17C76.58 55.15 65 68.93 47.5 70.75C43.53 71.16 39.18 70.68 35.25 69.87C33.88 69.59 32.91 68.67 31.5 68.66C31.17 67.96 30.83 67.25 30.5 66.55C29.72 67.82 28.94 69.09 28.15 70.36C27.96 69.74 27.76 69.12 27.57 68.5C28.32 67.53 29.08 66.57 29.83 65.6C33.92 62.74 38 59.87 42.08 57C43.99 58.26 48.45 57.4 50.91 56.79C62.72 53.83 66.81 43.46 66.99 32.39C67.32 32.24 67.64 32.09 67.97 31.94C72.51 33.35 77.04 34.76 81.58 36.17C81.73 34.55 81.89 32.94 82.04 31.32C82.5 31.05 82.97 30.77 83.43 30.5C82.64 27.44 81.85 24.39 81.06 21.33ZM86.12 30.28C86.89 32.35 87.66 34.43 88.43 36.5C87.54 39.57 89.41 51.88 86.33 54.39C84.41 57.09 83.87 61.39 81.95 64.45C78.48 69.97 67.15 80.88 60.33 80.94C60.17 80.63 60 80.31 59.83 80C58.72 79.89 57.61 79.78 56.5 79.67C56.2 78.29 55.32 77.48 54 78.5C54.78 79.5 55.56 80.5 56.33 81.5C53.62 82.04 52.61 80.56 51.5 78.33C47.78 78.39 44.06 78.44 40.33 78.5C41.5 79 42.67 79.5 43.83 80C43.57 82.53 46.15 80.1 47.5 82.67C48 82.76 48.5 82.85 49 82.94C48.06 82.96 47.11 82.98 46.17 83C46.11 83.1 46.06 83.2 46 83.3C42.81 83.52 39.08 82.57 36.33 80.92C37.17 80.84 38 80.75 38.83 80.67C38.28 79.89 37.72 79.11 37.17 78.33C36.54 77.94 35.91 77.55 35.28 77.16C39.69 77.33 50.1 79.5 53.5 76.73C57.58 77.67 63.11 74.73 66.4 72.89C77.49 66.67 85.4 60.18 87.55 46.8C88.21 42.68 87.38 38.85 86.8 34.83C86.57 33.28 85 31.65 86.12 30.28Z\" fill=\"#3e9c42\" fill-rule=\"evenodd\" stroke=\"#3e9c42\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/><path d=\"M22.33 10.06C22.44 10.32 22.56 10.58 22.67 10.83C22.54 11.17 22.41 11.5 22.27 11.83C22.54 12.33 22.82 12.83 23.09 13.33C22.45 14.33 21.81 15.33 21.17 16.33C21.63 19.66 22.76 23.25 25.31 25.68C25.49 26.12 25.66 26.56 25.83 27C26.65 28.24 27.47 29.48 28.29 30.72C28.69 31.8 29.1 32.88 29.5 33.96C29.75 33.08 30 32.21 30.25 31.33C32.03 40.58 39.61 46.61 48.5 42.21C53.44 44.51 58.41 36.02 58.43 31.83C58.44 29.84 57.42 28.86 57.84 26.83C57.37 26.17 56.9 25.5 56.43 24.83C55.23 24.86 55.08 24.64 54.5 23.57C53.28 23.82 52.06 24.08 50.83 24.33C50.33 24.23 49.83 24.13 49.33 24.02C49.23 23.74 49.13 23.45 49.03 23.17C46.42 21.61 44.32 21.01 41.5 21.61C40.94 21.85 40.39 22.09 39.83 22.34C39.56 22.83 39.28 23.32 39.01 23.81C38.12 24.46 37.22 25.1 36.33 25.75C33.37 26.75 32.06 28.51 30.42 31C30.64 29.76 30.45 28.79 29.29 28.21C29.07 27.98 28.84 27.74 28.62 27.5C28.8 25.23 32.15 21.9 34.2 20.99C37.22 20.92 40.97 18.11 46 18.24C50.88 18.37 53.22 21.15 56.78 21.65C57.4 22.18 58.01 22.71 58.63 23.24C60.1 30.63 78.73 24.75 82.04 31.32C81.89 32.94 81.73 34.55 81.58 36.17C77.04 34.76 72.51 33.35 67.97 31.94C67.53 30.73 63.09 29.98 61.83 30.46C64.19 38.9 63.6 40.33 60.3 48.03C55.62 54.63 46.41 51.73 42.08 57C38 59.87 33.92 62.74 29.83 65.6C29.08 66.57 28.32 67.53 27.57 68.5C27.76 69.12 27.96 69.74 28.15 70.36C30.53 72.63 32.9 74.9 35.28 77.16C35.91 77.55 36.54 77.94 37.17 78.33C37.72 79.11 38.28 79.89 38.83 80.67C38 80.75 37.17 80.84 36.33 80.92C32.21 78.35 24.46 74.11 23.26 68.9C22.31 64.72 33.67 56.84 37.17 56.09C37.35 55.74 37.54 55.39 37.72 55.04C38.44 54.53 39.15 54.01 39.87 53.5C38.58 51.93 36.18 51.65 34.56 50.59C30.68 48.06 27.74 43.9 26.93 39.33C26.91 36.28 26.89 33.22 26.87 30.17C26.69 30.01 26.52 29.85 26.34 29.69C25.16 24.79 12.37 15.35 21.34 10.35C21.67 10.25 22 10.16 22.33 10.06ZM86.33 54.39C86.33 66.1 69.82 79.71 59.1 82.27C57.7 82.61 55.78 83.41 54.49 83.59C52.2 83.92 49.25 82.52 47 83.69C46.67 83.56 46.33 83.43 46 83.3C46.06 83.2 46.11 83.1 46.17 83C47.11 82.98 48.06 82.96 49 82.94C52.69 83.19 57.13 82.9 60.33 80.94C67.15 80.88 78.48 69.97 81.95 64.45C83.87 61.39 84.41 57.09 86.33 54.39ZM34.83 59.26C33.1 58.87 27.02 64.58 26.8 66.5C29.48 64.09 32.16 61.67 34.83 59.26Z\" fill=\"#34393c\" fill-rule=\"evenodd\" stroke=\"#34393c\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/><path d=\"M84.72 27.33C84.91 27.39 85.09 27.44 85.28 27.5C85.54 28.06 85.8 28.61 86.07 29.17C86.14 29.39 86.21 29.61 86.28 29.83C86.23 29.98 86.18 30.13 86.12 30.28C85 31.65 86.57 33.28 86.8 34.83C87.38 38.85 88.21 42.68 87.55 46.8C85.4 60.18 77.49 66.67 66.4 72.89C63.11 74.73 57.58 77.67 53.5 76.73C50.1 79.5 39.69 77.33 35.28 77.16C32.9 74.9 30.53 72.63 28.15 70.36C28.94 69.09 29.72 67.82 30.5 66.55C30.83 67.25 31.17 67.96 31.5 68.66C32.91 68.67 33.88 69.59 35.25 69.87C39.18 70.68 43.53 71.16 47.5 70.75C65 68.93 76.58 55.15 78.25 38.17C77.77 37.61 77.29 37.06 76.81 36.5C78.35 36.61 79.89 36.72 81.43 36.83C82.48 36.61 83.53 36.39 84.58 36.17C86.04 33.86 84.73 30.62 83.83 28.33C84.13 28 84.43 27.67 84.72 27.33ZM60.33 80.94C57.13 82.9 52.69 83.19 49 82.94C48.5 82.85 48 82.76 47.5 82.67C46.15 80.1 43.57 82.53 43.83 80C42.67 79.5 41.5 79 40.33 78.5C44.06 78.44 47.78 78.39 51.5 78.33C52.61 80.56 53.62 82.04 56.33 81.5C55.56 80.5 54.78 79.5 54 78.5C55.32 77.48 56.2 78.29 56.5 79.67C57.61 79.78 58.72 79.89 59.83 80C60 80.31 60.17 80.63 60.33 80.94Z\" fill=\"#238b29\" fill-rule=\"evenodd\" stroke=\"#238b29\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/><path d=\"M58.63 23.24C58.01 22.71 57.4 22.18 56.78 21.65C54.33 15.94 37.66 16.23 34.2 20.99C32.15 21.9 28.8 25.23 28.62 27.5C28.84 27.74 29.07 27.98 29.29 28.21C28.97 28.42 28.65 28.63 28.33 28.83C28.44 29.39 28.56 29.94 28.67 30.5C28.54 30.57 28.41 30.65 28.29 30.72C27.47 29.48 26.65 28.24 25.83 27C25.66 26.56 25.49 26.12 25.31 25.68C26.04 26.45 26.77 27.23 27.5 28C27.81 26.94 28.12 25.89 28.43 24.83C25.52 25.11 25.25 21.49 24.17 19.33C24.11 20.28 24.06 21.22 24 22.17C25.71 22.16 24.06 24.47 26 24.5C25.77 24.89 25.54 25.29 25.31 25.68C22.76 23.25 21.63 19.66 21.17 16.33C21.81 15.33 22.45 14.33 23.09 13.33C23.56 13.33 24.03 13.32 24.5 13.31C25.02 14.98 23.79 16.06 24.09 17.83C24.37 19.45 25.63 20.62 25.98 22.17C26.49 22.68 26.99 23.2 27.5 23.72C28.89 22.09 30.28 20.46 31.67 18.83C32.87 18.92 38.58 15.35 40.84 14.97C51.68 13.12 58.01 17.89 64.64 25.5C64.59 25.89 64.55 26.28 64.5 26.67C62 25.91 60.79 24.43 58.63 23.24ZM26.34 29.69C26.34 30.51 26.34 31.34 26.33 32.17C24.45 33.44 25.79 39.2 26.5 41.1C26.64 40.51 26.79 39.92 26.93 39.33C27.74 43.9 30.68 48.06 34.56 50.59C36.18 51.65 38.58 51.93 39.87 53.5C39.15 54.01 38.44 54.53 37.72 55.04C37.43 54.92 37.13 54.79 36.83 54.66C36.33 54.94 35.83 55.22 35.33 55.5C34.39 55.11 34.6 54.52 33.88 53.95C24.36 46.41 23.61 40.26 24.28 28.5C24.97 28.9 25.66 29.29 26.34 29.69ZM66.99 32.39C66.81 43.46 62.72 53.83 50.91 56.79C48.45 57.4 43.99 58.26 42.08 57C46.41 51.73 55.62 54.63 60.3 48.03C64.97 44.85 65.24 35.98 63 31.5C64.03 30.7 65.93 31.77 66.99 32.39Z\" fill=\"#fefefd\" fill-rule=\"evenodd\" stroke=\"#fefefd\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/><path d=\"M49.33 24.02C49.82 25.32 51.53 24.91 52.58 25.58C53.95 26.45 54.01 28.64 55.63 29.5C54.22 30.86 54.7 32.08 53.95 33.83C51.25 34.48 50.63 36.72 48.05 37.86C45.98 38.78 43.19 38.21 41.5 39.76C37.7 37.87 38.14 33.81 35.5 30.85C34.83 31.6 34.17 32.35 33.5 33.1C31.02 29.3 35.75 28.41 36.33 25.75C37.22 25.1 38.12 24.46 39.01 23.81C40.85 23.32 42.3 21.76 44.49 21.97C46.36 22.15 47.65 24 49.33 24.02Z\" fill=\"#4a94e2\" fill-rule=\"evenodd\" stroke=\"#4a94e2\" stroke-width=\"0.25\" stroke-linejoin=\"round\"/></svg>",
  "vivaldi": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 456 455\"><defs><linearGradient id=\"vivaldi__a\" x1=\"21.587%\" x2=\"76.116%\" y1=\"5.709%\" y2=\"100.496%\"><stop offset=\"0%\" stop-opacity=\".2\"/><stop offset=\"79.08%\" stop-opacity=\".05\"/></linearGradient></defs><g fill=\"none\"><path fill=\"#EF3939\" d=\"M228 454.3c99.7 0 155.1 0 191.4-36.1 36.2-36.1 36.2-91.3 36.2-190.7 0-99.4 0-154.6-36.2-190.7C383.1.8 327.7.8 228 .8S72.9.8 36.6 36.9C.4 73 .4 128.2.4 227.6c0 99.4 0 154.6 36.2 190.7 36.3 36 91.7 36 191.4 36z\"/><path fill=\"url(#vivaldi__a)\" d=\"M376 143.7c-21.8-38.1-58.3-67.8-104.2-80.1C180.7 39.3 87.1 93.1 62.7 183.8c-12.3 45.6-4.7 91.9 17.5 129.7.3.5.6 1.1 1 1.6l80.2 138.5c13.3.4 27.7.5 43.2.5h22.6c44.3 0 79.9 0 109-3.2 36.3-4 62.3-12.9 82.4-32.9 29.3-29.2 34.9-71 36-138.7-46.8-80.8-78.5-135.5-78.6-135.6z\"/><path fill=\"#FFF\" d=\"M347.8 107.6c-66.5-66.4-174.4-66.4-241 0-66.5 66.4-66.5 174 0 240.3 66.5 66.4 174.4 66.4 241 0s66.6-174 0-240.3zm-10.2 78.1c-28.1 48.7-56.2 97.4-84.3 146.2-5.2 9.1-12.8 14.5-23.2 15.3-11.6.8-20.8-4.1-26.7-14.1-17.8-30.5-35.4-61.2-53-91.8-10.7-18.6-21.5-37.2-32.2-55.9-10.8-18.8 1.4-41.7 23-42.8 11.4-.6 20.2 4.7 26 14.6 7.9 13.5 15.7 27.2 23.6 40.8 5.7 9.8 11.2 19.7 17 29.3 8.4 14.1 20.8 22 37.3 23 23.3 1.4 45-15.5 47.8-40.2.2-1.8.3-3.7.4-4.6-.1-8-1.6-14.8-4.8-21.1-8.7-17.4.6-36.9 19.5-41.1 15.4-3.4 31.4 7.9 33.4 23.5 1 6.7-.4 13-3.8 18.9z\"/></g></svg>",
  "floorp": "<svg\n  \n  \n   viewBox=\"0 0 118 106\"\n   version=\"1.1\"\n   id=\"floorp__svg1\"\n   xml:space=\"preserve\"\n   xmlns:xlink=\"http://www.w3.org/1999/xlink\"\n   xmlns=\"http://www.w3.org/2000/svg\"\n   xmlns:svg=\"http://www.w3.org/2000/svg\"><defs\n     id=\"floorp__defs1\"><linearGradient\n       xlink:href=\"#floorp__linearGradient15-5\"\n       id=\"floorp__linearGradient16\"\n       x1=\"89.236084\"\n       y1=\"164.32671\"\n       x2=\"89.236343\"\n       y2=\"310.96014\"\n       gradientUnits=\"userSpaceOnUse\"\n       gradientTransform=\"matrix(0.73444795,0,0,0.73444795,-6.0081998,-120.68941)\" /><linearGradient\n       id=\"floorp__linearGradient15-5\"><stop\n         style=\"stop-color:#7204e8;stop-opacity:1;\"\n         offset=\"0.09843081\"\n         id=\"floorp__stop15\" /><stop\n         style=\"stop-color:#0710e8;stop-opacity:1;\"\n         offset=\"0.90442228\"\n         id=\"floorp__stop16\" /></linearGradient><filter\n       style=\"color-interpolation-filters:sRGB\"\n       id=\"floorp__filter16363\"\n       x=\"-0.026366812\"\n       y=\"-0.060160136\"\n       width=\"1.0527336\"\n       height=\"1.1203203\"><feGaussianBlur\n         stdDeviation=\"3.5408214\"\n         id=\"floorp__feGaussianBlur16365\" /></filter><linearGradient\n       xlink:href=\"#floorp__linearGradient41007\"\n       id=\"floorp__linearGradient41009\"\n       x1=\"44.491547\"\n       y1=\"29.87673\"\n       x2=\"90.553719\"\n       y2=\"104.66171\"\n       gradientUnits=\"userSpaceOnUse\" /><linearGradient\n       id=\"floorp__linearGradient41007\"><stop\n         style=\"stop-color:#2d0793;stop-opacity:1\"\n         offset=\"0\"\n         id=\"floorp__stop41003\" /><stop\n         style=\"stop-color:#1c056c;stop-opacity:1\"\n         offset=\"1\"\n         id=\"floorp__stop41005\" /></linearGradient><filter\n       style=\"color-interpolation-filters:sRGB\"\n       id=\"floorp__filter56934\"\n       x=\"-0.072575207\"\n       y=\"-0.05439755\"\n       width=\"1.1451504\"\n       height=\"1.1087951\"><feGaussianBlur\n         stdDeviation=\"0.94930096\"\n         id=\"floorp__feGaussianBlur56936\" /></filter><filter\n       style=\"color-interpolation-filters:sRGB\"\n       id=\"floorp__filter17243\"\n       x=\"-0.12431146\"\n       y=\"-0.087629295\"\n       width=\"1.2486229\"\n       height=\"1.1752586\"><feGaussianBlur\n         stdDeviation=\"5.5255376\"\n         id=\"floorp__feGaussianBlur17245\" /></filter><filter\n       style=\"color-interpolation-filters:sRGB\"\n       id=\"floorp__filter59166\"\n       x=\"-0.22283328\"\n       y=\"-0.088717683\"\n       width=\"1.4456666\"\n       height=\"1.1774354\"><feGaussianBlur\n         stdDeviation=\"0.72999998\"\n         id=\"floorp__feGaussianBlur59168\" /></filter><linearGradient\n       xlink:href=\"#floorp__linearGradient33056\"\n       id=\"floorp__linearGradient34608\"\n       gradientUnits=\"userSpaceOnUse\"\n       x1=\"91.133186\"\n       y1=\"33.858837\"\n       x2=\"12.926805\"\n       y2=\"151.69347\" /><linearGradient\n       id=\"floorp__linearGradient33056\"><stop\n         style=\"stop-color:#f8f2ff;stop-opacity:1\"\n         offset=\"0\"\n         id=\"floorp__stop33058\" /><stop\n         style=\"stop-color:#c1c3e5;stop-opacity:1\"\n         offset=\"1\"\n         id=\"floorp__stop35124\" /></linearGradient><filter\n       style=\"color-interpolation-filters:sRGB\"\n       id=\"floorp__filter84277\"\n       x=\"-0.0781947\"\n       y=\"-0.1319032\"\n       width=\"1.1563894\"\n       height=\"1.2638064\"><feGaussianBlur\n         stdDeviation=\"7.9744242\"\n         id=\"floorp__feGaussianBlur84279\" /></filter><linearGradient\n       xlink:href=\"#floorp__linearGradient33056\"\n       id=\"floorp__linearGradient86330\"\n       gradientUnits=\"userSpaceOnUse\"\n       x1=\"91.133186\"\n       y1=\"33.858837\"\n       x2=\"44.77869\"\n       y2=\"163.04298\" /></defs><g\n     id=\"floorp__layer1-3\"\n     transform=\"scale(0.98271698)\"><g\n       id=\"floorp__g86421\"><path\n         id=\"floorp__path1-8\"\n         style=\"fill:url(#floorp__linearGradient16);stroke:none;stroke-width:0.183612\"\n         d=\"M 41.409707,0 C 31.899786,0 27.488584,1.6208775 22.362291,10.499872 L 3.5596734,43.191255 C 3.5596734,43.191255 0,47.78478 0,53.833837 0,59.882895 3.5596734,64.53297 3.5596734,64.53297 L 22.416564,97.194742 c 5.126297,8.879008 9.537868,10.499878 19.047801,10.499878 h 36.133762 c 9.509933,0 13.921133,-1.62087 19.047428,-10.499878 L 115.50282,64.53297 c 0,0 3.55968,-4.650075 3.55968,-10.699133 0,-6.049057 -3.55968,-10.642582 -3.55968,-10.642582 L 96.7002,10.499872 C 91.573912,1.6208775 87.16233,0 77.652405,0 Z\" /><path\n         id=\"floorp__path16163\"\n         style=\"mix-blend-mode:normal;fill:#1f0774;fill-opacity:1;stroke:none;stroke-width:0.693967;filter:url(#floorp__filter16363)\"\n         d=\"m 63.853516,203.4668 c -1.49e-4,0.0195 -0.002,0.0391 -0.002,0.0586 0,0.0601 0.0015,0.11963 0.002,0.17969 4.53e-4,0.0653 2.5e-5,0.13015 0.002,0.19531 0.0076,0.15575 0.016,0.31227 0.02734,0.46875 0.0033,0.0492 0.0099,0.0975 0.01367,0.14648 1.14e-4,0.001 -1.13e-4,0.003 0,0.004 0.0076,0.0626 0.01197,0.12499 0.01953,0.1875 0.01512,0.15799 0.03781,0.31781 0.05859,0.47656 0.0076,0.0465 0.01588,0.0923 0.02344,0.13868 0.0076,0.0607 0.01405,0.1212 0.02539,0.18164 0.03024,0.16924 0.05986,0.33849 0.09766,0.50781 0.0189,0.0956 0.04373,0.193 0.06641,0.28711 0.04157,0.17272 0.08525,0.34605 0.134766,0.51953 0.03024,0.0994 0.06156,0.19823 0.0918,0.29687 0.05065,0.16184 0.101574,0.32263 0.160157,0.48438 0.04687,0.13122 0.09892,0.26143 0.148437,0.39258 0.05027,0.12816 0.09798,0.25701 0.154297,0.38476 0.07257,0.17443 0.15469,0.34598 0.236328,0.51758 0.0446,0.0922 0.08588,0.18594 0.13086,0.2793 0.133039,0.26766 0.274033,0.53066 0.425781,0.79297 l 54.042968,93.60351 15.16602,26.26953 0.008,-0.004 4.86914,8.43359 v 0.002 c 0.062,0.10715 0.13068,0.20762 0.19531,0.3125 0.13493,0.22103 0.27214,0.43815 0.41406,0.64649 0.0113,0.014 0.0199,0.0287 0.0312,0.043 0.10961,0.1593 0.22104,0.31846 0.33594,0.47265 0.0707,0.0942 0.14108,0.18401 0.21289,0.27539 0.0227,0.028 0.0461,0.0561 0.0684,0.084 0.0801,0.10016 0.16175,0.19936 0.24414,0.29687 0.0971,0.11407 0.1971,0.22273 0.29688,0.33204 0.0113,0.0125 0.0219,0.0269 0.0332,0.0391 0.0779,0.085 0.15847,0.16767 0.23633,0.25195 0.10658,0.1098 0.21499,0.21566 0.32422,0.32031 0.008,0.009 0.0198,0.0186 0.0273,0.0273 0.0779,0.0741 0.15463,0.14851 0.23438,0.2207 0.0151,0.0129 0.0301,0.0246 0.043,0.0371 0.10016,0.0897 0.20265,0.17607 0.30469,0.26172 0.0151,0.0117 0.0263,0.0234 0.041,0.0351 0.0858,0.0714 0.1717,0.14253 0.25976,0.21094 0.008,0.006 0.0139,0.0115 0.0215,0.0176 0.0975,0.076 0.1959,0.1502 0.29492,0.22266 0.0151,0.0113 0.0302,0.0238 0.0469,0.0351 0.0983,0.0741 0.19993,0.14486 0.30273,0.21289 0.0189,0.0125 0.0377,0.0231 0.0547,0.0352 0.076,0.0508 0.15141,0.10156 0.22851,0.15039 0.0265,0.0174 0.0544,0.0359 0.082,0.0527 0.11301,0.0711 0.2281,0.14014 0.34375,0.20704 0.0302,0.0185 0.064,0.0363 0.0957,0.0547 0.034,0.0197 0.0687,0.0395 0.10351,0.0586 0.0427,0.0242 0.0858,0.049 0.12891,0.0723 0.13871,0.0714 0.27665,0.14253 0.41797,0.21094 0.0378,0.0178 0.0731,0.0336 0.10937,0.0508 0.0227,0.0102 0.0433,0.0191 0.0645,0.0293 0.045,0.0208 0.0894,0.0422 0.13476,0.0625 0.14476,0.0654 0.29253,0.12778 0.44141,0.1875 0.0265,0.0106 0.0532,0.0207 0.0801,0.0312 0.034,0.0136 0.0703,0.0276 0.10546,0.041 0.0389,0.0151 0.0783,0.0302 0.11719,0.0449 0.16101,0.0597 0.32278,0.11814 0.48828,0.16992 0.0302,0.0102 0.0652,0.0191 0.0977,0.0293 0.008,0.002 0.0159,0.005 0.0234,0.008 0.0537,0.0166 0.10686,0.0336 0.16015,0.0488 0.17046,0.0503 0.3424,0.0987 0.51758,0.14257 0.0302,0.007 0.0584,0.0127 0.0879,0.0195 0.004,9.6e-4 0.008,0.003 0.0117,0.004 0.0677,0.0155 0.1339,0.0298 0.20117,0.0449 0.16555,0.037 0.33072,0.0752 0.5,0.10547 0.1372,0.025 0.27592,0.0437 0.41407,0.0664 0.13606,0.0204 0.27137,0.0435 0.41015,0.0586 0.0265,0.003 0.0512,0.005 0.0762,0.008 0.0151,0.002 0.0263,0.002 0.041,0.004 0.14929,0.0166 0.29894,0.031 0.44922,0.043 0.10242,0.008 0.20308,0.0198 0.30664,0.0273 0.2982,0.0189 0.59727,0.0254 0.90039,0.0254 h 108.08594 30.33203 v -0.002 h 9.74023 c 0.15799,0 0.3137,-0.0103 0.47071,-0.0156 0.14437,-0.005 0.28989,-0.005 0.43359,-0.0137 0.0949,-0.006 0.18985,-0.0155 0.2832,-0.0234 h 0.002 c 0.008,-5.8e-4 0.0159,-10e-4 0.0234,-0.002 0.18482,-0.0147 0.37003,-0.031 0.55274,-0.0527 0.004,-5.5e-4 0.008,-10e-4 0.0156,-0.002 0.13871,-0.0166 0.27364,-0.038 0.41016,-0.0586 0.0113,-0.001 0.018,-0.003 0.0293,-0.004 0.12661,-0.0193 0.25323,-0.0398 0.3789,-0.0625 0.002,-3.5e-4 0.004,3.4e-4 0.008,0 0.0661,-0.0121 0.12993,-0.0272 0.19532,-0.041 0.0952,-0.0189 0.19066,-0.0363 0.28515,-0.0586 0.008,-10e-4 0.012,-0.005 0.0195,-0.006 0.10092,-0.0227 0.20258,-0.0433 0.30274,-0.0684 0.16554,-0.0414 0.32843,-0.0871 0.49023,-0.13477 0.008,-0.003 0.0178,-0.005 0.0254,-0.008 0.0941,-0.028 0.1879,-0.0559 0.28125,-0.0859 0.16517,-0.0532 0.32731,-0.11036 0.48828,-0.16992 0.1013,-0.0374 0.20258,-0.077 0.30274,-0.11719 0.002,-7.6e-4 0.004,-0.001 0.004,-0.002 0.14212,-0.0571 0.28306,-0.11579 0.42188,-0.17774 0.004,-0.002 0.008,-0.006 0.0156,-0.008 0.082,-0.0367 0.16289,-0.075 0.24415,-0.11328 0.0227,-0.0102 0.0433,-0.0191 0.0645,-0.0293 0.003,-0.002 0.008,-0.004 0.0117,-0.006 0.13115,-0.0639 0.26081,-0.1308 0.38867,-0.19921 0.008,-0.003 0.01,-0.005 0.0176,-0.008 0.11036,-0.059 0.21927,-0.12093 0.32812,-0.18359 0.002,-10e-4 0.004,-0.003 0.008,-0.004 0.10886,-0.0627 0.21607,-0.12526 0.32227,-0.1914 0.004,-0.003 0.0118,-0.008 0.0156,-0.0117 0.10885,-0.0678 0.21688,-0.13755 0.32421,-0.20899 0.0151,-0.009 0.0301,-0.0179 0.043,-0.0273 0.004,-0.003 0.008,-0.005 0.0117,-0.008 0.0189,-0.0121 0.0342,-0.025 0.0527,-0.0371 0.0801,-0.0552 0.15929,-0.11094 0.23828,-0.16797 0.12321,-0.0891 0.24466,-0.1809 0.36523,-0.27539 10e-4,-10e-4 0.003,-0.003 0.004,-0.004 0.0567,-0.0447 0.11361,-0.0911 0.16992,-0.13672 0.0265,-0.023 0.0564,-0.0453 0.084,-0.0684 l 0.002,-0.002 c 0.13077,-0.10862 0.26119,-0.21871 0.38867,-0.33398 0.0726,-0.0657 0.14417,-0.13337 0.21484,-0.20118 0.008,-0.006 0.01,-0.0131 0.0176,-0.0195 0.11868,-0.11319 0.23591,-0.22837 0.35156,-0.34765 0.004,-0.004 0.008,-0.006 0.0117,-0.01 0.0718,-0.0745 0.14064,-0.15217 0.21094,-0.22851 0.004,-0.005 0.008,-0.009 0.0156,-0.0137 0.11036,-0.12007 0.21921,-0.24136 0.32617,-0.36718 0.001,-10e-4 0.003,-0.003 0.004,-0.004 0.0828,-0.0973 0.16402,-0.19683 0.24414,-0.29687 0.0949,-0.11853 0.19099,-0.23598 0.28321,-0.35938 0.11036,-0.14729 0.21524,-0.30021 0.32031,-0.45312 0.004,-0.006 0.008,-0.0127 0.0156,-0.0195 0.0522,-0.0761 0.10681,-0.14866 0.15821,-0.22656 l 0.002,-0.002 c 7.9e-4,-0.001 0.001,-0.003 0.002,-0.004 0.16555,-0.24873 0.32317,-0.50528 0.47461,-0.76758 l 0.002,-0.002 25.45507,-44.08789 40.90235,-70.8418 h -0.004 l 2.85352,-4.9414 0.002,-0.002 4.86719,-8.43359 0.002,-0.002 c 0.004,-0.009 0.006,-0.0186 0.0137,-0.0273 0.26608,-0.46306 0.49595,-0.92557 0.70118,-1.38867 0.0189,-0.0444 0.0416,-0.0883 0.0605,-0.13281 0.20032,-0.46461 0.36661,-0.92934 0.50781,-1.39258 0.0189,-0.0632 0.0405,-0.12603 0.0586,-0.18945 0.13682,-0.47498 0.24163,-0.94797 0.31836,-1.41992 0.008,-0.0553 0.0198,-0.11061 0.0273,-0.16602 0.0722,-0.4862 0.11366,-0.96985 0.125,-1.45117 0.001,-0.0599 0.003,-0.11971 0.004,-0.17969 3.8e-4,-0.0491 -0.008,-0.0974 -0.008,-0.14648 z\"\n         transform=\"scale(0.26458334)\" /><path\n         id=\"floorp__path16367\"\n         style=\"fill:url(#floorp__linearGradient41009);fill-opacity:1;stroke:none;stroke-width:0.183612\"\n         d=\"m 42.508908,16.487618 v 0.0016 h -2.57762 c -1.36099,0 -2.35088,0.660103 -2.95434,1.705324 l -1.28881,2.231388 -5.44618,9.433015 -10.82207,18.74356 h 0.001 l -2.04329,3.539318 -5.2e-4,5.19e-4 c -0.01,0.01687 -0.018,0.03418 -0.0274,0.05116 -0.0425,0.07603 -0.0816,0.151852 -0.11782,0.227891 -0.006,0.0117 -0.0106,0.02344 -0.016,0.03514 -0.0164,0.03453 -0.033,0.06888 -0.0481,0.103871 -7.4e-4,0.0017 -10e-4,0.0034 -0.002,0.0052 -0.0108,0.02531 -0.0204,0.05066 -0.0305,0.07596 -0.004,0.01046 -0.008,0.02108 -0.0124,0.03152 -0.0124,0.0316 -0.0243,0.06328 -0.0357,0.09508 -6e-5,1.56e-4 5e-5,3.63e-4 0,5.16e-4 -0.0129,0.03622 -0.0246,0.07234 -0.0362,0.108522 -0.002,0.0052 -0.004,0.0103 -0.005,0.0155 -0.009,0.0291 -0.0179,0.05865 -0.0269,0.08785 -5e-4,0.0017 -0.001,0.0034 -0.002,0.0052 -0.01,0.03465 -0.0183,0.06927 -0.0269,0.10387 -0.001,0.0058 -0.003,0.01172 -0.005,0.01757 -0.007,0.0276 -0.0136,0.05468 -0.0196,0.08268 -0.001,0.0062 -0.002,0.01239 -0.004,0.0186 -0.007,0.03451 -0.0131,0.06891 -0.0191,0.103354 -6.8e-4,0.0038 -10e-4,0.0076 -0.002,0.01137 -0.005,0.0291 -0.01,0.05813 -0.014,0.08733 -2.7e-4,0.0019 -2.5e-4,0.0038 -5.2e-4,0.0057 -0.004,0.03125 -0.008,0.06236 -0.0119,0.09354 -7.6e-4,0.007 -0.002,0.01415 -0.003,0.02119 -0.004,0.0323 -0.007,0.06455 -0.009,0.09715 -0.001,0.01329 -0.001,0.02651 -0.002,0.03979 -5.6e-4,0.0098 -10e-4,0.01964 -0.002,0.02946 -7.1e-4,0.01534 -0.002,0.03063 -0.002,0.04599 -0.001,0.03531 -0.002,0.07105 -0.002,0.106453 0,0.01591 4.1e-4,0.03165 5.2e-4,0.04754 1.2e-4,0.01728 10e-6,0.03444 5.2e-4,0.05168 0.002,0.04121 0.004,0.08262 0.007,0.124023 8.6e-4,0.01301 0.003,0.02581 0.004,0.03876 3e-5,3.41e-4 -3e-5,6.9e-4 0,0.001 0.002,0.01657 0.003,0.03307 0.005,0.04961 0.004,0.0418 0.01,0.08409 0.0155,0.126093 0.002,0.0123 0.004,0.02443 0.006,0.03669 0.002,0.01605 0.004,0.03207 0.007,0.04806 0.008,0.04478 0.0158,0.08956 0.0258,0.134358 0.005,0.0253 0.0116,0.05107 0.0176,0.07597 0.011,0.0457 0.0226,0.09156 0.0357,0.13746 0.008,0.0263 0.0163,0.05245 0.0243,0.07855 0.0134,0.04282 0.0269,0.08536 0.0424,0.128157 0.0124,0.03472 0.0262,0.06917 0.0393,0.10387 0.0133,0.03391 0.0259,0.068 0.0408,0.101801 0.0192,0.04615 0.0409,0.09154 0.0625,0.136943 0.0118,0.0244 0.0227,0.0492 0.0346,0.0739 0.0352,0.07082 0.0725,0.140406 0.11265,0.209807 l 14.29887,24.76593 4.01268,6.95048 0.002,-0.001 1.28829,2.23139 v 5.2e-4 c 0.0164,0.0284 0.0346,0.0549 0.0517,0.0827 0.0357,0.0585 0.072,0.11592 0.10955,0.17105 0.003,0.004 0.005,0.008 0.008,0.0114 0.029,0.0422 0.0585,0.0843 0.0889,0.12506 0.0187,0.0249 0.0378,0.0487 0.0568,0.0729 0.006,0.007 0.0117,0.0149 0.0176,0.0222 0.0212,0.0265 0.0428,0.0528 0.0646,0.0786 0.0257,0.0302 0.0522,0.0589 0.0786,0.0878 0.003,0.003 0.006,0.007 0.009,0.0103 0.0206,0.0225 0.0419,0.0444 0.0625,0.0667 0.0282,0.029 0.0569,0.0571 0.0858,0.0847 0.002,0.002 0.005,0.005 0.007,0.007 0.0206,0.0196 0.0409,0.0393 0.062,0.0584 0.004,0.003 0.008,0.007 0.0114,0.01 0.0265,0.0237 0.0536,0.0466 0.0806,0.0692 0.004,0.003 0.007,0.006 0.0109,0.009 0.0227,0.0189 0.0454,0.0377 0.0687,0.0558 0.002,0.002 0.004,0.003 0.006,0.005 0.0258,0.0201 0.0518,0.0397 0.078,0.0589 0.004,0.003 0.008,0.006 0.0124,0.009 0.026,0.0196 0.0529,0.0383 0.0801,0.0563 0.005,0.003 0.01,0.006 0.0145,0.009 0.0201,0.0134 0.0401,0.0269 0.0605,0.0398 0.007,0.005 0.0144,0.009 0.0217,0.0139 0.0299,0.0188 0.0603,0.0371 0.0909,0.0548 0.008,0.005 0.0169,0.01 0.0253,0.0145 0.009,0.005 0.0182,0.0105 0.0274,0.0155 0.0113,0.006 0.0227,0.013 0.0341,0.0191 0.0367,0.0189 0.0732,0.0377 0.11059,0.0558 0.01,0.005 0.0193,0.009 0.0289,0.0134 0.006,0.003 0.0114,0.005 0.017,0.008 0.0119,0.005 0.0237,0.0112 0.0357,0.0165 0.0383,0.0173 0.0774,0.0338 0.11679,0.0496 0.007,0.003 0.0141,0.005 0.0212,0.008 0.009,0.004 0.0186,0.007 0.0279,0.0109 0.0103,0.004 0.0207,0.008 0.031,0.0119 0.0426,0.0158 0.0854,0.0313 0.12919,0.045 0.008,0.003 0.0172,0.005 0.0258,0.008 0.002,6.5e-4 0.004,0.001 0.006,0.002 0.0142,0.004 0.0283,0.009 0.0424,0.0129 0.0451,0.0133 0.0906,0.0261 0.13695,0.0377 0.008,0.002 0.0155,0.003 0.0233,0.005 10e-4,2.6e-4 0.002,7.8e-4 0.003,10e-4 0.0179,0.004 0.0359,0.008 0.0537,0.0119 0.0438,0.01 0.0875,0.0199 0.13229,0.0279 0.0363,0.007 0.073,0.0116 0.10955,0.0176 0.036,0.005 0.0718,0.0115 0.10852,0.0155 0.007,8.8e-4 0.0135,0.001 0.0201,0.002 0.004,4.2e-4 0.007,6.3e-4 0.0109,0.001 0.0395,0.004 0.0791,0.008 0.11886,0.0114 0.0271,0.002 0.0537,0.005 0.0811,0.007 0.0789,0.005 0.15803,0.007 0.23823,0.007 h 28.59774 8.02535 v -5.1e-4 h 2.5771 c 0.0418,0 0.083,-0.003 0.12454,-0.004 0.0382,-10e-4 0.0767,-10e-4 0.11472,-0.004 0.0251,-0.001 0.0502,-0.004 0.0749,-0.006 0,0 5.2e-4,0 5.2e-4,0 0.002,-1.6e-4 0.004,-3.7e-4 0.006,-5.2e-4 0.0489,-0.004 0.0979,-0.008 0.14624,-0.0139 0.001,-1.5e-4 0.002,-3.7e-4 0.004,-5.2e-4 0.0367,-0.004 0.0724,-0.0101 0.10852,-0.0155 0.003,-3.9e-4 0.005,-6.4e-4 0.008,-0.001 0.0335,-0.005 0.067,-0.0105 0.10025,-0.0165 5.1e-4,-9e-5 0.001,9e-5 0.002,0 0.0175,-0.003 0.0344,-0.007 0.0517,-0.0109 0.0252,-0.005 0.0505,-0.01 0.0755,-0.0155 0.002,-3.9e-4 0.003,-10e-4 0.005,-10e-4 0.0267,-0.006 0.0536,-0.0115 0.0801,-0.0181 0.0438,-0.011 0.0869,-0.0231 0.12971,-0.0357 0.002,-7e-4 0.005,-10e-4 0.007,-0.002 0.0249,-0.007 0.0497,-0.0148 0.0744,-0.0227 0.0437,-0.0141 0.0866,-0.0292 0.12919,-0.045 0.0268,-0.01 0.0536,-0.0204 0.0801,-0.031 5.1e-4,-2e-4 10e-4,-3.1e-4 10e-4,-5.1e-4 0.0376,-0.0151 0.0749,-0.0306 0.11163,-0.047 0.001,-5.7e-4 0.002,-0.002 0.004,-0.002 0.0217,-0.01 0.0431,-0.0198 0.0646,-0.03 0.006,-0.003 0.0114,-0.005 0.017,-0.008 8.3e-4,-4.1e-4 0.002,-0.001 0.003,-0.002 0.0347,-0.0169 0.069,-0.0346 0.10283,-0.0527 0.002,-8e-4 0.003,-0.001 0.005,-0.002 0.0292,-0.0156 0.058,-0.032 0.0868,-0.0486 5.4e-4,-3.1e-4 10e-4,-7.3e-4 0.002,-0.001 0.0288,-0.0166 0.0572,-0.0331 0.0853,-0.0506 10e-4,-9.1e-4 0.003,-0.002 0.004,-0.003 0.0288,-0.0179 0.0574,-0.0364 0.0858,-0.0553 0.004,-0.002 0.008,-0.005 0.0114,-0.007 0.001,-7e-4 0.002,-0.001 0.003,-0.002 0.005,-0.003 0.009,-0.007 0.0139,-0.01 0.0212,-0.0146 0.0422,-0.0293 0.0631,-0.0444 0.0326,-0.0236 0.0647,-0.0479 0.0966,-0.0729 3.8e-4,-3e-4 6.5e-4,-7.4e-4 0.001,-0.001 0.015,-0.0118 0.0301,-0.0241 0.045,-0.0362 0.007,-0.006 0.0149,-0.012 0.0222,-0.0181 0,0 5.2e-4,-5.2e-4 5.2e-4,-5.2e-4 0.0346,-0.0287 0.0691,-0.0579 0.10283,-0.0884 0.0192,-0.0174 0.0381,-0.0353 0.0568,-0.0532 0.002,-0.002 0.003,-0.003 0.005,-0.005 0.0314,-0.0299 0.0624,-0.0604 0.093,-0.092 9.4e-4,-9.7e-4 0.002,-0.002 0.003,-0.003 0.019,-0.0197 0.0372,-0.0403 0.0558,-0.0605 0.001,-0.001 0.002,-0.002 0.004,-0.004 0.0292,-0.0318 0.058,-0.0639 0.0863,-0.0971 3.2e-4,-3.7e-4 7.3e-4,-6.7e-4 0.001,-0.001 0.0219,-0.0257 0.0434,-0.0521 0.0646,-0.0785 0.0251,-0.0314 0.0505,-0.0624 0.0749,-0.0951 0.0292,-0.039 0.0569,-0.0794 0.0847,-0.11989 0.001,-0.002 0.002,-0.003 0.004,-0.005 0.0138,-0.0202 0.0283,-0.0393 0.0419,-0.06 0,0 5.2e-4,-5.2e-4 5.2e-4,-5.2e-4 2.1e-4,-3.2e-4 3.1e-4,-7.1e-4 5.2e-4,-0.001 0.0438,-0.0658 0.0855,-0.13368 0.12557,-0.20308 l 5.2e-4,-5.2e-4 6.73499,-11.66492 10.82208,-18.743561 h -0.001 l 0.755002,-1.307415 5.1e-4,-5.16e-4 1.28778,-2.23139 c 0,0 5.2e-4,-5.16e-4 5.2e-4,-5.16e-4 10e-4,-0.0024 0.002,-0.0049 0.004,-0.0072 0.0704,-0.122518 0.13122,-0.244893 0.18552,-0.367421 0.005,-0.01174 0.011,-0.02336 0.016,-0.03514 0.053,-0.122928 0.097,-0.245887 0.13436,-0.368453 0.005,-0.01673 0.0107,-0.03334 0.0155,-0.05012 0.0362,-0.125672 0.0639,-0.250815 0.0842,-0.375687 0.002,-0.01463 0.005,-0.02927 0.007,-0.04393 0.0191,-0.12864 0.0301,-0.256606 0.0331,-0.383955 3.8e-4,-0.01585 8.9e-4,-0.03167 10e-4,-0.04754 0.001,-0.127024 -0.006,-0.253505 -0.0207,-0.378788 -0.002,-0.01965 -0.005,-0.03923 -0.007,-0.05891 -0.0172,-0.128317 -0.0422,-0.255391 -0.0749,-0.381373 -0.004,-0.01708 -0.009,-0.03406 -0.0134,-0.05116 -0.0369,-0.1332 -0.0825,-0.264806 -0.13591,-0.394809 -0.005,-0.01244 -0.01,-0.02476 -0.015,-0.03721 -0.0615,-0.145169 -0.13184,-0.288507 -0.2129,-0.428916 l -5.2e-4,-5.16e-4 -1.28778,-2.231387 -0.754992,-1.307931 h 5.2e-4 L 88.823098,29.858379 82.088108,18.193458 c -0.0405,-0.07015 -0.0835,-0.138139 -0.12765,-0.20464 -0.0132,-0.0209 -0.0274,-0.04026 -0.0413,-0.06046 -0.029,-0.04218 -0.0579,-0.08436 -0.0884,-0.125058 -0.0244,-0.0327 -0.0499,-0.06369 -0.0749,-0.09508 -0.0212,-0.0265 -0.0428,-0.05275 -0.0646,-0.07855 -0.0286,-0.0337 -0.0574,-0.06638 -0.0873,-0.09818 -0.0206,-0.0225 -0.0418,-0.04466 -0.0625,-0.06666 -0.0306,-0.0316 -0.0617,-0.06208 -0.093,-0.09198 -0.0205,-0.0196 -0.0408,-0.03959 -0.062,-0.0584 -0.0338,-0.0305 -0.0683,-0.05967 -0.10283,-0.08837 -0.0227,-0.0189 -0.0455,-0.03761 -0.0687,-0.05581 -0.0319,-0.025 -0.0641,-0.04926 -0.0966,-0.07286 -0.0264,-0.0191 -0.053,-0.03803 -0.0801,-0.05633 -0.032,-0.0216 -0.0645,-0.04223 -0.0971,-0.06253 -0.03,-0.0188 -0.0603,-0.03708 -0.091,-0.05478 -0.0288,-0.0166 -0.0576,-0.03298 -0.0868,-0.04857 -0.0364,-0.0194 -0.0732,-0.03823 -0.11059,-0.05633 -0.0271,-0.013 -0.0543,-0.02542 -0.0816,-0.03772 -0.0384,-0.0173 -0.0774,-0.03381 -0.11679,-0.04961 -0.0266,-0.0106 -0.0533,-0.021 -0.0801,-0.03101 -0.0426,-0.0158 -0.0855,-0.03086 -0.12919,-0.04496 -0.0247,-0.0079 -0.0495,-0.01574 -0.0744,-0.02274 -0.0451,-0.0133 -0.0906,-0.02612 -0.13694,-0.03772 -0.0266,-0.0066 -0.0533,-0.01209 -0.0801,-0.01809 -0.0438,-0.0098 -0.0875,-0.01991 -0.13229,-0.02791 -0.0363,-0.0067 -0.0729,-0.01157 -0.10956,-0.01757 -0.036,-0.0054 -0.0718,-0.0115 -0.10852,-0.0155 -0.0495,-0.0065 -0.0998,-0.01047 -0.14986,-0.01447 -0.0272,-0.002 -0.0538,-0.0047 -0.0811,-0.0067 -0.0789,-0.005 -0.1581,-0.0072 -0.23823,-0.0072 h -28.59774 z\" /><path\n         id=\"floorp__path6\"\n         style=\"mix-blend-mode:normal;fill:#1f0774;fill-opacity:1;stroke:none;stroke-width:0.693967;filter:url(#floorp__filter56934)\"\n         d=\"m 376.125,202.80078 -11.83984,41.88281 h 4.35351 c 6.07646,0 8.58166,-3.06959 11.29883,-7.21875 l 11.89453,-20.60546 c 2.83476,-4.90993 3.83459,-7.90022 3.8457,-14.0586 z\"\n         transform=\"scale(0.26458334)\" /><path\n         id=\"floorp__path16393\"\n         style=\"mix-blend-mode:normal;fill:#1f0774;fill-opacity:1;stroke:none;stroke-width:0.693967;filter:url(#floorp__filter17243)\"\n         d=\"m 53.986328,203.4668 c -0.1321,5.81462 2.92644,11.53577 9.207031,22.41406 l 12.398438,21.47266 54.519533,94.43359 c 0.70322,1.21805 7.60223,13.01367 21.86133,13.01367 6.40221,0 8.6875,-3.708 8.6875,-7.40234 v -88.0625 -8.25 -47.61914 z\"\n         transform=\"scale(0.26458334)\" /><path\n         id=\"floorp__path55280\"\n         style=\"fill:#1f0774;fill-opacity:1;stroke:none;stroke-width:0.693967;filter:url(#floorp__filter59166)\"\n         d=\"m 335.70898,93.171875 v 19.677735 0.0703 h 3.23243 c 3.33915,0 6.91873,-2.16554 2.73828,-9.40625 z\"\n         transform=\"scale(0.26458334)\" /><path\n         id=\"floorp__path16391\"\n         style=\"fill:url(#floorp__linearGradient34608);fill-opacity:1;stroke:none;stroke-width:0.183612\"\n         d=\"m 41.506867,13.84587 c -3.272904,-0.0336 -5.288951,0.484657 -7.296585,3.96198 l -5.530986,9.58026 -11.959195,20.713582 c -3.246583,5.623253 -3.257596,6.020078 0,11.662403 l 3.279955,5.681662 14.425422,24.985268 c 0.186065,0.322275 2.011411,3.443152 5.784134,3.443152 1.693916,0 2.298477,-0.980947 2.298477,-1.958407 V 68.616022 66.433305 c 0,-1.285178 0.586809,-1.680203 1.983457,-1.680203 v -0.01402 l 53.044019,3.74e-4 c 1.60773,0 2.270302,-0.812032 2.989225,-1.90983 l 3.1475,-5.452042 c 0.75003,-1.299083 1.0146,-2.09043 1.01754,-3.719835 0.009,-4.319685 -2.87374,-5.037592 -3.74906,-5.037592 H 44.491546 c -1.396648,0 -1.983457,-0.395026 -1.983457,-1.680203 V 44.757225 33.739657 31.55694 c 0,-1.285185 0.586809,-1.68021 1.983457,-1.68021 H 89.6784 c 0.883485,0 1.830615,-0.572843 0.724537,-2.48862 L 84.87195,17.80785 C 82.730482,14.098703 80.578927,13.756162 76.9032,13.859152 H 42.178652 c -0.229735,-0.0068 -0.453588,-0.01103 -0.671785,-0.01328 z\" /><path\n         id=\"floorp__path15001\"\n         style=\"fill:#1f0774;fill-opacity:1;stroke:none;stroke-width:0.693967;filter:url(#floorp__filter84277)\"\n         d=\"m 190.99805,62.3125 -30.33203,0.002 v 0.0059 h -9.74219 c -5.14393,0 -8.88524,2.494873 -11.16602,6.445313 l -4.87109,8.433594 -20.58399,35.652343 -40.902339,70.8418 h 0.0039 l -7.722656,13.37695 -0.002,0.002 c -0.0368,0.0638 -0.06791,0.12916 -0.103516,0.19335 -0.16048,0.28735 -0.308293,0.57394 -0.445313,0.86133 -0.0211,0.0442 -0.04005,0.0886 -0.06055,0.13282 -0.0618,0.13049 -0.12484,0.26031 -0.18164,0.39257 -0.003,0.007 -0.0048,0.013 -0.0078,0.0195 -0.0408,0.0957 -0.077,0.19145 -0.115234,0.2871 -0.0154,0.0395 -0.03137,0.0797 -0.04687,0.11914 -0.0469,0.11944 -0.0917,0.23919 -0.134766,0.35938 0,0 0,0.002 0,0.002 -0.0488,0.13691 -0.093,0.2734 -0.136718,0.41016 -0.006,0.0196 -0.01363,0.0389 -0.01953,0.0586 -0.0348,0.10998 -0.0676,0.22166 -0.101562,0.33203 -0.002,0.007 -0.0039,0.0129 -0.0059,0.0195 -0.037,0.13097 -0.0691,0.26178 -0.101562,0.39257 -0.005,0.0221 -0.01218,0.0443 -0.01758,0.0664 -0.0253,0.10432 -0.05152,0.20668 -0.07422,0.3125 -0.005,0.0235 -0.009,0.0468 -0.01367,0.0703 -0.0272,0.13044 -0.04957,0.26045 -0.07227,0.39063 -0.003,0.0143 -0.0048,0.0287 -0.0078,0.043 -0.0189,0.10998 -0.03763,0.2197 -0.05273,0.33007 -10e-4,0.007 -8.83e-4,0.0144 -0.002,0.0215 -0.0165,0.1181 -0.03202,0.23567 -0.04492,0.35351 -0.003,0.0266 -0.0068,0.0535 -0.0098,0.0801 -0.0151,0.12208 -0.02766,0.24398 -0.03516,0.36719 -0.004,0.0502 -0.0048,0.10021 -0.0078,0.15039 -0.002,0.0371 -0.0058,0.0742 -0.0078,0.11133 -0.003,0.058 -0.0058,0.11577 -0.0078,0.17383 -0.005,0.13345 -0.0078,0.26855 -0.0078,0.40234 0,0.0601 0.002,0.11961 0.002,0.17969 4.5e-4,0.0653 3e-6,0.13016 0.002,0.19531 0.008,0.15576 0.01399,0.31228 0.02539,0.46875 0.003,0.0492 0.009,0.0976 0.01367,0.14648 1.1e-4,0.001 -1.1e-4,0.003 0,0.004 0.006,0.0626 0.01128,0.125 0.01758,0.1875 0.0155,0.15799 0.03589,0.31782 0.05859,0.47656 0.007,0.0465 0.01449,0.0923 0.02148,0.13868 0.009,0.0607 0.01664,0.12122 0.02734,0.18164 0.0287,0.16925 0.05986,0.33849 0.09766,0.50781 0.0208,0.0956 0.04371,0.193 0.06641,0.28711 0.0416,0.17272 0.0853,0.34605 0.134766,0.51953 0.0287,0.0994 0.0616,0.19822 0.0918,0.29687 0.03063,0.098 0.06515,0.19533 0.09766,0.29297 L 308.61328,66.476562 c -0.0643,-0.07306 -0.12695,-0.148096 -0.19336,-0.21875 -0.0779,-0.085 -0.15786,-0.168803 -0.23633,-0.251953 -0.11573,-0.11943 -0.23307,-0.234646 -0.35156,-0.347656 -0.0777,-0.0741 -0.15413,-0.149643 -0.23437,-0.220703 -0.12762,-0.11527 -0.25802,-0.225514 -0.38868,-0.333984 -0.0857,-0.0714 -0.17211,-0.142148 -0.25976,-0.210938 -0.12042,-0.0945 -0.24225,-0.18619 -0.36524,-0.27539 -0.0998,-0.0722 -0.20038,-0.143721 -0.30273,-0.212891 -0.12091,-0.0816 -0.24394,-0.159598 -0.36719,-0.236328 -0.11331,-0.0711 -0.2279,-0.140131 -0.34375,-0.207031 -0.10866,-0.0627 -0.21772,-0.124634 -0.32812,-0.183594 -0.13754,-0.0733 -0.27681,-0.144481 -0.41797,-0.212891 -0.10258,-0.0491 -0.20538,-0.0961 -0.3086,-0.142578 -0.14513,-0.0654 -0.2926,-0.12778 -0.4414,-0.1875 -0.10042,-0.0401 -0.20156,-0.0794 -0.30274,-0.117187 -0.16102,-0.0597 -0.32319,-0.116632 -0.48828,-0.169922 -0.0932,-0.0299 -0.18698,-0.05954 -0.28125,-0.08594 -0.17052,-0.0503 -0.34258,-0.09871 -0.51757,-0.142578 -0.10043,-0.0249 -0.20149,-0.04566 -0.30274,-0.06836 -0.16551,-0.037 -0.33064,-0.0752 -0.5,-0.105469 -0.13727,-0.0253 -0.27569,-0.04371 -0.41406,-0.06641 -0.13617,-0.0204 -0.27137,-0.04349 -0.41016,-0.05859 -0.18717,-0.0246 -0.37701,-0.03959 -0.5664,-0.05469 -0.10262,-0.008 -0.20324,-0.01779 -0.30664,-0.02539 -0.29813,-0.0189 -0.59754,-0.02734 -0.9004,-0.02734 z\"\n         transform=\"scale(0.26458334)\" /><path\n         id=\"floorp__path78321\"\n         style=\"fill:url(#floorp__linearGradient86330);fill-opacity:1;stroke:none;stroke-width:0.183612\"\n         d=\"m 41.506867,13.84587 c -3.272904,-0.0336 -5.288951,0.484657 -7.296585,3.96198 l -5.530986,9.58026 -11.959195,20.713582 c -3.246583,5.623253 -3.257596,6.020078 0,11.662403 l 3.279955,5.681662 14.425422,24.985268 c 0.186065,0.322275 2.011411,3.443152 5.784134,3.443152 1.693916,0 2.298477,-0.980947 2.298477,-1.958407 V 68.616022 66.433305 c 0,-1.285178 0.586809,-1.680203 1.983457,-1.680203 v -0.01402 l 53.044019,3.74e-4 c 1.60773,0 2.270302,-0.812032 2.989225,-1.90983 l 3.1475,-5.452042 c 0.75003,-1.299083 1.0146,-2.09043 1.01754,-3.719835 0.009,-4.319685 -2.87374,-5.037592 -3.74906,-5.037592 H 44.491546 c -1.396648,0 -1.983457,-0.395026 -1.983457,-1.680203 V 44.757225 33.739657 31.55694 c 0,-1.285185 0.586809,-1.68021 1.983457,-1.68021 H 89.6784 c 0.883485,0 1.830615,-0.572843 0.724537,-2.48862 L 84.87195,17.80785 C 82.730482,14.098703 80.578927,13.756162 76.9032,13.859152 H 42.178652 c -0.229735,-0.0068 -0.453588,-0.01103 -0.671785,-0.01328 z\" /></g></g></svg>",
  "html": "<svg role=\"img\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><title>HTML5</title><path fill=\"#E34F26\" d=\"M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z\"/></svg>"
};

function tarayiciSimgesiAl(id) {
  const norm = String(id || '').toLowerCase();
  let anahtar = 'chrome';
  if (norm.includes('proton')) anahtar = 'protonpass';
  else if (norm.includes('brave')) anahtar = 'brave';
  else if (norm.includes('edge')) anahtar = 'edge';
  else if (norm.includes('supermium')) anahtar = 'supermium';
  else if (norm.includes('firefox')) anahtar = 'firefox';
  else if (norm.includes('floorp')) anahtar = 'floorp';
  else if (norm.includes('opera-gx') || norm.includes('opera_gx') || norm.includes('operagx')) anahtar = 'opera-gx';
  else if (norm.includes('opera')) anahtar = 'opera';
  else if (norm.includes('vivaldi')) anahtar = 'vivaldi';
  else if (norm.includes('html')) anahtar = 'html';
  else if (norm.includes('chrome')) anahtar = 'chrome';

  return TARAYICI_SIMGELERI[anahtar] || TARAYICI_SIMGELERI.chrome;
}

async function aktarmaPaneli() {
  el.panelAd.textContent = cev('aktarma.baslik');

  const kap = kartYap();
  kap.className = 'liste-kart aktarma-kart';

  const aciklama = document.createElement('div');
  aciklama.className = 'aktarma-aciklama';
  aciklama.textContent = cev('aktarma.aciklama');
  kap.appendChild(aciklama);

  const yukleniyor = document.createElement('div');
  yukleniyor.className = 'a-aciklama';
  yukleniyor.textContent = cev('aktarma.aktariliyor');
  kap.appendChild(yukleniyor);

  let tarayicilar = [];
  try {
    tarayicilar = await window.pusula.tarayiciListele();
  } catch (_) {
    tarayicilar = [];
  }
  yukleniyor.remove();

  if (!tarayicilar.length) {
    const bos = document.createElement('div');
    bos.className = 'a-aciklama';
    bos.style.padding = '12px 0';
    bos.textContent = cev('aktarma.bulunamadi');
    kap.appendChild(bos);
  } else {
    let seciliId = tarayicilar[0].id;

    const secimGrup = document.createElement('div');
    secimGrup.className = 'aktarma-secim-grup';

    const secimEtiket = document.createElement('label');
    secimEtiket.className = 'aktarma-etiket';
    secimEtiket.textContent = cev('aktarma.tarayiciSecin');

    const secimKutu = document.createElement('div');
    secimKutu.className = 'ozel-secim-kutu';

    const tetik = document.createElement('button');
    tetik.type = 'button';
    tetik.className = 'ozel-secim-tetik';

    const degerKutu = document.createElement('div');
    degerKutu.className = 'ozel-secim-deger';

    function degerGuncelle(t) {
      degerKutu.innerHTML = '<span class="ozel-secim-simge">' + tarayiciSimgesiAl(t.id) + '</span><span class="ozel-secim-baslik">' + temizMetin(t.ad) + '</span>';
    }
    degerGuncelle(tarayicilar[0]);

    const ok = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ok.setAttribute('viewBox', '0 0 16 16');
    ok.classList.add('ozel-secim-ok');
    ok.innerHTML = '<path d="M4 6l4 4 4-4"/>';
    tetik.append(degerKutu, ok);

    const menu = document.createElement('div');
    menu.className = 'ozel-secim-menu';
    menu.hidden = true;

    const ogeDizisi = [];
    tarayicilar.forEach((t) => {
      const oge = document.createElement('div');
      oge.className = 'ozel-secim-oge' + (t.id === seciliId ? ' secili' : '');
      oge.tabIndex = 0;

      const sol = document.createElement('div');
      sol.className = 'ozel-secim-oge-sol';
      sol.innerHTML = '<span class="ozel-secim-simge">' + tarayiciSimgesiAl(t.id) + '</span><span class="ozel-secim-baslik">' + temizMetin(t.ad) + '</span>';

      const tik = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tik.setAttribute('viewBox', '0 0 16 16');
      tik.classList.add('ozel-secim-tik');
      tik.innerHTML = '<path d="M3.5 8.5l3 3 6-6"/>';

      oge.append(sol, tik);

      function sec() {
        seciliId = t.id;
        degerGuncelle(t);
        if (typeof secenekleriGuncelle === 'function') secenekleriGuncelle();
        ogeDizisi.forEach((o) => o.classList.toggle('secili', o === oge));
        menu.hidden = true;
        tetik.classList.remove('acik');
        tetik.focus();
      }

      oge.addEventListener('click', sec);
      oge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sec(); }
      });
      ogeDizisi.push(oge);
      menu.appendChild(oge);
    });

    function menuKapat() {
      menu.hidden = true;
      tetik.classList.remove('acik');
      document.removeEventListener('click', disTikla);
    }
    function disTikla(e) {
      if (!secimKutu.contains(e.target)) menuKapat();
    }

    tetik.addEventListener('click', (e) => {
      e.stopPropagation();
      const acik = !menu.hidden;
      if (acik) {
        menuKapat();
      } else {
        menu.hidden = false;
        menu.scrollTop = 0;
        tetik.classList.add('acik');
        document.addEventListener('click', disTikla);
        const seciliOge = menu.querySelector('.ozel-secim-oge.secili');
        if (seciliOge) seciliOge.focus({ preventScroll: true });
      }
    });

    secimKutu.append(tetik, menu);
    secimGrup.append(secimEtiket, secimKutu);
    kap.appendChild(secimGrup);

    // Seçenekler (Yer imleri ve Geçmiş)
    const seceneklerGrup = document.createElement('div');
    seceneklerGrup.className = 'aktarma-secenekler-grup';

    const yerImiKutu = document.createElement('label');
    yerImiKutu.className = 'aktarma-secenek-kutu';
    const chkYerImi = document.createElement('input');
    chkYerImi.type = 'checkbox';
    chkYerImi.className = 'aktarma-secenek-onay';
    chkYerImi.checked = true;
    const yerImiEtiket = document.createElement('span');
    yerImiEtiket.className = 'aktarma-secenek-etiket';
    yerImiEtiket.textContent = cev('aktarma.yerImleri');
    yerImiKutu.append(chkYerImi, yerImiEtiket);

    const gecmisKutu = document.createElement('label');
    gecmisKutu.className = 'aktarma-secenek-kutu';
    const chkGecmis = document.createElement('input');
    chkGecmis.type = 'checkbox';
    chkGecmis.className = 'aktarma-secenek-onay';
    chkGecmis.checked = true;
    const gecmisEtiket = document.createElement('span');
    gecmisEtiket.className = 'aktarma-secenek-etiket';
    gecmisEtiket.textContent = cev('aktarma.gecmis');
    gecmisKutu.append(chkGecmis, gecmisEtiket);

    seceneklerGrup.append(yerImiKutu, gecmisKutu);

    const secenekKutusu = (anahtar, varsayilan) => {
      const kutu = document.createElement('label');
      kutu.className = 'aktarma-secenek-kutu';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'aktarma-secenek-onay';
      chk.checked = varsayilan;
      const etiket = document.createElement('span');
      etiket.className = 'aktarma-secenek-etiket';
      etiket.textContent = cev(anahtar);
      kutu.append(chk, etiket);
      seceneklerGrup.appendChild(kutu);
      return chk;
    };
    const chkIndirme = secenekKutusu('aktarma.indirilenler', true);
    const chkParola = secenekKutusu('aktarma.parolalar', false);
    kap.appendChild(seceneklerGrup);

    // Proton Pass bir dosyadır: yer imi / geçmiş / indirme yok, yalnız parolalar.
    const protonNot = document.createElement('div');
    protonNot.className = 'a-aciklama';
    protonNot.textContent = cev('aktarma.protonNot');
    protonNot.style.display = 'none';
    kap.appendChild(protonNot);
    function secenekleriGuncelle() {
      const proton = seciliId === 'protonpass';
      for (const k of [yerImiKutu, gecmisKutu, chkIndirme.parentElement]) k.style.display = proton ? 'none' : '';
      chkParola.parentElement.style.display = proton ? 'none' : '';
      protonNot.style.display = proton ? 'block' : 'none';
    }

    const durumMesaj = document.createElement('div');
    durumMesaj.className = 'aktarma-durum';
    durumMesaj.style.display = 'none';

    const btnBaslat = document.createElement('button');
    btnBaslat.className = 'dugme dugme-vurgulu';
    btnBaslat.textContent = cev('aktarma.baslat');
    btnBaslat.addEventListener('click', async () => {
      btnBaslat.disabled = true;
      durumMesaj.style.display = 'block';
      durumMesaj.style.color = 'var(--metin2)';
      durumMesaj.textContent = cev('aktarma.aktariliyor');

      const secenekler = {
        yerImleri: chkYerImi.checked, gecmis: chkGecmis.checked,
        indirmeler: chkIndirme.checked, parolalar: chkParola.checked
      };
      try {
        if (seciliId === 'protonpass') {
          const pr = await window.pusula.protonPassAktar();
          if (pr && pr.iptal) { durumMesaj.style.display = 'none'; return; }
          if (pr && pr.basarili) {
            durumMesaj.style.color = '#34d399';
            durumMesaj.textContent = cev('aktarma.protonTamam').replace('{n}', pr.parolaSayisi);
            if (pr.parolaAtlanan) durumMesaj.textContent += ' ' + cev('aktarma.parolaAtlanan').replace('{n}', pr.parolaAtlanan);
            if (pr.gecisSayisi) durumMesaj.textContent += ' ' + cev('aktarma.gecisAktarildi').replace('{n}', pr.gecisSayisi);
            if (pr.gecisAtlanan) durumMesaj.textContent += ' ' + cev('aktarma.gecisAtlandi').replace('{n}', pr.gecisAtlanan);
          } else {
            durumMesaj.style.color = '#f87171';
            durumMesaj.textContent = (pr && pr.hata) || cev('aktarma.hata');
          }
          return;
        }
        const res = await window.pusula.tarayiciAktar({ tarayiciId: seciliId, secenekler });
        if (res && res.basarili) {
          durumMesaj.style.color = '#34d399';
          durumMesaj.textContent = cev('aktarma.tamamlandi')
            .replace('{yerImi}', res.yerImiSayisi)
            .replace('{gecmis}', res.gecmisSayisi);
          if (res.indirmeSayisi || res.parolaSayisi) {
            durumMesaj.textContent += ' ' + cev('aktarma.ekSayi')
              .replace('{indirme}', res.indirmeSayisi || 0)
              .replace('{parola}', res.parolaSayisi || 0);
          }
          if (res.parolaAtlanan) {
            durumMesaj.textContent += ' ' + cev('aktarma.parolaAtlanan').replace('{n}', res.parolaAtlanan);
          }
        } else {
          durumMesaj.style.color = '#f87171';
          durumMesaj.textContent = (res && res.hata) || cev('aktarma.hata');
        }
      } catch (err) {
        durumMesaj.style.color = '#f87171';
        durumMesaj.textContent = err.message || cev('aktarma.hata');
      } finally {
        btnBaslat.disabled = false;
      }
    });

    kap.append(btnBaslat, durumMesaj);
  }

  const cizgi = document.createElement('hr');
  cizgi.className = 'aktarma-cizgi';
  kap.appendChild(cizgi);

  const htmlDurum = document.createElement('div');
  htmlDurum.className = 'aktarma-durum';
  htmlDurum.style.display = 'none';

  const btnHtml = document.createElement('button');
  btnHtml.className = 'dugme';
  btnHtml.textContent = cev('aktarma.htmlSec');
  btnHtml.addEventListener('click', async () => {
    btnHtml.disabled = true;
    try {
      const res = await window.pusula.htmlYerImiAktar();
      if (res && res.basarili) {
        htmlDurum.style.display = 'block';
        htmlDurum.style.color = '#34d399';
        htmlDurum.textContent = cev('aktarma.htmlTamam').replace('{n}', res.yerImiSayisi);
      } else if (res && res.hata) {
        htmlDurum.style.display = 'block';
        htmlDurum.style.color = '#f87171';
        htmlDurum.textContent = res.hata;
      }
    } catch (err) {
      htmlDurum.style.display = 'block';
      htmlDurum.style.color = '#f87171';
      htmlDurum.textContent = err.message || cev('aktarma.hata');
    } finally {
      btnHtml.disabled = false;
    }
  });

  const btnHtmlDisa = document.createElement('button');
  btnHtmlDisa.className = 'dugme';
  btnHtmlDisa.textContent = cev('aktarma.htmlDisa');
  btnHtmlDisa.addEventListener('click', async () => {
    btnHtmlDisa.disabled = true;
    try {
      const res = await window.pusula.htmlYerImiDisaAktar();
      if (res && res.basarili) {
        htmlDurum.style.display = 'block';
        htmlDurum.style.color = '#34d399';
        htmlDurum.textContent = cev('aktarma.htmlDisaTamam').replace('{n}', res.yerImiSayisi);
      } else if (res && res.hata) {
        htmlDurum.style.display = 'block';
        htmlDurum.style.color = '#f87171';
        htmlDurum.textContent = res.hata;
      }
    } catch (err) {
      htmlDurum.style.display = 'block';
      htmlDurum.style.color = '#f87171';
      htmlDurum.textContent = err.message || cev('aktarma.hata');
    } finally {
      btnHtmlDisa.disabled = false;
    }
  });

  kap.append(btnHtml, btnHtmlDisa, htmlDurum);
  el.panelIcerik.appendChild(kap);
}

function ayarlarPaneli() {
  const g = document.createElement('div');
  g.className = 'ayar-grup';
  const a = durum.ayarlar;
  const say = (n) => Number(n || 0).toLocaleString(ceviri.yerel);

  /* ---- istatistik ---- */
  const kuralToplam = (durum.listeler || []).reduce((t, l) => t + l.kural, 0);
  const ist = document.createElement('div');
  ist.className = 'istatistik';
  for (const [sayi, etiket] of [
    [say(durum.toplamEngellenen), cev('ayar.engellenenSayi')],
    [say(kuralToplam), cev('ayar.yukluAlan')],
    [say(durum.yerImleri.length), cev('ayar.yerImiSayi')]
  ]) {
    const kutu = document.createElement('div');
    kutu.className = 'kutu';
    const s = document.createElement('div');
    s.className = 'sayi';
    s.textContent = sayi;
    const e = document.createElement('div');
    e.className = 'etiket';
    e.textContent = etiket;
    kutu.append(s, e);
    ist.appendChild(kutu);
  }
  g.appendChild(ist);

  const baslik = (anahtarAdi) => {
    const h = document.createElement('h2');
    h.textContent = cev(anahtarAdi);
    h.dataset.anahtar = anahtarAdi;   // sekme ikonu bu anahtara göre seçilir
    g.appendChild(h);
  };

  /* ---- arama ve başlangıç ---- */
  baslik('ayar.bolumArama');

  /* ---- varsayılan tarayıcı ---- */
  const varsayilanKutu = document.createElement('div');
  const varsayilanBtn = document.createElement('button');
  varsayilanBtn.className = 'dugme';
  varsayilanBtn.textContent = cev('ayar.varsayilanYap');
  const varsayilanDurumEtiket = document.createElement('span');
  varsayilanDurumEtiket.className = 'a-aciklama';
  varsayilanKutu.append(varsayilanBtn, varsayilanDurumEtiket);

  window.pusula.varsayilanDurum().then((isDef) => {
    if (isDef) {
      varsayilanBtn.style.display = 'none';
      varsayilanDurumEtiket.textContent = cev('ayar.varsayilanEvet');
    } else {
      varsayilanBtn.style.display = '';
      varsayilanDurumEtiket.textContent = '';
    }
  }).catch(() => {});

  varsayilanBtn.addEventListener('click', async () => {
    varsayilanBtn.disabled = true;
    await window.pusula.varsayilanYap();
    const isDef = await window.pusula.varsayilanDurum().catch(() => false);
    if (isDef) {
      varsayilanBtn.style.display = 'none';
      varsayilanDurumEtiket.textContent = cev('ayar.varsayilanEvet');
      if (el.varsayilanBanner) el.varsayilanBanner.hidden = true;
    } else {
      varsayilanBtn.disabled = false;
    }
  });

  g.appendChild(ayarSatiri(cev('ayar.varsayilanTarayici'), cev('ayar.varsayilanAciklama'), varsayilanKutu));

  /* ---- veri içe aktarma ---- */
  const aktarKutu = document.createElement('div');
  const aktarBtn = document.createElement('button');
  aktarBtn.className = 'dugme';
  aktarBtn.textContent = cev('ayar.iceAktarDugme');
  aktarBtn.addEventListener('click', () => window.pusula.dahiliSayfaAc('aktarma'));
  aktarKutu.appendChild(aktarBtn);
  g.appendChild(ayarSatiri(cev('ayar.iceAktar'), cev('ayar.iceAktarAciklama'), aktarKutu));

  const dilSec = document.createElement('select');
  const sistemSecenek = document.createElement('option');
  sistemSecenek.value = 'sistem';
  sistemSecenek.textContent = cev('ayar.dilSistem');
  if ((a.dil || 'sistem') === 'sistem') sistemSecenek.selected = true;
  dilSec.appendChild(sistemSecenek);
  for (const d of (durum.diller || [])) {
    const o = document.createElement('option');
    o.value = d.kod;
    o.textContent = d.ad;
    if (a.dil === d.kod) o.selected = true;
    dilSec.appendChild(o);
  }
  dilSec.addEventListener('change', () => window.pusula.ayarDegistir('dil', dilSec.value));
  g.appendChild(ayarSatiri(cev('ayar.dil'), cev('ayar.dilAciklama'), dilSec));

  const motor = document.createElement('select');
  for (const [k, v] of Object.entries(durum.motorlar)) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = v.ad;
    if (k === a.aramaMotoru) o.selected = true;
    motor.appendChild(o);
  }
  motor.addEventListener('change', () => window.pusula.ayarDegistir('aramaMotoru', motor.value));
  g.appendChild(ayarSatiri(cev('ayar.aramaMotoru'), cev('ayar.aramaMotoruAciklama'), motor));

  const gizliMotor = document.createElement('select');
  for (const [k, v] of Object.entries(durum.motorlar)) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = v.ad;
    if (k === a.gizliAramaMotoru) o.selected = true;
    gizliMotor.appendChild(o);
  }
  gizliMotor.addEventListener('change', () => window.pusula.ayarDegistir('gizliAramaMotoru', gizliMotor.value));
  g.appendChild(ayarSatiri(cev('ayar.gizliAramaMotoru'), cev('ayar.gizliAramaMotoruAciklama'), gizliMotor));

  const ana = document.createElement('input');
  ana.type = 'text';
  ana.value = a.anasayfa || '';
  ana.placeholder = cev('ayar.anasayfaIpucu');
  ana.addEventListener('change', () => window.pusula.ayarDegistir('anasayfa', ana.value.trim()));
  g.appendChild(ayarSatiri(cev('ayar.anasayfa'), cev('ayar.anasayfaAciklama'), ana));

  /* ---- başlangıç sekmeleri ---- */
  const baslangicKutu = document.createElement('div');
  baslangicKutu.className = 'baslangic-kutu';

  const listeKutu = document.createElement('div');
  listeKutu.className = 'baslangic-liste';

  function baslangicListesiCiz() {
    listeKutu.replaceChildren();
    const list = Array.isArray(a.baslangicSekmeleri) ? a.baslangicSekmeleri : [];
    if (list.length === 0) {
      const bos = document.createElement('div');
      bos.className = 'baslangic-bos';
      bos.textContent = cev('ayar.baslangicBos');
      listeKutu.appendChild(bos);
    } else {
      list.forEach((url, index) => {
        const satir = document.createElement('div');
        satir.className = 'baslangic-satir';

        const simge = simgeYap(url, 'pusula-favicon://' + alanAdi(url));
        simge.classList.add('baslangic-simge');

        const metin = document.createElement('div');
        metin.className = 'baslangic-metin';
        const baslik = document.createElement('div');
        baslik.className = 'baslangic-baslik';
        baslik.textContent = alanAdi(url) || url;
        const adres = document.createElement('div');
        adres.className = 'baslangic-url';
        adres.textContent = url;
        metin.append(baslik, adres);

        const btnGrup = document.createElement('div');
        btnGrup.className = 'baslangic-butonlar';

        if (index > 0) {
          const btnYukari = document.createElement('button');
          btnYukari.type = 'button';
          btnYukari.className = 'baslangic-btn';
          btnYukari.title = cev('ayar.yukari');
          btnYukari.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 10l4-4 4 4"/></svg>';
          btnYukari.addEventListener('click', () => {
            const temp = list[index - 1];
            list[index - 1] = list[index];
            list[index] = temp;
            window.pusula.ayarDegistir('baslangicSekmeleri', [...list]);
            baslangicListesiCiz();
          });
          btnGrup.appendChild(btnYukari);
        }

        if (index < list.length - 1) {
          const btnAsagi = document.createElement('button');
          btnAsagi.type = 'button';
          btnAsagi.className = 'baslangic-btn';
          btnAsagi.title = cev('ayar.asagi');
          btnAsagi.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>';
          btnAsagi.addEventListener('click', () => {
            const temp = list[index + 1];
            list[index + 1] = list[index];
            list[index] = temp;
            window.pusula.ayarDegistir('baslangicSekmeleri', [...list]);
            baslangicListesiCiz();
          });
          btnGrup.appendChild(btnAsagi);
        }

        const btnSil = document.createElement('button');
        btnSil.type = 'button';
        btnSil.className = 'baslangic-btn sil';
        btnSil.title = cev('panel.kaldir');
        btnSil.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';
        btnSil.addEventListener('click', () => {
          list.splice(index, 1);
          window.pusula.ayarDegistir('baslangicSekmeleri', [...list]);
          baslangicListesiCiz();
        });
        btnGrup.appendChild(btnSil);

        satir.append(simge, metin, btnGrup);
        listeKutu.appendChild(satir);
      });
    }
  }

  baslangicListesiCiz();
  baslangicKutu.appendChild(listeKutu);

  const ekleSatir = document.createElement('div');
  ekleSatir.className = 'baslangic-ekle-satir';

  const yeniGirdi = document.createElement('input');
  yeniGirdi.type = 'text';
  yeniGirdi.placeholder = 'https://...';
  yeniGirdi.className = 'baslangic-yeni-url';

  const ekleBtn = document.createElement('button');
  ekleBtn.type = 'button';
  ekleBtn.className = 'baslangic-ekle-btn';
  ekleBtn.textContent = cev('ayar.baslangicEkle');

  function yeniEkle() {
    const val = yeniGirdi.value.trim();
    if (!val) return;
    const list = Array.isArray(a.baslangicSekmeleri) ? [...a.baslangicSekmeleri] : [];
    list.push(val);
    window.pusula.ayarDegistir('baslangicSekmeleri', list);
    a.baslangicSekmeleri = list;
    yeniGirdi.value = '';
    ekleForm.style.display = 'none';
    baslangicListesiCiz();
  }

  ekleBtn.addEventListener('click', yeniEkle);
  yeniGirdi.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      yeniEkle();
    }
  });

  const mevcutBtn = document.createElement('button');
  mevcutBtn.type = 'button';
  mevcutBtn.className = 'baslangic-ekle-btn';
  mevcutBtn.textContent = cev('ayar.baslangicMevcut');
  mevcutBtn.addEventListener('click', () => {
    const urls = durum.sekmeler
      .map(t => t.url || t.gorunenUrl)
      .filter(u => u && /^https?:\/\//i.test(u));
    if (urls.length > 0) {
      window.pusula.ayarDegistir('baslangicSekmeleri', urls);
      a.baslangicSekmeleri = urls;
      baslangicListesiCiz();
    }
  });

  ekleBtn.textContent = cev('ayar.baslangicEkle').replace(/^\+\s*/, '');
  ekleBtn.className = 'baslangic-baglanti';
  mevcutBtn.className = 'baslangic-baglanti';
  const ekleForm = document.createElement('div');
  ekleForm.className = 'baslangic-ekle-satir';
  ekleForm.style.display = 'none';
  ekleForm.appendChild(yeniGirdi);
  ekleBtn.addEventListener('click', () => {
    if (ekleForm.style.display === 'none') { ekleForm.style.display = 'flex'; yeniGirdi.focus(); }
  });
  ekleSatir.className = 'baslangic-alt';
  ekleSatir.append(ekleForm, ekleBtn, mevcutBtn);
  baslangicKutu.appendChild(ekleSatir);

  const baslangicAyarSatiri = ayarSatiri(cev('ayar.baslangic'), cev('ayar.baslangicAciklama'), baslangicKutu);
  baslangicAyarSatiri.classList.add('ayar-dikey');
  g.appendChild(baslangicAyarSatiri);

  /* ---- indirme klasörü ---- */
  const klasorKutu = document.createElement('div');
  klasorKutu.className = 'indirme-klasor-kutu';
  const klasorYol = document.createElement('span');
  klasorYol.className = 'indirme-klasor-yol';
  klasorYol.textContent = a.indirmeKlasoru || cev('ayar.indirmeKlasoruVarsayilan');
  klasorYol.title = a.indirmeKlasoru || '';
  const klasorSec = document.createElement('button');
  klasorSec.className = 'dugme';
  klasorSec.textContent = cev('ayar.indirmeKlasoruDegistir');
  klasorSec.addEventListener('click', async () => {
    const secilen = await window.pusula.indirmeKlasoruSec();
    if (secilen) panelCiz();
  });
  klasorKutu.append(klasorYol, klasorSec);
  if (a.indirmeKlasoru) {
    const sifirla = document.createElement('button');
    sifirla.className = 'dugme';
    sifirla.textContent = cev('ayar.indirmeKlasoruSifirla');
    sifirla.addEventListener('click', async () => {
      await window.pusula.ayarDegistir('indirmeKlasoru', '');
      panelCiz();
    });
    klasorKutu.appendChild(sifirla);
  }
  g.appendChild(ayarSatiri(cev('ayar.indirmeKlasoru'), cev('ayar.indirmeKlasoruAciklama'), klasorKutu));

  /* ---- gizlilik ---- */
  baslik('ayar.bolumGizlilik');

  g.appendChild(ayarSatiri(cev('ayar.engelleyici'), cev('ayar.engelleyiciAciklama'),
    anahtar(a.engelleyiciAcik, (v) => window.pusula.ayarDegistir('engelleyiciAcik', v))));
  g.appendChild(ayarSatiri(cev('ayar.httpsZorla'), cev('ayar.httpsZorlaAciklama'),
    anahtar(a.httpsZorla !== false, (v) => window.pusula.ayarDegistir('httpsZorla', v))));
  g.appendChild(ayarSatiri(cev('ayar.gecisTarayici'), cev('ayar.gecisTarayiciAciklama'),
    anahtar(a.gecisAnahtariTarayici !== false, (v) => window.pusula.ayarDegistir('gecisAnahtariTarayici', v))));
  g.appendChild(ayarSatiri(cev('ayar.anaParola'), cev('ayar.anaParolaAciklama'),
    anahtar(!!a.anaParolaAcik, (v) => window.pusula.ayarDegistir('anaParolaAcik', v))));
  g.appendChild(ayarSatiri(cev('ayar.dnt'), cev('ayar.dntAciklama'),
    anahtar(a.dntGonder, (v) => window.pusula.ayarDegistir('dntGonder', v))));
  g.appendChild(ayarSatiri(cev('ayar.ucuncuTarafCerez'), cev('ayar.ucuncuTarafCerezAciklama'),
    anahtar(a.ucuncuTarafCerez !== false, (v) => window.pusula.ayarDegistir('ucuncuTarafCerez', v))));

  /*
   * Güvenli DNS (DoH). Varsayılan KAPALI; kapalıyken sağlayıcı satırları
   * görünmez. Sağlayıcı "özel" ise adres kutusu da çıkar; yalnızca geçerli
   * bir https adresi kaydedilir (main tarafı da doğrular).
   */
  const dnsSaglayiciSec = document.createElement('select');
  for (const [k, ad] of [
    ['sistem', cev('dns.sistem')],
    ['ozel', cev('dns.ozel')],
    ['opendns', 'OpenDNS'],
    ['cleanbrowsing', 'CleanBrowsing (Family Filter)'],
    ['cloudflare', 'Cloudflare (1.1.1.1)'],
    ['google', 'Google (Public DNS)']
  ]) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = ad;
    if ((a.dnsSaglayici || 'sistem') === k) o.selected = true;
    dnsSaglayiciSec.appendChild(o);
  }
  const dnsSaglayiciSatir = ayarSatiri(cev('ayar.dnsSaglayici'), cev('ayar.dnsSaglayiciAciklama'), dnsSaglayiciSec);

  const dnsOzelKutu = document.createElement('input');
  dnsOzelKutu.type = 'text';
  dnsOzelKutu.placeholder = 'https://dns.example/dns-query';
  dnsOzelKutu.spellcheck = false;
  dnsOzelKutu.value = a.dnsOzel || '';
  const dnsOzelSatir = ayarSatiri(cev('ayar.dnsOzel'), cev('ayar.dnsOzelAciklama'), dnsOzelKutu);

  const dnsGorunum = (acik, saglayici) => {
    dnsSaglayiciSatir.style.display = acik ? '' : 'none';
    dnsOzelSatir.style.display = acik && saglayici === 'ozel' ? '' : 'none';
  };
  dnsGorunum(a.guvenliDns === true, a.dnsSaglayici || 'sistem');

  g.appendChild(ayarSatiri(cev('ayar.guvenliDns'), cev('ayar.guvenliDnsAciklama'),
    anahtar(a.guvenliDns === true, (v) => {
      a.guvenliDns = v;
      window.pusula.ayarDegistir('guvenliDns', v);
      dnsGorunum(v, dnsSaglayiciSec.value);
    })));
  g.appendChild(dnsSaglayiciSatir);
  g.appendChild(dnsOzelSatir);
  dnsSaglayiciSec.addEventListener('change', () => {
    window.pusula.ayarDegistir('dnsSaglayici', dnsSaglayiciSec.value);
    dnsGorunum(a.guvenliDns === true, dnsSaglayiciSec.value);
  });
  dnsOzelKutu.addEventListener('change', async () => {
    const v = dnsOzelKutu.value.trim();
    const sonuc = await window.pusula.ayarDegistir('dnsOzel', v);
    // Reddedilen (geçersiz) adres kutuda kalmasın: kayıtlı değere dön.
    if (sonuc && (sonuc.dnsOzel || '') !== v) dnsOzelKutu.value = sonuc.dnsOzel || '';
  });
  g.appendChild(ayarSatiri(cev('ayar.kapanistaCerezSil'), cev('ayar.kapanistaCerezSilAciklama'),
    anahtar(!!a.kapanistaCerezSil, (v) => window.pusula.ayarDegistir('kapanistaCerezSil', v))));
  g.appendChild(ayarSatiri(cev('ayar.gecmisiKaydet'), cev('ayar.gecmisiKaydetAciklama'),
    anahtar(a.gecmisiKaydet, (v) => window.pusula.ayarDegistir('gecmisiKaydet', v))));
  g.appendChild(ayarSatiri(cev('ayar.discordSunum'), cev('ayar.discordSunumAciklama'),
    anahtar(a.discordSunum !== false, (v) => window.pusula.ayarDegistir('discordSunum', v))));
  g.appendChild(ayarSatiri(cev('ayar.discordButonlar'), cev('ayar.discordButonlarAciklama'),
    anahtar(a.discordButonlar !== false, (v) => window.pusula.ayarDegistir('discordButonlar', v))));

  const temizle = document.createElement('button');
  temizle.className = 'dugme';
  temizle.textContent = cev('ayar.veriTemizle');
  temizle.addEventListener('click', async () => {
    temizle.disabled = true;
    temizle.textContent = cev('ayar.temizleniyor');
    await window.pusula.veriTemizle();
    dugmeDurum(temizle, cev('ayar.temizlendi'), cev('ayar.veriTemizle'));
  });
  g.appendChild(ayarSatiri(cev('ayar.cerezler'), cev('ayar.cerezlerAciklama'), temizle));

  const izinSifirla = document.createElement('button');
  izinSifirla.className = 'dugme';
  izinSifirla.textContent = cev('ayar.izinSifirla');
  izinSifirla.addEventListener('click', async () => {
    izinSifirla.disabled = true;
    await window.pusula.izinTemizle();
    dugmeDurum(izinSifirla, cev('ayar.sifirlandi'), cev('ayar.izinSifirla'));
  });
  g.appendChild(ayarSatiri(cev('ayar.siteIzinleri'), cev('ayar.siteIzinleriAciklama'), izinSifirla));

  /* ---- vekil sunucu ---- */
  baslik('ayar.bolumVekil');

  const vekilAdres = document.createElement('input');
  const vekilAtla = document.createElement('input');

  const vekilKip = document.createElement('select');
  for (const [deger, anahtar] of [
    ['kapali', 'ayar.vekilKapali'], ['sistem', 'ayar.vekilSistem'], ['elle', 'ayar.vekilElle']
  ]) {
    const o = document.createElement('option');
    o.value = deger;
    o.textContent = cev(anahtar);
    if (deger === (a.vekilKip || 'kapali')) o.selected = true;
    vekilKip.appendChild(o);
  }
  const elleAlanlari = () => {
    const elle = vekilKip.value === 'elle';
    vekilAdres.disabled = !elle;
    vekilAtla.disabled = !elle;
  };
  vekilKip.addEventListener('change', () => {
    /*
     * "Elle" seçilip adres BOŞ bırakılırsa vekil kuralı üretilemiyor,
     * fail-closed devreye giriyor ve tarayıcı tümden ağa çıkamıyor - üstelik
     * sebebi hiçbir yerde görünmüyordu (ölçüldü: güncelleme dahil her istek
     * ERR_PROXY_CONNECTION_FAILED). YARIM KALMIŞ ayarı kasıtlı bir gizlilik
     * tercihi gibi uygulamıyoruz; önce adres istiyoruz.
     *
     * Adresi GİRİLMİŞ bir vekil çalışmıyorsa fail-closed doğru davranıştır:
     * orada trafiği doğrudan göndermek, vekil isteyen kullanıcıyı ele verir.
     */
    if (vekilKip.value === 'elle' && !vekilAdres.value.trim()) {
      vekilKip.value = a.vekilKip || 'kapali';
      vekilUyari.textContent = cev('ayar.vekilAdresGerek');
      vekilUyari.hidden = false;
      vekilAdres.disabled = false;
      vekilAdres.focus();
      return;
    }
    vekilUyari.hidden = true;
    window.pusula.ayarDegistir('vekilKip', vekilKip.value);
    elleAlanlari();
  });
  g.appendChild(ayarSatiri(cev('ayar.vekil'), cev('ayar.vekilAciklama'), vekilKip));

  /*
   * Adres reddedilirse KULLANICI GÖRMELİ. Ana süreç geçersiz bir ayarı sessizce
   * yok sayıyor; geri dönen ayarlarla karşılaştırmasak kullanıcı yazdığı adresin
   * kaydedildiğini sanır ve korunduğunu düşünerek gezerdi.
   */
  const vekilUyari = document.createElement('div');
  vekilUyari.className = 'a-uyari';
  vekilUyari.hidden = true;
  vekilUyari.textContent = cev('ayar.vekilAdresHatali');

  /*
   * Chromium kurali reddettiyse bunu da soyluyoruz. Dizeye bakan dogrulama
   * Chromium'un ayristiricisiyla her zaman ayni fikirde olamaz; o durumda
   * baglanti erisilemeyen bir vekile gidiyor ve kullanici NEDEN calismadigini
   * bilmeli.
   */
  const vekilRet = document.createElement('div');
  vekilRet.className = 'a-uyari';
  vekilRet.hidden = !durum.vekilReddedildi;
  vekilRet.textContent = cev('ayar.vekilReddedildi');

  vekilAdres.type = 'text';
  vekilAdres.value = a.vekilAdres || '';
  vekilAdres.placeholder = 'socks5://127.0.0.1:9050';
  vekilAdres.addEventListener('change', async () => {
    const yeni = vekilAdres.value.trim();
    const sonuc = await window.pusula.ayarDegistir('vekilAdres', yeni);
    vekilUyari.hidden = !sonuc || sonuc.vekilAdres === yeni;
  });
  g.appendChild(ayarSatiri(cev('ayar.vekilAdres'), cev('ayar.vekilAdresAciklama'), vekilAdres));
  g.appendChild(vekilUyari);
  g.appendChild(vekilRet);

  vekilAtla.type = 'text';
  vekilAtla.value = a.vekilAtla || '';
  vekilAtla.placeholder = 'ornek.com, 192.168.1.1';
  const vekilAtlaUyari = document.createElement('div');
  vekilAtlaUyari.className = 'a-uyari';
  vekilAtlaUyari.hidden = true;
  vekilAtlaUyari.textContent = cev('ayar.vekilAtlaHatali');
  vekilAtla.addEventListener('change', async () => {
    const yeni = vekilAtla.value.trim();
    const sonuc = await window.pusula.ayarDegistir('vekilAtla', yeni);
    vekilAtlaUyari.hidden = !sonuc || sonuc.vekilAtla === yeni;
  });
  g.appendChild(ayarSatiri(cev('ayar.vekilAtla'), cev('ayar.vekilAtlaAciklama'), vekilAtla));
  g.appendChild(vekilAtlaUyari);
  elleAlanlari();

  /* ---- DPI sansür aşma (ByeDPI) ---- */
  baslik('ayar.bolumDpi');

  const dpiMod = document.createElement('select');
  [
    ['kapali', cev('ayar.dpiKapali')],
    ['dahili', cev('ayar.dpiDahili')],
    ['ciadpi', cev('ayar.dpiCiadpi')]
  ].forEach(([val, label]) => {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = label;
    if (val === (a.dpiMod || 'kapali')) o.selected = true;
    dpiMod.appendChild(o);
  });

  const dpiStrateji = document.createElement('select');
  [
    ['split-1', cev('ayar.dpiStratejiSplit1')],
    ['split-2', cev('ayar.dpiStratejiSplit2')],
    ['split-sni', cev('ayar.dpiStratejiSplitSni')],
    ['fake-split', cev('ayar.dpiStratejiFake')]
  ].forEach(([val, label]) => {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = label;
    if (val === (a.dpiStrateji || 'split-1')) o.selected = true;
    dpiStrateji.appendChild(o);
  });

  function dpiAlanlari() {
    const acik = dpiMod.value !== 'kapali';
    dpiStrateji.disabled = !acik;
  }

  /* Sözleşme penceresi: kabul edilirse true, reddedilirse false döner. */
  function dpiSozlesmeSor() {
    return new Promise((coz) => {
      const kaplama = document.createElement('div');
      kaplama.className = 'dpi-sozlesme-kaplama';
      const kutu = document.createElement('div');
      kutu.className = 'dpi-sozlesme-kutu';
      const bs = document.createElement('h3');
      bs.textContent = cev('dpi.sozlesmeBaslik');
      const metin = document.createElement('div');
      metin.className = 'dpi-sozlesme-metin';
      metin.textContent = cev('dpi.sozlesmeMetin');
      const etiket = document.createElement('label');
      etiket.className = 'dpi-sozlesme-onay';
      const kutucuk = document.createElement('input');
      kutucuk.type = 'checkbox';
      const yazi = document.createElement('span');
      yazi.textContent = cev('dpi.sozlesmeOnay');
      etiket.append(kutucuk, yazi);
      const alt = document.createElement('div');
      alt.className = 'dpi-sozlesme-alt';
      const reddet = document.createElement('button');
      reddet.className = 'dugme';
      reddet.textContent = cev('dpi.sozlesmeReddet');
      const kabul = document.createElement('button');
      kabul.className = 'dugme';
      kabul.textContent = cev('dpi.sozlesmeKabul');
      kabul.disabled = true;
      kutucuk.addEventListener('change', () => { kabul.disabled = !kutucuk.checked; });
      const bitir = (v) => { kaplama.remove(); document.removeEventListener('keydown', tus, true); coz(v); };
      const tus = (e) => { if (e.key === 'Escape') { e.stopPropagation(); bitir(false); } };
      document.addEventListener('keydown', tus, true);
      reddet.addEventListener('click', () => bitir(false));
      kabul.addEventListener('click', () => { if (kutucuk.checked) bitir(true); });
      alt.append(reddet, kabul);
      kutu.append(bs, metin, etiket, alt);
      kaplama.appendChild(kutu);
      document.body.appendChild(kaplama);
      reddet.focus();
    });
  }

  dpiMod.addEventListener('change', async () => {
    if (dpiMod.value !== 'kapali' && a.dpiSozlesmeKabul !== true) {
      const kabulEdildi = await dpiSozlesmeSor();
      if (!kabulEdildi) {
        dpiMod.value = 'kapali';
        dpiAlanlari();
        return;
      }
      a.dpiSozlesmeKabul = true;
      await window.pusula.ayarDegistir('dpiSozlesmeKabul', true);
    }
    window.pusula.ayarDegistir('dpiMod', dpiMod.value);
    dpiAlanlari();
  });

  dpiStrateji.addEventListener('change', () => {
    window.pusula.ayarDegistir('dpiStrateji', dpiStrateji.value);
  });

  g.appendChild(ayarSatiri(cev('ayar.dpi'), cev('ayar.dpiAciklama'), dpiMod));
  g.appendChild(ayarSatiri(cev('ayar.dpiStrateji'), cev('ayar.dpiStratejiAciklama'), dpiStrateji));
  dpiAlanlari();

  /* ---- filtre listeleri ---- */
  baslik('ayar.bolumListeler');

  g.appendChild(ayarSatiri(cev('ayar.listeKullan'), cev('ayar.listeKullanAciklama'),
    anahtar(a.filtreListeleriAcik !== false, (v) => window.pusula.ayarDegistir('filtreListeleriAcik', v))));
  g.appendChild(ayarSatiri(cev('ayar.otomatikGuncelle'), cev('ayar.otomatikGuncelleAciklama'),
    anahtar(a.otomatikGuncelle !== false, (v) => window.pusula.ayarDegistir('otomatikGuncelle', v))));

  const yenile = document.createElement('button');
  yenile.className = 'dugme';
  yenile.textContent = cev('ayar.simdiGuncelle');
  yenile.addEventListener('click', async () => {
    yenile.disabled = true;
    yenile.textContent = cev('ayar.guncelleniyor');
    await window.pusula.listeGuncelle();
    if (acikPanel === 'ayarlar') panelCiz();
  });
  g.appendChild(ayarSatiri(cev('ayar.listeYenile'), cev('ayar.listeYenileAciklama'), yenile));

  for (const l of (durum.listeler || [])) g.appendChild(listeSatiri(l));

  const ekleKutu = document.createElement('input');
  ekleKutu.type = 'text';
  ekleKutu.placeholder = cev('ayar.listeEkleIpucu');
  const ekleDugme = document.createElement('button');
  ekleDugme.className = 'dugme';
  ekleDugme.textContent = cev('ayar.ekle');
  const ekle = async () => {
    const url = ekleKutu.value.trim();
    if (!url) return;
    ekleDugme.disabled = true;
    ekleDugme.textContent = cev('ayar.ekleniyor');
    const sonuc = await window.pusula.listeEkle(url);
    if (sonuc && sonuc.hata) {
      ekleDugme.disabled = false;
      ekleDugme.textContent = cev('ayar.ekle');
      ekleKutu.value = '';
      ekleKutu.placeholder = sonuc.hata;
      return;
    }
    if (acikPanel === 'ayarlar') panelCiz();
  };
  ekleDugme.addEventListener('click', ekle);
  ekleKutu.addEventListener('keydown', (e) => { if (e.key === 'Enter') ekle(); });

  const ekleSaran = document.createElement('div');
  ekleSaran.style.cssText = 'display:flex;gap:8px;align-items:center';
  ekleSaran.append(ekleKutu, ekleDugme);
  g.appendChild(ayarSatiri(cev('ayar.listeEkle'), cev('ayar.listeEkleAciklama'), ekleSaran));

  /* ---- izin istekleri ---- */
  baslik('ayar.bolumIzinler');

  const KARARLAR = [['sor', 'ayar.izinSor'], ['izin', 'ayar.izinVer'], ['ret', 'ayar.izinRet']];
  const izinVarsayilan = a.izinVarsayilan || {};

  for (const izin of (durum.izinTurleri || [])) {
    const izinAdi = cev('izin.' + izin);
    const sec = document.createElement('select');
    for (const [deger, etiketAnahtari] of KARARLAR) {
      const o = document.createElement('option');
      o.value = deger;
      o.textContent = cev(etiketAnahtari);
      if ((izinVarsayilan[izin] || 'sor') === deger) o.selected = true;
      sec.appendChild(o);
    }
    sec.addEventListener('change', () => window.pusula.izinVarsayilanAyarla(izin, sec.value));
    g.appendChild(ayarSatiri(
      izinAdi.charAt(0).toLocaleUpperCase(ceviri.yerel) + izinAdi.slice(1),
      cev('ayar.izinSatir', { izin: izinAdi }),
      sec
    ));
  }

  /* ---- güncelleme ---- */
  baslik('ayar.bolumGuncelleme');

  const gu = durum.guncelleme || { durum: 'kapali', surum: '', ilerleme: 0 };
  let gDurum;
  if (gu.durum === 'bulundu') gDurum = cev('guncelleme.bulundu', { surum: gu.bulunanSurum });
  else if (gu.durum === 'iniyor') gDurum = cev('guncelleme.iniyor', { n: gu.ilerleme });
  else if (gu.durum === 'hazir') gDurum = cev(
    // Otomatik kurulum açıksa güncelleme kapanışta sessizce kurulacak; kullanıcı
    // "hemen kur"a basmak zorunda olmadığını bilsin.
    a.guncellemeOtomatikKur !== false ? 'guncelleme.hazirKapanista' : 'guncelleme.hazir',
    { surum: gu.bulunanSurum });
  else if (gu.durum === 'hata') gDurum = gu.sebep === 'vekil'
    ? cev('guncelleme.hataVekil')
    : cev('guncelleme.hata', { sebep: gu.sebep || '?' });
  else gDurum = cev('guncelleme.' + gu.durum);

  const gDugme = document.createElement('button');
  gDugme.className = 'dugme';
  gDugme.disabled = !gu.etkin || gu.durum === 'kontrol' || gu.durum === 'iniyor';

  if (gu.durum === 'hazir') {
    gDugme.textContent = cev('ayar.guncellemeKur');
    gDugme.addEventListener('click', () => window.pusula.guncellemeKur());
  } else if (gu.durum === 'bulundu') {
    gDugme.textContent = cev('ayar.guncellemeIndirDugme');
    gDugme.addEventListener('click', async () => {
      gDugme.disabled = true;
      await window.pusula.guncellemeIndir();
    });
  } else {
    gDugme.textContent = cev('ayar.guncellemeKontrolEt');
    gDugme.addEventListener('click', async () => {
      gDugme.disabled = true;
      await window.pusula.guncellemeKontrol();
      if (acikPanel === 'ayarlar') panelCiz();
    });
  }

  gDugme.id = 'gncDugme';
  const gSatir = ayarSatiri(cev('ayar.surum') + ' ' + (gu.surum || ''), gDurum, gDugme);
  // Açıklama metnini yerinde tazeleyebilmek için işaretliyoruz.
  const gAciklama = gSatir.querySelector('.a-aciklama');
  if (gAciklama) gAciklama.id = 'gncDurum';
  g.appendChild(gSatir);

  /*
   * İlerleme çubuğu. Ayarlar paneli durum yayınında bilerek yeniden
   * çizilmiyor (girdi alanlarındaki yazı silinmesin diye), bu yüzden çubuğu
   * guncellemeTazele() yerinde güncelliyor. Yalnızca durum ADI değiştiğinde
   * panel baştan çiziliyor; yüzde tikleri sırasında çizilmiyor.
   */
  const gIlerleme = document.createElement('div');
  gIlerleme.id = 'gncIlerleme';
  gIlerleme.className = 'ilerleme guncelleme-ilerleme';
  gIlerleme.hidden = !(gu.durum === 'iniyor' || gu.durum === 'kontrol' || gu.durum === 'hazir');
  const gIc = document.createElement('div');
  gIc.style.width = (gu.durum === 'hazir' ? 100 : (gu.durum === 'iniyor' ? (gu.ilerleme || 0) : 0)) + '%';
  gIlerleme.appendChild(gIc);
  gIlerleme.dataset.durum = gu.durum;
  g.appendChild(gIlerleme);

  g.appendChild(ayarSatiri(cev('ayar.guncellemeOtoKontrol'), cev('ayar.guncellemeOtoKontrolAciklama'),
    anahtar(a.guncellemeKontrol !== false, (v) => window.pusula.ayarDegistir('guncellemeKontrol', v))));
  g.appendChild(ayarSatiri(cev('ayar.guncellemeOtoIndir'), cev('ayar.guncellemeOtoIndirAciklama'),
    anahtar(a.guncellemeIndir !== false, (v) => window.pusula.ayarDegistir('guncellemeIndir', v))));
  g.appendChild(ayarSatiri(cev('ayar.guncellemeOtoKur'), cev('ayar.guncellemeOtoKurAciklama'),
    anahtar(a.guncellemeOtomatikKur !== false, (v) => window.pusula.ayarDegistir('guncellemeOtomatikKur', v))));

  const kanal = document.createElement('select');
  for (const [deger, etiketAnahtari] of [['kararli', 'ayar.kanalKararli'], ['beta', 'ayar.kanalBeta']]) {
    const o = document.createElement('option');
    o.value = deger;
    o.textContent = cev(etiketAnahtari);
    if ((a.guncellemeKanali || 'kararli') === deger) o.selected = true;
    kanal.appendChild(o);
  }
  kanal.addEventListener('change', () => window.pusula.ayarDegistir('guncellemeKanali', kanal.value));
  g.appendChild(ayarSatiri(cev('ayar.guncellemeKanal'), cev('ayar.guncellemeKanalAciklama'), kanal));

  /* ---- görünüm ---- */
  baslik('ayar.bolumGorunum');

  // Tema seçici GÖRÜNÜM sekmesinde: "Arama ve başlangıç" altındayken kullanıcı
  // koyu temayı bulamıyordu (sekme adı neredeyse oraya bakıyor).
  const temaSec = document.createElement('select');
  for (const [deger, anahtar] of [
    ['sistem', 'ayar.temaSistem'], ['acik', 'ayar.temaAcik'], ['koyu', 'ayar.temaKoyu']
  ]) {
    const o = document.createElement('option');
    o.value = deger;
    o.textContent = cev(anahtar);
    if ((a.tema || 'sistem') === deger) o.selected = true;
    temaSec.appendChild(o);
  }
  temaSec.addEventListener('change', () => window.pusula.ayarDegistir('tema', temaSec.value));
  g.appendChild(ayarSatiri(cev('ayar.tema'), cev('ayar.temaAciklama'), temaSec));

  /* ---- tema stili ---- */
  const temaStilSec = document.createElement('select');
  for (const [deger, anahtar] of [
    ['varsayilan', 'tema.stilVarsayilan'],
    ['gece-mavisi', 'tema.stilGeceMavisi'],
    ['mor-nebula', 'tema.stilMorNebula'],
    ['zumrut', 'tema.stilZumrut'],
    ['gun-batimi', 'tema.stilGunBatimi'],
    ['saf-koyu', 'tema.stilSafKoyu']
  ]) {
    const o = document.createElement('option');
    o.value = deger;
    o.textContent = cev(anahtar);
    if ((a.temaStil || 'varsayilan') === deger) o.selected = true;
    temaStilSec.appendChild(o);
  }
  temaStilSec.addEventListener('change', () => window.pusula.ayarDegistir('temaStil', temaStilSec.value));
  g.appendChild(ayarSatiri(cev('ayar.temaStil'), cev('ayar.temaStilAciklama'), temaStilSec));

  /* ---- özel duvar kağıdı ---- */
  const resimKutu = document.createElement('div');
  resimKutu.className = 'tema-resim-kutu';
  const resimSecBtn = document.createElement('button');
  resimSecBtn.className = 'dugme';
  resimSecBtn.textContent = cev('tema.resimSec');
  resimKutu.appendChild(resimSecBtn);

  if (a.temaResmi) {
    const onizleme = document.createElement('img');
    onizleme.className = 'tema-resim-onizleme';
    onizleme.src = a.temaResmi;
    onizleme.alt = 'Preview';
    const kaldirBtn = document.createElement('button');
    kaldirBtn.className = 'dugme';
    kaldirBtn.textContent = cev('tema.resimKaldir');
    kaldirBtn.addEventListener('click', async () => {
      kaldirBtn.disabled = true;
      await window.pusula.temaResimKaldir();
      if (acikPanel === 'ayarlar') panelCiz();
    });
    resimKutu.append(onizleme, kaldirBtn);
  }

  resimSecBtn.addEventListener('click', async () => {
    resimSecBtn.disabled = true;
    const res = await window.pusula.temaResimSec();
    resimSecBtn.disabled = false;
    if (res && res.basarili && acikPanel === 'ayarlar') {
      panelCiz();
    }
  });

  g.appendChild(ayarSatiri(cev('ayar.temaResmi'), cev('ayar.temaResmiAciklama'), resimKutu));

  g.appendChild(ayarSatiri(cev('ayar.yerImleriCubugu'), cev('ayar.yerImleriCubuguAciklama'),
    anahtar(a.yerImleriCubugu, (v) => window.pusula.ayarDegistir('yerImleriCubugu', v))));

  ayarlariSekmele(g);
  el.panelIcerik.appendChild(g);
}

/* ---------------- ana süreçle bağlantı ---------------- */

let ilkDurumGeldi = false;

window.pusula.durumDinle((d) => {
  /*
   * BİRLEŞTİR, DEĞİŞTİRME. Ana süreç değişmeyen veriyi (çeviri, dil/motor/izin
   * listeleri) her durumda göndermiyor - yalnızca bağlanışta ve dil değişince.
   * Gelen durumu öncekinin üstüne yığıyoruz ki atlanan alanlar (ör. motorlar,
   * yerImleri) son bilinen değerinde kalsın.
   */
  durum = Object.assign(durum, d);
  // yerImleri yalnızca değiştiğinde geliyor; geldiyse şerit yeniden çizilsin.
  if (d.yerImleri) yerImYeni = true;
  if (d.ceviri) {
    const dilDegisti = d.ceviri.dil !== ceviri.dil;
    ceviri = d.ceviri;
    // İlk durumda da çalışmalı: sabit metinler ve yön henüz hiç yazılmadı.
    if (dilDegisti || !ilkDurumGeldi) {
      statikMetinler();
      if (ilkDurumGeldi && acikPanel) panelCiz();   // açık panel yeni dile geçsin
    }
    ilkDurumGeldi = true;
  }
  if (durum.pencereGizli) {
    document.body.classList.add('pencere-gizli');
    if (el.gizliGosterge) el.gizliGosterge.hidden = false;
  } else {
    document.body.classList.remove('pencere-gizli');
    if (el.gizliGosterge) el.gizliGosterge.hidden = true;
  }

  const temaStil = (durum.ayarlar && durum.ayarlar.temaStil) || 'varsayilan';
  document.body.dataset.temaStil = temaStil;
  try { localStorage.setItem('pusula_tema_stil', temaStil); } catch (_) {}

  const temaResmi = (durum.ayarlar && durum.ayarlar.temaResmi) || '';
  if (temaResmi) {
    document.body.style.backgroundImage = 'url("' + temaResmi + '")';
    document.body.classList.add('ozel-duvarkagidi');
    try { localStorage.setItem('pusula_tema_resmi', temaResmi); } catch (_) {}
  } else {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('ozel-duvarkagidi');
    try { localStorage.removeItem('pusula_tema_resmi'); } catch (_) {}
  }

  const aktifTab = durum.sekmeler && durum.sekmeler.find(s => s.id === durum.aktifId);
  if (aktifTab && aktifTab.dahiliPanel) {
    if (acikPanel !== aktifTab.dahiliPanel) {
      panelAc(aktifTab.dahiliPanel, true);
    }
  } else if (acikPanel && el.panel.classList.contains('sekme-sayfasi')) {
    panelKapat();
  }

  ciz();
  varsayilanTarayiciDenetle();
});

let varsayilanDenetlendi = false;

async function varsayilanTarayiciDenetle() {
  if (varsayilanDenetlendi || durum.pencereGizli || durum.ayarlar.varsayilanOneriGizle) return;
  varsayilanDenetlendi = true;
  try {
    const varsayilan = await window.pusula.varsayilanDurum();
    if (!varsayilan && !durum.ayarlar.varsayilanOneriGizle && !durum.pencereGizli) {
      el.varsayilanMetin.textContent = cev('banner.varsayilanMetin');
      el.btnVarsayilanYap.textContent = cev('banner.varsayilanYap');
      el.btnVarsayilanKapat.title = cev('banner.simdiDegil');
      el.varsayilanBanner.hidden = false;
    } else {
      el.varsayilanBanner.hidden = true;
    }
  } catch {
    el.varsayilanBanner.hidden = true;
  }
}

el.btnVarsayilanYap.addEventListener('click', async () => {
  el.varsayilanBanner.hidden = true;
  await window.pusula.varsayilanYap();
});

el.btnVarsayilanKapat.addEventListener('click', () => {
  el.varsayilanBanner.hidden = true;
  window.pusula.ayarDegistir('varsayilanOneriGizle', true);
});

window.pusula.bulmaSonucuDinle(({ etkin, toplam }) => {
  el.bulSayac.textContent = (toplam ? etkin : 0) + '/' + toplam;
});

/*
 * Sayfa görüntüsü: öneri açıkken main sayfayı gizleyip anlık görüntüsünü
 * gönderir. Görüntüyü sayfa alanının başına (öneri listesinin üst kenarı)
 * hizalıyoruz ki sayfa yerinde duruyormuş gibi görünsün. null gelirse öneri
 * kapandı, görüntüyü kaldır.
 */
window.pusula.sayfaGoruntuDinle((veriUrl) => {
  if (!veriUrl || !oneriAcikDurum) {
    el.sayfaGoruntu.hidden = true;
    el.sayfaGoruntu.style.backgroundImage = '';
    return;
  }
  // Görüntü sayfa alanının başından (chrome'un altı) başlar. Öneri artık
  // mutlak konumlu olduğu için onun top'u değil, chrome yüksekliği ölçülüyor.
  el.sayfaGoruntu.style.top = Math.round(el.chrome.getBoundingClientRect().height) + 'px';
  el.sayfaGoruntu.style.backgroundImage = 'url("' + veriUrl + '")';
  el.sayfaGoruntu.hidden = false;
});

window.pusula.adresOdakDinle(() => {
  if (acikPanel) panelKapat();
  el.adres.focus();
  el.adres.select();
});

window.pusula.bulmaAcDinle(() => { if (!acikPanel) bulmaAc(); });
window.pusula.yerImiKisayolDinle(() => yerImiPopoverAc());
window.pusula.panelAcDinle((istek) => {
  // Kisayollar ayni paneli acip kapatir; 'Tumunu goster' gibi olumlu
  // eylemler ise SADECE acar. Ikisi ayni sayilinca, panel zaten acikken
  // 'Tumunu goster' onu kapatiyordu.
  const ad = typeof istek === 'string' ? istek : (istek && istek.ad);
  const kip = typeof istek === 'string' ? 'degistir' : (istek && istek.kip);
  const sekmeModu = typeof istek === 'object' && istek !== null && !!istek.sekmeModu;
  if (!ad) return;
  if (kip === 'degistir' && acikPanel === ad && !sekmeModu) panelKapat();
  else panelAc(ad, sekmeModu);
});
window.pusula.panelKapatDinle(() => panelKapat());

// Açık eklenti penceresinin düğmesi, Chrome'daki gibi basılı/belirgin görünür.
var eklentiAcikId = null;
window.pusula.eklentiPopupDinle((id) => {
  eklentiAcikId = id || null;
  for (const b of el.eklentiSabit.querySelectorAll('.eklenti-dugme')) {
    b.classList.toggle('basili', !!eklentiAcikId && b.dataset.id === eklentiAcikId);
  }
});

/* ---------------- klavye ---------------- */

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
    e.preventDefault();
    window.pusula.yeniGizliPencere();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
    e.preventDefault();
    window.pusula.yanCubukGecis();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'N' || e.key === 'n')) {
    e.preventDefault();
    window.pusula.yeniPencere();
    return;
  }
  if (e.key === 'Escape') {
    if (!el.yanPanelEkleModal.hidden) {
      yanPanelEkleModalKapat();
      return;
    }
    if (durum.ayarlar && durum.ayarlar.yanPanelAcik) {
      window.pusula.yanPanelKapat();
      return;
    }
    // Indirilenler kutusu artik katmanda; Escape'i o kendi icinde yakaliyor.
    if (acikPanel && !el.panel.classList.contains('sekme-sayfasi')) { panelKapat(); return; }
    if (!el.bulCubugu.hidden && document.activeElement !== el.bulGirdi) { bulmaKapat(); return; }
  }
});

/* Orta tıkla sekme kapatma sırasında sayfanın kaydırma imleci açılmasın. */
document.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

window.pusula.hazir();
