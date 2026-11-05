'use strict';

/**
 * Eklentiler için tarayıcı verisi API'leri (Electron bunları uygulamıyor):
 * chrome.bookmarks, history, topSites, browsingData, privacy, sessions, search,
 * fontSettings, contentSettings, tts ve favicon.
 *
 * Çağıran eklenti HER ZAMAN gönderen bağlamdan çıkarılır (src/eklenti-api.js); izin
 * denetimi burada, manifest'teki izin adına göre yapılır. Veri store'dan gelir
 * (yerImleri: düz liste + "a/b" klasör yolu; gecmis: düz liste).
 */

const KOK = '0';
const BAR = '1';
const DIGER = '2';
const BASLIKLAR = { [KOK]: '', [BAR]: 'Bookmarks bar', [DIGER]: 'Other bookmarks' };

// ns -> gereken manifest izni
const IZINLER = {
  bookmarks: 'bookmarks', history: 'history', topSites: 'topSites', browsingData: 'browsingData',
  privacy: 'privacy', sessions: 'sessions', search: 'search', fontSettings: 'fontSettings',
  contentSettings: 'contentSettings', tts: 'tts', favicon: 'favicon'
};

const KLASOR = 'f:';

function klasorAdiTemizle(s) {
  return String(s || '').replace(/[\\/]+/g, '-').trim().slice(0, 100);
}
function ust(yol) { const i = yol.lastIndexOf('/'); return i < 0 ? '' : yol.slice(0, i); }
function ad(yol) { const i = yol.lastIndexOf('/'); return i < 0 ? yol : yol.slice(i + 1); }

class EklentiVeri {
  /**
   * @param {object} o
   * @param {object} o.store   src/store.js
   * @param {(kimlik:string, ns:string, ad:string, veri:any)=>void} o.bildir  tüm izinli eklentilere olay
   * @param {object} [o.kanca] { temizle(secim, since) , ara(text, disposition) }
   */
  constructor({ store, yayinla, kanca }) {
    this.store = store;
    this.yayinla = yayinla || (() => {});       // (ns, ad, veri) -> izinli tüm eklentilere
    this.kanca = kanca || {};
    this.ayarlar = new Map();                   // privacy/contentSettings: anahtar -> { value }
    this._sayac = 0;
  }

  destekler(ns) { return Object.prototype.hasOwnProperty.call(IZINLER, ns); }

  izinGerek(m, ns) {
    const izin = IZINLER[ns];
    if (!izin) throw new Error('Desteklenmeyen API: ' + ns);
    if (!Array.isArray(m.permissions) || !m.permissions.includes(izin)) {
      throw new Error("'" + izin + "' izni manifest'te bildirilmemiş");
    }
  }

  async cagir(kimlik, m, ns, yontem, args) {
    this.izinGerek(m, ns);
    switch (ns) {
      case 'bookmarks': return this._yerImi(String(yontem), args);
      case 'history': return this._gecmis(String(yontem), args);
      case 'topSites': return this._sik(String(yontem));
      case 'browsingData': return this._veriTemizle(String(yontem), args);
      case 'privacy': return this._gizlilik(String(yontem), args);
      case 'sessions': return this._oturumlar(String(yontem));
      case 'search': return this._ara(String(yontem), args);
      case 'fontSettings': return this._yazi(String(yontem));
      case 'contentSettings': return this._icerikAyari(String(yontem), args);
      case 'tts': return this._tts(String(yontem));
      case 'favicon': throw new Error('chrome.favicon desteklenmiyor');
      default: throw new Error('Desteklenmeyen API: ' + ns);
    }
  }

  /* ---------------------------------------------------------------- */
  /* bookmarks                                                          */
  /* ---------------------------------------------------------------- */

  get _liste() { return this.store.veri.yerImleri; }

  _bosKlasorler() {
    if (!Array.isArray(this.store.veri.yerImiBosKlasorleri)) this.store.veri.yerImiBosKlasorleri = [];
    return this.store.veri.yerImiBosKlasorleri;
  }

