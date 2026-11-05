'use strict';

/**
 * Chromium eklenti desteği (kurulum, kaldırma, etkin/pasif, sabitleme).
 *
 * Dış bağımlılık yok: CRX2/CRX3 başlığı ve ZIP arşivi burada çözülüyor.
 * Eklentiler userData/eklentiler/<kimlik>/ altına açılıp Electron'un
 * session.extensions.loadExtension'ı ile yükleniyor. Hangi eklentilerin kurulu,
 * etkin ve sabit olduğu store'da (veri.eklentiler) tutuluyor.
 *
 * Güvenlik: arşiv açılırken yol kaçışı (zip-slip) engelleniyor, dosya sayısı ve
 * toplam boyut sınırlı; Web Store indirmesi yalnızca doğrulanmış 32 harflik
 * kimlikle yapılıyor. Kurulum her zaman kullanıcı onayından sonra yapılıyor
 * (bu onay main.js'te).
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const KIMLIK_RE = /^[a-p]{32}$/;
const MAX_CRX_BAYT = 200 * 1024 * 1024;
const MAX_DOSYA_SAYISI = 20000;
const MAX_ACILMIS_BAYT = 500 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Kimlik çözümleme                                                    */
/* ------------------------------------------------------------------ */

/**
 * Kimlik ya da Chrome Web Store adresi (yeni ve eski biçim) -> 32 harflik kimlik.
 * Tanınmayan girdide null.
 */
function magazaIdCoz(girdi) {
  const s = String(girdi || '').trim();
  if (KIMLIK_RE.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    const h = u.hostname.toLowerCase();
    if (h !== 'chromewebstore.google.com' && h !== 'chrome.google.com') return null;
    const parcalar = u.pathname.split('/').filter(Boolean);
    for (let i = parcalar.length - 1; i >= 0; i--) {
      if (KIMLIK_RE.test(parcalar[i])) return parcalar[i];
    }
  } catch { /* adres değil */ }
  return null;
}

function magazaIndirmeAdresi(kimlik, chromeSurumu) {
  const surum = String(chromeSurumu || '120.0.0.0').replace(/[^0-9.]/g, '') || '120.0.0.0';
  return 'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=' + surum
    + '&acceptformat=crx2,crx3&x=id%3D' + kimlik + '%26uc';
}

/* ------------------------------------------------------------------ */
/* Güncelleme denetimi (Chrome Web Store update2 protokolü)            */
/* ------------------------------------------------------------------ */

function guncellemeAdresi(kimlik, surum, chromeSurumu) {
  const v = String(chromeSurumu || '120.0.0.0').replace(/[^0-9.]/g, '') || '120.0.0.0';
  return 'https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=' + v
    + '&acceptformat=crx2,crx3&x=id%3D' + kimlik + '%26v%3D' + encodeURIComponent(String(surum || '0')) + '%26uc';
}

/** update2 XML yanıtından { durum, surum, codebase } çıkarır; yanıt anlaşılamazsa null. */
function guncellemeYaniti(xml) {
  const m = /<updatecheck\b([^>]*)\/?>/i.exec(String(xml || ''));
  if (!m) return null;
  const oz = (ad) => { const r = new RegExp('\\b' + ad + '="([^"]*)"', 'i').exec(m[1]); return r ? r[1] : ''; };
  return { durum: oz('status'), surum: oz('version'), codebase: oz('codebase') };
}

