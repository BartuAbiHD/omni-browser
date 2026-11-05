'use strict';
// Geçiş anahtarı yazılım doğrulayıcısı: kayıt -> imza, bir WebAuthn doğrulayıcısının yaptığı gibi doğrulanır.
const assert = require('node:assert');
const crypto = require('node:crypto');
const g = require('../src/gecis-anahtari');

let n = 0;
const ok = (ad, f) => { f(); n++; console.log('  ok', ad); };
const origin = 'https://login.example.com';
const challenge = g.b64u(crypto.randomBytes(32));

ok('rpId doğrulama', () => {
  assert(g.rpIdGecerli('example.com', origin));
  assert(g.rpIdGecerli('login.example.com', origin));
  assert(!g.rpIdGecerli('com', origin));
  assert(!g.rpIdGecerli('evil.com', origin));
  assert(!g.rpIdGecerli('example.com', 'http://login.example.com'));
  assert(g.rpIdGecerli('localhost', 'http://localhost:3000'));
});

const kayitSonuc = g.olustur({
  rp: { id: 'example.com', name: 'Example' }, user: { id: g.b64u('u1'), name: 'ali', displayName: 'Ali' },
  challenge, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], excludeCredentials: []
}, origin, []);

ok('kayıt çıktısı', () => {
  const { kayit, yanit } = kayitSonuc;
  assert.strictEqual(kayit.rpId, 'example.com');
  const cd = JSON.parse(g.deB64u(yanit.clientDataJSON));
  assert.deepStrictEqual([cd.type, cd.origin, cd.challenge], ['webauthn.create', origin, challenge]);
  const ad = g.deB64u(yanit.authenticatorData);
  assert(ad.subarray(0, 32).equals(crypto.createHash('sha256').update('example.com').digest()));
  assert.strictEqual(ad[32] & 0x41, 0x41);   // UP + AT
});

ok('hariç tutulan kimlik reddedilir', () => {
  assert.throws(() => g.olustur({
    rp: { id: 'example.com' }, user: { id: 'x', name: 'a' }, challenge,
    pubKeyCredParams: [{ alg: -7 }], excludeCredentials: [{ id: kayitSonuc.kayit.id }]
  }, origin, [kayitSonuc.kayit]), (e) => e.ad === 'InvalidStateError');
});

ok('ES256 olmayan algoritma reddedilir', () => {
  assert.throws(() => g.olustur({
    rp: { id: 'example.com' }, user: { id: 'x', name: 'a' }, challenge, pubKeyCredParams: [{ alg: -257 }]
  }, origin, []), (e) => e.ad === 'NotSupportedError');
});

ok('imza doğrulanır, sayaç artar', () => {
  const { kayit, yanit } = kayitSonuc;
  const a = g.adaylar({ rpId: 'example.com', challenge, allowCredentials: [] }, origin, [kayit]);
  assert.strictEqual(a.liste.length, 1);
  const r = g.imzala(kayit, { challenge }, origin);
  assert.strictEqual(kayit.sayac, 1);
  const pub = crypto.createPublicKey({ key: g.deB64u(yanit.publicKey), format: 'der', type: 'spki' });
  const veri = Buffer.concat([g.deB64u(r.authenticatorData),
    crypto.createHash('sha256').update(g.deB64u(r.clientDataJSON)).digest()]);
  assert(crypto.verify('sha256', veri, { key: pub, dsaEncoding: 'der' }, g.deB64u(r.signature)));
});

ok('başka site aday olmaz, yanlış köken reddedilir', () => {
  const { kayit } = kayitSonuc;
  assert.strictEqual(g.adaylar({ rpId: 'example.com' }, 'https://a.example.com', [kayit]).liste.length, 1);
  assert.throws(() => g.adaylar({ rpId: 'example.com' }, 'https://evil.com', [kayit]), (e) => e.ad === 'SecurityError');
  assert.strictEqual(g.adaylar({ allowCredentials: [{ id: 'baska' }] }, origin, [kayit]).liste.length, 0);
});

console.log(n + ' test geçti');