  _idVer(y) {
    if (y.id) return y.id;
    let en = 9;
    for (const k of this._liste) { const n = Number(k.id); if (Number.isFinite(n) && n > en) en = n; }
    y.id = String(en + 1);
    return y.id;
  }

  _tumKlasorler() {
    const s = new Set();
    const ekle = (yol) => {
      for (let p = String(yol || '').trim(); p; p = ust(p)) { if (s.has(p)) break; s.add(p); }
    };
    for (const y of this._liste) ekle(y.klasor);
    for (const k of this._bosKlasorler()) ekle(k);
    return s;
  }

  _yerImiDugumu(y) {
    const k = String(y.klasor || '').trim();
    return {
      id: this._idVer(y), parentId: k ? KLASOR + k : BAR, title: y.baslik || y.url, url: y.url,
      dateAdded: y.zaman || 0, index: 0
    };
  }

  _klasorDugumu(yol) {
    return { id: KLASOR + yol, parentId: ust(yol) ? KLASOR + ust(yol) : BAR, title: ad(yol), dateAdded: 0, dateGroupModified: 0, index: 0 };
  }

  _cocuklar(parentId) {
    if (parentId === KOK) return [this._dugum(BAR), this._dugum(DIGER)];
    if (parentId === DIGER) return [];
    const yol = parentId === BAR ? '' : String(parentId).slice(KLASOR.length);
    const klasorler = [...this._tumKlasorler()].filter((p) => ust(p) === yol).sort((a, b) => a.localeCompare(b));
    const dugumler = klasorler.map((p) => this._klasorDugumu(p));
    for (const y of this._liste) if (String(y.klasor || '').trim() === yol) dugumler.push(this._yerImiDugumu(y));
    dugumler.forEach((d, i) => { d.index = i; });
    return dugumler;
  }

  _dugum(id) {
    id = String(id);
    if (id === KOK || id === BAR || id === DIGER) {
      const d = { id, title: BASLIKLAR[id], dateAdded: 0, dateGroupModified: 0, index: id === BAR ? 0 : id === DIGER ? 1 : 0 };
      if (id !== KOK) d.parentId = KOK;
      if (id === BAR) d.folderType = 'bookmarks-bar';
      if (id === DIGER) d.folderType = 'other';
      return d;
    }
    if (id.startsWith(KLASOR)) {
      const yol = id.slice(KLASOR.length);
      return this._tumKlasorler().has(yol) ? this._klasorDugumu(yol) : null;
    }
    const y = this._liste.find((k) => this._idVer(k) === id);
    if (!y) return null;
    const d = this._yerImiDugumu(y);
    d.index = this._cocuklar(d.parentId).findIndex((c) => c.id === d.id);
    return d;
  }

  _agac(d) {
    if (!d.url) d.children = this._cocuklar(d.id).map((c) => this._agac(c));
    return d;
  }

  _hepsi() {
    const sonuc = [];
    const gez = (id) => {
      for (const c of this._cocuklar(id)) { sonuc.push(c); if (!c.url) gez(c.id); }
    };
    gez(BAR);
    return sonuc;
  }

  _klasorYolu(parentId) {
    if (parentId === undefined || parentId === null || parentId === BAR) return '';
    if (parentId === DIGER || parentId === KOK) throw new Error('Bu klasöre öğe eklenemez');
    const id = String(parentId);
    if (!id.startsWith(KLASOR) || !this._tumKlasorler().has(id.slice(KLASOR.length))) throw new Error('Üst klasör bulunamadı');
    return id.slice(KLASOR.length);
  }

