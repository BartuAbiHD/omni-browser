'use strict';

/*
 * DISCORD RICH PRESENCE (bagimliliksiz IPC istemcisi).
 *
 * Masaustu Discord'un YEREL kanalina (Windows: \\?\pipe\discord-ipc-N,
 * POSIX: $XDG_RUNTIME_DIR/discord-ipc-N) baglanir. Hicbir ag istegi atmaz;
 * veri yalnizca ayni bilgisayardaki Discord uygulamasina gider. Discord
 * kapaliysa sessizce bekler, acildiginda kendiliginden baglanir.
 *
 * Cerceve: [op:int32LE][uzunluk:int32LE][JSON]. op 0 = el sikisma,
 * 1 = cerceve, 2 = kapat, 3 = ping, 4 = pong.
 */

const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const OP = { ELSIKISMA: 0, CERCEVE: 1, KAPAT: 2, PING: 3, PONG: 4 };
const YENIDEN_DENEME_MS = 15000;
const MAX_CERCEVE = 1024 * 1024;

function yolAdaylari() {
  const liste = [];
  for (let i = 0; i < 10; i++) {
    if (process.platform === 'win32') {
      liste.push(`\\\\?\\pipe\\discord-ipc-${i}`);
    } else {
      const kok = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || os.tmpdir();
      liste.push(path.join(kok, `discord-ipc-${i}`));
      // Flatpak / Snap kurulumlari
      liste.push(path.join(kok, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`));
      liste.push(path.join(kok, 'snap.discord', `discord-ipc-${i}`));
    }
  }
  return liste;
}

function cerceveYaz(op, veri) {
  const govde = Buffer.from(JSON.stringify(veri), 'utf8');
  const bas = Buffer.alloc(8);
  bas.writeInt32LE(op, 0);
  bas.writeInt32LE(govde.length, 4);
  return Buffer.concat([bas, govde]);
}

/** Tamponu cerceve listesine ayirir. Donus: { cerceveler, kalan } */
function cerceveOku(tampon) {
  const cerceveler = [];
  let kalan = tampon;
  while (kalan.length >= 8) {
    const op = kalan.readInt32LE(0);
    const uzunluk = kalan.readInt32LE(4);
    if (uzunluk < 0 || uzunluk > MAX_CERCEVE) return { cerceveler, kalan: Buffer.alloc(0), bozuk: true };
    if (kalan.length < 8 + uzunluk) break;
    let veri = null;
    try { veri = JSON.parse(kalan.subarray(8, 8 + uzunluk).toString('utf8')); } catch { /* bozuk govde */ }
    cerceveler.push({ op, veri });
    kalan = kalan.subarray(8 + uzunluk);
  }
  return { cerceveler, kalan };
}

class DiscordRpc {
  /**
   * Ayni anda birden cok Discord/uyumlu istemci olabilir (ipc-0 baska bir
   * uygulamaya ait olabiliyor): TUM erisilebilir kanallara baglanilir.
   * @param {string} clientId Discord uygulama kimligi
   * @param {{baglan?:Function, yollar?:string[]}} [secenek] test icin enjekte
   */
  constructor(clientId, secenek = {}) {
    this.clientId = String(clientId);
    this._baglan = secenek.baglan || ((yol) => net.createConnection(yol));
    this._yollar = secenek.yollar || yolAdaylari();
    this.baglantilar = new Map();   // yol -> { soket, hazir, tampon }
    this.kapali = false;
    this.bekleyen = null;
    this.sonDeneme = 0;
    this.baglaniyor = false;
  }

  get hazir() { for (const b of this.baglantilar.values()) if (b.hazir) return true; return false; }

  /** Etkinligi ayarlar; baglanti yoksa kurulana dek saklar. null = temizle. */
  etkinlikAyarla(etkinlik) {
    if (this.kapali) return;
    this.bekleyen = etkinlik || null;
    for (const b of this.baglantilar.values()) if (b.hazir) this._gonder(b);
    this._baglantiyiDene();
  }

  _gonder(b) {
    if (!b.hazir) return;
    try {
      b.soket.write(cerceveYaz(OP.CERCEVE, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: this.bekleyen || null },
        nonce: crypto.randomUUID()
      }));
    } catch { this._kopar(b); }
  }

  async _baglantiyiDene() {
    if (this.kapali || this.baglaniyor) return;
    if (Date.now() - this.sonDeneme < YENIDEN_DENEME_MS) return;
    this.sonDeneme = Date.now();
    this.baglaniyor = true;
    try {
      for (const yol of this._yollar) {
        if (this.kapali) return;
        if (this.baglantilar.has(yol)) continue;
        const soket = await this._dene(yol);
        if (soket) this._kur(yol, soket);
      }
    } finally {
      this.baglaniyor = false;
    }
  }

  _dene(yol) {
    return new Promise((coz) => {
      let bitti = false;
      let soket;
      const son = (s) => { if (!bitti) { bitti = true; coz(s); } };
      try { soket = this._baglan(yol); } catch { return coz(null); }
      soket.once('connect', () => son(soket));
      soket.once('error', () => { try { soket.destroy(); } catch { /* yok */ } son(null); });
      setTimeout(() => { if (!bitti) { try { soket.destroy(); } catch { /* yok */ } son(null); } }, 1500).unref?.();
    });
  }

  _kur(yol, soket) {
    const b = { yol, soket, hazir: false, tampon: Buffer.alloc(0) };
    this.baglantilar.set(yol, b);
    soket.on('data', (parca) => this._veri(b, parca));
    soket.on('error', () => this._kopar(b));
    soket.on('close', () => this._kopar(b));
    try {
      soket.write(cerceveYaz(OP.ELSIKISMA, { v: 1, client_id: this.clientId }));
    } catch { this._kopar(b); }
  }

  _veri(b, parca) {
    b.tampon = Buffer.concat([b.tampon, parca]);
    const { cerceveler, kalan, bozuk } = cerceveOku(b.tampon);
    b.tampon = kalan;
    if (bozuk) return this._kopar(b);
    for (const { op, veri } of cerceveler) {
      if (op === OP.PING) {
        try { b.soket.write(cerceveYaz(OP.PONG, veri || {})); } catch { /* kopacak */ }
      } else if (op === OP.KAPAT) {
        this._kopar(b);
      } else if (op === OP.CERCEVE && veri && veri.evt === 'READY') {
        b.hazir = true;
        this._gonder(b);
      }
    }
  }

  _kopar(b) {
    b.hazir = false;
    if (this.baglantilar.get(b.yol) === b) this.baglantilar.delete(b.yol);
    try { b.soket.destroy(); } catch { /* yok */ }
  }

  /** Etkinligi temizleyip baglantilari kapatir. Bir daha kullanilmaz. */
  kapat() {
    if (this.kapali) return;
    this.bekleyen = null;
    for (const b of [...this.baglantilar.values()]) {
      this._gonder(b);
      setTimeout(() => { try { b.soket.destroy(); } catch { /* yok */ } }, 100).unref?.();
    }
    this.kapali = true;
    this.baglantilar.clear();
  }
}

module.exports = { DiscordRpc, cerceveYaz, cerceveOku, OP, yolAdaylari };
