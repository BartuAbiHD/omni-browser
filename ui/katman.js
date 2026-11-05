'use strict';

/*
 * Katman içeriğini çizer. İki tür var: indirilenler kutusu ve izin isteği.
 * Metinlerin tamamı ana süreçten çevrilmiş olarak geliyor; bu sayfa kendi
 * çeviri tablosunu taşımıyor.
 */

const ortu = document.getElementById('ortu');
const kutu = document.getElementById('kutu');

const SIMGE = {
  klasor: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.6h4.2L7.4 6.2H14v7.2H2z"/></svg>',
  kapat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  uyari: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6l5.9 10.8H2.1z"/>'
    + '<path d="M8 6.4v3.1"/><path d="M8 11.4v.3"/></svg>',
  indir: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v7.1"/>'
    + '<path d="M5.2 7.2 8 10l2.8-2.8"/><path d="M3.4 13h9.2"/></svg>',
  duraklat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.6 3.6v8.8M10.4 3.6v8.8"/></svg>',
  surdur: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 3.4l7 4.6-7 4.6z"/></svg>',
  sil: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 4.8h9.2M6.4 4.8V3.2h3.2v1.6M4.7 4.8l.6 8.2h5.4l.6-8.2"/></svg>',
  soru: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/>'
    + '<path d="M6.4 6.2a1.6 1.6 0 1 1 1.9 1.9v1"/><path d="M8.3 11.2v.3"/></svg>'
};

function bos() {
  kapatinca = null;
  for (const m of document.querySelectorAll('.ym-menu')) m.remove();
  kutu.style.display = '';
  kutu.replaceChildren();
  kutu.className = '';
  ortu.className = '';
}

/* ---------------- indirilenler ---------------- */

// Açık kutuda her ilerleme güncellemesinde tüm satırları yeniden kurmak,
// fareyle basılı düğmeyi araya girip tıklamayı yutardı. Satır kümesi ve
// eylem durumları aynıysa yalnızca metin ve çubuk güncellenir.
let indirmeImza = '';
const indirmeSatirlari = new Map();   // id -> { alt, cubukIc }

function indirmeImzasi(v) {
  return v.ogeler.map((o) => [o.id, o.durum, o.duraklatildi, o.acilabilir, o.surdurulebilir,
    o.duraklatilabilir, o.iptalEdilebilir, o.silinebilir, o.yuzde === null ? 0 : 1, o.belirsiz ? 1 : 0].join(':')).join('|');
}

function indirmeYamala(v) {
  if (!kutu.querySelector('.menu-satir') || indirmeImzasi(v) !== indirmeImza) return false;
  for (const o of v.ogeler) {
    const r = indirmeSatirlari.get(o.id);
    if (!r) return false;
    r.alt.textContent = o.alt;
    if (r.cubukIc && o.yuzde !== null && o.yuzde !== undefined) r.cubukIc.style.width = o.yuzde + '%';
  }
  return true;
}

function eylemDugmesi(simge, baslik, fn) {
  const d = document.createElement('button');
  d.className = 'ikon kucuk';
  d.innerHTML = simge;
  d.title = baslik || '';
  d.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return d;
}

function indirmeleriCiz(v) {
  indirmeSatirlari.clear();
  indirmeImza = indirmeImzasi(v);

  const baslik = document.createElement('div');
  baslik.className = 'menu-baslik';
  baslik.textContent = v.baslik;

  const kapat = document.createElement('button');
  kapat.className = 'ikon kucuk';
  kapat.innerHTML = SIMGE.kapat;
  kapat.title = v.kapatMetni || '';
  kapat.addEventListener('click', () => window.katman.kapat());
  baslik.appendChild(kapat);
  kutu.appendChild(baslik);

  if (!v.ogeler.length) {
    const bosluk = document.createElement('div');
    bosluk.className = 'menu-bos';
    bosluk.textContent = v.bosMetni;
    kutu.appendChild(bosluk);
    return;
  }

  for (const o of v.ogeler) {
    const satir = document.createElement('div');
    satir.className = 'menu-satir' + (o.riskli ? ' riskli' : '');
    satir.title = o.ad;

    const simge = document.createElement('span');
    simge.className = 'menu-ikon';
    simge.innerHTML = o.riskli ? SIMGE.uyari : SIMGE.indir;
    satir.appendChild(simge);

    const metin = document.createElement('div');
    metin.className = 'menu-metin';
    const ad = document.createElement('div');
    ad.className = 'menu-ad';
    ad.textContent = o.ad;
    const alt = document.createElement('div');
    alt.className = 'menu-alt';
    alt.textContent = o.alt;
    metin.append(ad, alt);
    satir.appendChild(metin);

    // İlerleme çizgisi yalnızca sürmekte olan ve boyutu bilinen indirmelerde.
    let cubukIc = null;
    if ((o.yuzde !== null && o.yuzde !== undefined) || o.belirsiz) {
      const cubuk = document.createElement('div');
      cubuk.className = 'ilerleme' + (o.duraklatildi ? ' duraklatildi' : '') + (o.belirsiz ? ' belirsiz' : '');
      cubukIc = document.createElement('div');
      if (!o.belirsiz) cubukIc.style.width = o.yuzde + '%';
      cubuk.appendChild(cubukIc);
      metin.appendChild(cubuk);
    }
    indirmeSatirlari.set(o.id, { alt, cubukIc });

    if (o.duraklatilabilir) satir.appendChild(eylemDugmesi(SIMGE.duraklat, v.duraklatMetni, () => window.katman.indirmeEylem(o.id, 'duraklat')));
    if (o.surdurulebilir) satir.appendChild(eylemDugmesi(SIMGE.surdur, v.surdurMetni, () => window.katman.indirmeEylem(o.id, 'surdur')));
    if (o.iptalEdilebilir) satir.appendChild(eylemDugmesi(SIMGE.kapat, v.iptalMetni, () => window.katman.indirmeEylem(o.id, 'iptal')));
    if (o.acilabilir) {
      satir.addEventListener('click', () => window.katman.indirmeAc(o.id));
      satir.appendChild(eylemDugmesi(SIMGE.klasor, v.klasorMetni, () => window.katman.indirmeKlasor(o.id)));
    }
    if (o.silinebilir) satir.appendChild(eylemDugmesi(SIMGE.sil, v.silMetni, () => window.katman.indirmeEylem(o.id, 'sil')));

    kutu.appendChild(satir);
  }

  const tumu = document.createElement('button');
  tumu.className = 'menu-alt-dugme';
  tumu.textContent = v.tumunuMetni;
  tumu.addEventListener('click', () => window.katman.tumunuGoster());
  kutu.appendChild(tumu);
}