  _yerImi(yontem, args) {
    const st = this.store;
    const bul = (id) => { const d = this._dugum(id); if (!d) throw new Error("Can't find bookmark for id."); return d; };
    switch (yontem) {
      case 'getTree': return [this._agac(this._dugum(KOK))];
      case 'get': {
        const ids = Array.isArray(args[0]) ? args[0] : [args[0]];
        return ids.map((i) => bul(i));
      }
      case 'getChildren': { bul(args[0]); return this._cocuklar(String(args[0])); }
      case 'getSubTree': return [this._agac(bul(args[0]))];
      case 'getRecent': {
        const n = Math.max(1, Math.min(1000, Number(args[0]) || 10));
        return this._liste.filter((y) => y.url).map((y) => this._yerImiDugumu(y))
          .sort((a, b) => b.dateAdded - a.dateAdded).slice(0, n);
      }
      case 'search': {
        const q = args[0];
        const o = typeof q === 'string' ? { query: q } : (q && typeof q === 'object' ? q : {});
        const sorgu = String(o.query || '').toLowerCase().split(/\s+/).filter(Boolean);
        return this._hepsi().filter((d) => {
          if (o.url !== undefined && d.url !== String(o.url)) return false;
          if (o.title !== undefined && d.title !== String(o.title)) return false;
          const hay = ((d.title || '') + ' ' + (d.url || '')).toLowerCase();
          return sorgu.every((s) => hay.includes(s));
        });
      }
      case 'create': {
        const o = args[0] && typeof args[0] === 'object' ? args[0] : {};
        const klasor = this._klasorYolu(o.parentId);
        if (o.url !== undefined && o.url !== null) {
          const url = String(o.url);
          if (!/^(https?|ftp|file|chrome-extension):/i.test(url) && !/^[a-z][a-z0-9+.-]*:/i.test(url)) throw new Error('Geçersiz url');
          const baslik = String(o.title !== undefined ? o.title : url).slice(0, 200);
          // Mevcut model adres başına tek kayıt tutar.
          if (st.veri.yerImleri.some((y) => y.url === url)) {
            st.yerImiGuncelle(url, { ad: baslik, klasor });
          } else {
            st.yerImiEkle(url, baslik, klasor);
          }
          const y = this._liste.find((k) => k.url === url);
          const d = this._yerImiDugumu(y);
          d.index = this._cocuklar(d.parentId).findIndex((c) => c.id === d.id);
          this.yayinla('bookmarks', 'onCreated', { __args: [d.id, d] });
          return d;
        }
        const adi = klasorAdiTemizle(o.title);
        if (!adi) throw new Error('Klasör için başlık gerekli');
        const yol = klasor ? klasor + '/' + adi : adi;
        if (!this._tumKlasorler().has(yol)) { this._bosKlasorler().push(yol); st.kaydet(); st._yerImiDegisti(); }
        const d = this._klasorDugumu(yol);
        d.children = [];
        this.yayinla('bookmarks', 'onCreated', { __args: [d.id, { ...d, children: undefined }] });
        return d;
      }
      case 'update': {
        const d = bul(args[0]);
        const ch = args[1] && typeof args[1] === 'object' ? args[1] : {};
        if (!d.parentId || d.id === BAR || d.id === DIGER) throw new Error('Bu öğe değiştirilemez');
        if (d.url) {
          const k = this._liste.find((y) => this._idVer(y) === d.id);
          const yeniUrl = ch.url !== undefined ? String(ch.url) : undefined;
          if (yeniUrl !== undefined && !st.yerImiGuncelle(k.url, { ad: ch.title, url: yeniUrl })) {
            if (yeniUrl !== k.url) throw new Error('Adres güncellenemedi');
          } else if (ch.title !== undefined) st.yerImiGuncelle(k.url, { ad: String(ch.title) });
        } else if (ch.title !== undefined) {
          const eski = d.id.slice(KLASOR.length);
          const adi = klasorAdiTemizle(ch.title);
          if (!adi) throw new Error('Klasör için başlık gerekli');
          const yeni = ust(eski) ? ust(eski) + '/' + adi : adi;
          if (yeni !== eski) this._klasorTasi(eski, yeni);
          const sd = this._klasorDugumu(yeni);
          this.yayinla('bookmarks', 'onChanged', { __args: [sd.id, { title: adi }] });
          return sd;
        }
        const yeni = this._dugum(d.url ? d.id : d.id);
        this.yayinla('bookmarks', 'onChanged', { __args: [d.id, { title: yeni.title, ...(yeni.url ? { url: yeni.url } : {}) }] });
        return yeni;
      }
      case 'move': {
        const d = bul(args[0]);
        const hedef = args[1] && typeof args[1] === 'object' ? args[1] : {};
        if (d.id === BAR || d.id === DIGER || d.id === KOK) throw new Error('Bu öğe taşınamaz');
        const yeniKlasor = hedef.parentId !== undefined ? this._klasorYolu(hedef.parentId) : (d.parentId === BAR ? '' : d.parentId.slice(KLASOR.length));
        const eskiParent = d.parentId;
        if (d.url) {
          const k = this._liste.find((y) => this._idVer(y) === d.id);
          st.yerImiGuncelle(k.url, { klasor: yeniKlasor });
        } else {
          const eski = d.id.slice(KLASOR.length);
          if (yeniKlasor === eski || yeniKlasor.startsWith(eski + '/')) throw new Error('Klasör kendi içine taşınamaz');
          this._klasorTasi(eski, yeniKlasor ? yeniKlasor + '/' + ad(eski) : ad(eski));
        }
        const sonuc = d.url ? this._dugum(d.id) : this._klasorDugumu(yeniKlasor ? yeniKlasor + '/' + ad(d.id.slice(KLASOR.length)) : ad(d.id.slice(KLASOR.length)));
        this.yayinla('bookmarks', 'onMoved', { __args: [sonuc.id, { parentId: sonuc.parentId, index: sonuc.index || 0, oldParentId: eskiParent, oldIndex: d.index || 0 }] });
        return sonuc;
      }
      case 'remove':
      case 'removeTree': {
        const d = bul(args[0]);
        if (d.id === KOK || d.id === BAR || d.id === DIGER) throw new Error("Can't modify the root bookmark folders.");
        if (d.url) {
          st.yerImiSil(d.url);
        } else {
          const yol = d.id.slice(KLASOR.length);
          if (yontem === 'remove' && this._cocuklar(d.id).length) throw new Error('Klasör boş değil');
          st.yerImiKlasorSil(yol);
          st.veri.yerImiBosKlasorleri = this._bosKlasorler().filter((k) => k !== yol && !k.startsWith(yol + '/'));
          st.kaydet(); st._yerImiDegisti();
        }
        this.yayinla('bookmarks', 'onRemoved', { __args: [d.id, { parentId: d.parentId, index: d.index || 0, node: d }] });
        return undefined;
      }
      default:
        throw new Error('chrome.bookmarks.' + yontem + ' desteklenmiyor');
    }
  }

