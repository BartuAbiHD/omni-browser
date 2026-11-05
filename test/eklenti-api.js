'use strict';
// chrome.cookies / chrome.downloads köprüsü: izin denetimi ve davranış (sahte oturumla).
const A = require('../src/eklenti-api');

let hata = 0, gecen = 0;
function esit(ad, bulunan, beklenen) {
  if (JSON.stringify(bulunan) === JSON.stringify(beklenen)) { gecen++; return; }
  hata++;
  console.error('✗ ' + ad + '\n   bulunan:  ' + JSON.stringify(bulunan) + '\n   beklenen: ' + JSON.stringify(beklenen));
}
async function reddedilir(ad, p, parca) {
  try { await p; } catch (e) { if (!parca || e.message.includes(parca)) { gecen++; return; } hata++; console.error('✗ ' + ad + ' yanlış hata: ' + e.message); return; }
  hata++; console.error('✗ ' + ad + ' reddedilmedi');
}

// --- eşleşme desenleri ---
esit('all_urls http', A.urlEslesir('<all_urls>', 'http://a.com/x'), true);
esit('all_urls dosya yok', A.urlEslesir('<all_urls>', 'file:///c:/x'), false);
esit('alt alan adı', A.urlEslesir('https://*.ornek.com/*', 'https://a.b.ornek.com/yol'), true);
esit('kök alan adı alt alan deseniyle', A.urlEslesir('https://*.ornek.com/*', 'https://ornek.com/'), true);
esit('benzer alan adı reddedilir', A.urlEslesir('https://*.ornek.com/*', 'https://evilornek.com/'), false);
esit('sonek tuzağı', A.urlEslesir('https://ornek.com/*', 'https://ornek.com.evil.net/'), false);
esit('şema uyuşmazlığı', A.urlEslesir('https://ornek.com/*', 'http://ornek.com/'), false);
esit('* şema her ikisi', A.urlEslesir('*://ornek.com/*', 'http://ornek.com/a'), true);
esit('yol kısıtı', A.urlEslesir('https://ornek.com/api/*', 'https://ornek.com/baska'), false);
esit('yol kısıtı eşleşir', A.urlEslesir('https://ornek.com/api/*', 'https://ornek.com/api/x?y=1'), true);
esit('geçersiz desen', A.urlEslesir('ornek.com', 'https://ornek.com/'), false);
esit('geçersiz adres', A.urlEslesir('<all_urls>', 'bozuk'), false);
esit('guvenliDosyaAdi göreli', A.guvenliDosyaAdi('a/b.txt'), 'a/b.txt');
esit('guvenliDosyaAdi ..', A.guvenliDosyaAdi('../x'), null);
esit('guvenliDosyaAdi iç ..', A.guvenliDosyaAdi('a/../../x'), null);
esit('guvenliDosyaAdi sürücü', A.guvenliDosyaAdi('C:/x'), null);
esit('guvenliDosyaAdi mutlak', A.guvenliDosyaAdi('/etc/passwd'), 'etc/passwd');
esit('guvenliDosyaAdi karakter', A.guvenliDosyaAdi('a<b>.txt'), 'a_b_.txt');