/* ---------------- izin isteği ---------------- */

function izinCiz(v) {
  const baslik = document.createElement('div');
  baslik.className = 'izin-baslik';
  baslik.innerHTML = SIMGE.soru;
  const b = document.createElement('span');
  b.textContent = v.baslik;
  baslik.appendChild(b);
  kutu.appendChild(baslik);

  const kaynak = document.createElement('div');
  kaynak.className = 'izin-kaynak';
  const kb = document.createElement('b');
  kb.textContent = v.kaynak;
  kaynak.append(kb, document.createTextNode(' ' + v.istiyor));
  kutu.appendChild(kaynak);

  const ne = document.createElement('div');
  ne.className = 'izin-ne';
  ne.textContent = v.ne;
  kutu.appendChild(ne);

  const etiket = document.createElement('label');
  etiket.className = 'izin-hatirla';
  const kutucuk = document.createElement('input');
  kutucuk.type = 'checkbox';
  etiket.append(kutucuk, document.createTextNode(v.hatirlaMetni));
  kutu.appendChild(etiket);

  const dugmeler = document.createElement('div');
  dugmeler.className = 'izin-dugmeler';

  const reddet = document.createElement('button');
  reddet.textContent = v.reddetMetni;
  reddet.addEventListener('click', () => window.katman.izinKarar(false, kutucuk.checked));

  const izinVer = document.createElement('button');
  izinVer.className = 'birincil';
  izinVer.textContent = v.izinMetni;
  izinVer.addEventListener('click', () => window.katman.izinKarar(true, kutucuk.checked));

  dugmeler.append(reddet, izinVer);
  kutu.appendChild(dugmeler);

  // Odak reddetmede başlasın: kazara Enter izin vermesin.
  requestAnimationFrame(() => reddet.focus());
}

/* ---------------- onay penceresi ---------------- */

/*
 * Sayfanın ortasında, tarayıcının kendi temasıyla çizilen onay kutusu. Eklenti
 * kurulumu/kaldırma gibi işletim sistemi kutusuna benzemesini istemediğimiz
 * kararlar için. Bölümler (sürüm, izinler, siteler) etiket + yuvarlak rozetler
 * olarak çiziliyor. Kapatma/Escape/dışarı tıklama "vazgeç" sayılır.
 */
function onayCiz(v) {
  ortu.classList.add('karart');
  kutu.classList.add('merkez');

  const baslik = document.createElement('div');
  baslik.className = 'onay-baslik';
  const ikon = document.createElement('span');
  ikon.className = 'onay-ikon' + (v.tehlikeli ? ' tehlike' : '');
  ikon.innerHTML = v.simge === 'uyari' ? SIMGE.uyari : SIMGE.soru;
  const metin = document.createElement('span');
  metin.className = 'onay-baslik-metin';
  metin.textContent = v.baslik;
  baslik.append(ikon, metin);
  kutu.appendChild(baslik);

  if (v.aciklama) {
    const a = document.createElement('div');
    a.className = 'onay-aciklama';
    a.textContent = v.aciklama;
    kutu.appendChild(a);
  }

  for (const b of (v.bolumler || [])) {
    if (!b.ogeler || !b.ogeler.length) continue;
    const bolum = document.createElement('div');
    bolum.className = 'onay-bolum';
    const etiket = document.createElement('div');
    etiket.className = 'onay-etiket';
    etiket.textContent = b.etiket;
    const rozetler = document.createElement('div');
    rozetler.className = 'onay-rozetler';
    for (const o of b.ogeler) {
      const r = document.createElement('span');
      r.className = 'onay-rozet' + (b.mono ? ' mono' : '');
      r.textContent = o;
      rozetler.appendChild(r);
    }
    bolum.append(etiket, rozetler);
    kutu.appendChild(bolum);
  }

  const dugmeler = document.createElement('div');
  dugmeler.className = 'izin-dugmeler onay-dugmeler';
  let vazgec = null;
  if (v.vazgecMetni) {
    vazgec = document.createElement('button');
    vazgec.textContent = v.vazgecMetni;
    vazgec.addEventListener('click', () => window.katman.onayKarar(false));
    dugmeler.appendChild(vazgec);
  }
  const tamam = document.createElement('button');
  tamam.className = 'birincil' + (v.tehlikeli ? ' tehlike' : '');
  tamam.textContent = v.tamamMetni;
  tamam.addEventListener('click', () => window.katman.onayKarar(true));
  dugmeler.appendChild(tamam);
  kutu.appendChild(dugmeler);

  // Yıkıcı eylemde odak vazgeçte başlasın: kazara Enter silmesin.
  requestAnimationFrame(() => (v.tehlikeli && vazgec ? vazgec : tamam).focus());
}