  _klasorTasi(eski, yeni) {
    this.store.yerImiKlasorYenidenAdlandir(eski, yeni);
    const bos = this._bosKlasorler();
    this.store.veri.yerImiBosKlasorleri = bos.map((k) => (k === eski ? yeni : k.startsWith(eski + '/') ? yeni + k.slice(eski.length) : k));
    this.store.kaydet();
    this.store._yerImiDegisti();
  }

  /* ---------------------------------------------------------------- */
  /* history / topSites                                                 */
  /* ---------------------------------------------------------------- */

  _gecmisOge(g, i) {
    return { id: String(g.zaman) + ':' + i, url: g.url, title: g.baslik || '', lastVisitTime: g.zaman, visitCount: 1, typedCount: 0 };
  }

  _gecmis(yontem, args) {
    const st = this.store;
    switch (yontem) {
      case 'search': {
        const o = args[0] && typeof args[0] === 'object' ? args[0] : {};
        const q = String(o.text || '').toLowerCase().trim();
        const bas = o.startTime !== undefined ? Number(o.startTime) : Date.now() - 7 * 864e5;
        const son = o.endTime !== undefined ? Number(o.endTime) : Infinity;
        const max = o.maxResults !== undefined ? Math.max(0, Number(o.maxResults)) : 100;
        // Chrome: adres başına tek kayıt, ziyaret sayısı birleştirilir.
        const harita = new Map();
        for (const g of st.veri.gecmis) {
          if (g.zaman < bas || g.zaman >= son) continue;
          if (q && !g.url.toLowerCase().includes(q) && !(g.baslik || '').toLowerCase().includes(q)) continue;
          const v = harita.get(g.url);
          if (v) { v.visitCount++; if (g.zaman > v.lastVisitTime) { v.lastVisitTime = g.zaman; v.title = g.baslik || ''; } }
          else harita.set(g.url, this._gecmisOge(g, harita.size));
        }
        return [...harita.values()].sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, max);
      }
      case 'getVisits': {
        const url = String(args[0] && args[0].url);
        return st.veri.gecmis.filter((g) => g.url === url)
          .map((g, i) => ({ id: this._gecmisOge(g, 0).id, visitId: String(g.zaman) + ':' + i, visitTime: g.zaman, referringVisitId: '0', transition: 'link' }));
      }
      case 'addUrl': {
        const url = String(args[0] && args[0].url);
        if (!/^https?:\/\//i.test(url)) throw new Error('Yalnızca http(s) adresleri eklenebilir');
        st.gecmiseEkle(url, args[0].title || '', false);
        return undefined;
      }
      case 'deleteUrl': {
        const url = String(args[0] && args[0].url);
        st.gecmisTekilSil(url);
        this.yayinla('history', 'onVisitRemoved', { allHistory: false, urls: [url] });
        return undefined;
      }
      case 'deleteRange': {
        const o = args[0] && typeof args[0] === 'object' ? args[0] : {};
        const bas = Number(o.startTime), son = Number(o.endTime);
        if (!Number.isFinite(bas) || !Number.isFinite(son)) throw new Error('startTime ve endTime gerekli');
        const silinen = [];
        for (const g of st.veri.gecmis.slice()) if (g.zaman >= bas && g.zaman <= son) { silinen.push(g.url); st.gecmisTekilSil(g.url, g.zaman); }
        if (silinen.length) this.yayinla('history', 'onVisitRemoved', { allHistory: false, urls: [...new Set(silinen)] });
        return undefined;
      }
      case 'deleteAll':
        st.gecmisiTemizle();
        this.yayinla('history', 'onVisitRemoved', { allHistory: true });
        return undefined;
      default:
        throw new Error('chrome.history.' + yontem + ' desteklenmiyor');
    }
  }