// --- sahte oturum ---
const cerezler = [
  { name: 'a', value: '1', domain: '.ornek.com', hostOnly: false, path: '/', secure: true, httpOnly: false, session: true, sameSite: 'lax' },
  { name: 'b', value: '2', domain: 'baska.net', hostOnly: true, path: '/', secure: false, httpOnly: true, session: false, expirationDate: 123, sameSite: 'unspecified' },
  { name: 'a', value: '3', domain: 'ornek.com', hostOnly: true, path: '/yol', secure: true, httpOnly: false, session: true, sameSite: 'strict' }
];
const olaylar = {};
const ses = {
  cookies: {
    async get(f) {
      return cerezler.filter((c) => (f.name === undefined || c.name === f.name)
        && (f.domain === undefined || c.domain.replace(/^\./, '').endsWith(f.domain))
        && (f.url === undefined || f.url.includes(c.domain.replace(/^\./, ''))));
    },
    async set(a) {
      cerezler.push({ name: a.name, value: a.value, domain: a.domain || new URL(a.url).hostname, hostOnly: !a.domain, path: a.path || '/', secure: !!a.secure, httpOnly: !!a.httpOnly, session: true, sameSite: a.sameSite || 'unspecified' });
    },
    async remove(url, ad) { const i = cerezler.findIndex((c) => c.name === ad && url.includes(c.domain.replace(/^\./, ''))); if (i >= 0) cerezler.splice(i, 1); },
    on(ad, f) { olaylar[ad] = f; }
  }
};
const KIM = 'a'.repeat(32), BASKA = 'b'.repeat(32), IZINSIZ = 'c'.repeat(32);
const manifestler = {
  [KIM]: { permissions: ['cookies', 'downloads'], host_permissions: ['https://*.ornek.com/*'] },
  [BASKA]: { permissions: ['cookies'], host_permissions: ['<all_urls>'] },
  [IZINSIZ]: { permissions: ['storage'], host_permissions: ['<all_urls>'] }
};
const bildirimler = [];
const indirmeCagrilari = [];
const indirme = {
  baslat: async (o) => { indirmeCagrilari.push(['baslat', o]); return 7; },
  ara: async (q) => { indirmeCagrilari.push(['ara', q]); return []; },
  iptal: async (id) => { indirmeCagrilari.push(['iptal', id]); }, duraklat: async () => {}, surdur: async () => {},
  sil: async () => [], goster: async () => {}, klasoruAc: async () => {}
};
const api = new A.EklentiApi({
  ses, manifest: (k) => manifestler[k] || null, bildir: (...a) => bildirimler.push(a), indirme
});