/* ---------------- yenilikler (sürüm notları) ---------------- */

// Satır içi Markdown: `kod`, **kalın**, [metin](adres). Hepsi DOM düğümü olarak
// kurulur (innerHTML yok); bağlantılar tıklanabilir yapılmaz, yalnızca metin.
function mdSatirIci(ust, metin) {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]*\))/g;
  let son = 0;
  let m;
  while ((m = re.exec(metin))) {
    if (m.index > son) ust.append(metin.slice(son, m.index));
    if (m[1]) {
      const k = document.createElement('code');
      k.textContent = m[1].slice(1, -1);
      ust.appendChild(k);
    } else if (m[2]) {
      const b = document.createElement('strong');
      mdSatirIci(b, m[2].slice(2, -2));
      ust.appendChild(b);
    } else {
      ust.append(/^\[([^\]]+)\]/.exec(m[3])[1]);
    }
    son = m.index + m[0].length;
  }
  if (son < metin.length) ust.append(metin.slice(son));
}

function mdCiz(kap, govde, bolumAdlari) {
  kap.replaceChildren();
  for (const satir of govde.split('\n')) {
    if (!satir.trim()) continue;
    const baslik = /^#{2,6}\s+(.*)$/.exec(satir);
    if (baslik) {
      const h = document.createElement('div');
      h.className = 'yn-bolum';
      const ad = baslik[1].trim();
      h.textContent = Object.hasOwn(bolumAdlari, ad) ? bolumAdlari[ad] : ad;
      kap.appendChild(h);
      continue;
    }
    const madde = /^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/.exec(satir);
    const d = document.createElement('div');
    if (madde) {
      d.className = 'yn-oge';
      d.style.setProperty('--yn-girinti', Math.min(4, Math.floor(madde[1].length / 2)));
      mdSatirIci(d, madde[2]);
    } else {
      d.className = 'yn-par';
      mdSatirIci(d, satir.trim());
    }
    kap.appendChild(d);
  }
}

function yenilikCiz(v) {
  ortu.classList.add('karart');
  kutu.classList.add('merkez', 'yenilik');

  const bas = document.createElement('div');
  bas.className = 'yn-bas';
  const metin = document.createElement('div');
  metin.className = 'yn-baslik-kap';
  const b = document.createElement('div');
  b.className = 'yn-baslik';
  b.textContent = v.baslik;
  const alt = document.createElement('div');
  alt.className = 'yn-surum';
  alt.textContent = 'v' + v.surum + (v.tarih ? ' · ' + v.tarih : '');
  metin.append(b, alt);

  const dilKap = document.createElement('label');
  dilKap.className = 'yn-dil';
  const dilEtiket = document.createElement('span');
  dilEtiket.textContent = v.m.dil;
  const sec = document.createElement('select');
  for (const d of v.diller) {
    const o = document.createElement('option');
    o.value = d.kod;
    o.textContent = d.ad;
    if (d.kod === v.secili) o.selected = true;
    sec.appendChild(o);
  }
  dilKap.append(dilEtiket, sec);
  bas.append(metin, dilKap);

  const durum = document.createElement('div');
  durum.className = 'yn-durum';
  const icerik = document.createElement('div');
  icerik.className = 'yn-govde';

  const dugmeler = document.createElement('div');
  dugmeler.className = 'izin-dugmeler onay-dugmeler';
  const kapat = document.createElement('button');
  kapat.className = 'birincil';
  kapat.textContent = v.m.kapat;
  kapat.addEventListener('click', () => window.katman.kapat());
  dugmeler.appendChild(kapat);

  kutu.append(bas, durum, icerik, dugmeler);

  let istek = 0;
  async function goster(kod) {
    const bu = ++istek;
    icerik.dir = kod === 'ar' ? 'rtl' : 'ltr';
    durum.textContent = '';
    if (kod === 'en') { mdCiz(icerik, v.govde, v.m.bolumler); return; }
    durum.textContent = v.m.ceviriyor;
    let sonuc = null;
    try { sonuc = await window.katman.yenilikCevir(kod); } catch { sonuc = null; }
    if (bu !== istek) return;              // arada başka dil seçildi
    if (sonuc && sonuc.govde) { mdCiz(icerik, sonuc.govde, v.m.bolumler); durum.textContent = ''; }
    else { icerik.dir = 'ltr'; mdCiz(icerik, v.govde, v.m.bolumler); durum.textContent = v.m.ceviriHata; }
  }
  sec.addEventListener('change', () => goster(sec.value));
  mdCiz(icerik, v.govde, v.m.bolumler);
  goster(sec.value);
  requestAnimationFrame(() => kapat.focus());
}