  _sik(yontem) {
    if (yontem !== 'get') throw new Error('chrome.topSites.' + yontem + ' desteklenmiyor');
    return this.store.sikGidilenler(20).map((s) => ({ url: s.url, title: s.baslik }));
  }

  /* ---------------------------------------------------------------- */
  /* browsingData                                                       */
  /* ---------------------------------------------------------------- */

  async _veriTemizle(yontem, args) {
    const TUMU = ['appcache', 'cache', 'cacheStorage', 'cookies', 'downloads', 'fileSystems', 'formData', 'history',
      'indexedDB', 'localStorage', 'passwords', 'serviceWorkers', 'webSQL'];
    if (yontem === 'settings') {
      const dizi = { dataToRemove: {}, dataRemovalPermitted: {} };
      for (const k of TUMU) { dizi.dataToRemove[k] = false; dizi.dataRemovalPermitted[k] = true; }
      return dizi;
    }
    let secim;
    const o = args[0] && typeof args[0] === 'object' ? args[0] : {};
    if (yontem === 'remove') secim = args[1] && typeof args[1] === 'object' ? args[1] : {};
    else {
      const m = /^remove(\w+)$/.exec(yontem);
      if (!m) throw new Error('chrome.browsingData.' + yontem + ' desteklenmiyor');
      const ad = m[1][0].toLowerCase() + m[1].slice(1);
      secim = { [ad]: true };
    }
    const since = Number(o.since) || 0;
    if (!this.kanca.temizle) throw new Error('Veri temizleme desteği yok');
    const istenen = Object.keys(secim).filter((k) => secim[k] === true);
    for (const k of istenen) if (!TUMU.includes(k)) throw new Error('Bilinmeyen veri türü: ' + k);
    // Sözleşme: parolalar ve form verisi bu tarayıcıda eklentilerce silinemez (kullanıcı verisi).
    await this.kanca.temizle(istenen.filter((k) => k !== 'passwords'), since, o);
    return undefined;
  }

  /* ---------------------------------------------------------------- */
  /* privacy / contentSettings / sessions / search / diğer             */
  /* ---------------------------------------------------------------- */

