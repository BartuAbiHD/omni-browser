'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/store');
const { EklentiVeri } = require('../src/eklenti-veri');

const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-veri-')), 'v.json');
const store = new Store(dosya);
const olaylar = [];
let silinen = null;
const v = new EklentiVeri({
  store,
  yayinla: (ns, ad, d) => olaylar.push([ns, ad, d]),
  kanca: { temizle: async (t, s) => { silinen = [t, s]; }, ara: async () => {} }
});
let n = 0;
const ok = (c, ad) => { assert.ok(c, ad); n++; };
const hepsi = ['bookmarks', 'history', 'topSites', 'browsingData', 'privacy', 'sessions', 'search', 'fontSettings', 'contentSettings', 'tts'];
const M = { permissions: hepsi };
const c = (ns, y, ...a) => v.cagir('x', M, ns, y, a);

(async () => {
  // izin
  await assert.rejects(v.cagir('x', { permissions: [] }, 'bookmarks', 'getTree', []), /izni/); n++;

  // bookmarks
  const agac = (await c('bookmarks', 'getTree'))[0];
  ok(agac.id === '0' && agac.children.length === 2 && agac.children[0].id === '1', 'kök ağaç');
  const f = await c('bookmarks', 'create', { title: 'Klasör' });
  ok(f.id === 'f:Klasör' && f.parentId === '1', 'klasör oluştu (boş)');
  const a = await c('bookmarks', 'create', { parentId: f.id, title: 'A', url: 'https://a.com/' });
  ok(a.parentId === f.id && /^\d+$/.test(a.id), 'yer imi klasöre eklendi, sayısal kimlik');
  const b = await c('bookmarks', 'create', { title: 'B', url: 'https://b.com/' });
  ok(b.parentId === '1', 'çubuğa eklendi');
  ok((await c('bookmarks', 'getChildren', f.id)).length === 1, 'getChildren');
  ok((await c('bookmarks', 'search', 'b.com')).length === 1, 'search metin');
  ok((await c('bookmarks', 'search', { title: 'A' }))[0].url === 'https://a.com/', 'search title');
  ok((await c('bookmarks', 'get', [a.id, b.id])).length === 2, 'get dizi');
  await assert.rejects(c('bookmarks', 'get', '999'), /Can't find/); n++;
  await c('bookmarks', 'update', a.id, { title: 'A2' });
  ok((await c('bookmarks', 'get', a.id))[0].title === 'A2', 'update başlık');
  await c('bookmarks', 'move', b.id, { parentId: f.id });
  ok((await c('bookmarks', 'get', b.id))[0].parentId === f.id, 'move');
  const yeniAd = await c('bookmarks', 'update', f.id, { title: 'Yeni' });
  ok(yeniAd.id === 'f:Yeni', 'klasör yeniden adlandı');
  ok((await c('bookmarks', 'get', a.id))[0].parentId === 'f:Yeni', 'çocuklar yolu izledi');
  await assert.rejects(c('bookmarks', 'remove', 'f:Yeni'), /boş değil/); n++;
  await assert.rejects(c('bookmarks', 'remove', '1'), /root/); n++;
  await c('bookmarks', 'removeTree', 'f:Yeni');
  ok((await c('bookmarks', 'getRecent', 10)).length === 0, 'removeTree');
  ok(olaylar.some((o) => o[1] === 'onCreated') && olaylar.some((o) => o[1] === 'onRemoved') && olaylar.some((o) => o[1] === 'onMoved'), 'olaylar yayınlandı');

  // history
  store.veri.ayarlar.gecmisiKaydet = true;
  store.veri.gecmis = [
    { url: 'https://a.com/', baslik: 'A', zaman: Date.now() - 1000 },
    { url: 'https://a.com/', baslik: 'A', zaman: Date.now() - 2000 },
    { url: 'https://b.com/', baslik: 'B', zaman: Date.now() - 3000 }
  ];
  const h = await c('history', 'search', { text: '' });
  ok(h.length === 2 && h[0].visitCount === 2, 'history.search tekilleştirir');
  ok((await c('history', 'getVisits', { url: 'https://a.com/' })).length === 2, 'getVisits');
  await c('history', 'deleteUrl', { url: 'https://a.com/' });
  ok(store.veri.gecmis.length === 1, 'deleteUrl');
  await c('history', 'deleteAll');
  ok(store.veri.gecmis.length === 0 && olaylar.some((o) => o[1] === 'onVisitRemoved'), 'deleteAll');
  await assert.rejects(c('history', 'addUrl', { url: 'javascript:1' }), /http/); n++;

  // browsingData
  await c('browsingData', 'remove', { since: 5 }, { cookies: true, passwords: true, cache: true });
  ok(silinen[1] === 5 && silinen[0].includes('cookies') && !silinen[0].includes('passwords'), 'parolalar silinemez');
  await c('browsingData', 'removeCookies', {});
  ok(silinen[0].length === 1 && silinen[0][0] === 'cookies', 'removeCookies');
  await assert.rejects(c('browsingData', 'remove', {}, { yok: true }), /Bilinmeyen/); n++;

  // diğerleri
  ok((await c('privacy', 'get', 'network.webRTCIPHandlingPolicy', {})).levelOfControl === 'not_controllable', 'privacy');
  ok((await c('sessions', 'getRecentlyClosed')).length === 0, 'sessions');
  ok((await c('topSites', 'get')).length === 0, 'topSites');
  ok((await c('contentSettings', 'get', 'cookies', {})).setting === 'allow', 'contentSettings');
  console.log('✓ ' + n + ' eklenti veri api testinin hepsi geçti.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