/* ---------------- VPN ---------------- */

/*
 * Ülke bayrağı — HatScripts/circle-flags setinden gömülü (MIT lisansı),
 * kendinden dairesel maskeli profesyonel SVG'ler. Emoji bayrak yazıtipi
 * Windows'ta yok; bu yüzden gerçek çizim. mask id'leri ülkeye özel: aynı
 * belgede iki bayrak olursa çakışmasın. Bilinmeyen ülke için küre.
 */
function bayrakSvg(ulke) {
  const S = (id, ic) => '<svg viewBox="0 0 512 512" aria-hidden="true"><mask id="bm-' + id + '">'
    + '<circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#bm-' + id + ')">' + ic + '</g></svg>';
  const B = {
    DE: S('de', '<path fill="#ffda44" d="m0 345 256.7-25.5L512 345v167H0z"/><path fill="#d80027" d="m0 167 255-23 257 23v178H0z"/><path fill="#333" d="M0 0h512v167H0z"/>'),
    NL: S('nl', '<path fill="#eee" d="m0 167 253.8-19.3L512 167v178l-254.9 32.3L0 345z"/><path fill="#a2001d" d="M0 0h512v167H0z"/><path fill="#0052b4" d="M0 345h512v167H0z"/>'),
    FR: S('fr', '<path fill="#eee" d="M167 0h178l25.9 252.3L345 512H167l-29.8-253.4z"/><path fill="#0052b4" d="M0 0h167v512H0z"/><path fill="#d80027" d="M345 0h167v512H345z"/>'),
    TR: S('tr', '<path fill="#d80027" d="M0 0h512v512H0z"/><path fill="#eee" d="M208 115a141 141 0 1 0 106 242q-25 13-54 13a114 114 0 1 1 54-215 141 141 0 0 0-106-40m142 67v56l-54 18 54 17v57l33-46 54 18-33-46 33-46-54 18z"/>'),
    US: S('us', '<path fill="#eee" d="M256 0h256v64l-32 32 32 32v64l-32 32 32 32v64l-32 32 32 32v64l-256 32L0 448v-64l32-32-32-32v-64z"/><path fill="#d80027" d="M224 64h288v64H224Zm0 128h288v64H256ZM0 320h512v64H0Zm0 128h512v64H0Z"/><path fill="#0052b4" d="M0 0h256v256H0Z"/><path fill="#eee" d="m187 243 57-41h-70l57 41-22-67zm-81 0 57-41H93l57 41-22-67zm-81 0 57-41H12l57 41-22-67zm162-81 57-41h-70l57 41-22-67zm-81 0 57-41H93l57 41-22-67zm-81 0 57-41H12l57 41-22-67Zm162-82 57-41h-70l57 41-22-67Zm-81 0 57-41H93l57 41-22-67zm-81 0 57-41H12l57 41-22-67Z"/>'),
    GB: S('gb', '<path fill="#eee" d="m0 0 8 22-8 23v23l32 54-32 54v32l32 48-32 48v32l32 54-32 54v68l22-8 23 8h23l54-32 54 32h32l48-32 48 32h32l54-32 54 32h68l-8-22 8-23v-23l-32-54 32-54v-32l-32-48 32-48v-32l-32-54 32-54V0l-22 8-23-8h-23l-54 32-54-32h-32l-48 32-48-32h-32l-54 32L68 0H0z"/><path fill="#0052b4" d="M336 0v108L444 0Zm176 68L404 176h108zM0 176h108L0 68ZM68 0l108 108V0Zm108 512V404L68 512ZM0 444l108-108H0Zm512-108H404l108 108Zm-68 176L336 404v108z"/><path fill="#d80027" d="M0 0v45l131 131h45L0 0zm208 0v208H0v96h208v208h96V304h208v-96H304V0h-96zm259 0L336 131v45L512 0h-45zM176 336 0 512h45l131-131v-45zm160 0 176 176v-45L381 336h-45z"/>')
  };
  const svg = B[(ulke || '').toUpperCase()];
  if (svg) return svg;
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.3"/>'
    + '<path d="M2 10h16M10 2v16M4.4 5c3.2 2.6 8 2.6 11.2 0M4.4 15c3.2-2.6 8-2.6 11.2 0" fill="none" stroke="currentColor" stroke-width="1.05"/></svg>';
}

const VPN_GUC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="M12 2.5v9"/><path d="M6.6 6.6a8 8 0 1 0 10.8 0"/></svg>';

