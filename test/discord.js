'use strict';
// Discord Rich Presence: IPC cercevesi, site eslemesi ve etkinlik uretimi (Discord/Electron gerekmez).
const { cerceveYaz, cerceveOku, OP, DiscordRpc } = require('../src/discord-rpc');
const { siteBul, etkinlikUret } = require('../src/discord-sunum');
const { EventEmitter } = require('node:events');

let hata = 0, gecen = 0;
function esit(ad, bulunan, beklenen) {
  if (JSON.stringify(bulunan) === JSON.stringify(beklenen)) { gecen++; return; }
  hata++;
  console.error('✗ ' + ad + '\n   bulunan:  ' + JSON.stringify(bulunan) + '\n   beklenen: ' + JSON.stringify(beklenen));
}

// --- cerceve ---
const c = cerceveYaz(OP.ELSIKISMA, { v: 1, client_id: '1' });
esit('cerceve op', c.readInt32LE(0), 0);
esit('cerceve uzunluk', c.readInt32LE(4), c.length - 8);
const oku = cerceveOku(Buffer.concat([c, c.subarray(0, 5)]));
esit('tam cerceve okunur', oku.cerceveler.length, 1);
esit('yarim cerceve kalir', oku.kalan.length, 5);
const bozuk = Buffer.alloc(8); bozuk.writeInt32LE(1, 0); bozuk.writeInt32LE(99999999, 4);
esit('asiri buyuk cerceve reddedilir', !!cerceveOku(bozuk).bozuk, true);

// --- site esleme ---
esit('anivesta', siteBul('https://anivesta.com/watch/x').ad, 'anivesta');
esit('www.anivesta', siteBul('https://www.anivesta.com/').ad, 'anivesta');
esit('videovitrini alt alan', siteBul('https://m.videovitrini.com/watch/1').ad, 'videovitrini');
esit('taklit alan adi', siteBul('https://anivesta.com.evil.io/'), null);
esit('taklit onek', siteBul('https://evilvideovitrini.com/'), null);
esit('baska site', siteBul('https://example.com/'), null);
esit('dosya semasi', siteBul('file:///C:/anivesta.com'), null);

// --- anivesta ---
const simdi = 1_000_000_000_000;
const izle = etkinlikUret('https://anivesta.com/watch/a/1', {
  href: 'https://anivesta.com/watch/a/1', path: '/watch/a/1',
  meta: { anime: 'Naruto', season: 2, episode: 5, poster: 'https://anivesta.com/p.jpg', animeUrl: 'https://anivesta.com/anime/naruto' },
  mediaState: { status: 'playing', currentTime: '100', duration: '1400' }
}, { butonlar: true }, simdi);
esit('clientId', izle.clientId, '1323996217675616321');
esit('detay', izle.etkinlik.details, 'Naruto');
esit('durum', izle.etkinlik.state, '2. Sezon 5. Bölüm');
esit('tur izliyor', izle.etkinlik.type, 3);
esit('bitis', izle.etkinlik.timestamps.end, simdi + 1300 * 1000);
esit('buton sayisi', izle.etkinlik.buttons.length, 2);

const dur = etkinlikUret('https://anivesta.com/watch/a/1', {
  href: 'https://anivesta.com/watch/a/1', path: '/watch/a/1', meta: { anime: 'X', episode: 1 }, mediaState: { status: 'paused' }
}, { butonlar: false }, simdi);
esit('duraklatinca zaman yok', dur.etkinlik.timestamps, undefined);
esit('buton kapaliysa yok', dur.etkinlik.buttons, undefined);

const kotu = etkinlikUret('https://anivesta.com/watch/a/1', {
  href: 'https://anivesta.com/watch/a/1', path: '/watch/a/1',
  meta: { anime: 'Y', poster: 'javascript:alert(1)', animeUrl: 'https://evil.io/x', url: 'http://anivesta.com/a' }
}, { butonlar: true }, simdi);
esit('zararli poster logoya duser', kotu.etkinlik.assets.large_image.startsWith('https://cdn.rcd.gg/'), true);
esit('site disi/http dugme elenir', kotu.etkinlik.buttons, undefined);