/** 1.2.10 > 1.2.9 gibi noktalı sürüm karşılaştırması: -1, 0, 1. */
function surumKarsilastir(a, b) {
  const x = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const y = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// Güncelleme dosyası yalnızca Google'ın kendi alan adlarından indirilir.
function guncellemeAdresiGuvenli(adres) {
  try {
    const u = new URL(adres);
    return u.protocol === 'https:' && /(^|\.)(google\.com|googleusercontent\.com|gvt1\.com|gstatic\.com)$/i.test(u.hostname);
  } catch { return false; }
}

// Yeni sürüm eskisinden FAZLA izin ya da site erişimi istiyor mu?
function izinArtti(eskiManifest, yeniOzet) {
  const eski = izinOzeti(eskiManifest);
  return yeniOzet.izinler.some((p) => !eski.izinler.includes(p))
    || yeniOzet.siteler.some((s) => !eski.siteler.includes(s));
}

function dizinBoyutu(dizin, sinir = 20000) {
  let toplam = 0, sayi = 0;
  const yigin = [dizin];
  while (yigin.length && sayi < sinir) {
    const d = yigin.pop();
    let girdiler;
    try { girdiler = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const g of girdiler) {
      sayi++;
      const yol = path.join(d, g.name);
      if (g.isDirectory()) yigin.push(yol);
      else { try { toplam += fs.statSync(yol).size; } catch { /* okunamadı */ } }
    }
  }
  return toplam;
}

function kimlikDizesi(ozet16) {
  let s = '';
  for (const b of ozet16) s += String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15));
  return s;
}

function acikAnahtardanKimlik(anahtarDer) {
  return kimlikDizesi(crypto.createHash('sha256').update(anahtarDer).digest().subarray(0, 16));
}

/* ------------------------------------------------------------------ */
/* CRX                                                                 */
/* ------------------------------------------------------------------ */

function protoAlanlari(buf) {
  const cikti = [];
  let i = 0;
  const varint = () => {
    let n = 0, carpan = 1, b;
    do {
      if (i >= buf.length) throw new Error('bozuk başlık');
      b = buf[i++];
      n += (b & 0x7f) * carpan;
      carpan *= 128;
    } while (b & 0x80);
    return n;
  };
  while (i < buf.length) {
    const etiket = varint();
    const alan = Math.floor(etiket / 8);
    const tur = etiket % 8;
    if (tur === 2) {
      const uzun = varint();
      if (i + uzun > buf.length) throw new Error('bozuk başlık');
      cikti.push({ alan, deger: buf.subarray(i, i + uzun) });
      i += uzun;
    } else if (tur === 0) {
      varint();
    } else if (tur === 1) {
      i += 8;
    } else if (tur === 5) {
      i += 4;
    } else {
      throw new Error('bozuk başlık');
    }
  }
  return cikti;
}

/**
 * CRX2/CRX3 arşivinden ZIP gövdesini ve (varsa) genel anahtarı çıkarır.
 * Düz ZIP (PK..) de kabul edilir. Anahtar, manifest'e 'key' olarak yazılırsa
 * eklenti Chrome'daki kimliğini korur (kimliğe bağlı eklentiler bozulmaz).
 */
function crxCoz(tampon) {
  if (!Buffer.isBuffer(tampon) || tampon.length < 4) throw new Error('Geçersiz dosya');
  if (tampon[0] === 0x50 && tampon[1] === 0x4b) return { zip: tampon, anahtar: null };
  if (tampon.subarray(0, 4).toString('latin1') !== 'Cr24') throw new Error('Geçersiz CRX dosyası');
  const surum = tampon.readUInt32LE(4);
  if (surum === 2) {
    const anahtarUzun = tampon.readUInt32LE(8);
    const imzaUzun = tampon.readUInt32LE(12);
    const bas = 16 + anahtarUzun + imzaUzun;
    if (bas > tampon.length) throw new Error('Bozuk CRX');
    return { zip: tampon.subarray(bas), anahtar: tampon.subarray(16, 16 + anahtarUzun) };
  }
  if (surum === 3) {
    const baslikUzun = tampon.readUInt32LE(8);
    const bas = 12 + baslikUzun;
    if (bas > tampon.length) throw new Error('Bozuk CRX');
    const alanlar = protoAlanlari(tampon.subarray(12, bas));
    let crxId = null;
    const adaylar = [];
    for (const a of alanlar) {
      if (a.alan === 10000) {
        const ic = protoAlanlari(a.deger).find((x) => x.alan === 1);
        if (ic) crxId = kimlikDizesi(ic.deger.subarray(0, 16));
      } else if (a.alan === 2 || a.alan === 3) {
        const anahtar = protoAlanlari(a.deger).find((x) => x.alan === 1);
        if (anahtar) adaylar.push(anahtar.deger);
      }
    }
    const secilen = adaylar.find((k) => acikAnahtardanKimlik(k) === crxId) || adaylar[0] || null;
    return { zip: tampon.subarray(bas), anahtar: secilen };
  }
  throw new Error('Desteklenmeyen CRX sürümü: ' + surum);
}

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