// Başlıktaki kalkan (onaylı) ikonu — pencereye VPN kimliği katar.
const VPN_KALKAN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
  + '<path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/*
 * VPN açılır kutusu (VeePN tarzı): büyük güç düğmesi + bağlantı durumu +
 * bayraklı konum kartı + çıkış IP. KİMLİK DOĞRULAMA OTOMATİK: kullanıcı token
 * girmez; güç düğmesine basınca ana süreç cihaz token'ını sunucudan alır
 * (vpnAcKapa invoke -> {acik,hata}). Bant limiti (100 Mbps/kullanıcı) SUNUCUDA.
 * Aç/kapa ve lokasyon değişince kutu yerinde yeniden çizilir; durum v üstünde.
 */
function vpnCiz(v) {
  kutu.replaceChildren();          // yeniden çizimde eski içerik gitsin; konum sınıfları/var'ları kalır
  const m = v.metin;
  const bagli = !!v.acik;

  // Başlık: kalkan ikonu + "VPN" + kapat
  const baslik = document.createElement('div');
  baslik.className = 'menu-baslik vpn-baslik';
  const kalkan = document.createElement('span');
  kalkan.className = 'vpn-baslik-ikon';
  kalkan.innerHTML = VPN_KALKAN_SVG;
  const baslikAd = document.createElement('span');
  baslikAd.textContent = m.baslik;
  const kapat = document.createElement('button');
  kapat.className = 'ikon kucuk';
  kapat.innerHTML = SIMGE.kapat;
  kapat.title = m.kapat || '';
  kapat.addEventListener('click', () => window.katman.kapat());
  baslik.append(kalkan, baslikAd, kapat);
  kutu.appendChild(baslik);

  const ekran = document.createElement('div');
  ekran.className = 'vpn-ekran ' + (bagli ? 'acik' : 'kapali');

  // Güç düğmesi (halo + halkalarla) — otomatik kayıt: sonucu bekler,
  // bu sırada "Bağlanıyor…" gösterir.
  const gucAlan = document.createElement('div');
  gucAlan.className = 'vpn-guc-alan';
  const halo = document.createElement('div');
  halo.className = 'vpn-halo';
  const guc = document.createElement('button');
  guc.className = 'vpn-guc ' + (bagli ? 'acik' : 'kapali');
  guc.setAttribute('aria-pressed', bagli ? 'true' : 'false');
  guc.setAttribute('aria-label', m.ac);
  guc.innerHTML = VPN_GUC_SVG;
  gucAlan.append(halo, guc);

  const durumMetin = document.createElement('div');
  durumMetin.className = 'vpn-durum-metin';
  durumMetin.textContent = bagli ? m.baglantiAcik : m.baglantiKapali;

  const hata = document.createElement('div');
  hata.className = 'vpn-uyari';
  if (v.hata) hata.textContent = v.hata;

  guc.addEventListener('click', async () => {
    const hedef = !bagli;
    guc.disabled = true;
    guc.classList.add('mesgul');
    durumMetin.textContent = m.baglaniyor;
    hata.textContent = '';
    let sonuc = null;
    try { sonuc = await window.katman.vpnAcKapa(hedef); } catch (e) { /* sonuc null */ }
    if (!hedef) { v.acik = false; v.hata = ''; }                 // kapatma her zaman başarılı
    else if (sonuc && sonuc.acik && !sonuc.hata) { v.acik = true; v.hata = ''; }
    else { v.acik = false; v.hata = m.hataKayit; }               // kayıt/bağlantı olamadı
    vpnCiz(v);
  });
  ekran.append(gucAlan, durumMetin, hata);

  // Konum kartı (bayrak + ad; tıkla → gizli seçici)
  const sec = document.createElement('select');
  sec.className = 'vpn-gizli-sec';
  sec.setAttribute('aria-label', m.lokasyon);
  for (const x of v.katalog) {
    const o = document.createElement('option');
    o.value = x.id; o.textContent = x.ad + ' (' + x.ulke + ')';
    if (x.id === v.lokasyon.id) o.selected = true;
    sec.appendChild(o);
  }
  sec.addEventListener('change', () => {
    v.lokasyon = v.katalog.find((x) => x.id === sec.value) || v.lokasyon;
    window.katman.vpnLokasyon(sec.value);
    vpnCiz(v);
  });
  const lokKart = document.createElement('button');
  lokKart.className = 'vpn-kart vpn-lokasyon-kart';
  const bayrak = document.createElement('span');
  bayrak.className = 'vpn-bayrak';
  bayrak.innerHTML = bayrakSvg(v.lokasyon.ulke);
  const lokAd = document.createElement('span');
  lokAd.className = 'vpn-lok-ad';
  const lokB = document.createElement('b'); lokB.textContent = v.lokasyon.ad || '';
  const lokS = document.createElement('small'); lokS.textContent = v.lokasyon.ulke || '';
  lokAd.append(lokB, lokS);
  const ok = document.createElement('span'); ok.className = 'vpn-ok'; ok.textContent = '›';
  lokKart.append(bayrak, lokAd, ok);
  lokKart.addEventListener('click', () => {
    if (v.katalog.length > 1) { if (sec.showPicker) sec.showPicker(); else sec.click(); }
  });
  ekran.append(lokKart, sec);

  // Çıkış IP kartı
  const ipKart = document.createElement('div');
  ipKart.className = 'vpn-kart vpn-ip-kart';
  const ipMetin = document.createElement('span');
  const ipDeger = document.createElement('b');
  ipDeger.className = 'vpn-ip-deger'; ipDeger.textContent = '—';
  ipMetin.append(document.createTextNode(m.ipBaslik + ': '), ipDeger);
  const ipBtn = document.createElement('button');
  ipBtn.className = 'dugme'; ipBtn.textContent = m.ipGoster;
  ipBtn.addEventListener('click', async () => {
    ipBtn.disabled = true; ipDeger.textContent = '…';
    const ip = await window.katman.vpnCikisIp();
    ipDeger.textContent = ip || m.ipHata; ipBtn.disabled = false;
  });
  ipKart.append(ipMetin, ipBtn);
  ekran.appendChild(ipKart);

  // Otomatik-bağlantı notu (kullanıcı giriş yapmaz) + limit açıklaması
  const oto = document.createElement('div');
  oto.className = 'vpn-oto';
  oto.textContent = m.otomatik;
  const limit = document.createElement('div');
  limit.className = 'vpn-limit';
  limit.textContent = m.limit;
  ekran.append(oto, limit);

  kutu.appendChild(ekran);
}

