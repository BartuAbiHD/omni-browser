'use strict';

/**
 * Geçiş anahtarı (passkey / WebAuthn) yazılım kimlik doğrulayıcısı. Yalnızca ana
 * süreçte çalışır; sayfa tarafı src/gecis-anahtari-onyukleme.js'tir.
 *
 *  - Algoritma ES256 (P-256, COSE -7), sınırsız bulunabilir (resident) kimlik bilgisi.
 *  - Kanıt biçimi "none". Kullanıcı doğrulaması (UV) kullanıcının onay kutusudur.
 *  - Köken (origin) SAYFADAN GELEN VERİYE DEĞİL, gönderen çerçevenin URL'sine
 *    dayanır; rpId o kökenin kayıtlı alan son eki olmak zorundadır.
 */
const crypto = require('node:crypto');

const b64u = (b) => Buffer.from(b).toString('base64url');
const deB64u = (s) => Buffer.from(String(s || ''), 'base64url');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();

/* ---- En küçük CBOR kodlayıcı (yalnızca ihtiyaç duyulan türler) ---- */
function cborBaslik(tip, n) {
  if (n < 24) return Buffer.from([(tip << 5) | n]);
  if (n < 256) return Buffer.from([(tip << 5) | 24, n]);
  if (n < 65536) return Buffer.from([(tip << 5) | 25, n >> 8, n & 255]);
  const b = Buffer.alloc(5); b[0] = (tip << 5) | 26; b.writeUInt32BE(n, 1); return b;
}
function cbor(v) {
  if (Buffer.isBuffer(v)) return Buffer.concat([cborBaslik(2, v.length), v]);
  if (typeof v === 'string') { const s = Buffer.from(v, 'utf8'); return Buffer.concat([cborBaslik(3, s.length), s]); }
  if (typeof v === 'number') return v >= 0 ? cborBaslik(0, v) : cborBaslik(1, -1 - v);
  if (v instanceof Map) {
    const parcalar = [cborBaslik(5, v.size)];
    for (const [k, d] of v) parcalar.push(cbor(k), cbor(d));
    return Buffer.concat(parcalar);
  }
  throw new Error('CBOR: desteklenmeyen tür');
}

/** rpId, kökenin ana makinesi ya da onun bir üst alanı mı? (https ya da localhost) */
function rpIdGecerli(rpId, origin) {
  let u;
  try { u = new URL(origin); } catch { return false; }
  const host = u.hostname.toLowerCase();
  const yerel = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && yerel)) return false;
  const id = String(rpId || '').toLowerCase();
  if (!id || !/^[a-z0-9.-]+$/.test(id) && !yerel) return false;
  if (id === host) return true;
  // Tek etiketli (com, tr...) kamusal sonekleri engelle; tam PSL denetimi yok.
  if (!id.includes('.')) return false;
  return host.endsWith('.' + id);
}

function kokenAl(url) {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : null; } catch { return null; }
}

function bayraklar({ uv = true, at = false }) {
  return 0x01 | (uv ? 0x04 : 0) | (at ? 0x40 : 0);
}

function kullaniciGoruntu(k) {
  return k.kullaniciGoruntu || k.kullaniciAdi || '—';
}

/**
 * @param {object} secenekler  publicKey (b64url'li alanlarla): rp, user, challenge,
 *                              pubKeyCredParams, excludeCredentials
 * @returns {{ kayit, yanit }}  kayit: depolanacak; yanit: sayfaya dönecek
 */
