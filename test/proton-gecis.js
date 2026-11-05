'use strict';
// Proton Pass geçiş anahtarı içe aktarımı: gözlenen kodlamayı (MessagePack içinde MessagePack,
// COSE anahtarı) yeniden üretir, çözer ve imzanın doğrulandığını sınar.
const assert = require('node:assert');
const crypto = require('node:crypto');
const { protonGecisCoz } = require('../src/proton-gecis');
const { protonPassAyristir } = require('../src/tarayici-aktar');
const g = require('../src/gecis-anahtari');

let n = 0;
const ok = (ad, f) => { f(); n++; console.log('  ok', ad); };

/* En küçük MessagePack kodlayıcı (yalnız bu testin ihtiyacı) */
function mp(v) {
  if (v === null) return Buffer.from([0xc0]);
  if (typeof v === 'number') {
    if (v >= 0 && v < 128) return Buffer.from([v]);
    if (v >= 128 && v < 256) return Buffer.from([0xcc, v]);
    if (v < 0 && v >= -32) return Buffer.from([v + 256]);
    throw new Error('sayı');
  }
  if (typeof v === 'string') { const b = Buffer.from(v); return Buffer.concat([Buffer.from([0xa0 | b.length]), b]); }
  if (Array.isArray(v)) {
    const baslik = v.length < 16 ? Buffer.from([0x90 | v.length]) : Buffer.from([0xdc, v.length >> 8, v.length & 255]);
    return Buffer.concat([baslik, ...v.map(mp)]);
  }
  const e = Object.entries(v);
  return Buffer.concat([Buffer.from([0x80 | e.length]), ...e.flatMap(([k, d]) => [mp(k), mp(d)])]);
}

function protonPasskey(rpId, kullanici, bozPar) {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  const kimlik = crypto.randomBytes(16), uhd = Buffer.from('kullanici-' + kullanici);
  const crv = [1, ...new Array(15).fill(0)];
  const ic = mp({
    key: {
      kty: { t: 'assign', c: 'EC2' }, kid: [], alg: { t: 'assign', c: 'ES256' }, kops: [], biv: [],
      par: [
        [{ t: 'int', c: -1 }, { t: 'int', c: { inner: crv } }],
        [{ t: 'int', c: -2 }, { t: 'bytes', c: [...g.deB64u(jwk.x)] }],
        [{ t: 'int', c: -3 }, { t: 'bytes', c: [...g.deB64u(jwk.y)] }],
        [{ t: 'int', c: -4 }, { t: 'bytes', c: [...g.deB64u(bozPar ? jwk.x : jwk.d)] }]
      ]
    },
    cid: [...kimlik], rid: rpId, uhd: [...uhd], cnt: null, ext: { hmac_secret: null }, udn: kullanici, un: kullanici
  });
  const dis = mp({ c: [...ic], v: 1 });
  return {
    pk: { keyId: 'x', content: dis.toString('base64'), rpId, rpName: rpId, userName: kullanici,
      userDisplayName: kullanici, createTime: 1792345659 },
    kimlik, uhd
  };
}

ok('çözülür ve kimlik/kullanıcı eşleşir', () => {
  const { pk, kimlik, uhd } = protonPasskey('example.com', 'ali');
  const k = protonGecisCoz(pk);
  assert(k);
  assert.strictEqual(k.rpId, 'example.com');
  assert.strictEqual(k.id, g.b64u(kimlik));
  assert.strictEqual(k.kullaniciKimlik, g.b64u(uhd));
  assert.strictEqual(k.zaman, 1792345659000);
});

ok('içe alınan anahtarla atılan imza doğrulanır', () => {
  const { pk } = protonPasskey('example.com', 'ali');
  const k = protonGecisCoz(pk);
  const origin = 'https://example.com';
  const r = g.imzala(k, { challenge: g.b64u(crypto.randomBytes(32)) }, origin);
  const pub = crypto.createPublicKey(crypto.createPrivateKey({ key: g.deB64u(k.ozelAnahtar), format: 'der', type: 'pkcs8' }));
  const veri = Buffer.concat([g.deB64u(r.authenticatorData),
    crypto.createHash('sha256').update(g.deB64u(r.clientDataJSON)).digest()]);
  assert(crypto.verify('sha256', veri, { key: pub, dsaEncoding: 'der' }, g.deB64u(r.signature)));
});

ok('tutarsız anahtar ve çöp veri reddedilir (null)', () => {
  assert.strictEqual(protonGecisCoz(protonPasskey('example.com', 'ali', true).pk), null);
  assert.strictEqual(protonGecisCoz({ content: 'AAAA' }), null);
  assert.strictEqual(protonGecisCoz({ content: Buffer.from('zzzz').toString('base64') }), null);
  assert.strictEqual(protonGecisCoz(null), null);
});

ok('rpId uyuşmazlığı reddedilir', () => {
  const { pk } = protonPasskey('example.com', 'ali');
  pk.rpId = 'baska.com';
  assert.strictEqual(protonGecisCoz(pk), null);
});

ok('JSON dışa aktarım: parolasız geçiş anahtarı kaydı atlanan sayılmaz', () => {
  const { pk } = protonPasskey('example.com', 'ali');
  const bozuk = { content: 'AAAA' };
  const json = JSON.stringify({ vaults: { v: { items: [
    { data: { type: 'login', content: { itemUsername: 'ali', password: '', urls: ['https://example.com/'], passkeys: [pk, bozuk] } } }
  ] } } });
  const s = protonPassAyristir(json);
  assert.strictEqual(s.gecis.length, 1);
  assert.strictEqual(s.gecisAtlanan, 1);
  assert.strictEqual(s.parolalar.length, 0);
  assert.strictEqual(s.atlanan, 0);
});

console.log(n + ' proton geçiş anahtarı testi geçti');
