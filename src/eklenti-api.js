'use strict';

/**
 * Eklentiler için chrome.cookies ve chrome.downloads (Electron bunları uygulamıyor).
 *
 * Eklentinin bağlamı (servis çalışanı ya da sayfa) önyükleme betiği üzerinden buraya
 * çağrı yollar; çağıran HER ZAMAN gönderen bağlamın adresinden (chrome-extension://<kimlik>)
 * çıkarılır, istek içindeki bir kimliğe güvenilmez. İzin denetimi burada, ana süreçte:
 *   - 'cookies' / 'downloads' izni manifest'te bildirilmiş olmalı,
 *   - çerezlere erişim için ilgili alan adına host izni gerekir (Chrome ile aynı kural).
 */

const KIMLIK_RE = /^[a-p]{32}$/;

/* ------------------------------------------------------------------ */
/* Eşleşme desenleri (match patterns)                                  */
/* ------------------------------------------------------------------ */

function globRe(yol) {
  return new RegExp('^' + yol.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
}

/** "https://*.ornek.com/yol/*" gibi bir desen bu adresle eşleşir mi? */
function urlEslesir(desen, adres) {
  let u;
  try { u = new URL(adres); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (desen === '<all_urls>') return true;
  const m = /^(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/.exec(String(desen));
  if (!m) return false;
  const [, sema, host, yol] = m;
  if (sema !== '*' && sema + ':' !== u.protocol) return false;
  const h = u.hostname.toLowerCase();
  if (host !== '*') {
    const k = host.toLowerCase();
    if (k.startsWith('*.')) {
      const kok = k.slice(2);
      if (h !== kok && !h.endsWith('.' + kok)) return false;
    } else if (h !== k) {
      return false;
    }
  }
  return globRe(yol).test(u.pathname + u.search);
}

function hostDesenleri(manifest) {
  const kume = [];
  for (const h of manifest.host_permissions || []) if (typeof h === 'string') kume.push(h);
  for (const p of manifest.permissions || []) {
    if (typeof p === 'string' && (p === '<all_urls>' || /^(\*|https?):\/\//.test(p))) kume.push(p);
  }
  return kume;
}

// Desen a, desen b'nin kapsadığı her adresi kapsıyor mu? (chrome.permissions.contains için)
function desenKapsar(a, b) {
  if (a === b || a === '<all_urls>') return true;
  if (b === '<all_urls>') return false;
  const re = /^(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/;
  const ma = re.exec(String(a));
  const mb = re.exec(String(b));
  if (!ma || !mb) return false;
  if (ma[1] !== '*' && ma[1] !== mb[1]) return false;
  const ha = ma[2].toLowerCase();
  const hb = mb[2].toLowerCase();
  if (ha !== '*') {
    if (hb === '*') return false;
    if (ha.startsWith('*.')) {
      const kok = ha.slice(2);
      const hk = hb.startsWith('*.') ? hb.slice(2) : hb;
      if (hk !== kok && !hk.endsWith('.' + kok)) return false;
    } else if (ha !== hb) {
      return false;
    }
  }
  return ma[3] === '/*' || ma[3] === mb[3] || globRe(ma[3]).test(mb[3]);
}

const DESEN_RE = /^(<all_urls>|(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)\/.*)$/;

function hostIzni(manifest, adres) {
  return hostDesenleri(manifest).some((d) => urlEslesir(d, adres));
}

function izinVar(manifest, ad) {
  return Array.isArray(manifest.permissions) && manifest.permissions.includes(ad);
}

/* ------------------------------------------------------------------ */
/* Çerez dönüşümü                                                      */
/* ------------------------------------------------------------------ */

function cerezDonustur(c) {
  const o = {
    name: c.name,
    value: c.value,
    domain: c.domain,
    hostOnly: !!c.hostOnly,
    path: c.path || '/',
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: c.sameSite || 'unspecified',
    session: !!c.session,
    storeId: '0'
  };
  if (!c.session && c.expirationDate) o.expirationDate = c.expirationDate;
  return o;
}

// Çerezin alanı için "bu eklentinin erişebileceği bir adres" üretir.
function cerezAdresi(c) {
  const host = String(c.domain || '').replace(/^\./, '');
  return (c.secure ? 'https://' : 'http://') + host + (c.path || '/');
}

function adresDogrula(adres) {
  let u;
  try { u = new URL(String(adres)); } catch { throw new Error('Geçersiz url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Yalnızca http(s) adresleri desteklenir');
  return u.href;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

class EklentiApi {
  /**
   * @param {object} o
   * @param {Electron.Session} o.ses
   * @param {(kimlik:string)=>object|null} o.manifest  etkin eklentinin manifest'i, yoksa null
   * @param {(kimlik:string, ns:string, ad:string, veri:any)=>void} o.bildir  olay yayını
   * @param {object} [o.indirme]  indirme kancaları (main.js)
   * @param {object} [o.ekran]    { hazirla(kimlik) } sekme sesi yakalama (main.js)
   * @param {object} [o.kimlik]   { webAuth({url, interactive, redirectBase, kimlik}) } (main.js)
   * @param {object} [o.izinler]  { onayIste(kimlik, istek), ver(kimlik, istek), kaldir(kimlik, istek),
   *                               verilen(kimlik) } (main.js)
   */
  constructor({ ses, manifest, bildir, indirme, kimlik, izinler, ekran, baglam, bildirim, veri }) {
    this.veri = veri || null;
    this.bildirimHook = bildirim || null;
    this.baglam = baglam || null;
    this.ses = ses;
    this.manifest = manifest;
    this.bildir = bildir;
    this.indirme = indirme || null;
    this.kimlikHook = kimlik || null;
    this.ekranHook = ekran || null;
    this.izinHook = izinler || null;
    this._cerezDinleniyor = false;
    this._oturum = new Map();                   // kimlik -> Map<anahtar, değer>  (chrome.storage.session)
  }

  /** Çerez değişikliklerini ilgili eklentilere iletir (çerez izni + host izni olanlara). */
  cerezOlaylariniBaslat(kimlikler) {
    if (this._cerezDinleniyor) return;
    this._cerezDinleniyor = true;
    this.ses.cookies.on('changed', (_e, cerez, neden, silindi) => {
      for (const kimlik of kimlikler()) {
        const m = this.manifest(kimlik);
        if (!m || !izinVar(m, 'cookies') || !hostIzni(m, cerezAdresi(cerez))) continue;
        this.bildir(kimlik, 'cookies', 'onChanged', {
          removed: !!silindi,
          cookie: cerezDonustur(cerez),
          cause: String(neden || 'explicit').replace(/-/g, '_')
        });
      }
    });
  }

  async cagir(kimlik, ns, yontem, args) {
    if (!KIMLIK_RE.test(String(kimlik))) throw new Error('Eklenti bilinmiyor');
    const m = this.manifest(kimlik);
    if (!m) throw new Error('Eklenti etkin değil');
    args = Array.isArray(args) ? args : [];
    if (ns === 'cookies') {
      if (!izinVar(m, 'cookies')) throw new Error("'cookies' izni manifest'te bildirilmemiş");
      return this._cerez(m, String(yontem), args[0] || {});
    }
    if (ns === 'downloads') {
      if (!izinVar(m, 'downloads')) throw new Error("'downloads' izni manifest'te bildirilmemiş");
      if (!this.indirme) throw new Error('İndirme desteği yok');
      return this._indirme(kimlik, String(yontem), args);
    }
    if (ns === 'tabCapture') {
      if (!izinVar(m, 'tabCapture')) throw new Error("'tabCapture' izni manifest'te bildirilmemiş");
      return this._ekran(kimlik, String(yontem));
    }
    if (ns === 'storageSession') {
      if (!izinVar(m, 'storage')) throw new Error("'storage' izni manifest'te bildirilmemiş");
      return this._oturumDeposu(kimlik, String(yontem), args);
    }
    if (this.veri && this.veri.destekler(ns)) return this.veri.cagir(kimlik, m, String(ns), String(yontem), args);
    if (ns === 'contextMenus') {
      if (!izinVar(m, 'contextMenus')) throw new Error("'contextMenus' izni manifest'te bildirilmemiş");
      if (!this.baglam) throw new Error('Bağlam menüsü desteği yok');
      return this.baglam.cagir(kimlik, String(yontem), args);
    }
    if (ns === 'notifications') {
      if (!izinVar(m, 'notifications')) throw new Error("'notifications' izni manifest'te bildirilmemiş");
      const h = this.bildirimHook;
      if (!h) throw new Error('Bildirim desteği yok');
      const y = String(yontem);
      if (y === 'create' || y === 'update') {
        const id = typeof args[0] === 'string' && args[0] ? args[0] : 'cvs-' + Date.now().toString(36);
        const o = (typeof args[0] === 'string' ? args[1] : args[0]) || {};
        h.goster(kimlik, id, o);
        return y === 'create' ? id : true;
      }
      if (y === 'clear') return h.kapat(kimlik, String(args[0]));
      if (y === 'getAll') return {};
      throw new Error('chrome.notifications.' + y + ' desteklenmiyor');
    }
    if (ns === 'identity') return this._kimlik(kimlik, m, String(yontem), args);
    if (ns === 'permissions') return this._izinler(kimlik, m, String(yontem), args[0] || {});
    throw new Error('Desteklenmeyen API: ' + ns);
  }

  /* ---- storage.session (Electron uygulamıyor): bellekte, tarayıcı kapanınca silinir ---- */

  _oturumDeposu(kimlik, yontem, args) {
    let depo = this._oturum.get(kimlik);
    if (!depo) { depo = new Map(); this._oturum.set(kimlik, depo); }
    const KOTA = 10 * 1024 * 1024;
    const boyut = (k, v) => k.length + (v === undefined ? 0 : JSON.stringify(v).length);
    const toplam = () => { let n = 0; for (const [k, v] of depo) n += boyut(k, v); return n; };
    const anahtarlar = (a) => (a === null || a === undefined ? [...depo.keys()]
      : typeof a === 'string' ? [a]
        : Array.isArray(a) ? a.map(String)
          : typeof a === 'object' ? Object.keys(a) : []);
    const yayinla = (degisim) => { if (Object.keys(degisim).length) this.bildir(kimlik, 'storageSession', 'onChanged', degisim); };
    switch (yontem) {
      case 'get': {
        const a = args[0];
        const sonuc = {};
        for (const k of anahtarlar(a)) {
          if (depo.has(k)) sonuc[k] = depo.get(k);
          else if (a && typeof a === 'object' && !Array.isArray(a)) sonuc[k] = a[k];   // varsayılan değer
        }
        return sonuc;
      }
      case 'getKeys': return [...depo.keys()];
      case 'getBytesInUse': return anahtarlar(args[0]).reduce((n, k) => n + (depo.has(k) ? boyut(k, depo.get(k)) : 0), 0);
      case 'set': {
        const o = args[0] && typeof args[0] === 'object' ? args[0] : {};
        let yeni = toplam();
        const degisim = {};
        for (const [k, v] of Object.entries(o)) {
          yeni += boyut(k, v) - (depo.has(k) ? boyut(k, depo.get(k)) : 0);
        }
        if (yeni > KOTA) throw new Error('QUOTA_BYTES quota exceeded');
        for (const [k, v] of Object.entries(o)) {
          const eski = depo.get(k);
          degisim[k] = depo.has(k) ? { oldValue: eski, newValue: v } : { newValue: v };
          depo.set(k, v);
        }
        yayinla(degisim);
        return undefined;
      }
      case 'remove': {
        const degisim = {};
        for (const k of anahtarlar(args[0])) if (depo.has(k)) { degisim[k] = { oldValue: depo.get(k) }; depo.delete(k); }
        yayinla(degisim);
        return undefined;
      }
      case 'clear': {
        const degisim = {};
        for (const [k, v] of depo) degisim[k] = { oldValue: v };
        depo.clear();
        yayinla(degisim);
        return undefined;
      }
      case 'setAccessLevel': return undefined;
      default: throw new Error('chrome.storage.session.' + yontem + ' desteklenmiyor');
    }
  }

  /** Eklenti kaldırıldı / pasifleşti: oturum deposu silinir. */
  oturumTemizle(kimlik) { this._oturum.delete(kimlik); }

  /* ---- tabCapture (sekme sesi) ---- */

  async _ekran(kimlik, yontem) {
    switch (yontem) {
      case 'capture':
      case 'getMediaStreamId':
        // Akışı eklenti sayfası getDisplayMedia ile alır; burada yalnızca TEK KULLANIMLIK, kısa
        // ömürlü onay açılır (etkin sekme ve çağıran eklenti için).
        if (!this.ekranHook) throw new Error('Sekme yakalama yok');
        await this.ekranHook.hazirla(kimlik);
        return 'cvs-tab';
      case 'getCapturedTabs':
        return [];
      default:
        throw new Error('chrome.tabCapture.' + yontem + ' desteklenmiyor');
    }
  }

  /* ---- identity ---- */

  async _kimlik(kimlik, m, yontem, args) {
    switch (yontem) {
      case 'getRedirectURL':
        return 'https://' + kimlik + '.chromiumapp.org/' + String(args[0] || '').replace(/^\//, '');
      case 'getProfileUserInfo':
        // Tarayıcıda hesap oturumu yok: Chrome'un oturum açılmamışken verdiği boş yanıt.
        return { email: '', id: '' };
      case 'launchWebAuthFlow': {
        if (!izinVar(m, 'identity')) throw new Error("'identity' izni verilmemiş");
        const d = args[0] && typeof args[0] === 'object' ? args[0] : {};
        let u;
        try { u = new URL(String(d.url)); } catch { throw new Error('Geçersiz url'); }
        if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) {
          throw new Error('Yetkilendirme adresi https olmalı');
        }
        if (!this.kimlikHook) throw new Error('Yetkilendirme penceresi yok');
        return this.kimlikHook.webAuth({
          url: u.href,
          interactive: d.interactive === true,
          redirectBase: 'https://' + kimlik + '.chromiumapp.org/',
          kimlik
        });
      }
      default:
        throw new Error('chrome.identity.' + yontem + ' desteklenmiyor');
    }
  }

  /* ---- permissions (isteğe bağlı izinler) ---- */

  async _izinler(kimlik, m, yontem, f) {
    const h = this.izinHook;
    const istenen = {
      permissions: Array.isArray(f.permissions) ? f.permissions.filter((p) => typeof p === 'string') : [],
      origins: Array.isArray(f.origins) ? f.origins.filter((o) => typeof o === 'string') : []
    };
    for (const o of istenen.origins) if (!DESEN_RE.test(o)) throw new Error('Geçersiz izin deseni: ' + o);

    const etkinIzinler = (m.permissions || []).filter((p) => typeof p === 'string' && !/^(<all_urls>|(\*|https?):\/\/)/.test(p));
    const etkinOrijinler = hostDesenleri(m);
    const sahip = (i) => istenen.permissions.every((p) => etkinIzinler.includes(p))
      && istenen.origins.every((o) => etkinOrijinler.some((d) => desenKapsar(d, o)));

    switch (yontem) {
      case 'contains':
        return sahip();
      case 'getAll':
        return { permissions: [...new Set(etkinIzinler)], origins: [...new Set(etkinOrijinler)] };
      case 'request': {
        if (sahip()) return true;
        const secenekIzin = m.optional_permissions || [];
        const secenekHost = m.optional_host_permissions || [];
        const yeniIzin = istenen.permissions.filter((p) => !etkinIzinler.includes(p));
        const yeniOrijin = istenen.origins.filter((o) => !etkinOrijinler.some((d) => desenKapsar(d, o)));
        for (const p of yeniIzin) if (!secenekIzin.includes(p)) throw new Error("Yalnızca isteğe bağlı izinler istenebilir: " + p);
        for (const o of yeniOrijin) if (!secenekHost.some((d) => desenKapsar(d, o)) && !secenekIzin.some((d) => desenKapsar(d, o))) {
          throw new Error('Yalnızca isteğe bağlı host izinleri istenebilir: ' + o);
        }
        if (!h) throw new Error('İzin penceresi yok');
        const istek = { permissions: yeniIzin, origins: yeniOrijin };
        if (!(await h.onayIste(kimlik, istek))) return false;
        h.ver(kimlik, istek);
        this.bildir(kimlik, 'permissions', 'onAdded', istek);
        return true;
      }
      case 'remove': {
        if (!h) throw new Error('İzin yönetimi yok');
        const verilen = h.verilen(kimlik);
        const kaldirilacak = {
          permissions: istenen.permissions.filter((p) => verilen.permissions.includes(p)),
          origins: istenen.origins.filter((o) => verilen.origins.includes(o))
        };
        // Zorunlu (manifest'teki) izinler kaldırılamaz.
        if (istenen.permissions.some((p) => !kaldirilacak.permissions.includes(p) && (m.permissions || []).includes(p))
          && !istenen.permissions.every((p) => kaldirilacak.permissions.includes(p))) {
          throw new Error('Zorunlu izinler kaldırılamaz');
        }
        h.kaldir(kimlik, kaldirilacak);
        if (kaldirilacak.permissions.length || kaldirilacak.origins.length) this.bildir(kimlik, 'permissions', 'onRemoved', kaldirilacak);
        return true;
      }
      default:
        throw new Error('chrome.permissions.' + yontem + ' desteklenmiyor');
    }
  }

  /* ---- cookies ---- */

  async _cerezler(m, f) {
    const sorgu = {};
    if (f.url !== undefined) {
      const adres = adresDogrula(f.url);
      if (!hostIzni(m, adres)) throw new Error('Bu adres için host izni yok: ' + adres);
      sorgu.url = adres;
    }
    for (const k of ['name', 'domain', 'path']) if (typeof f[k] === 'string') sorgu[k] = f[k];
    if (typeof f.secure === 'boolean') sorgu.secure = f.secure;
    if (typeof f.session === 'boolean') sorgu.session = f.session;
    const liste = await this.ses.cookies.get(sorgu);
    // url verilmediyse (alan adı/ad filtresi) her çerezi host iznine göre süz.
    return liste.filter((c) => hostIzni(m, cerezAdresi(c)));
  }

  async _cerez(m, yontem, f) {
    switch (yontem) {
      case 'getAll':
        return (await this._cerezler(m, f)).map(cerezDonustur);
      case 'get': {
        if (typeof f.name !== 'string') throw new Error('name gerekli');
        if (f.url === undefined) throw new Error('url gerekli');
        const adres = adresDogrula(f.url);
        const liste = (await this._cerezler(m, { url: adres, name: f.name }))
          .sort((a, b) => (b.path || '').length - (a.path || '').length);
        return liste.length ? cerezDonustur(liste[0]) : null;
      }
      case 'set': {
        const adres = adresDogrula(f.url);
        if (!hostIzni(m, adres)) throw new Error('Bu adres için host izni yok: ' + adres);
        const ayar = { url: adres, name: String(f.name || ''), value: String(f.value || '') };
        if (typeof f.domain === 'string') ayar.domain = f.domain;
        if (typeof f.path === 'string') ayar.path = f.path;
        if (typeof f.secure === 'boolean') ayar.secure = f.secure;
        if (typeof f.httpOnly === 'boolean') ayar.httpOnly = f.httpOnly;
        if (typeof f.expirationDate === 'number') ayar.expirationDate = f.expirationDate;
        if (['unspecified', 'no_restriction', 'lax', 'strict'].includes(f.sameSite)) ayar.sameSite = f.sameSite;
        // Alan adı verildiyse o alan için de host izni şart (başka siteye çerez yazılamasın).
        if (ayar.domain && !hostIzni(m, (ayar.secure ? 'https://' : 'http://') + ayar.domain.replace(/^\./, '') + '/')) {
          throw new Error('Bu alan adı için host izni yok: ' + ayar.domain);
        }
        await this.ses.cookies.set(ayar);
        const donen = await this.ses.cookies.get({ url: adres, name: ayar.name });
        return donen.length ? cerezDonustur(donen[0]) : null;
      }
      case 'remove': {
        if (typeof f.name !== 'string') throw new Error('name gerekli');
        const adres = adresDogrula(f.url);
        if (!hostIzni(m, adres)) throw new Error('Bu adres için host izni yok: ' + adres);
        await this.ses.cookies.remove(adres, f.name);
        return { url: adres, name: f.name, storeId: '0' };
      }
      case 'getAllCookieStores':
        return [{ id: '0', tabIds: [] }];
      default:
        throw new Error('chrome.cookies.' + yontem + ' desteklenmiyor');
    }
  }

  /* ---- downloads ---- */

  async _indirme(kimlik, yontem, args) {
    const d = this.indirme;
    const f = args[0];
    switch (yontem) {
      case 'download': {
        const o = f && typeof f === 'object' ? f : {};
        const adres = String(o.url || '');
        if (!/^(https?:|data:)/i.test(adres)) throw new Error('Yalnızca http(s) ve data: adresleri indirilebilir');
        return d.baslat({
          url: adres,
          filename: typeof o.filename === 'string' ? o.filename : '',
          saveAs: o.saveAs === true,
          conflictAction: o.conflictAction,
          headers: Array.isArray(o.headers) ? o.headers : [],
          kimlik
        });
      }
      case 'search': return d.ara(f && typeof f === 'object' ? f : {});
      case 'cancel': return d.iptal(Number(f));
      case 'pause': return d.duraklat(Number(f));
      case 'resume': return d.surdur(Number(f));
      case 'erase': return d.sil(f && typeof f === 'object' ? f : {});
      case 'show': return d.goster(Number(f));
      case 'showDefaultFolder': return d.klasoruAc();
      default:
        throw new Error('chrome.downloads.' + yontem + ' desteklenmiyor');
    }
  }
}

/** İndirme dosya adı: göreli, '..' yok, geçersiz karakter yok. Boşsa null. */
function guvenliDosyaAdi(ad) {
  const parcalar = String(ad || '').replace(/\\/g, '/').split('/').filter((p) => p && p !== '.');
  if (!parcalar.length || parcalar.includes('..') || /^[a-zA-Z]:/.test(parcalar[0])) return null;
  const temiz = parcalar.map((p) => p.replace(/[<>:"|?*\u0000-\u001f]/g, '_').slice(0, 200));
  return temiz.join('/');
}

module.exports = {
  KIMLIK_RE,
  urlEslesir,
  desenKapsar,
  hostDesenleri,
  hostIzni,
  izinVar,
  cerezDonustur,
  cerezAdresi,
  guvenliDosyaAdi,
  EklentiApi
};