function olustur(secenekler, origin, mevcut) {
  const rp = secenekler.rp || {};
  const rpId = String(rp.id || new URL(origin).hostname).toLowerCase();
  if (!rpIdGecerli(rpId, origin)) { const e = new Error('SecurityError'); e.ad = 'SecurityError'; throw e; }
  const algs = Array.isArray(secenekler.pubKeyCredParams) ? secenekler.pubKeyCredParams : [];
  if (algs.length && !algs.some((p) => p && p.alg === -7)) { const e = new Error('NotSupportedError'); e.ad = 'NotSupportedError'; throw e; }
  const dislanan = new Set((secenekler.excludeCredentials || []).map((c) => c && c.id));
  if ((mevcut || []).some((k) => k.rpId === rpId && dislanan.has(k.id))) {
    const e = new Error('InvalidStateError'); e.ad = 'InvalidStateError'; throw e;
  }
  const user = secenekler.user || {};
  if (!user.id) { const e = new Error('TypeError'); e.ad = 'TypeError'; throw e; }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = deB64u(jwk.x), y = deB64u(jwk.y);
  const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y]]);
  const kimlik = crypto.randomBytes(32);

  const sayac = Buffer.alloc(4);
  const kimlikUzunluk = Buffer.alloc(2); kimlikUzunluk.writeUInt16BE(kimlik.length);
  const authData = Buffer.concat([
    sha256(rpId), Buffer.from([bayraklar({ at: true })]), sayac,
    Buffer.alloc(16), kimlikUzunluk, kimlik, cbor(cose)
  ]);
  const clientDataJSON = Buffer.from(JSON.stringify({
    type: 'webauthn.create', challenge: secenekler.challenge, origin, crossOrigin: false
  }));
  const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));

  const kayit = {
    id: b64u(kimlik),
    rpId,
    rpAdi: String(rp.name || rpId),
    kullaniciKimlik: user.id,
    kullaniciAdi: String(user.name || ''),
    kullaniciGoruntu: String(user.displayName || ''),
    ozelAnahtar: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url'),
    sayac: 0,
    zaman: Date.now(),
    sonKullanim: 0
  };
  return {
    kayit,
    yanit: {
      id: kayit.id,
      clientDataJSON: b64u(clientDataJSON),
      attestationObject: b64u(attestationObject),
      authenticatorData: b64u(authData),
      publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' })),
      publicKeyAlgorithm: -7,
      transports: ['internal']
    }
  };
}

/** Bu istek için uygun kayıtlar (allowCredentials boşsa bu rpId'nin hepsi). */
function adaylar(secenekler, origin, mevcut) {
  const rpId = String(secenekler.rpId || new URL(origin).hostname).toLowerCase();
  if (!rpIdGecerli(rpId, origin)) { const e = new Error('SecurityError'); e.ad = 'SecurityError'; throw e; }
  const izinli = (secenekler.allowCredentials || []).map((c) => c && c.id).filter(Boolean);
  return {
    rpId,
    liste: (mevcut || []).filter((k) => k.rpId === rpId && (!izinli.length || izinli.includes(k.id)))
  };
}

/** Seçilen kayıtla imzala. kayit.sayac artırılır (çağıran saklar). */
function imzala(kayit, secenekler, origin) {
  kayit.sayac = (kayit.sayac || 0) + 1;
  const sayac = Buffer.alloc(4); sayac.writeUInt32BE(kayit.sayac >>> 0);
  const authData = Buffer.concat([sha256(kayit.rpId), Buffer.from([bayraklar({})]), sayac]);
  const clientDataJSON = Buffer.from(JSON.stringify({
    type: 'webauthn.get', challenge: secenekler.challenge, origin, crossOrigin: false
  }));
  const anahtar = crypto.createPrivateKey({ key: deB64u(kayit.ozelAnahtar), format: 'der', type: 'pkcs8' });
  const imza = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]),
    { key: anahtar, dsaEncoding: 'der' });
  kayit.sonKullanim = Date.now();
  return {
    id: kayit.id,
    clientDataJSON: b64u(clientDataJSON),
    authenticatorData: b64u(authData),
    signature: b64u(imza),
    userHandle: kayit.kullaniciKimlik
  };
}

module.exports = { olustur, adaylar, imzala, rpIdGecerli, kokenAl, kullaniciGoruntu, cbor, b64u, deB64u };