  // privacy.*: Tarayıcının gizlilik ayarlarını eklenti değiştiremez; Chrome'un "not_controllable"
  // davranışı. get değeri güvenli varsayılandır, set sessizce yok sayılır.
  _gizlilik(yontem, args) {
    const yol = String(args[0] || '');
    const VARSAYILAN = {
      'network.networkPredictionEnabled': false, 'network.webRTCIPHandlingPolicy': 'default_public_interface_only',
      'network.webRTCMultipleRoutesEnabled': false, 'network.webRTCNonProxiedUdpEnabled': false,
      'services.alternateErrorPagesEnabled': false, 'services.autofillAddressEnabled': true,
      'services.autofillCreditCardEnabled': true, 'services.autofillEnabled': true,
      'services.passwordSavingEnabled': true, 'services.safeBrowsingEnabled': false,
      'services.safeBrowsingExtendedReportingEnabled': false, 'services.searchSuggestEnabled': true,
      'services.spellingServiceEnabled': false, 'services.translationServiceEnabled': false,
      'websites.doNotTrackEnabled': true, 'websites.hyperlinkAuditingEnabled': false,
      'websites.referrersEnabled': true, 'websites.protectedContentEnabled': false,
      'websites.thirdPartyCookiesAllowed': true, 'websites.privacySandboxEnabled': false,
      'websites.adMeasurementEnabled': false, 'websites.fledgeEnabled': false, 'websites.topicsEnabled': false,
      'websites.relatedWebsiteSetsEnabled': false
    };
    if (!(yol in VARSAYILAN)) throw new Error('Bilinmeyen gizlilik ayarı: ' + yol);
    switch (yontem) {
      case 'get': return { value: VARSAYILAN[yol], levelOfControl: 'not_controllable' };
      case 'set': case 'clear': return undefined;
      default: throw new Error('chrome.privacy.' + yontem + ' desteklenmiyor');
    }
  }

  _icerikAyari(yontem, args) {
    switch (yontem) {
      case 'get': return { setting: 'allow' };
      case 'getResourceIdentifiers': return [];
      case 'set': case 'clear': return undefined;
      default: throw new Error('chrome.contentSettings.' + yontem + ' desteklenmiyor');
    }
  }

  _oturumlar(yontem) {
    switch (yontem) {
      case 'getRecentlyClosed': return [];
      case 'getDevices': return [];
      case 'restore': throw new Error('Geri yüklenecek oturum yok');
      default: throw new Error('chrome.sessions.' + yontem + ' desteklenmiyor');
    }
  }

  async _ara(yontem, args) {
    if (yontem !== 'query') throw new Error('chrome.search.' + yontem + ' desteklenmiyor');
    const o = typeof args[0] === 'string' ? { text: args[0] } : (args[0] && typeof args[0] === 'object' ? args[0] : {});
    const metin = String(o.text || '').trim();
    if (!metin) throw new Error('text gerekli');
    if (!this.kanca.ara) throw new Error('Arama desteği yok');
    await this.kanca.ara(metin, o.disposition || 'NEW_TAB');
    return undefined;
  }

  _yazi(yontem) {
    switch (yontem) {
      case 'getFontList': return [];
      case 'getFont': return { fontId: '', levelOfControl: 'not_controllable' };
      case 'getDefaultFontSize': case 'getDefaultFixedFontSize': return { pixelSize: 16, levelOfControl: 'not_controllable' };
      case 'getMinimumFontSize': return { pixelSize: 0, levelOfControl: 'not_controllable' };
      case 'setFont': case 'setDefaultFontSize': case 'setDefaultFixedFontSize': case 'setMinimumFontSize':
      case 'clearFont': case 'clearDefaultFontSize': case 'clearDefaultFixedFontSize': case 'clearMinimumFontSize':
        return undefined;
      default: throw new Error('chrome.fontSettings.' + yontem + ' desteklenmiyor');
    }
  }

  _tts(yontem) {
    switch (yontem) {
      case 'getVoices': return [];
      case 'isSpeaking': return false;
      case 'speak': case 'stop': case 'pause': case 'resume': return undefined;
      default: throw new Error('chrome.tts.' + yontem + ' desteklenmiyor');
    }
  }
}

module.exports = { EklentiVeri, IZINLER };
