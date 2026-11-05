'use strict';

/**
 * chrome.contextMenus: eklentilerin sağ tık menüsü öğeleri (Electron bunu uygulamıyor).
 *
 * Kayıt ana süreçte tutulur; çağıran eklenti her zaman gönderen bağlamdan çıkarılır
 * (src/eklenti-api.js). Menü, sekmenin sağ tık menüsüne Chrome gibi eklenir: tek üst düzey
 * öğesi olan eklenti öğesini doğrudan, birden çok öğesi olan eklenti kendi adıyla bir alt
 * menü altında gösterir.
 */

const { urlEslesir } = require('./eklenti-api');

const BAGLAMLAR = ['all', 'page', 'frame', 'selection', 'link', 'editable', 'image', 'video', 'audio',
  'launcher', 'browser_action', 'page_action', 'action'];
const TURLER = ['normal', 'checkbox', 'radio', 'separator'];
const SAYFA_BAGLAMLARI = ['page', 'frame', 'selection', 'link', 'editable', 'image', 'video', 'audio'];
const EKLENTI_BAGLAMLARI = ['browser_action', 'page_action', 'action'];

function dizi(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }

function oge(p, onceki) {
  const o = onceki ? { ...onceki } : { type: 'normal', contexts: ['page'], enabled: true, visible: true, checked: false };
  if (p.type !== undefined) {
    if (!TURLER.includes(p.type)) throw new Error('Geçersiz menü türü: ' + p.type);
    o.type = p.type;
  }
  if (p.title !== undefined) o.title = String(p.title).slice(0, 300);
  if (p.contexts !== undefined) {
    const c = dizi(p.contexts);
    if (!c.length || c.some((x) => !BAGLAMLAR.includes(x))) throw new Error('Geçersiz menü bağlamı');
    o.contexts = c;
  }
  for (const k of ['enabled', 'visible', 'checked']) if (typeof p[k] === 'boolean') o[k] = p[k];
  if (p.parentId !== undefined) o.parentId = p.parentId === null ? undefined : String(p.parentId);
  if (p.documentUrlPatterns !== undefined) o.documentUrlPatterns = dizi(p.documentUrlPatterns);
  if (p.targetUrlPatterns !== undefined) o.targetUrlPatterns = dizi(p.targetUrlPatterns);
  if (!onceki && o.type !== 'separator' && !o.title) throw new Error('Menü öğesi için başlık (title) gerekli');
  return o;
}

class EklentiBaglamMenusu {
  /**
   * @param {object} o
   * @param {(kimlik:string, ns:string, ad:string, veri:any)=>void} o.bildir  olay yayını
   * @param {()=>object} [o.yukle]    kalıcı kayıt: { kimlik: [oge, ...] }
   * @param {(veri:object)=>void} [o.kaydet]
   */
  constructor({ bildir, yukle, kaydet }) {
    this.bildir = bildir;
    this.kaydet = kaydet || (() => {});
    this.kayit = new Map();   // kimlik -> Map<id, oge>
    this._sayac = 0;
    const eski = yukle ? yukle() : null;
    if (eski && typeof eski === 'object') {
      for (const [k, liste] of Object.entries(eski)) {
        if (!Array.isArray(liste)) continue;
        const m = new Map();
        for (const x of liste) if (x && typeof x.id === 'string') m.set(x.id, x);
        if (m.size) this.kayit.set(k, m);
      }
    }
  }

  _yaz() {
    const o = {};
    for (const [k, m] of this.kayit) o[k] = [...m.values()];
    this.kaydet(o);
  }

  /** chrome.contextMenus.* çağrıları. */
  cagir(kimlik, yontem, args) {
    const m = this.kayit.get(kimlik) || new Map();
    switch (yontem) {
      case 'create': {
        const p = args[0] && typeof args[0] === 'object' ? args[0] : {};
        const id = p.id !== undefined ? String(p.id) : 'cvs-' + (++this._sayac) + '-' + Date.now().toString(36);
        if (m.has(id)) throw new Error('Yinelenen menü kimliği: ' + id);
        if (p.parentId !== undefined && p.parentId !== null && !m.has(String(p.parentId))) {
          throw new Error('Üst menü bulunamadı: ' + p.parentId);
        }
        const o = oge(p);
        o.id = id;
        m.set(id, o);
        this.kayit.set(kimlik, m);
        this._yaz();
        return id;
      }
      case 'update': {
        const id = String(args[0]);
        const onceki = m.get(id);
        if (!onceki) throw new Error('Menü bulunamadı: ' + id);
        const o = oge(args[1] && typeof args[1] === 'object' ? args[1] : {}, onceki);
        o.id = id;
        m.set(id, o);
        this._yaz();
        return undefined;
      }
      case 'remove': {
        const id = String(args[0]);
        if (!m.has(id)) throw new Error('Menü bulunamadı: ' + id);
        this._sil(m, id);
        this._yaz();
        return undefined;
      }
      case 'removeAll':
        this.kayit.delete(kimlik);
        this._yaz();
        return undefined;
      default:
        throw new Error('chrome.contextMenus.' + yontem + ' desteklenmiyor');
    }
  }

  _sil(m, id) {
    m.delete(id);
    for (const [k, o] of [...m]) if (o.parentId === id) this._sil(m, k);
  }

  /** Eklenti kaldırıldı ya da pasifleştirildi. */
  temizle(kimlik) {
    if (this.kayit.delete(kimlik)) this._yaz();
  }