// gercek video zamani ve duraklatma metni
const gv = etkinlikUret('https://anivesta.com/watch/a/1', {
  href: 'https://anivesta.com/watch/a/1', path: '/watch/a/1', meta: { anime: 'X', episode: 3 },
  mediaState: { status: 'playing', currentTime: '5', duration: '1400' },
  videolar: [{ paused: true, currentTime: 600, duration: 1500 }]
}, {}, simdi);
esit('duraklatinca durum metni', gv.etkinlik.state, 'Duraklatıldı • 3. Bölüm');
esit('duraklatinca zaman yok (video)', gv.etkinlik.timestamps, undefined);
const gv2 = etkinlikUret('https://anivesta.com/watch/a/1', {
  href: 'https://anivesta.com/watch/a/1', path: '/watch/a/1', meta: { anime: 'X', episode: 3 },
  mediaState: { status: 'paused', currentTime: '5', duration: '1400' },
  videolar: [{ paused: false, currentTime: 600, duration: 1500 }]
}, {}, simdi);
esit('video zamani veri-ozelligini ezer', gv2.etkinlik.timestamps, { start: simdi - 600000, end: simdi + 900000 });

esit('anasayfa', etkinlikUret('https://anivesta.com/', { path: '/' }, {}, simdi).etkinlik.details, 'Anasayfada Geziniyor');
esit('kesfet', etkinlikUret('https://anivesta.com/kesfet', { path: '/kesfet' }, {}, simdi).etkinlik.details, 'Anime Keşfediyor');
esit('uzun konu kirpilir', etkinlikUret('https://anivesta.com/social/topic/1', { path: '/social/topic/1', meta: { type: 'community_topic', title: 'a'.repeat(100) } }, {}, simdi).etkinlik.state.length, 30);

// --- video vitrini ---
esit('ana sayfada etkinlik yok', etkinlikUret('https://videovitrini.com/', { path: '/', videolar: [] }, {}, simdi), null);
const v = etkinlikUret('https://videovitrini.com/watch/1', {
  href: 'https://videovitrini.com/watch/1', path: '/watch/1', title: 'Tom &amp; Jerry &#039;99',
  videolar: [{ paused: false, currentTime: 10, duration: 100 }]
}, { butonlar: true }, simdi);
esit('baslik cozuldu', v.etkinlik.details, "Tom & Jerry '99");
esit('oynuyor', v.etkinlik.state, 'Video İzliyor');
esit('shorts dugme', etkinlikUret('https://videovitrini.com/shorts/1', { href: 'https://videovitrini.com/shorts/1', path: '/shorts/1', title: 'ab', videolar: [] }, { butonlar: true }, simdi).etkinlik.buttons[0].label, 'Kısa Videoyu İzle');

