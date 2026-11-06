'use strict';

/*
 * Etkin sekmeyi periyodik okuyup Discord'a yansitir.
 * - Yalnizca etkin ve GIZLI OLMAYAN sekme, yalnizca desteklenen siteler.
 * - Ayar kapaliysa veya site/sekme uygun degilse etkinlik temizlenir.
 * - Degisiklik yoksa tekrar gonderilmez (Discord hiz siniri).
 */

const { DiscordRpc } = require('./discord-rpc');
const { siteBul, etkinlikUret, SNAPSHOT_BETIGI, CERCEVE_VIDEO_BETIGI } = require('./discord-sunum');

const ARALIK_MS = 5000;
const SAPMA_MS = 4000;   // oynatma zamani bu kadar kaydiysa yeniden gonder

class DiscordYonetici {
  /**
   * @param {{sekmeAl:()=>({url:string,gizli:boolean,wc:any}|null), ayarAl:()=>({acik:boolean,butonlar:boolean}), RpcSinifi?:any}} g
   */
  constructor(g) {
    this.g = g;
    this.Rpc = g.RpcSinifi || DiscordRpc;
    this.istemci = null;
    this.zamanlayici = null;
    this.sonAnahtar = null;
    this.sonEtkinlik = null;
    this.gezintiBaslangic = new Map();   // adres kokeni -> baslangic ms
    this.mesgul = false;
  }

  baslat() {
    if (this.zamanlayici) return;
    this.zamanlayici = setInterval(() => { this.tikla().catch(() => {}); }, ARALIK_MS);
    this.zamanlayici.unref?.();
  }

  durdur() {
    if (this.zamanlayici) clearInterval(this.zamanlayici);
    this.zamanlayici = null;
    if (this.istemci) { this.istemci.kapat(); this.istemci = null; }
    this.sonAnahtar = null;
    this.sonEtkinlik = null;
  }

  _temizle() {
    this.gezintiBaslangic.clear();   // siteye donuste sayac sifirdan baslasin
    if (this.istemci && this.sonAnahtar !== null) this.istemci.etkinlikAyarla(null);
    this.sonAnahtar = null;
    this.sonEtkinlik = null;
  }

  async tikla() {
    if (this.mesgul) return;
    this.mesgul = true;
    try {
      const ayar = this.g.ayarAl();
      const sekme = ayar.acik ? this.g.sekmeAl() : null;
      if (!sekme || sekme.gizli || !siteBul(sekme.url)) return this._temizle();

      const wc = sekme.wc;
      if (!wc || wc.isDestroyed()) return this._temizle();
      let ham;
      try { ham = await wc.executeJavaScript(SNAPSHOT_BETIGI, false); } catch { return this._temizle(); }
      let snap;
      try { snap = JSON.parse(ham); } catch { return this._temizle(); }

      const site = siteBul(sekme.url);
      if (site.altCerceve) await this._cerceveVideolari(wc, site, snap);

      const koken = new URL(sekme.url).origin;
      if (!this.gezintiBaslangic.has(koken)) this.gezintiBaslangic.set(koken, Date.now());
      const sonuc = etkinlikUret(sekme.url, snap, { butonlar: !!ayar.butonlar, gezinti: this.gezintiBaslangic.get(koken) });
      if (!sonuc) return this._temizle();

      if (!this._degistiMi(sonuc)) return;

      if (!this.istemci || this.istemci.clientId !== sonuc.clientId) {
        if (this.istemci) this.istemci.kapat();
        this.istemci = new this.Rpc(sonuc.clientId);
      }
      this.istemci.etkinlikAyarla(sonuc.etkinlik);
      this.sonAnahtar = sonuc.clientId;
      this.sonEtkinlik = sonuc;
    } finally {
      this.mesgul = false;
    }
  }

  /** Site-ici (alt alan adli) iframe'lerdeki video durumunu snapshot'a ekler. */
  async _cerceveVideolari(wc, site, snap) {
    let cerceveler = [];
    try {
      const ana = wc.mainFrame;
      cerceveler = (ana.framesInSubtree || []).filter((c) => c !== ana);
    } catch { return; }
    snap.videolar = Array.isArray(snap.videolar) ? snap.videolar : [];
    for (const c of cerceveler.slice(0, 5)) {
      let host = '';
      try { host = new URL(c.url).hostname.toLowerCase(); } catch { continue; }
      if (!site.altCerceve(host)) continue;
      try {
        const liste = JSON.parse(await c.executeJavaScript(CERCEVE_VIDEO_BETIGI, false));
        if (Array.isArray(liste)) snap.videolar.push(...liste.slice(0, 5));
      } catch { /* cerceve kapandi / yuklenmedi */ }
    }
  }

  _degistiMi(yeni) {
    const eski = this.sonEtkinlik;
    if (!eski || eski.clientId !== yeni.clientId) return true;
    const a = { ...eski.etkinlik };
    const b = { ...yeni.etkinlik };
    const ta = a.timestamps || {};
    const tb = b.timestamps || {};
    delete a.timestamps; delete b.timestamps;
    if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    if (!!ta.end !== !!tb.end || !!ta.start !== !!tb.start) return true;
    // Oynatma sirasinda start/end kayarsa (atlama, duraklat-devam) yeniden gonder.
    if (ta.end && Math.abs(ta.end - tb.end) > SAPMA_MS) return true;
    if (ta.start && Math.abs(ta.start - tb.start) > SAPMA_MS) return true;
    return false;
  }
}

module.exports = { DiscordYonetici };