/* ---------------- yer imleri menüsü ---------------- */

/*
 * Yer imi çubuğundaki "Tüm yer imleri" / "»" menüleri. Sitedeyken sayfa görünümü
 * arayüzün üstünde olduğu için menü burada, katmanda çiziliyor. Klasörler sağa
 * açılan alt menüler; uzun listeler kaydırılır.
 * ogeler: { tur: 'yerimi', url, baslik, favicon } | { tur: 'klasor', ad, yol, alt }
 *       | { tur: 'eylem', ad } | { tur: 'ayrac' }
 */
let ymMenuler = [];

function ymKapat(seviye) {
  while (ymMenuler.length > seviye) ymMenuler.pop().remove();
}

function ymSimge(o) {
  let host = '';
  try { host = new URL(o.url).hostname; } catch { /* geçersiz */ }
  const rozet = () => {
    const r = document.createElement('span');
    r.className = 'ym-rozet';
    r.textContent = (host || o.baslik || '?').replace(/^www\./, '').charAt(0).toUpperCase();
    return r;
  };
  if (!o.favicon) return rozet();
  const i = document.createElement('img');
  i.className = 'ym-simge';
  i.alt = '';
  i.src = o.favicon;
  i.addEventListener('error', () => i.replaceWith(rozet()));
  return i;
}

function ymKur(ogeler, seviye, konum) {
  ymKapat(seviye);
  const menu = document.createElement('div');
  menu.className = 'ym-menu';
  for (const o of ogeler) {
    if (o.tur === 'ayrac') {
      const ay = document.createElement('div');
      ay.className = 'ym-ayrac';
      menu.appendChild(ay);
      continue;
    }
    const oge = document.createElement('div');
    oge.className = 'ym-oge';
    const ad = document.createElement('span');
    ad.className = 'ym-baslik';
    if (o.tur === 'yerimi') {
      oge.title = o.baslik + '\n' + o.url;
      ad.textContent = o.baslik || o.url;
      oge.append(ymSimge(o), ad);
      oge.addEventListener('mouseenter', () => ymKapat(seviye + 1));
      oge.addEventListener('click', () => window.katman.yerimiGit(o.url, false));
      oge.addEventListener('auxclick', (e) => { if (e.button === 1) window.katman.yerimiGit(o.url, true); });
    } else if (o.tur === 'klasor') {
      const simge = document.createElement('span');
      simge.className = 'ym-klasor-simge';
      simge.innerHTML = SIMGE.klasor;
      ad.textContent = o.ad;
      oge.title = o.yol;
      const ok = document.createElement('span');
      ok.className = 'ym-ok';
      ok.innerHTML = '<svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg>';
      oge.append(simge, ad, ok);
      const ac = () => {
        for (const m of menu.querySelectorAll('.ym-oge.acik')) m.classList.remove('acik');
        oge.classList.add('acik');
        const r = oge.getBoundingClientRect();
        ymKur(o.alt, seviye + 1, (m) => {
          let sol = r.right - 2;
          if (sol + m.offsetWidth > window.innerWidth - 4) sol = Math.max(4, r.left - m.offsetWidth + 2);
          return { sol, ust: r.top - 5 };
        });
      };
      oge.addEventListener('mouseenter', ac);
      oge.addEventListener('click', ac);
    } else {
      const simge = document.createElement('span');
      simge.className = 'ym-klasor-simge';
      simge.innerHTML = SIMGE.klasor;
      ad.textContent = o.ad;
      oge.append(simge, ad);
      oge.addEventListener('mouseenter', () => ymKapat(seviye + 1));
      oge.addEventListener('click', () => window.katman.yerimiTumunuAc());
    }
    menu.appendChild(oge);
  }
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);
  const k = konum(menu);
  const sol = Math.max(4, Math.min(window.innerWidth - menu.offsetWidth - 4, k.sol));
  const ust = Math.max(4, k.ust);
  menu.style.left = sol + 'px';
  menu.style.top = ust + 'px';
  menu.style.maxHeight = Math.max(120, window.innerHeight - ust - 8) + 'px';
  menu.style.visibility = '';
  ymMenuler.push(menu);
}