  /**
   * Sağ tık parametrelerine uyan öğeleri döndürür (kimlik başına).
   * @param {Array<{id:string, ad:string, simge?:any}>} eklentiler  etkin eklentiler (sıralı)
   * @param {object} p   Electron context-menu parametreleri
   * @param {string} sayfaUrl
   * @param {(kimlik:string, bilgi:object)=>void} tikla  öğeye tıklanınca
   * @param {(simge:any)=>any} [simgeYap]
   */
  sablon(eklentiler, p, sayfaUrl, tikla, simgeYap) {
    const sonuc = [];
    for (const e of eklentiler) {
      const m = this.kayit.get(e.id);
      if (!m || !m.size) continue;
      const uyan = (o) => this._uyar(o, p, sayfaUrl);
      const dal = (ust) => {
        const cocuklar = [...m.values()].filter((o) => o.parentId === ust && o.visible && uyan(o));
        const cikti = [];
        for (const o of cocuklar) {
          const ic = o.type === 'separator' ? [] : dal(o.id);
          if (o.type === 'separator') { cikti.push({ type: 'separator' }); continue; }
          const baslik = this._baslik(o.title, p);
          const oz = { label: baslik, enabled: o.enabled };
          if (ic.length) oz.submenu = ic;
          else if (o.type === 'checkbox' || o.type === 'radio') {
            oz.type = o.type;
            oz.checked = o.checked;
            oz.click = () => {
              const onceki = o.checked;
              if (o.type === 'checkbox') o.checked = !o.checked;
              else {
                for (const k of m.values()) if (k.type === 'radio' && k.parentId === o.parentId) k.checked = false;
                o.checked = true;
              }
              this._yaz();
              tikla(e.id, this._bilgi(o, p, sayfaUrl, onceki));
            };
          } else oz.click = () => tikla(e.id, this._bilgi(o, p, sayfaUrl));
          cikti.push(oz);
        }
        // Baştaki / sondaki / art arda ayırıcıları at.
        const temiz = [];
        for (const x of cikti) {
          if (x.type === 'separator' && (!temiz.length || temiz[temiz.length - 1].type === 'separator')) continue;
          temiz.push(x);
        }
        while (temiz.length && temiz[temiz.length - 1].type === 'separator') temiz.pop();
        return temiz;
      };
      const ust = dal(undefined);
      if (!ust.length) continue;
      const icon = simgeYap && e.simge ? simgeYap(e.simge) : undefined;
      if (ust.length === 1 && ust[0].type !== 'separator') {
        sonuc.push(icon ? { ...ust[0], icon } : ust[0]);
      } else {
        sonuc.push({ label: e.ad, ...(icon ? { icon } : {}), submenu: ust });
      }
    }
    return sonuc;
  }

  _baglamlar(p) {
    const c = ['page'];
    if (p.frame || p.frameURL) c.push('frame');
    if (p.selectionText) c.push('selection');
    if (p.linkURL) c.push('link');
    if (p.isEditable) c.push('editable');
    if (p.mediaType === 'image') c.push('image');
    if (p.mediaType === 'video') c.push('video');
    if (p.mediaType === 'audio') c.push('audio');
    return c;
  }

  _uyar(o, p, sayfaUrl) {
    const bagl = this._baglamlar(p);
    const hepsi = o.contexts.includes('all');
    // 'page' yalnızca başka özel bağlam yokken geçerlidir (Chrome davranışı).
    const ozel = bagl.filter((x) => x !== 'page' && x !== 'frame');
    let tamam;
    if (hepsi) tamam = true;
    else if (ozel.length) tamam = o.contexts.some((x) => ozel.includes(x));
    else tamam = o.contexts.includes('page') || (bagl.includes('frame') && o.contexts.includes('frame'));
    if (!tamam) return false;
    // Yalnızca eklenti düğmesi bağlamında olanlar sayfa menüsünde görünmez.
    if (!hepsi && o.contexts.every((x) => EKLENTI_BAGLAMLARI.includes(x) || x === 'launcher')) return false;
    if (o.documentUrlPatterns && o.documentUrlPatterns.length
      && !o.documentUrlPatterns.some((d) => urlEslesir(d, p.pageURL || sayfaUrl || ''))) return false;
    if (o.targetUrlPatterns && o.targetUrlPatterns.length) {
      const hedef = p.linkURL || p.srcURL;
      if (!hedef || !o.targetUrlPatterns.some((d) => urlEslesir(d, hedef))) return false;
    }
    return true;
  }

  _baslik(t, p) {
    const sec = (p.selectionText || '').trim();
    return String(t || '').replace(/%s/g, sec.slice(0, 40)).replace(/&/g, '&&');
  }

  _bilgi(o, p, sayfaUrl, oncekiChecked) {
    const b = { menuItemId: o.id, editable: !!p.isEditable, pageUrl: p.pageURL || sayfaUrl || '' };
    if (o.parentId) b.parentMenuItemId = o.parentId;
    if (p.selectionText) b.selectionText = p.selectionText;
    if (p.linkURL) b.linkUrl = p.linkURL;
    if (p.srcURL && p.mediaType && p.mediaType !== 'none') b.srcUrl = p.srcURL;
    if (p.mediaType === 'image' || p.mediaType === 'video' || p.mediaType === 'audio') b.mediaType = p.mediaType;
    if (p.frameURL) b.frameUrl = p.frameURL;
    if (o.type === 'checkbox' || o.type === 'radio') {
      b.checked = o.checked;
      b.wasChecked = !!oncekiChecked;
    }
    return b;
  }
}

module.exports = { EklentiBaglamMenusu, SAYFA_BAGLAMLARI };