function zipGirdileri(zip) {
  let eocd = -1;
  const alt = Math.max(0, zip.length - 22 - 65535);
  for (let i = zip.length - 22; i >= alt; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Geçersiz ZIP');
  const sayi = zip.readUInt16LE(eocd + 10);
  let konum = zip.readUInt32LE(eocd + 16);
  if (sayi > MAX_DOSYA_SAYISI) throw new Error('Arşivde çok fazla dosya var');
  const girdiler = [];
  for (let n = 0; n < sayi; n++) {
    if (konum + 46 > zip.length || zip.readUInt32LE(konum) !== 0x02014b50) throw new Error('Bozuk ZIP');
    const yontem = zip.readUInt16LE(konum + 10);
    const sikisik = zip.readUInt32LE(konum + 20);
    const acilmis = zip.readUInt32LE(konum + 24);
    const adUzun = zip.readUInt16LE(konum + 28);
    const ekUzun = zip.readUInt16LE(konum + 30);
    const yorumUzun = zip.readUInt16LE(konum + 32);
    const yerelKonum = zip.readUInt32LE(konum + 42);
    const ad = zip.toString('utf8', konum + 46, konum + 46 + adUzun);
    girdiler.push({ ad, yontem, sikisik, acilmis, yerelKonum });
    konum += 46 + adUzun + ekUzun + yorumUzun;
  }
  return girdiler;
}

/**
 * ZIP'i hedef dizine açar. Dizin dışına çıkan, mutlak ya da '..' içeren adlar
 * reddedilir; '_metadata/' (Chrome'un doğrulama dosyaları, Electron yüklemeyi
 * reddediyor) atlanır.
 */
function zipAc(zip, hedefDizin) {
  const girdiler = zipGirdileri(zip);
  const kok = path.resolve(hedefDizin);
  let toplam = 0;
  fs.mkdirSync(kok, { recursive: true });

  for (const g of girdiler) {
    const ad = g.ad.replace(/\\/g, '/');
    if (!ad || ad.endsWith('/')) continue;
    if (ad.startsWith('/') || /^[a-zA-Z]:/.test(ad) || ad.split('/').includes('..')) {
      throw new Error('Güvensiz dosya yolu: ' + g.ad);
    }
    if (ad.split('/')[0] === '_metadata') continue;

    const hedef = path.resolve(kok, ad);
    if (hedef !== kok && !hedef.startsWith(kok + path.sep)) throw new Error('Güvensiz dosya yolu: ' + g.ad);

    if (zip.readUInt32LE(g.yerelKonum) !== 0x04034b50) throw new Error('Bozuk ZIP');
    const adUzun = zip.readUInt16LE(g.yerelKonum + 26);
    const ekUzun = zip.readUInt16LE(g.yerelKonum + 28);
    const veriBas = g.yerelKonum + 30 + adUzun + ekUzun;
    const ham = zip.subarray(veriBas, veriBas + g.sikisik);
    let veri;
    if (g.yontem === 0) veri = ham;
    else if (g.yontem === 8) veri = zlib.inflateRawSync(ham, { maxOutputLength: MAX_ACILMIS_BAYT });
    else throw new Error('Desteklenmeyen sıkıştırma yöntemi');

    toplam += veri.length;
    if (toplam > MAX_ACILMIS_BAYT) throw new Error('Arşiv çok büyük');
    fs.mkdirSync(path.dirname(hedef), { recursive: true });
    fs.writeFileSync(hedef, veri);
  }
}

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

function manifestOku(dizin) {
  const ham = fs.readFileSync(path.join(dizin, 'manifest.json'), 'utf8').replace(/^﻿/, '');
  return JSON.parse(ham);
}

// "__MSG_ad__" gibi yerelleştirilmiş metni _locales'tan çözer.
function mesajCoz(metin, dizin, manifest, dil) {
  const m = /^__MSG_([A-Za-z0-9_@]+)__$/.exec(String(metin || ''));
  if (!m) return String(metin || '');
  const adaylar = [];
  if (dil) adaylar.push(dil, String(dil).split('-')[0]);
  if (manifest && manifest.default_locale) adaylar.push(manifest.default_locale);
  adaylar.push('en');
  for (const a of adaylar) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dizin, '_locales', a, 'messages.json'), 'utf8').replace(/^﻿/, ''));
      const anahtar = Object.keys(j).find((k) => k.toLowerCase() === m[1].toLowerCase());
      if (anahtar && j[anahtar] && j[anahtar].message) return String(j[anahtar].message);
    } catch { /* sıradaki dil */ }
  }
  return String(metin);
}