function yerimiCiz(v) {
  kutu.style.display = 'none';
  ymMenuler = [];
  ymKur(v.ogeler, 0, (m) => ({
    sol: v.sagaHizala ? v.sag - m.offsetWidth : v.sol,
    ust: v.ust
  }));
}

/* ---------------- yer imi ekle/düzenle kutusu ---------------- */

// Dışarı tıklayınca kayıt yapıp kapatmak için; null ise düz kapatma.
let kapatinca = null;

function yerimiPopCiz(v) {
  const m = v.metin;
  const d = { ad: v.baslik, url: v.url, klasor: v.klasor, yeni: [] };
  const kaydet = () => window.katman.yerimiKaydet({
    url: v.url, yeniUrl: d.url, ad: d.ad.trim() || v.baslik || v.url, klasor: d.klasor
  });
  kapatinca = kaydet;
  const bitir = () => { kapatinca = null; kaydet(); };
  const yeniKlasorEtiketi = m.yeniKlasor.replace(/^\+\s*/, '').replace(/…$/, '');

  function dugme(sinif, metin, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ypk-dugme ' + sinif;
    b.textContent = metin;
    b.addEventListener('click', fn);
    return b;
  }
  function satir(etiket, kontrol) {
    const r = document.createElement('div');
    r.className = 'ypk-satir';
    const e = document.createElement('label');
    e.className = 'ypk-etiket';
    e.textContent = etiket;
    r.append(e, kontrol);
    return r;
  }
  function girdi(deger, alan) {
    const g = document.createElement('input');
    g.type = 'text';
    g.className = 'ypk-girdi';
    g.value = deger;
    g.addEventListener('input', () => { d[alan] = g.value; });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') bitir(); });
    return g;
  }

  /* ---- küçük görünüm: ad + klasör listesi ---- */
  function kucuk() {
    kutu.replaceChildren();
    kutu.style.setProperty('--kutu-genislik', '440px');
    const kap = document.createElement('div');
    kap.className = 'ypk ypk-kucuk';

    const onizleme = document.createElement('div');
    onizleme.className = 'ypk-onizleme';
    if (v.favicon) {
      const i = document.createElement('img');
      i.alt = '';
      i.src = v.favicon;
      i.addEventListener('error', () => { i.replaceWith(yildiz()); });
      onizleme.appendChild(i);
    } else {
      onizleme.appendChild(yildiz());
    }

    const sag = document.createElement('div');
    sag.className = 'ypk-sag';
    const ust = document.createElement('div');
    ust.className = 'ypk-ust';
    const bas = document.createElement('div');
    bas.className = 'ypk-baslik';
    bas.textContent = m.baslik;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'ikon kucuk';
    x.title = m.kapat;
    x.innerHTML = SIMGE.kapat;
    x.addEventListener('click', bitir);
    ust.append(bas, x);

    const adG = girdi(d.ad, 'ad');
    const sec = document.createElement('select');
    sec.className = 'ypk-girdi ypk-secim';
    const yollar = ['', ...v.klasorler];
    if (d.klasor && !yollar.includes(d.klasor)) yollar.push(d.klasor);
    for (const k of yollar) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k || m.cubuk;
      if (k === d.klasor) o.selected = true;
      sec.appendChild(o);
    }
    const diger = document.createElement('option');
    diger.value = '__DIGER__';
    diger.textContent = m.baskaKlasor;
    sec.appendChild(diger);
    sec.addEventListener('change', () => {
      if (sec.value === '__DIGER__') { agac(); return; }
      d.klasor = sec.value;
    });

    const dugmeler = document.createElement('div');
    dugmeler.className = 'ypk-dugmeler';
    dugmeler.append(
      dugme('birincil', m.bitti, bitir),
      dugme('ikincil', m.kaldir, () => { kapatinca = null; window.katman.yerimiKaldir(v.url); })
    );
    sag.append(ust, satir(m.ad, adG), satir(m.klasor, sec), dugmeler);
    kap.append(onizleme, sag);
    kutu.appendChild(kap);
    requestAnimationFrame(() => { adG.focus(); adG.select(); });
  }

  function yildiz() {
    const s = document.createElement('span');
    s.className = 'ypk-yildiz';
    s.textContent = '★';
    return s;
  }

  /* ---- ağaç görünümü: ad + URL + klasör seç ---- */
  let yeniGirdiAcik = false;
  const acik = new Set();
  function atalariAc(yol) {
    const p = yol.split('/');
    for (let i = 1; i < p.length; i++) acik.add(p.slice(0, i).join('/'));
  }

  function agac() {
    kutu.replaceChildren();
    kutu.style.setProperty('--kutu-genislik', '460px');
    atalariAc(d.klasor);
    const kap = document.createElement('div');
    kap.className = 'ypk ypk-agac';
    const bas = document.createElement('div');
    bas.className = 'ypk-baslik';
    bas.textContent = m.duzenleBaslik;

    const adG = girdi(d.ad, 'ad');
    const urlG = girdi(d.url, 'url');

    const kutuAgac = document.createElement('div');
    kutuAgac.className = 'ypk-agac-kutu';
    kutuAgac.tabIndex = 0;

    const yollar = new Set([...v.klasorler, ...d.yeni]);
    const kok = { alt: new Map() };
    for (const y of yollar) {
      let n = kok;
      for (const seg of y.split('/').filter(Boolean)) {
        if (!n.alt.has(seg)) n.alt.set(seg, { alt: new Map() });
        n = n.alt.get(seg);
      }
    }

    function dugumSatiri(etiket, yol, derinlik, dugum) {
      const r = document.createElement('div');
      r.className = 'ypk-dugum' + (d.klasor === yol ? ' secili' : '');
      r.style.paddingLeft = (8 + derinlik * 18) + 'px';
      const ok = document.createElement('span');
      ok.className = 'ypk-ok' + (dugum && dugum.alt.size ? '' : ' bos');
      if (dugum && dugum.alt.size) {
        ok.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>';
        ok.classList.toggle('kapali', !acik.has(yol));
        ok.addEventListener('click', (e) => {
          e.stopPropagation();
          if (acik.has(yol)) acik.delete(yol); else acik.add(yol);
          agac();
        });
      }
      const si = document.createElement('span');
      si.className = 'ypk-dugum-simge';
      si.innerHTML = SIMGE.klasor;
      const ad = document.createElement('span');
      ad.className = 'ypk-dugum-ad';
      ad.textContent = etiket;
      r.append(ok, si, ad);
      r.addEventListener('click', () => { d.klasor = yol; yeniGirdiAcik = false; agac(); });
      return r;
    }

    function yeniGirdiSatiri(ustYol, derinlik) {
      const r = document.createElement('div');
      r.className = 'ypk-dugum';
      r.style.paddingLeft = (8 + derinlik * 18 + 18) + 'px';
      const g = document.createElement('input');
      g.type = 'text';
      g.className = 'ypk-girdi ypk-yeni-girdi';
      g.placeholder = m.klasorAdi;
      g.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          const ad = g.value.trim().split('/').join('-');
          if (ad) {
            const yol = ustYol ? ustYol + '/' + ad : ad;
            d.yeni.push(yol);
            d.klasor = yol;
            acik.add(ustYol);
          }
          yeniGirdiAcik = false;
          agac();
        } else if (e.key === 'Escape') {
          yeniGirdiAcik = false;
          agac();
        }
      });
      r.appendChild(g);
      requestAnimationFrame(() => g.focus());
      return r;
    }

    function ciz(n, onek, derinlik) {
      for (const [ad, c] of n.alt) {
        const yol = onek ? onek + '/' + ad : ad;
        kutuAgac.appendChild(dugumSatiri(ad, yol, derinlik, c));
        if (acik.has(yol)) ciz(c, yol, derinlik + 1);
        if (yeniGirdiAcik && d.klasor === yol) kutuAgac.appendChild(yeniGirdiSatiri(yol, derinlik + 1));
      }
    }
    kutuAgac.appendChild(dugumSatiri(m.cubuk, '', 0, null));
    if (yeniGirdiAcik && d.klasor === '') kutuAgac.appendChild(yeniGirdiSatiri('', 0));
    ciz(kok, '', 0);

    const dugmeler = document.createElement('div');
    dugmeler.className = 'ypk-dugmeler ypk-alt';
    const sol = dugme('anahat', yeniKlasorEtiketi, () => { yeniGirdiAcik = true; agac(); });
    const bosluk = document.createElement('span');
    bosluk.style.flex = '1';
    dugmeler.append(sol, bosluk,
      dugme('birincil', m.kaydet, bitir),
      dugme('ikincil', m.iptal, () => { kapatinca = null; window.katman.kapat(); })
    );

    kap.append(bas, satir(m.ad, adG), satir(m.url, urlG), kutuAgac, dugmeler);
    kutu.appendChild(kap);
  }

  kucuk();
}