(async () => {
  // cookies
  const hepsi = await api.cagir(KIM, 'cookies', 'getAll', [{}]);
  esit('getAll yalnızca izinli alan adı', hepsi.map((c) => c.name + c.domain), ['a.ornek.com', 'aornek.com']);
  esit('getAll baska.net gizli', hepsi.some((c) => c.domain === 'baska.net'), false);
  const tumu = await api.cagir(BASKA, 'cookies', 'getAll', [{}]);
  esit('all_urls her çerezi görür', tumu.length, 3);
  esit('çerez dönüşümü sameSite', tumu[0].sameSite, 'lax');
  esit('çerez dönüşümü storeId', tumu[0].storeId, '0');
  esit('oturum çerezinde expirationDate yok', 'expirationDate' in tumu[0], false);
  esit('kalıcı çerezde expirationDate var', tumu.find((c) => c.name === 'b').expirationDate, 123);
  await reddedilir('izinsiz url', api.cagir(KIM, 'cookies', 'getAll', [{ url: 'https://baska.net/' }]), 'host izni');
  const bir = await api.cagir(KIM, 'cookies', 'get', [{ url: 'https://ornek.com/yol/x', name: 'a' }]);
  esit('get en uzun yol', bir && bir.value, '3');
  await reddedilir('get izinsiz', api.cagir(KIM, 'cookies', 'get', [{ url: 'https://baska.net/', name: 'b' }]), 'host izni');
  const yeni = await api.cagir(KIM, 'cookies', 'set', [{ url: 'https://www.ornek.com/', name: 'n', value: 'v' }]);
  esit('set çalıştı', yeni && yeni.value, 'v');
  await reddedilir('set izinsiz url', api.cagir(KIM, 'cookies', 'set', [{ url: 'https://baska.net/', name: 'x', value: 'y' }]), 'host izni');
  await reddedilir('set başka alan adına', api.cagir(KIM, 'cookies', 'set', [{ url: 'https://www.ornek.com/', name: 'x', value: 'y', domain: 'baska.net' }]), 'alan adı');
  await api.cagir(KIM, 'cookies', 'remove', [{ url: 'https://www.ornek.com/', name: 'n' }]);
  esit('remove', cerezler.some((c) => c.name === 'n'), false);
  await reddedilir('remove izinsiz', api.cagir(KIM, 'cookies', 'remove', [{ url: 'https://baska.net/', name: 'b' }]), 'host izni');
  esit('cookie store', (await api.cagir(KIM, 'cookies', 'getAllCookieStores', [{}]))[0].id, '0');
  await reddedilir("'cookies' izni yok", api.cagir(IZINSIZ, 'cookies', 'getAll', [{}]), 'izni');
  await reddedilir('bilinmeyen eklenti', api.cagir('d'.repeat(32), 'cookies', 'getAll', [{}]), 'etkin değil');
  await reddedilir('geçersiz kimlik', api.cagir('../x', 'cookies', 'getAll', [{}]), 'bilinmiyor');
  await reddedilir('bilinmeyen yöntem', api.cagir(KIM, 'cookies', 'ucur', [{}]), 'desteklenmiyor');
  await reddedilir('file: adresi', api.cagir(BASKA, 'cookies', 'getAll', [{ url: 'file:///x' }]), 'http');

  // çerez olayları
  api.cerezOlaylariniBaslat(() => [KIM, BASKA, IZINSIZ]);
  olaylar.changed({}, { name: 'a', value: '1', domain: '.ornek.com', path: '/', secure: true, session: true }, 'expired-overwrite', true);
  esit('olay: izinli iki eklentiye gitti', bildirimler.map((b) => b[0]), [KIM, BASKA]);
  esit('olay: ad', bildirimler[0][2], 'onChanged');
  esit('olay: neden alt çizgili', bildirimler[0][3].cause, 'expired_overwrite');
  esit('olay: removed', bildirimler[0][3].removed, true);
  olaylar.changed({}, { name: 'b', value: '2', domain: 'baska.net', path: '/', secure: false, session: true }, 'explicit', false);
  esit('olay: host izni olmayan eklentiye gitmedi', bildirimler.filter((b) => b[3].cookie.name === 'b').map((b) => b[0]), [BASKA]);

  // downloads
  esit('download id döner', await api.cagir(KIM, 'downloads', 'download', [{ url: 'https://x.com/a.zip', filename: 'a.zip' }]), 7);
  esit('download çağrısı', indirmeCagrilari[0][1].url, 'https://x.com/a.zip');
  await reddedilir('download file:', api.cagir(KIM, 'downloads', 'download', [{ url: 'file:///c:/x' }]), 'http');
  await reddedilir('download javascript:', api.cagir(KIM, 'downloads', 'download', [{ url: 'javascript:alert(1)' }]), 'http');
  await reddedilir("'downloads' izni yok", api.cagir(BASKA, 'downloads', 'download', [{ url: 'https://x.com/a' }]), 'izni');
  await api.cagir(KIM, 'downloads', 'search', [{ state: 'complete' }]);
  esit('search yönlendirildi', indirmeCagrilari[indirmeCagrilari.length - 1][0], 'ara');
  await api.cagir(KIM, 'downloads', 'cancel', [5]);
  esit('cancel yönlendirildi', indirmeCagrilari[indirmeCagrilari.length - 1], ['iptal', 5]);
  await reddedilir('downloads.bilinmeyen', api.cagir(KIM, 'downloads', 'acceptDanger', [1]), 'desteklenmiyor');
  await reddedilir('bilinmeyen ad alanı', api.cagir(KIM, 'tabs', 'query', [{}]), 'Desteklenmeyen');

  // --- permissions / identity ---
  esit('desenKapsar all_urls', A.desenKapsar('<all_urls>', 'https://a.com/*'), true);
  esit('desenKapsar alt alan', A.desenKapsar('*://*.youtube.com/*', 'https://www.youtube.com/*'), true);
  esit('desenKapsar kök alan', A.desenKapsar('https://*.ornek.com/*', 'https://ornek.com/*'), true);
  esit('desenKapsar dar -> geniş yok', A.desenKapsar('https://a.ornek.com/*', 'https://*.ornek.com/*'), false);
  esit('desenKapsar şema', A.desenKapsar('https://a.com/*', 'http://a.com/*'), false);
  esit('desenKapsar benzer alan adı', A.desenKapsar('https://*.ornek.com/*', 'https://evilornek.com/*'), false);

  const PK = 'e'.repeat(32);
  manifestler[PK] = {
    permissions: ['storage'], optional_permissions: ['identity'],
    optional_host_permissions: ['https://*.ornek.com/*'], host_permissions: ['https://a.com/*']
  };
  const verilen = { permissions: [], origins: [] };
  let sorulan = null, onay = true;
  const izinApi = new A.EklentiApi({
    ses,
    manifest: (k) => {
      const m = manifestler[k];
      if (!m) return null;
      return { ...m, permissions: [...(m.permissions || []), ...verilen.permissions], host_permissions: [...(m.host_permissions || []), ...verilen.origins] };
    },
    bildir: (...x) => bildirimler.push(x),
    izinler: {
      onayIste: async (k, istek) => { sorulan = istek; return onay; },
      ver: (k, i) => { verilen.permissions.push(...i.permissions); verilen.origins.push(...i.origins); },
      kaldir: (k, i) => {
        verilen.permissions = verilen.permissions.filter((p) => !i.permissions.includes(p));
        verilen.origins = verilen.origins.filter((o) => !i.origins.includes(o));
      },
      verilen: () => ({ permissions: [...verilen.permissions], origins: [...verilen.origins] })
    },
    kimlik: { webAuth: async (o) => 'https://' + o.kimlik + '.chromiumapp.org/cb?code=1' }
  });
  esit('contains: sahip olunan', await izinApi.cagir(PK, 'permissions', 'contains', [{ permissions: ['storage'] }]), true);
  esit('contains: sahip olunmayan', await izinApi.cagir(PK, 'permissions', 'contains', [{ permissions: ['identity'] }]), false);
  esit('contains: host', await izinApi.cagir(PK, 'permissions', 'contains', [{ origins: ['https://a.com/*'] }]), true);
  await reddedilir('request: isteğe bağlı olmayan', izinApi.cagir(PK, 'permissions', 'request', [{ permissions: ['cookies'] }]), 'isteğe bağlı');
  await reddedilir('request: isteğe bağlı olmayan host', izinApi.cagir(PK, 'permissions', 'request', [{ origins: ['https://evil.com/*'] }]), 'host');
  await reddedilir('geçersiz desen', izinApi.cagir(PK, 'permissions', 'contains', [{ origins: ['evil.com'] }]), 'Geçersiz');
  onay = false;
  esit('request: kullanıcı reddetti', await izinApi.cagir(PK, 'permissions', 'request', [{ permissions: ['identity'] }]), false);
  esit('reddedince izin verilmedi', verilen.permissions.length, 0);
  onay = true;
  esit('request: onaylandı', await izinApi.cagir(PK, 'permissions', 'request', [{ permissions: ['identity'], origins: ['https://x.ornek.com/*'] }]), true);
  esit('sorulan istek', sorulan, { permissions: ['identity'], origins: ['https://x.ornek.com/*'] });
  esit('onay sonrası contains', await izinApi.cagir(PK, 'permissions', 'contains', [{ permissions: ['identity'], origins: ['https://x.ornek.com/*'] }]), true);
  esit('onAdded olayı', bildirimler.some((b) => b[0] === PK && b[2] === 'onAdded'), true);
  const hepsi2 = await izinApi.cagir(PK, 'permissions', 'getAll', [{}]);
  esit('getAll izinler', hepsi2.permissions.sort(), ['identity', 'storage']);
  esit('getAll origins', hepsi2.origins.includes('https://x.ornek.com/*'), true);
  sorulan = null;
  await izinApi.cagir(PK, 'permissions', 'request', [{ permissions: ['identity'] }]);
  esit('zaten sahipse sormaz', sorulan, null);
  esit('remove', await izinApi.cagir(PK, 'permissions', 'remove', [{ permissions: ['identity'] }]), true);
  esit('remove sonrası', await izinApi.cagir(PK, 'permissions', 'contains', [{ permissions: ['identity'] }]), false);
  esit('onRemoved olayı', bildirimler.some((b) => b[0] === PK && b[2] === 'onRemoved'), true);
  esit('getRedirectURL', await izinApi.cagir(PK, 'identity', 'getRedirectURL', ['x/y']), 'https://' + PK + '.chromiumapp.org/x/y');
  esit('getProfileUserInfo boş', await izinApi.cagir(PK, 'identity', 'getProfileUserInfo', [{}]), { email: '', id: '' });
  await reddedilir('launchWebAuthFlow: identity izni yok', izinApi.cagir(PK, 'identity', 'launchWebAuthFlow', [{ url: 'https://a.com/x', interactive: true }]), 'izni');
  await izinApi.cagir(PK, 'permissions', 'request', [{ permissions: ['identity'] }]);
  esit('launchWebAuthFlow: izin sonrası', (await izinApi.cagir(PK, 'identity', 'launchWebAuthFlow', [{ url: 'https://a.com/x', interactive: true }])).startsWith('https://' + PK + '.chromiumapp.org/'), true);
  await reddedilir('launchWebAuthFlow: http reddedilir', izinApi.cagir(PK, 'identity', 'launchWebAuthFlow', [{ url: 'http://a.com/x' }]), 'https');
  await reddedilir('launchWebAuthFlow: geçersiz url', izinApi.cagir(PK, 'identity', 'launchWebAuthFlow', [{ url: 'bozuk' }]), 'Geçersiz');
  await reddedilir('identity.getAuthToken desteklenmiyor', izinApi.cagir(PK, 'identity', 'getAuthToken', [{}]), 'desteklenmiyor');

  // --- tabCapture ---
  const TK = 'f'.repeat(32), TZ = '1'.repeat(32).replace(/1/g, 'g');
  manifestler[TK] = { permissions: ['tabCapture'] };
  manifestler[TZ] = { permissions: ['storage'] };
  const hazirlananlar = [];
  let ekranHata = null;
  const ekranApi = new A.EklentiApi({
    ses, manifest: (k) => manifestler[k] || null, bildir: () => {},
    ekran: { hazirla: async (k) => { if (ekranHata) throw new Error(ekranHata); hazirlananlar.push(k); return true; } }
  });
  esit('tabCapture.capture onay açar', await ekranApi.cagir(TK, 'tabCapture', 'capture', [{ audio: true }]), 'cvs-tab');
  esit('capture çağıran eklentiyi bildirdi', hazirlananlar, [TK]);
  esit('getMediaStreamId', await ekranApi.cagir(TK, 'tabCapture', 'getMediaStreamId', [{}]), 'cvs-tab');
  esit('getCapturedTabs boş', await ekranApi.cagir(TK, 'tabCapture', 'getCapturedTabs', []), []);
  await reddedilir("tabCapture izni yok", ekranApi.cagir(TZ, 'tabCapture', 'capture', [{ audio: true }]), 'izni');
  esit('izinsiz eklenti için onay açılmadı', hazirlananlar.length, 2);
  ekranHata = 'Etkin sekmenin sesi yakalanamıyor';
  await reddedilir('iç sayfa/sekme yok', ekranApi.cagir(TK, 'tabCapture', 'capture', [{ audio: true }]), 'yakalanamıyor');
  await reddedilir('tabCapture bilinmeyen yöntem', ekranApi.cagir(TK, 'tabCapture', 'captureOffscreenTab', [{}]), 'desteklenmiyor');

  if (hata) { console.error('\n' + hata + ' eklenti api testi başarısız.'); process.exit(1); }
  console.log('✓ ' + gecen + ' eklenti api testinin hepsi geçti.');
})();