function simgeYollari(manifest) {
  const liste = [];
  const ekle = (o) => {
    if (!o) return;
    if (typeof o === 'string') liste.push({ boyut: 48, yol: o });
    else if (typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'string') liste.push({ boyut: Number(k) || 48, yol: v });
  };
  ekle(manifest.icons);
  const eylem = manifest.action || manifest.browser_action || manifest.page_action;
  if (eylem) ekle(eylem.default_icon);
  return liste;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Araç çubuğu için ~32px'e en yakın simge, data URL olarak. Yoksa null.
function simgeVeriUrl(dizin, manifest, hedef = 32) {
  const adaylar = simgeYollari(manifest).sort((a, b) => Math.abs(a.boyut - hedef) - Math.abs(b.boyut - hedef));
  const kok = path.resolve(dizin);
  for (const a of adaylar) {
    try {
      const dosya = path.resolve(kok, a.yol.replace(/^\/+/, ''));
      if (!dosya.startsWith(kok + path.sep)) continue;
      const mime = MIME[path.extname(dosya).toLowerCase()];
      if (!mime) continue;
      const veri = fs.readFileSync(dosya);
      if (veri.length > 512 * 1024) continue;
      return 'data:' + mime + ';base64,' + veri.toString('base64');
    } catch { /* sıradaki simge */ }
  }
  return null;
}

function eylemBilgisi(manifest) {
  const e = manifest.action || manifest.browser_action || manifest.page_action || null;
  return {
    popup: e && typeof e.default_popup === 'string' ? e.default_popup.replace(/^\/+/, '') : null,
    baslik: e && typeof e.default_title === 'string' ? e.default_title : ''
  };
}

function secenekSayfasi(manifest) {
  const s = (manifest.options_ui && manifest.options_ui.page) || manifest.options_page || null;
  return typeof s === 'string' ? s.replace(/^\/+/, '') : null;
}

// Kullanıcıya gösterilecek izin özeti (teknik adlar, olduğu gibi).
function izinOzeti(manifest) {
  const kume = new Set();
  for (const p of manifest.permissions || []) {
    if (typeof p === 'string') kume.add(p);
  }
  const siteler = new Set();
  for (const h of [].concat(manifest.host_permissions || [])) if (typeof h === 'string') siteler.add(h);
  for (const p of manifest.permissions || []) if (typeof p === 'string' && /^(\*|https?:|file:)/.test(p)) { kume.delete(p); siteler.add(p); }
  for (const c of manifest.content_scripts || []) for (const m of (c.matches || [])) siteler.add(m);
  return { izinler: [...kume], siteler: [...siteler] };
}

/* ------------------------------------------------------------------ */
/* Yönetici                                                            */
/* ------------------------------------------------------------------ */

class EklentiYoneticisi {
  /**
   * @param {object} o
   * @param {Electron.Session} o.ses    eklentilerin yükleneceği KALICI oturum
   * @param {object} o.store            veri.eklentiler nesnesini tutan Store
   * @param {string} o.dizin            kurulum kökü (userData/eklentiler)
   * @param {Function} o.indir          (url) => Promise<Buffer>
   * @param {string} [o.chromeSurumu]
   */
  constructor({ ses, store, dizin, indir, chromeSurumu, dil }) {
    this.ses = ses;
    this.store = store;
    this.dizin = dizin;
    this.indir = indir;
    this.chromeSurumu = chromeSurumu;
    this.dil = dil || 'en';
    this.surum = 0;                 // arayüze "liste değişti" demek için
    this.hatalar = new Map();       // kimlik -> son yükleme hatası
  }

  get kayitlar() {
    if (!this.store.veri.eklentiler || typeof this.store.veri.eklentiler !== 'object' || Array.isArray(this.store.veri.eklentiler)) {
      this.store.veri.eklentiler = {};
    }
    return this.store.veri.eklentiler;
  }

  _degisti() { this.surum++; this.store.kaydet(); }

  dizinOf(kimlik) { return path.join(this.dizin, kimlik); }

  async baslat() {
    for (const [kimlik, k] of Object.entries(this.kayitlar)) {
      if (!k || !KIMLIK_RE.test(kimlik)) { delete this.kayitlar[kimlik]; continue; }
      if (!fs.existsSync(k.yol || this.dizinOf(kimlik))) { delete this.kayitlar[kimlik]; continue; }
      if (k.etkin !== false) await this._yukle(kimlik).catch(() => {});
    }
  }

  async _yukle(kimlik) {
    const k = this.kayitlar[kimlik];
    try {
      const ext = await this.ses.extensions.loadExtension(k.yol, { allowFileAccess: !!k.dosyaErisimi });
      this.hatalar.delete(kimlik);
      if (ext && ext.id !== kimlik) {
        // Anahtarsız (paketlenmemiş) eklentide kimlik yoldan türer; kaydı gerçeğe taşı.
        this.kayitlar[ext.id] = { ...k };
        delete this.kayitlar[kimlik];
        return ext;
      }
      return ext;
    } catch (e) {
      this.hatalar.set(kimlik, e.message);
      throw e;
    }
  }

  /**
   * Kuruluma hazırlar ama YÜKLEMEZ: arşivi geçici dizine açar, manifest'i
   * okur. Kullanıcı onaylarsa kurulumuTamamla çağrılır, vazgeçerse iptal.
   */
  async hazirlaMagaza(kimlik) {
    if (!KIMLIK_RE.test(kimlik)) throw new Error('Geçersiz eklenti kimliği');
    const tampon = await this.indir(magazaIndirmeAdresi(kimlik, this.chromeSurumu));
    if (tampon.length > MAX_CRX_BAYT) throw new Error('Dosya çok büyük');
    return this._hazirla(tampon, kimlik);
  }

  hazirlaDosya(dosyaYolu) {
    const stat = fs.statSync(dosyaYolu);
    if (stat.isDirectory()) return this._hazirlaDizin(dosyaYolu);
    if (stat.size > MAX_CRX_BAYT) throw new Error('Dosya çok büyük');
    return this._hazirla(fs.readFileSync(dosyaYolu), null);
  }

  _hazirla(tampon, beklenenKimlik) {
    const { zip, anahtar } = crxCoz(tampon);
    const gecici = path.join(this.dizin, '.kur-' + crypto.randomBytes(6).toString('hex'));
    try {
      zipAc(zip, gecici);
      const manifest = manifestOku(gecici);
      if (!manifest || typeof manifest !== 'object' || !manifest.name || !manifest.version) {
        throw new Error('Geçersiz manifest');
      }
      let kimlik = beklenenKimlik;
      if (anahtar) {
        const turetilen = acikAnahtardanKimlik(anahtar);
        if (beklenenKimlik && turetilen !== beklenenKimlik) throw new Error('Eklenti kimliği eşleşmiyor');
        kimlik = turetilen;
        if (!manifest.key) {
          manifest.key = anahtar.toString('base64');
          fs.writeFileSync(path.join(gecici, 'manifest.json'), JSON.stringify(manifest, null, 2));
        }
      }
      return this._ozet(gecici, manifest, kimlik);
    } catch (e) {
      fs.rmSync(gecici, { recursive: true, force: true });
      throw e;
    }
  }

  _hazirlaDizin(kaynak) {
    const manifest = manifestOku(kaynak);
    if (!manifest || !manifest.name || !manifest.version) throw new Error('Geçersiz manifest');
    // Kullanıcının klasörünü yerinde bırakıyoruz (geliştirici akışı: değişiklikler yansır).
    return { ...this._ozet(kaynak, manifest, null), yerinde: true };
  }

  _ozet(dizin, manifest, kimlik) {
    const { izinler, siteler } = izinOzeti(manifest);
    return {
      gecici: dizin,
      kimlik,
      ad: mesajCoz(manifest.name, dizin, manifest, this.dil),
      surum: String(manifest.version),
      aciklama: mesajCoz(manifest.description || '', dizin, manifest, this.dil),
      manifestSurumu: manifest.manifest_version,
      izinler,
      siteler
    };
  }

  iptal(hazir) {
    if (hazir && hazir.gecici && !hazir.yerinde) fs.rmSync(hazir.gecici, { recursive: true, force: true });
  }

  async tamamla(hazir, kaynak) {
    let hedef;
    // Zaten kuruluysa (güncelleme/yeniden kurulum): önce boşalt, sabit/etkin tercihini koru.
    const onceki = hazir.kimlik ? this.kayitlar[hazir.kimlik] : null;
    if (onceki) {
      try { this.ses.extensions.removeExtension(hazir.kimlik); } catch { /* yüklü değildi */ }
    }
    if (hazir.yerinde) {
      hedef = hazir.gecici;
    } else {
      const kimlik = hazir.kimlik || ('x' + crypto.randomBytes(8).toString('hex'));
      hedef = this.dizinOf(kimlik);
      fs.rmSync(hedef, { recursive: true, force: true });
      fs.renameSync(hazir.gecici, hedef);
    }

    let ext;
    const gecicKimlik = hazir.kimlik || 'gecici';
    const pasifti = !!onceki && onceki.etkin === false;
    this.kayitlar[gecicKimlik] = {
      yol: hedef, etkin: !pasifti, sabit: onceki ? !!onceki.sabit : true, kaynak,
      ...(onceki && onceki.verilen ? { verilen: onceki.verilen } : {}),
      ...(onceki && onceki.dosyaErisimi ? { dosyaErisimi: true } : {})
    };
    try {
      // Pasif bir eklentinin güncellemesi onu yeniden etkinleştirmez.
      if (!pasifti) ext = await this._yukle(gecicKimlik);
    } catch (e) {
      delete this.kayitlar[gecicKimlik];
      if (!hazir.yerinde) fs.rmSync(hedef, { recursive: true, force: true });
      throw e;
    }
    const kimlik = ext ? ext.id : gecicKimlik;
    if (!this.kayitlar[kimlik]) this.kayitlar[kimlik] = this.kayitlar[gecicKimlik];
    if (kimlik !== gecicKimlik) delete this.kayitlar[gecicKimlik];
    this._degisti();
    return kimlik;
  }

  async kaldir(kimlik) {
    const k = this.kayitlar[kimlik];
    if (!k) return false;
    try { this.ses.extensions.removeExtension(kimlik); } catch { /* yüklü değildi */ }
    delete this.kayitlar[kimlik];
    this.hatalar.delete(kimlik);
    if (typeof this.kaldirildi === 'function') { try { this.kaldirildi(kimlik); } catch { /* kanca hatası */ } }
    // Yalnızca BİZİM kurduğumuz kopyayı sil; kullanıcının "paketlenmemiş" klasörüne dokunma.
    const bizimki = path.resolve(k.yol).startsWith(path.resolve(this.dizin) + path.sep);
    if (bizimki) fs.rmSync(k.yol, { recursive: true, force: true });
    this._degisti();
    return true;
  }

  async etkinYap(kimlik, etkin) {
    const k = this.kayitlar[kimlik];
    if (!k) return false;
    if (etkin) {
      k.etkin = true;
      try { await this._yukle(kimlik); } catch (e) { k.etkin = false; this._degisti(); throw e; }
    } else {
      k.etkin = false;
      try { this.ses.extensions.removeExtension(kimlik); } catch { /* zaten yok */ }
      if (typeof this.kaldirildi === 'function') { try { this.kaldirildi(kimlik); } catch { /* kanca hatası */ } }
    }
    this._degisti();
    return true;
  }

  /** Dosya URL'lerine erişim (allowFileAccess): kalıcı kaydedilir, etkinse yeniden yüklenir. */
  async dosyaErisimi(kimlik, acik) {
    const k = this.kayitlar[kimlik];
    if (!k) return false;
    k.dosyaErisimi = !!acik;
    if (k.etkin !== false) {
      try { this.ses.extensions.removeExtension(kimlik); } catch { /* yüklü değildi */ }
      await this._yukle(kimlik);
    }
    this._degisti();
    return true;
  }

  /** Ayrıntılar sayfası için ağır alanlar: disk boyutu, izin ve site listeleri. */
  detay(kimlik) {
    const k = this.kayitlar[kimlik];
    if (!k) return null;
    let manifest = null;
    try { manifest = manifestOku(k.yol); } catch { return null; }
    return {
      id: kimlik,
      boyut: dizinBoyutu(k.yol),
      kaynak: k.kaynak || 'dosya',
      dosyaErisimi: !!k.dosyaErisimi,
      isci: !!(manifest.background && (manifest.background.service_worker || manifest.background.scripts || manifest.background.page)),
      isciTuru: manifest.background && manifest.background.service_worker ? 'hizmet' : 'arka',
      magazaUrl: (k.kaynak === 'magaza' && KIMLIK_RE.test(kimlik)) ? 'https://chromewebstore.google.com/detail/' + kimlik : null,
      ...izinOzeti(manifest),
      verilen: this.verilenIzinler(kimlik)
    };
  }

  /**
   * Web Store'dan kurulu eklentilerin güncellemelerini denetler. İzin artırmayan güncellemeler
   * (Chrome gibi) sessizce kurulur; yeni izin isteyenler kullanıcı onayı için döner.
   * @returns {{guncellenen:object[], onayGereken:object[], guncel:number, hata:number}}
   */
  async guncellemeKontrol() {
    const sonuc = { guncellenen: [], onayGereken: [], guncel: 0, hata: 0 };
    for (const [kimlik, k] of Object.entries(this.kayitlar)) {
      if (!k || k.kaynak !== 'magaza' || !KIMLIK_RE.test(kimlik)) continue;
      try {
        const manifest = manifestOku(k.yol);
        const xml = (await this.indir(guncellemeAdresi(kimlik, manifest.version, this.chromeSurumu))).toString('utf8');
        const y = guncellemeYaniti(xml);
        if (!y || y.durum !== 'ok' || !y.codebase || surumKarsilastir(y.surum, manifest.version) <= 0) { sonuc.guncel++; continue; }
        if (!guncellemeAdresiGuvenli(y.codebase)) throw new Error('Güvensiz güncelleme adresi');
        const tampon = await this.indir(y.codebase);
        if (tampon.length > MAX_CRX_BAYT) throw new Error('Dosya çok büyük');
        const hazir = this._hazirla(tampon, kimlik);
        const bilgi = { id: kimlik, ad: hazir.ad, eski: String(manifest.version), yeni: hazir.surum };
        if (izinArtti(manifest, hazir)) {
          sonuc.onayGereken.push({ ...bilgi, hazir });
        } else {
          await this.tamamla(hazir, 'magaza');
          sonuc.guncellenen.push(bilgi);
        }
      } catch {
        sonuc.hata++;
      }
    }
    return sonuc;
  }

  sabitle(kimlik, sabit) {
    const k = this.kayitlar[kimlik];
    if (!k) return false;
    k.sabit = !!sabit;
    this._degisti();
    return true;
  }

  kurulu(kimlik) { return !!this.kayitlar[kimlik]; }

  /**
   * Etkin eklentinin manifest'i (izin denetimi için); pasif ya da bilinmiyorsa null.
   * Kullanıcının sonradan onayladığı isteğe bağlı izinler (chrome.permissions.request)
   * permissions / host_permissions listelerine eklenmiş olarak döner.
   */
  etkinManifest(kimlik) {
    const k = this.kayitlar[kimlik];
    if (!k || k.etkin === false) return null;
    let m;
    try { m = manifestOku(k.yol); } catch { return null; }
    const v = k.verilen;
    if (v) {
      m.permissions = [...new Set([...(m.permissions || []), ...(v.permissions || [])])];
      m.host_permissions = [...new Set([...(m.host_permissions || []), ...(v.origins || [])])];
    }
    return m;
  }

  /** Kullanıcının onayladığı isteğe bağlı izinler: { permissions: [], origins: [] }. */
  verilenIzinler(kimlik) {
    const v = this.kayitlar[kimlik] && this.kayitlar[kimlik].verilen;
    return { permissions: [...((v && v.permissions) || [])], origins: [...((v && v.origins) || [])] };
  }

  izinVer(kimlik, { permissions = [], origins = [] }) {
    const k = this.kayitlar[kimlik];
    if (!k) return false;
    const v = k.verilen || (k.verilen = { permissions: [], origins: [] });
    v.permissions = [...new Set([...v.permissions, ...permissions])];
    v.origins = [...new Set([...v.origins, ...origins])];
    this._degisti();
    return true;
  }

  izinKaldir(kimlik, { permissions = [], origins = [] }) {
    const k = this.kayitlar[kimlik];
    if (!k || !k.verilen) return false;
    k.verilen.permissions = k.verilen.permissions.filter((p) => !permissions.includes(p));
    k.verilen.origins = k.verilen.origins.filter((o) => !origins.includes(o));
    this._degisti();
    return true;
  }

  etkinKimlikler() {
    return Object.keys(this.kayitlar).filter((id) => this.kayitlar[id] && this.kayitlar[id].etkin !== false);
  }

  /** Arayüz için düz liste. simge: araç çubuğuna uygun data URL ya da null. */
  liste({ simge = true } = {}) {
    const cikti = [];
    for (const [kimlik, k] of Object.entries(this.kayitlar)) {
      let manifest = null;
      try { manifest = manifestOku(k.yol); } catch { /* bozulmuş kayıt */ }
      if (!manifest) continue;
      const eylem = eylemBilgisi(manifest);
      cikti.push({
        id: kimlik,
        ad: mesajCoz(manifest.name, k.yol, manifest, this.dil),
        surum: String(manifest.version || ''),
        aciklama: mesajCoz(manifest.description || '', k.yol, manifest, this.dil),
        etkin: k.etkin !== false,
        sabit: !!k.sabit,
        kaynak: k.kaynak || 'dosya',
        isci: !!(manifest.background && manifest.background.service_worker),
        popup: eylem.popup,
        secenekler: secenekSayfasi(manifest),
        simge: simge ? simgeVeriUrl(k.yol, manifest) : null,
        hata: this.hatalar.get(kimlik) || null,
        ...izinOzeti(manifest)
      });
    }
    return cikti.sort((a, b) => a.ad.localeCompare(b.ad));
  }
}

module.exports = {
  KIMLIK_RE,
  magazaIdCoz,
  magazaIndirmeAdresi,
  guncellemeAdresi,
  guncellemeYaniti,
  surumKarsilastir,
  guncellemeAdresiGuvenli,
  izinArtti,
  dizinBoyutu,
  acikAnahtardanKimlik,
  crxCoz,
  zipAc,
  manifestOku,
  mesajCoz,
  simgeVeriUrl,
  eylemBilgisi,
  secenekSayfasi,
  izinOzeti,
  EklentiYoneticisi
};