/* ---------------- yönlendirme ---------------- */

window.katman.dinle((v) => {
  if (v.yenile && v.tur === 'indirmeler' && indirmeYamala(v)) return;
  bos();
  if (v.tur !== 'onay' && v.tur !== 'yenilikler') kutu.classList.add(v.yon === 'sol' ? 'sol' : 'sag');
  kutu.style.setProperty('--kutu-ust', v.ust + 'px');
  kutu.style.setProperty('--kutu-kenar', v.kenar + 'px');
  if (v.genislik) kutu.style.setProperty('--kutu-genislik', v.genislik + 'px');

  if (v.tur === 'indirmeler') indirmeleriCiz(v);
  else if (v.tur === 'izin') izinCiz(v);
  else if (v.tur === 'vpn') vpnCiz(v);
  else if (v.tur === 'onay') onayCiz(v);
  else if (v.tur === 'yenilikler') yenilikCiz(v);
  else if (v.tur === 'yerimi') yerimiCiz(v);
  else if (v.tur === 'yerimipop') yerimiPopCiz(v);
});

// Dışarı tıklama ve Escape kutuyu kapatır. İzin kutusunda bu "reddet"
// anlamına gelir; kararı ana süreç veriyor, biz yalnızca kapanışı bildiriyoruz.
ortu.addEventListener('mousedown', () => {
  if (kapatinca) { const k = kapatinca; kapatinca = null; k(); } else window.katman.kapat();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.katman.kapat();
});

window.katman.hazir();
