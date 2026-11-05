'use strict';
const assert = require('node:assert');
const { EklentiApi } = require('../src/eklenti-api');

const K = 'a'.repeat(32), K2 = 'b'.repeat(32);
const olaylar = [];
const manifestler = { [K]: { permissions: ['storage'] }, [K2]: { permissions: [] } };
const api = new EklentiApi({ ses: {}, manifest: (k) => manifestler[k] || null, bildir: (...a) => olaylar.push(a) });
const c = (k, y, ...a) => api.cagir(k, 'storageSession', y, a);
let n = 0; const ok = (x, ad) => { assert.ok(x, ad); n++; };

(async () => {
  await c(K, 'set', { a: 1, b: { x: 2 } });
  assert.deepStrictEqual(await c(K, 'get', 'a'), { a: 1 }); n++;
  assert.deepStrictEqual(await c(K, 'get', null), { a: 1, b: { x: 2 } }); n++;
  assert.deepStrictEqual(await c(K, 'get', { a: 9, z: 7 }), { a: 1, z: 7 }); n++;   // varsayılan değerler
  assert.deepStrictEqual(await c(K, 'getKeys'), ['a', 'b']); n++;
  ok(olaylar[0][2] === 'onChanged' && olaylar[0][3].a.newValue === 1 && !('oldValue' in olaylar[0][3].a), 'ilk set olayı');
  await c(K, 'set', { a: 2 });
  ok(olaylar[1][3].a.oldValue === 1 && olaylar[1][3].a.newValue === 2, 'güncelleme olayı');
  await c(K, 'remove', ['a']);
  assert.deepStrictEqual(await c(K, 'get', 'a'), {}); n++;
  ok((await c(K, 'getBytesInUse', null)) > 0, 'getBytesInUse');
  await c(K, 'clear');
  assert.deepStrictEqual(await c(K, 'get', null), {}); n++;
  // eklentiler birbirinin deposunu görmez; izin zorunlu
  await assert.rejects(c(K2, 'set', { a: 1 }), /izni/); n++;
  manifestler[K2].permissions.push('storage');
  assert.deepStrictEqual(await c(K2, 'get', null), {}); n++;
  await assert.rejects(c(K, 'set', { dev: 'x'.repeat(11 * 1024 * 1024) }), /QUOTA/); n++;
  api.oturumTemizle(K);
  console.log('✓ ' + n + ' eklenti oturum deposu testinin hepsi geçti.');
})().catch((e) => { console.error(e); process.exit(1); });