// --- youtube ---
esit('youtube esleme', siteBul('https://www.youtube.com/watch?v=x').ad, 'youtube');
esit('youtube taklit', siteBul('https://youtube.com.evil.io/'), null);
esit('music.youtube ayri site (YouTube degil)', siteBul('https://music.youtube.com/').ad, 'youtubemusic');
const yt = (extra, yol = '/watch') => etkinlikUret('https://www.youtube.com' + yol, {
  host: 'www.youtube.com', href: 'https://www.youtube.com' + yol + '?v=dQw4w9WgXcQ', path: yol, title: '(3) Sayfa - YouTube',
  yt: Object.assign({ videoId: 'dQw4w9WgXcQ', title: 'Şarkı', author: 'Kanal', channelId: 'UC' + 'a'.repeat(22),
    video: { paused: false, currentTime: 30, duration: 200, rate: 2 } }, extra)
}, { butonlar: true }, simdi);
const y1 = yt({});
esit('yt clientId', y1.clientId, '463097721130188830');
esit('yt detay', y1.etkinlik.details, 'Şarkı');
esit('yt durum kanal', y1.etkinlik.state, 'Kanal');
esit('yt hizli oynatma zamani', y1.etkinlik.timestamps, { start: simdi - 15000, end: simdi + 85000 });
esit('yt kapak', y1.etkinlik.assets.large_image, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
esit('yt butonlar', y1.etkinlik.buttons.map((b) => b.label), ['Videoyu İzle', 'Kanala Git']);
esit('yt duraklatildi', yt({ video: { paused: true, currentTime: 1, duration: 9, rate: 1 } }).etkinlik.state, 'Duraklatıldı • Kanal');
esit('yt reklam', yt({ ad: true }).etkinlik.details, 'Reklam izliyor');
esit('yt listelenmemis: dugme/kapak yok', [yt({ unlisted: true }).etkinlik.buttons, yt({ unlisted: true }).etkinlik.assets.large_image.includes('ytimg')], [undefined, false]);
esit('yt canli zaman', yt({ isLive: true }).etkinlik.timestamps, { start: simdi });
esit('yt gecersiz video kimligi gezintiye duser', yt({ videoId: '../x' }, '/').etkinlik.details, 'Ana sayfada geziniyor');
esit('yt shorts kapak', yt({}, '/shorts/dQw4w9WgXcQ').etkinlik.assets.large_image.endsWith('/1.png'), true);
esit('yt kanal sayfasi', etkinlikUret('https://www.youtube.com/@x', { host: 'www.youtube.com', path: '/@x', title: '(2) Kanal Adı - YouTube', yt: { video: null } }, {}, simdi).etkinlik.state, 'Kanal Adı');
esit('yt arama sorgusu sizdirilmaz', JSON.stringify(etkinlikUret('https://www.youtube.com/results', { host: 'www.youtube.com', path: '/results', search: '?search_query=gizli', title: 'gizli - YouTube', yt: {} }, {}, simdi).etkinlik).includes('gizli'), false);

// --- youtube music ---
esit('ytm esleme', siteBul('https://music.youtube.com/watch?v=abcde12345').ad, 'youtubemusic');
const ytm = (mus, href = 'https://music.youtube.com/watch?v=abcde12345') => etkinlikUret(href, { href, path: '/watch', mus: Object.assign({ kind: 'ytm',
  md: { title: 'Şarkı', artist: 'Sanatçı', album: 'Albüm', artwork: 'https://lh3.googleusercontent.com/x', state: 'playing' },
  links: ['https://music.youtube.com/channel/UCx', 'https://music.youtube.com/browse/MPREb_1'],
  video: { paused: false, currentTime: 60, duration: 240, rate: 1 } }, mus) }, { butonlar: true }, simdi);
const m1 = ytm({});
esit('ytm clientId', m1.clientId, '463151177836658699');
esit('ytm tur dinliyor', m1.etkinlik.type, 2);
esit('ytm zaman', m1.etkinlik.timestamps, { start: simdi - 60000, end: simdi + 180000 });
esit('ytm butonlar', m1.etkinlik.buttons.map((b) => b.url), ['https://music.youtube.com/watch?v=abcde12345', 'https://music.youtube.com/browse/MPREb_1']);
esit('ytm duraklatildi', ytm({ video: { paused: true, currentTime: 1, duration: 9, rate: 1 } }).etkinlik.state, 'Duraklatıldı • Sanatçı');
esit('ytm reklam', ytm({ ad: true }).etkinlik.details, 'Reklam dinliyor');
esit('ytm sarki yoksa etkinlik yok', ytm({ md: null, video: null }), null);
esit('ytm ilerleme cubugu yedegi', ytm({ video: null, pb: { now: 10, max: 100 } }).etkinlik.timestamps, { start: simdi - 10000, end: simdi + 90000 });

// --- apple music ---
esit('apple esleme', siteBul('https://music.apple.com/tr/album/x').ad, 'applemusic');
esit('apple taklit', siteBul('https://music.apple.com.evil.io/'), null);
const am = (mus) => etkinlikUret('https://music.apple.com/tr/album/x', { path: '/tr/album/x', mus }, { butonlar: true }, simdi);
const a1 = am({ kind: 'apple', ap: { name: 'Song', artistName: 'Art', albumName: 'Alb', durationInMillis: 200000, url: 'https://music.apple.com/tr/song/1', artwork: 'https://is1-ssl.mzstatic.com/a/1024x1024.jpg', isPlaying: true, progress: 0.25 } });
esit('apple clientId', a1.clientId, '842112189618978897');
esit('apple zaman', a1.etkinlik.timestamps, { start: simdi - 50000, end: simdi + 150000 });
esit('apple buton', a1.etkinlik.buttons[0].url, 'https://music.apple.com/tr/song/1');
esit('apple duraklatilinca zaman yok', am({ kind: 'apple', ap: { name: 'Song', artistName: 'Art', albumName: '', durationInMillis: 1000, url: '', artwork: '', isPlaying: false, progress: 0 } }).etkinlik.timestamps, undefined);
esit('apple sarki yok', am({ kind: 'apple', ap: null, md: null, audio: null }), null);
esit('apple zararli buton elenir', am({ kind: 'apple', ap: { name: 'Song', artistName: 'Art', albumName: '', durationInMillis: 1000, url: 'https://evil.io/x', artwork: '', isPlaying: true, progress: 0 } }).etkinlik.buttons, undefined);

// --- spotify / netflix / twitch ---
const sp = (o) => etkinlikUret('https://open.spotify.com/album/x', { path: '/album/x', sp: Object.assign({ etiket: 'Pause', parca: 'Şarkı', parcaUrl: 'https://open.spotify.com/track/abc', sanatci: 'Sanatçı', podcast: false, kapak: 'https://i.scdn.co/image/x', gecen: '1:00', toplam: '4:00' }, o) }, { butonlar: true }, simdi);
const s1 = sp({});
esit('spotify clientId', s1.clientId, '1458014647193047042');
esit('spotify zaman', s1.etkinlik.timestamps, { start: simdi - 60000, end: simdi + 180000 });
esit('spotify buton', s1.etkinlik.buttons[0].url, 'https://open.spotify.com/track/abc');
esit('spotify duraklatildi', sp({ etiket: 'Play' }).etkinlik.state, 'Duraklatıldı • Sanatçı');
esit('spotify oynatici yok', sp({ etiket: '' }), null);
esit('spotify saat:dk:sn', sp({ gecen: '0:10', toplam: '1:01:00' }).etkinlik.timestamps.end, simdi + (3660 - 10) * 1000);
esit('spotify parca urlsi dis ise buton yok', sp({ parcaUrl: 'https://open.spotify.com/settings' }).etkinlik.buttons, undefined);

const nfv = (nf, v) => etkinlikUret('https://www.netflix.com/watch/81?trackId=1', { href: 'https://www.netflix.com/watch/81?trackId=1', path: '/watch/81', nf, videolar: [v || { paused: false, currentTime: 100, duration: 2600 }] }, { butonlar: true }, simdi);
const n1 = nfv({ type: 'show', title: 'Dizi', id: 70, sezon: 2, bolum: 3, bolumAd: 'Bölüm Adı', boxart: 'https://occ-0.nflxso.net/x.jpg' });
esit('netflix clientId', n1.clientId, '926541425682829352');
esit('netflix dizi durum', n1.etkinlik.state, '2. Sezon 3. Bölüm • Bölüm Adı');
esit('netflix butonlar', n1.etkinlik.buttons.map((b) => b.url), ['https://www.netflix.com/watch/81', 'https://www.netflix.com/title/70']);
esit('netflix film durum', nfv({ type: 'movie', title: 'Film', id: 5, year: 2020, runtime: 7200 }).etkinlik.state, '2020 • 120 dk');
esit('netflix metadata gelmeden etkinlik yok', nfv(null), null);
esit('netflix duraklatildi', nfv({ type: 'movie', title: 'Film', id: 5, year: 2020, runtime: 60 }, { paused: true, currentTime: 1, duration: 9 }).etkinlik.timestamps, undefined);

const twv = (tw) => etkinlikUret('https://www.twitch.tv/kanal', { href: 'https://www.twitch.tv/kanal?sr=a', path: '/kanal', tw }, { butonlar: true }, simdi);
const t1 = twv({ canli: true, paused: false, currentTime: 0, duration: 0, yayinBasligi: 'Yayın', yayinci: 'Kanal', oyun: 'Oyun', avatar: 'https://static-cdn.jtvnw.net/a-600x600.png', og: '', sayfaBasligi: '' });
esit('twitch clientId', t1.clientId, '802958789555781663');
esit('twitch canli durum', [t1.etkinlik.details, t1.etkinlik.state], ['Yayın', 'Kanal • Oyun']);
esit('twitch buton sorgusuz', t1.etkinlik.buttons[0].url, 'https://www.twitch.tv/kanal');
esit('twitch vod zaman', twv({ canli: false, paused: false, currentTime: 10, duration: 100, yayinci: 'K', og: '', avatar: '', sayfaBasligi: 'Video' }).etkinlik.timestamps, { start: simdi - 10000, end: simdi + 90000 });
esit('twitch oynatici yok', twv(null), null);

// --- kick ---
const kkv = (kk, adres = 'https://kick.com/kanal') => etkinlikUret(adres, { href: adres + '?x=1', path: new URL(adres).pathname, kk }, { butonlar: true }, simdi);
const k1 = kkv({ vod: false, canli: true, paused: false, currentTime: 0, duration: 0, yayinci: 'Kanal', baslik: 'Yayın', aciklama: '', avatar: 'https://files.kick.com/a.png' });
esit('kick clientId', k1.clientId, '1125405319594512404');
esit('kick canli durum', [k1.etkinlik.details, k1.etkinlik.state], ['Yayın', 'Kanal']);
esit('kick buton sorgusuz', k1.etkinlik.buttons[0].url, 'https://kick.com/kanal');
esit('kick canli duraklatildi', kkv({ vod: false, canli: true, paused: true, yayinci: 'Kanal', baslik: 'Yayın' }).etkinlik.state, 'Duraklatıldı • Kanal');
esit('kick vod zaman', kkv({ vod: true, canli: false, paused: false, currentTime: 10, duration: 100, yayinci: 'K1', baslik: 'Kayıt' }, 'https://kick.com/kanal/videos/abc').etkinlik.timestamps, { start: simdi - 10000, end: simdi + 90000 });
esit('kick oynatici yok', kkv(null), null);
esit('kick typo-squat kapsam disi', etkinlikUret('https://kick.com.evil.io/x', { kk: { canli: true, yayinci: 'K', baslik: 'B' } }, { butonlar: true }, simdi), null);

// --- istemci: el sikisma + SET_ACTIVITY ---
(async () => {
  const yazilan = [];
  const soket = new EventEmitter();
  soket.write = (b) => { yazilan.push(cerceveOku(b).cerceveler[0]); };
  soket.destroy = () => {};
  const rpc = new DiscordRpc('42', { yollar: ['x'], baglan: () => { setImmediate(() => soket.emit('connect')); return soket; } });
  rpc.etkinlikAyarla({ details: 'merhaba' });
  await new Promise((r) => setTimeout(r, 30));
  esit('el sikisma gonderildi', yazilan[0], { op: 0, veri: { v: 1, client_id: '42' } });
  soket.emit('data', cerceveYaz(OP.CERCEVE, { evt: 'READY' }));
  esit('hazir olunca etkinlik gider', yazilan[1].veri.args.activity, { details: 'merhaba' });
  soket.emit('data', cerceveYaz(OP.PING, { n: 1 }));
  esit('ping -> pong', yazilan[2].op, OP.PONG);
  rpc.kapat();

  if (hata) { console.error('\n' + hata + ' Discord testi başarısız.'); process.exit(1); }
  console.log('✓ ' + gecen + ' Discord testinin hepsi geçti.');
})();
