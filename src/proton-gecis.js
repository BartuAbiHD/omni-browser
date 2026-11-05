'use strict';

/**
 * Proton Pass JSON dışa aktarımındaki geçiş anahtarını (passkey) çözer.
 *
 * Gözlenen biçim (browser-pass 1.42/1.43, contentFormatVersion 8):
 *   passkeys[i].content = base64( MessagePack { c: [bayt...], v: 1 } )
 *   c baytları ikinci bir MessagePack:
 *     { key: { kty:{t,c:'EC2'}, alg:{t,c:'ES256'},
 *              par: [[{c:-1}, crv], [{c:-2}, x], [{c:-3}, y], [{c:-4}, d]] },
 *       cid: kimlik, rid: rpId, uhd: userHandle, un, udn, cnt }
 * Yalnızca ES256 / P-256 desteklenir; başka her şey null döner (atlanır).
 * Özel anahtar günlüğe/hata iletisine yazılmaz.
 */
const crypto = require('node:crypto');
const { b64u } = require('./gecis-anahtari');

const SINIR = { derinlik: 12, oge: 100000 };

/** Gerekli MessagePack alt kümesi. Sınır aşımı ve taşma hata fırlatır. */
function mpCoz(b) {
  let sayac = 0;
  const gerek = (o, n) => { if (o + n > b.length) throw new Error('mp: taşma'); };
  const oku = (o, d) => {
    if (d > SINIR.derinlik || ++sayac > SINIR.oge) throw new Error('mp: sınır');
    gerek(o, 1);
    const t = b[o];
    if (t <= 0x7f) return [t, o + 1];
    if (t >= 0xe0) return [t - 256, o + 1];
    if (t >= 0xa0 && t <= 0xbf) return str(o + 1, t & 31);
    if (t >= 0x90 && t <= 0x9f) return dizi(o + 1, t & 15, d);
    if (t >= 0x80 && t <= 0x8f) return harita(o + 1, t & 15, d);
    switch (t) {
      case 0xc0: return [null, o + 1];
      case 0xc2: return [false, o + 1];
      case 0xc3: return [true, o + 1];
      case 0xcc: gerek(o, 2); return [b[o + 1], o + 2];
      case 0xcd: gerek(o, 3); return [b.readUInt16BE(o + 1), o + 3];
      case 0xce: gerek(o, 5); return [b.readUInt32BE(o + 1), o + 5];
      case 0xd0: gerek(o, 2); return [b.readInt8(o + 1), o + 2];
      case 0xd9: gerek(o, 2); return str(o + 2, b[o + 1]);
      case 0xc4: { gerek(o, 2); const n = b[o + 1]; gerek(o + 2, n); return [b.subarray(o + 2, o + 2 + n), o + 2 + n]; }
      case 0xdc: gerek(o, 3); return dizi(o + 3, b.readUInt16BE(o + 1), d);
      case 0xdd: gerek(o, 5); return dizi(o + 5, b.readUInt32BE(o + 1), d);
      case 0xde: gerek(o, 3); return harita(o + 3, b.readUInt16BE(o + 1), d);
      default: throw new Error('mp: desteklenmeyen tür');
    }
  };
  const str = (o, n) => { gerek(o, n); return [b.subarray(o, o + n).toString('utf8'), o + n]; };
  const dizi = (o, n, d) => {
    if (n > SINIR.oge) throw new Error('mp: sınır');
    const r = [];
    for (let i = 0; i < n; i++) { const [v, p] = oku(o, d + 1); r.push(v); o = p; }
    return [r, o];
  };
  const harita = (o, n, d) => {
    if (n > SINIR.oge) throw new Error('mp: sınır');
    const r = {};
    for (let i = 0; i < n; i++) {
      const [k, p] = oku(o, d + 1); const [v, q] = oku(p, d + 1);
      if (typeof k === 'string' && k !== '__proto__') r[k] = v;
      o = q;
    }
    return [r, o];
  };
  return oku(0, 0)[0];
}

const baytlar = (x) => (Array.isArray(x) && x.every((n) => Number.isInteger(n) && n >= 0 && n < 256) ? Buffer.from(x) : null);

/**
 * @param {object} pk  Proton passkey nesnesi (content, rpId, userName...)
 * @returns {object|null}  store kaydı; desteklenmiyorsa ya da bozuksa null
 */
function protonGecisCoz(pk) {
  try {
    if (!pk || typeof pk.content !== 'string') return null;
    const dis = mpCoz(Buffer.from(pk.content, 'base64'));
    const ic = mpCoz(baytlar(dis && dis.c) || Buffer.alloc(0));
    const key = ic && ic.key;
    if (!key || !key.kty || key.kty.c !== 'EC2' || !key.alg || key.alg.c !== 'ES256') return null;

    const par = new Map();
    for (const [e, deger] of key.par || []) {
      if (e && typeof e.c === 'number' && deger) par.set(e.c, deger.c);
    }
    // crv: 1 = P-256. Değer 16 baytlık tamsayı olarak da gelebiliyor.
    const crv = par.get(-1);
    const crvB = crv && typeof crv === 'object' ? baytlar(crv.inner) : null;
    const crvDeger = typeof crv === 'number' ? crv : crvB ? Number(crvB.readBigUInt64LE(0)) : null;
    const crvBe = crvB ? Number(crvB.readBigUInt64BE(8)) : null;
    if (crvDeger !== 1 && crvBe !== 1) return null;

    const x = baytlar(par.get(-2)), y = baytlar(par.get(-3)), d = baytlar(par.get(-4));
    if (!x || !y || !d || x.length !== 32 || y.length !== 32 || d.length !== 32) return null;

    const ozel = crypto.createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y), d: b64u(d) }, format: 'jwk'
    });
    // d, x/y ile tutarlı mı? Node JWK'dan açık anahtarı yeniden hesaplamaz; bu yüzden
    // imza atıp x/y'den kurulan açık anahtarla doğrulatırız (bozuk dosya yanlış imza üretmesin).
    const deneme = Buffer.from('cvs-passkey-import');
    const imza = crypto.sign('sha256', deneme, ozel);
    const acik = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) }, format: 'jwk' });
    if (!crypto.verify('sha256', deneme, acik, imza)) return null;

    const kimlik = baytlar(ic.cid);
    const kullaniciKimlik = baytlar(ic.uhd);
    const rpId = String(ic.rid || pk.rpId || '').toLowerCase();
    if (!kimlik || !kimlik.length || !kullaniciKimlik || !rpId) return null;
    if (pk.rpId && String(pk.rpId).toLowerCase() !== rpId) return null;

    return {
      id: b64u(kimlik),
      rpId,
      rpAdi: String(pk.rpName || rpId),
      kullaniciKimlik: b64u(kullaniciKimlik),
      kullaniciAdi: String(ic.un || pk.userName || ''),
      kullaniciGoruntu: String(ic.udn || pk.userDisplayName || ''),
      ozelAnahtar: ozel.export({ format: 'der', type: 'pkcs8' }).toString('base64url'),
      sayac: Number.isInteger(ic.cnt) && ic.cnt > 0 ? ic.cnt : 0,
      zaman: Number(pk.createTime) > 0 ? Number(pk.createTime) * 1000 : Date.now(),
      sonKullanim: 0
    };
  } catch {
    return null;
  }
}

module.exports = { protonGecisCoz, mpCoz };
