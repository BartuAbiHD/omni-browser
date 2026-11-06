'use strict';

/*
 * DISCORD SUNUMU: hangi sitede ne gosterilecek.
 *
 * Yalnizca asagidaki SITELER listesindeki siteler icin etkinlik uretilir
 * (PreMiD "presence" mantiginin yerel karsiligi). Sayfadan okunan her sey
 * guvenilmeyen veridir: metinler kirpilir, gorsel/dugme adresleri https ve
 * site-ici olmaya zorlanir.
 *
 * snapshotBetigi sayfa dunyasinda calisir ve JSON metni dondurur;
 * etkinlikUret saf bir fonksiyondur (test edilebilir, Electron gerektirmez).
 */

const LOGO_ANIVESTA = 'https://cdn.rcd.gg/PreMiD/websites/A/Anivesta/assets/logo.png';
const LOGO_VITRIN = 'https://cdn.rcd.gg/PreMiD/websites/V/Video%20Vitrini/assets/logo.png';

// Discord etkinlik turu: 3 = "Izliyor"
const IZLIYOR = 3;

/** Sayfa dunyasinda calisir; yalnizca okur, hicbir sey degistirmez. */
const SNAPSHOT_BETIGI = `(() => {
  const q = (s) => document.querySelector(s);
  const t = (s) => { const e = q(s); return e && e.textContent ? e.textContent.trim() : ''; };
  let meta = null;
  const sc = document.getElementById('anivesta-presence-data');
  if (sc && sc.textContent) { try { meta = JSON.parse(sc.textContent); } catch (_) {} }
  const ms = document.getElementById('anivesta-media-state');
  const pb = document.getElementById('wpPlaybackProgress');
  const img = q('.ad-poster-img');
  const videolar = Array.from(document.querySelectorAll('video')).map((v) => ({
    paused: !!v.paused, currentTime: Number(v.currentTime) || 0, duration: Number(v.duration) || 0
  }));
  // YouTube: oynatici API'si DOM kaziminden cok daha dayanikli.
  let yt = null;
  if (/(^|\\.)youtube\\.com$/.test(location.hostname)) {
    try {
      const mp = document.getElementById('movie_player') || q('.html5-video-player');
      let vd = null; let pr = null;
      try { vd = mp && mp.getVideoData ? mp.getVideoData() : null; } catch (_) {}
      try { pr = mp && mp.getPlayerResponse ? mp.getPlayerResponse() : null; } catch (_) {}
      const det = (pr && pr.videoDetails) || {};
      const mf = (pr && pr.microformat && pr.microformat.playerMicroformatRenderer) || {};
      const id = (vd && vd.video_id) || det.videoId || '';
      const ayni = !!id && det.videoId === id;   // eski/bayat oynatici yaniti degil
      const v = mp ? mp.querySelector('video') : null;
      yt = {
        videoId: id,
        title: (vd && vd.title) || (ayni ? det.title : '') || '',
        author: (vd && vd.author) || (ayni ? det.author : '') || '',
        channelId: ayni ? (det.channelId || '') : '',
        isLive: !!(ayni && det.isLive) || !!(vd && vd.isLive),
        category: ayni ? (mf.category || '') : '',
        unlisted: ayni && !!mf.isUnlisted,
        ad: !!q('.ytp-ad-player-overlay, .ad-showing'),
        video: v ? { paused: !!v.paused, currentTime: Number(v.currentTime) || 0, duration: Number(v.duration) || 0, rate: Number(v.playbackRate) || 1 } : null
      };
    } catch (_) { yt = null; }
  }
  // YouTube Music / Apple Music: mediaSession + oynaticinin kendi verisi.
  let mus = null;
  try {
    const h = location.hostname;
    const md = navigator.mediaSession && navigator.mediaSession.metadata;
    const mdv = md ? {
      title: md.title || '', artist: md.artist || '', album: md.album || '',
      artwork: md.artwork && md.artwork.length ? (md.artwork[md.artwork.length - 1].src || '') : '',
      state: (navigator.mediaSession && navigator.mediaSession.playbackState) || ''
    } : null;
    if (h === 'music.youtube.com') {
      const v = q('.html5-main-video') || q('.video-stream');
      const pbar = document.getElementById('progress-bar');
      mus = {
        kind: 'ytm', md: mdv,
        title: t('ytmusic-player-bar .title'),
        artist: t('ytmusic-player-bar .byline a'),
        artwork: ((q('ytmusic-player-bar img.image') || {}).src) || '',
        links: Array.from(document.querySelectorAll('ytmusic-player-bar .byline a')).map((a) => a.href),
        video: v ? { paused: !!v.paused, currentTime: Number(v.currentTime) || 0, duration: Number(v.duration) || 0, rate: Number(v.playbackRate) || 1 } : null,
        pb: pbar ? { now: Number(pbar.getAttribute('aria-valuenow')), max: Number(pbar.getAttribute('aria-valuemax')) } : null,
        ad: !!q('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting, .ytp-ad-player-overlay')
      };
    } else if (/(^|\\.)music\\.apple\\.com$/.test(h)) {
      let ap = null;
      try {
        const a = window.audioPlayer;
        const at = a && a.nowPlayingItem && a.nowPlayingItem.attributes;
        if (at) {
          ap = {
            name: at.name || '', artistName: at.artistName || '', albumName: at.albumName || '',
            durationInMillis: Number(at.durationInMillis) || 0, url: at.url || '',
            artwork: at.artwork && at.artwork.url ? String(at.artwork.url).replace('{w}', at.artwork.width).replace('{h}', at.artwork.height) : '',
            isPlaying: !!a.isPlaying, progress: Number(a.currentPlaybackProgress) || 0
          };
        }
      } catch (_) {}
      const au = q('audio#apple-music-player');
      mus = {
        kind: 'apple', md: mdv, ap,
        audio: au ? { paused: !!au.paused, currentTime: Number(au.currentTime) || 0, duration: Number(au.duration) || 0 } : null
      };
    }
  } catch (_) { mus = null; }
  // Spotify / Netflix / Twitch
  let sp = null; let nf = null; let tw = null; let kk = null;
  try {
    const h = location.hostname;
    if (h === 'open.spotify.com') {
      const dugme = q('[data-testid=control-button-playpause]');
      const kapak = q('a[data-testid=cover-art-link], a[data-testid=context-link]');
      const parca = q('[data-testid="context-item-link"], [data-testid="nowplaying-track-link"]');
      const podcast = !!kapak && /\\/(?:show|episode)\\/|your-episodes\\?/.test(kapak.href || '');
      sp = {
        etiket: dugme ? (dugme.getAttribute('aria-label') || '') : '',
        parca: parca ? (parca.textContent || '').trim() : '',
        parcaUrl: parca ? (parca.href || '') : '',
        sanatci: t(podcast ? '[data-testid="context-item-info-show"], [data-testid="track-info-artists"]' : '[data-testid="context-item-info-artist"], [data-testid="track-info-artists"]'),
        podcast,
        kapak: kapak && kapak.querySelector('img') ? (kapak.querySelector('img').src || '') : '',
        gecen: t('[data-testid="playback-position"]'), toplam: t('[data-testid="playback-duration"]')
      };
    } else if (/(^|\\.)netflix\\.com$/.test(h)) {
      const m = location.pathname.match(/\\/watch\\/(\\d+)/);
      if (m) {
        const onbellek = (window.__cvsNf = window.__cvsNf || {});
        const c = onbellek[m[1]];
        if (c && c.hazir) nf = c.veri;
        else if (!c || (c.hata && Date.now() - c.hata > 60000)) {
          onbellek[m[1]] = {};
          fetch('https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=' + m[1], { credentials: 'include' })
            .then((r) => r.json()).then((j) => {
              const v = j && j.video; if (!v) throw new Error('bos');
              let sezon = 0; let bolum = 0; let bolumAd = '';
              (v.seasons || []).forEach((s) => (s.episodes || []).forEach((e) => {
                if (e.episodeId === v.currentEpisode) { sezon = s.seq; bolum = e.seq; bolumAd = e.title || ''; }
              }));
              onbellek[m[1]] = { hazir: true, veri: {
                type: v.type, title: v.title || '', id: v.id, year: v.year, runtime: v.runtime,
                boxart: (v.boxart && v.boxart[0] && v.boxart[0].url) || '', sezon, bolum, bolumAd
              } };
            }).catch(() => { onbellek[m[1]] = { hata: Date.now() }; });
        }
      }
    } else if (/(^|\\.)twitch\\.tv$/.test(h)) {
      const v = q('video');
      if (v && q('.channel-root') && !q('.home-carousel-info')) {
        const resim = (...liste) => { const bulunan = liste.find((x) => x && !x.startsWith('data:')); return bulunan ? bulunan.replace(/-\\d{1,3}x\\d{1,3}(?=\\.\\w+$)/, '-600x600') : ''; };
        const img = (s) => { const e = q(s); return e ? e.src : ''; };
        const og = q('meta[property="og:image"], meta[name="twitter:image"]');
        const sd = Number(v.duration);
        const yayinci = q('.channel-info-content h1') || q('[class*="metadata-layout__support"] a');
        tw = {
          canli: !Number.isFinite(sd) || sd >= 1073741824,
          paused: !!v.paused, currentTime: Number(v.currentTime) || 0, duration: Number.isFinite(sd) ? sd : 0,
          yayinBasligi: t("p[data-a-target='stream-title']"),
          yayinci: yayinci ? (yayinci.textContent || '').trim() : '',
          oyun: t("a[data-a-target='stream-game-link']") || 'Just Chatting',
          avatar: resim(img('img[data-a-target="channel-avatar"], [data-a-target="channel-avatar"] img'), img('[class*=channel-info-content] img[class*=tw-image], [class*=channel-info-content] img[class*=image-avatar]')),
          og: resim(og ? og.content : ''),
          sayfaBasligi: (document.title || '').replace(/ - Twitch$/, '')
        };
      }
    } else if (h === 'kick.com' || h === 'www.kick.com') {
      const v = q('video');
      const ilk = location.pathname.split('/')[1] || '';
      const yayinci = q('.stream-username, #channel-username');
      if (v && ilk && yayinci && !/^(categories|following|dashboard|transactions|community-guidelines|dmca-policy|privacy-policy|terms-of-service)$/.test(ilk)) {
        const baslikEl = q('[data-testid="livestream-title"]');
        const av = q('.owner-avatar img');
        const acik = q('meta[name="description"]');
        const sd = Number(v.duration);
        kk = {
          vod: /\\/(videos|clips)\\//.test(location.pathname),
          canli: !Number.isFinite(sd) || sd >= 1073741824,
          paused: !!v.paused, currentTime: Number(v.currentTime) || 0, duration: Number.isFinite(sd) ? sd : 0,
          yayinci: (yayinci.textContent || '').trim(),
          baslik: baslikEl ? ((baslikEl.getAttribute('title') || baslikEl.textContent || '').trim()) : '',
          aciklama: acik ? (acik.content || '') : '',
          avatar: av ? (av.src || '') : ''
        };
      }
    }
  } catch (_) { sp = null; nf = null; tw = null; kk = null; }
  return JSON.stringify({
    sp, nf, tw, kk,
    yt, mus,
    href: location.href, host: location.hostname, path: location.pathname, search: location.search,
    title: document.title || '',
    meta,
    mediaState: ms ? Object.assign({}, ms.dataset) : null,
    playback: pb ? Object.assign({}, pb.dataset) : null,
    animeBaslik: t('.wp-anime-title'),
    detayBaslik: t('.ad-title'),
    detayPoster: img ? (img.getAttribute('src') || '') : '',
    konuBaslik: t('.thread-header-card h1'),
    videolar
  });
})()`;

function metin(s, en = 128) {
  if (typeof s !== 'string') return '';
  const t = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > en ? t.slice(0, en - 1) + '…' : t;
}

/** Discord alanlari en az 2 karakter ister. */
function alan(s, en = 128) {
  const t = metin(s, en);
  return t.length >= 2 ? t : undefined;
}

function sayi(v, varsayilan = 0) {
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : varsayilan;
}

function httpsAdres(v, hostKosulu) {
  if (typeof v !== 'string' || v.length > 512) return '';
  let u;
  try { u = new URL(v); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  if (hostKosulu && !hostKosulu(u.hostname.toLowerCase())) return '';
  return u.href;
}

const SITELER = [
  {
    ad: 'anivesta',
    clientId: '1323996217675616321',
    host: (h) => h === 'anivesta.com' || h === 'www.anivesta.com',
    // Oynatici stream.anivesta.com altinda ayri bir iframe: ana surecten okunur.
    altCerceve: (h) => h === 'anivesta.com' || h.endsWith('.anivesta.com'),
    uret: anivesta
  },
  {
    ad: 'videovitrini',
    clientId: '1481304927690293258',
    host: (h) => h === 'videovitrini.com' || h.endsWith('.videovitrini.com'),
    uret: videovitrini
  },
  {
    ad: 'youtube',
    // PreMiD YouTube uygulamasinin kimligi (varliklar da onun CDN'inde).
    clientId: '463097721130188830',
    host: (h) => h === 'youtube.com' || h === 'www.youtube.com' || h === 'm.youtube.com' || h === 'studio.youtube.com',
    uret: youtube
  },
  {
    ad: 'youtubemusic',
    clientId: '463151177836658699',
    host: (h) => h === 'music.youtube.com',
    uret: youtubeMusic
  },
  {
    ad: 'applemusic',
    clientId: '842112189618978897',
    host: (h) => h === 'music.apple.com' || h === 'beta.music.apple.com' || h === 'classical.music.apple.com',
    uret: appleMusic
  },
  {
    ad: 'spotify',
    clientId: '1458014647193047042',
    host: (h) => h === 'open.spotify.com',
    uret: spotify
  },
  {
    ad: 'netflix',
    clientId: '926541425682829352',
    host: (h) => h === 'netflix.com' || h === 'www.netflix.com',
    uret: netflix
  },
  {
    ad: 'twitch',
    clientId: '802958789555781663',
    host: (h) => h === 'twitch.tv' || h === 'www.twitch.tv' || h === 'm.twitch.tv',
    uret: twitch
  },
  {
    ad: 'kick',
    clientId: '1125405319594512404',
    host: (h) => h === 'kick.com' || h === 'www.kick.com',
    uret: kick
  }
];

function siteBul(adres) {
  let u;
  try { u = new URL(adres); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.toLowerCase();
  return SITELER.find((s) => s.host(h)) || null;
}

function dugmeler(site, liste, ayar) {
  if (!ayar.butonlar) return undefined;
  const cikti = [];
  for (const [etiket, adres] of liste) {
    const url = httpsAdres(adres, site.host);
    const label = metin(etiket, 32);
    if (url && label) cikti.push({ label, url });
  }
  return cikti.length ? cikti.slice(0, 2) : undefined;
}

function zamanlar(simdi, gecen, toplam, durdu, hiz = 1) {
  if (durdu) return undefined;
  const h = hiz > 0 && hiz <= 16 ? hiz : 1;
  if (toplam > 0 && gecen <= toplam) {
    return { start: Math.round(simdi - (gecen / h) * 1000), end: Math.round(simdi + ((toplam - gecen) / h) * 1000) };
  }
  return { start: Math.round(simdi - (gecen / h) * 1000) };
}

const LOGO_YT = 'https://cdn.rcd.gg/PreMiD/websites/Y/YouTube/assets/logo.png';
const LOGO_SHORTS = 'https://cdn.rcd.gg/PreMiD/websites/Y/YouTube/assets/1.png';
const LOGO_STUDIO = 'https://cdn.rcd.gg/PreMiD/websites/Y/YouTube/assets/0.png';

const DINLIYOR = 2;
const LOGO_YTM = 'https://cdn.rcd.gg/PreMiD/websites/Y/YouTube%20Music/assets/logo.png';
const LOGO_APPLE = 'https://cdn.rcd.gg/PreMiD/websites/A/Apple%20Music/assets/logo.png';

/** Muzik siteleri icin ortak "dinliyor" etkinligi. */
function muzikEtkinligi(m, ayar, simdi, site) {
  const sanatci = alan(m.sanatci, 60);
  const e = {
    type: DINLIYOR,
    status_display_type: 1,   // durum satirinda sanatci adi
    details: alan(m.baslik),
    state: m.durdu ? (sanatci ? `Duraklatıldı • ${sanatci}` : 'Duraklatıldı') : sanatci,
    assets: { large_image: httpsAdres(m.kapak) || m.logo, large_text: alan(m.album) || m.ad },
    timestamps: m.durdu ? undefined : (m.toplam > 0 ? zamanlar(simdi, m.gecen, m.toplam, false, m.hiz) : undefined)
  };
  e.buttons = dugmeler(site, m.dugmeler || [], ayar);
  return e;
}

function youtubeMusic(s, ayar, simdi, site) {
  const m = s.mus;
  if (!m || m.kind !== 'ytm') return null;
  const md = m.md || {};
  const baslik = metin(md.title || m.title || '');
  const durum = md.state;
  const v = m.video && sayi(m.video.duration, 0) > 0 ? m.video : null;
  const sayfaId = (String(s.href || '').match(/[?&]v=([\w-]{5,20})/) || [])[1];

  let durdu;
  if (v) durdu = !!v.paused;
  else if (durum === 'playing') durdu = false;
  else if (durum === 'paused') durdu = true;
  else return null;   // calan/duraklatilmis sarki yok: gezinti
  if (!baslik) return null;

  const logo = { logo: LOGO_YTM, ad: 'YouTube Music' };
  if (m.ad) {
    return { type: DINLIYOR, details: 'Reklam dinliyor', assets: { large_image: LOGO_YTM, large_text: 'YouTube Music' } };
  }
  let gecen = 0; let toplam = 0; let hiz = 1;
  if (v) { gecen = sayi(v.currentTime, 0); toplam = sayi(v.duration, 0); hiz = sayi(v.rate, 1); }
  else if (m.pb && Number.isFinite(m.pb.max) && m.pb.max > 0) { gecen = sayi(m.pb.now, 0); toplam = m.pb.max; }

  const linkler = Array.isArray(m.links) ? m.links : [];
  const album = alan(md.album, 100);
  return muzikEtkinligi({
    ...logo,
    baslik, sanatci: md.artist || m.artist, album,
    kapak: md.artwork || m.artwork, durdu, gecen, toplam, hiz,
    dugmeler: [
      ['Birlikte Dinle', sayfaId ? `https://music.youtube.com/watch?v=${sayfaId}` : ''],
      [album ? 'Albümü Gör' : 'Sanatçıyı Gör', linkler.length ? linkler[linkler.length - 1] : '']
    ]
  }, ayar, simdi, site);
}

function appleMusic(s, ayar, simdi, site) {
  const m = s.mus;
  if (!m || m.kind !== 'apple') return null;
  const ap = m.ap;
  const md = m.md || {};
  let baslik; let sanatci; let album; let kapak; let durdu; let gecen; let toplam; let url = '';

  if (ap && alan(ap.name)) {
    baslik = ap.name; sanatci = ap.artistName; album = ap.albumName; kapak = ap.artwork;
    toplam = sayi(ap.durationInMillis, 0) / 1000;
    gecen = Math.min(sayi(ap.progress, 0), 1) * toplam;
    durdu = !ap.isPlaying; url = ap.url;
  } else if (m.audio && alan(md.title) && sayi(m.audio.duration, 0) > 0) {
    baslik = md.title; sanatci = md.artist; album = md.album;
    kapak = String(md.artwork || '').replace(/\d{1,2}x\d{1,2}[a-z]{1,2}/, '1024x1024');
    toplam = sayi(m.audio.duration, 0); gecen = sayi(m.audio.currentTime, 0); durdu = !!m.audio.paused;
  } else {
    return null;
  }
  return muzikEtkinligi({
    logo: LOGO_APPLE, ad: 'Apple Music',
    baslik, sanatci, album, kapak, durdu, gecen, toplam, hiz: 1,
    dugmeler: [['Apple Music’te Dinle', url]]
  }, ayar, simdi, site);
}

/** "m:ss" / "h:mm:ss" -> saniye */
function saniye(str) {
  if (typeof str !== 'string' || !/^\d{1,2}(:\d{2}){1,2}$/.test(str.trim())) return 0;
  return str.trim().split(':').reduce((t, p) => t * 60 + Number(p), 0);
}

function ilkVideo(s) {
  const l = Array.isArray(s.videolar) ? s.videolar : [];
  return l.find((x) => x && sayi(x.duration, 0) > 0 && !x.paused) || l.find((x) => x && sayi(x.duration, 0) > 0) || null;
}

function spotify(s, ayar, simdi, site) {
  const p = s.sp;
  if (!p || !alan(p.parca)) return null;
  const etiket = String(p.etiket || '').toLowerCase();
  // "Pause" etiketi = caliyor, "Play" = duraklatilmis; etiket yoksa oynatici yok
  if (!etiket.includes('pause') && !etiket.includes('play')) return null;
  const durdu = !etiket.includes('pause');
  const sanatci = alan(p.sanatci, 60) || (p.podcast ? 'Bilinmeyen Program' : 'Bilinmeyen Sanatçı');
  const toplam = saniye(p.toplam);
  const e = {
    type: DINLIYOR,
    status_display_type: 1,
    details: alan(p.parca),
    state: durdu ? `Duraklatıldı • ${sanatci}` : sanatci,
    assets: { large_image: httpsAdres(p.kapak) || 'https://cdn.rcd.gg/PreMiD/websites/S/Spotify/assets/logo.png', large_text: 'Spotify' },
    timestamps: durdu || !toplam ? undefined : zamanlar(simdi, saniye(p.gecen), toplam, false)
  };
  const url = /\/(track|episode)\//.test(String(p.parcaUrl)) ? p.parcaUrl : '';
  e.buttons = dugmeler(site, [[p.podcast ? 'Podcast’i Dinle' : 'Spotify’da Dinle', url]], ayar);
  return e;
}

function netflix(s, ayar, simdi, site) {
  const n = s.nf;
  const v = ilkVideo(s);
  if (!n || !v || !alan(n.title)) return null;
  const durdu = !!v.paused;
  const dizi = n.type === 'show';
  const film = n.type === 'movie';
  if (!dizi && !film) return null;
  let state;
  if (dizi) {
    state = `${Math.floor(sayi(n.sezon, 0))}. Sezon ${Math.floor(sayi(n.bolum, 0))}. Bölüm`;
    if (alan(n.bolumAd, 60)) state += ` • ${metin(n.bolumAd, 60)}`;
  } else {
    state = `${Math.floor(sayi(n.year, 0)) || ''} • ${Math.floor(sayi(n.runtime, 0) / 60)} dk`;
  }
  if (durdu) state = `Duraklatıldı • ${state}`;
  const izle = String(s.href || '').split('?')[0];
  const e = {
    type: IZLIYOR,
    details: alan(n.title),
    state: alan(state),
    assets: { large_image: httpsAdres(n.boxart) || 'https://cdn.rcd.gg/PreMiD/websites/N/Netflix/assets/1.png', large_text: 'Netflix' },
    timestamps: zamanlar(simdi, sayi(v.currentTime, 0), sayi(v.duration, 0), durdu)
  };
  const id = /^\d{1,12}$/.test(String(n.id)) ? n.id : '';
  e.buttons = dugmeler(site, dizi
    ? [['Bölümü İzle', izle], ['Diziyi Gör', id ? `https://www.netflix.com/title/${id}` : '']]
    : [['Filmi İzle', izle]], ayar);
  return e;
}

function twitch(s, ayar, simdi, site) {
  const w = s.tw;
  if (!w) return null;
  const durdu = !!w.paused;
  const yayinci = metin(w.yayinci, 60);
  const sayfa = String(s.href || '').split('?')[0];
  const resim = httpsAdres(w.canli ? (w.avatar || w.og) : (w.og || w.avatar)) || 'https://cdn.rcd.gg/PreMiD/websites/T/Twitch/assets/logo.png';
  let e;
  if (w.canli) {
    const oyun = metin(w.oyun, 50);
    const alt = [yayinci, oyun].filter(Boolean).join(' • ');
    e = {
      type: IZLIYOR,
      status_display_type: 1,
      details: alan(w.yayinBasligi) || 'Canlı yayın izliyor',
      state: alan(durdu ? `Duraklatıldı • ${alt}` : alt),
      assets: { large_image: resim, large_text: yayinci || 'Twitch' },
      timestamps: durdu ? undefined : { start: ayar.gezinti || simdi }
    };
    e.buttons = dugmeler(site, [['Yayını İzle', sayfa]], ayar);
  } else {
    e = {
      type: IZLIYOR,
      status_display_type: 1,
      details: alan(w.sayfaBasligi) || 'Video izliyor',
      state: alan(durdu ? `Duraklatıldı • ${yayinci}` : yayinci),
      assets: { large_image: resim, large_text: yayinci || 'Twitch' },
      timestamps: zamanlar(simdi, sayi(w.currentTime, 0), sayi(w.duration, 0), durdu)
    };
    e.buttons = dugmeler(site, [['Videoyu İzle', sayfa]], ayar);
  }
  return e;
}

function kick(s, ayar, simdi, site) {
  const k = s.kk;
  if (!k) return null;
  const durdu = !!k.paused;
  const yayinci = metin(k.yayinci, 60);
  const sayfa = String(s.href || '').split('?')[0].split('#')[0];
  const resim = httpsAdres(k.avatar) || 'https://cdn.rcd.gg/PreMiD/websites/K/Kick/assets/logo.png';
  const buyuk = { large_image: resim, large_text: yayinci || 'Kick' };
  if (k.vod || !k.canli) {
    return {
      type: IZLIYOR,
      status_display_type: 1,
      details: alan(k.baslik) || alan(k.aciklama) || 'Video izliyor',
      state: alan(durdu ? `Duraklatıldı • ${yayinci}` : yayinci),
      assets: buyuk,
      timestamps: zamanlar(simdi, sayi(k.currentTime, 0), sayi(k.duration, 0), durdu),
      buttons: dugmeler(site, [['Videoyu İzle', sayfa]], ayar)
    };
  }
  return {
    type: IZLIYOR,
    status_display_type: 1,
    details: alan(k.baslik) || 'Canlı yayın izliyor',
    state: alan(durdu ? `Duraklatıldı • ${yayinci}` : yayinci),
    assets: buyuk,
    timestamps: durdu ? undefined : { start: ayar.gezinti || simdi },
    buttons: dugmeler(site, [['Yayını İzle', sayfa]], ayar)
  };
}

/** Sekme basligindan bildirim sayacini ve " - YouTube" son ekini ayiklar. */
function ytBaslik(t) {
  return metin(String(t || '').replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube( Studio)?$/, ''));
}

function youtube(s, ayar, simdi, site) {
  const yol = String(s.path || '');
  const host = String(s.host || '');
  const gez = ayar.gezinti || simdi;
  const temel = {
    type: IZLIYOR,
    // 1 = Discord durum satirinda "state" (kanal adi) gorunsun (PreMiD varsayilani)
    status_display_type: 1,
    timestamps: { start: gez },
    assets: { large_image: LOGO_YT, large_text: 'YouTube' }
  };

  if (host === 'studio.youtube.com') {
    return { ...temel, details: 'YouTube Studio', state: 'Kanalını yönetiyor', assets: { large_image: LOGO_YT, large_text: 'YouTube', small_image: LOGO_STUDIO, small_text: 'YouTube Studio' } };
  }

  const y = s.yt && typeof s.yt === 'object' ? s.yt : null;
  const v = y && y.video && sayi(y.video.duration, 0) > 0 ? y.video : null;
  const id = y && typeof y.videoId === 'string' && /^[\w-]{11}$/.test(y.videoId) ? y.videoId : '';

  if (y && v && id && alan(y.title)) {
    const kisa = yol.startsWith('/shorts/');
    const canli = !!y.isLive;
    const durdu = !!v.paused;
    const sayfa = `https://www.youtube.com/watch?v=${id}`;
    const kanalId = typeof y.channelId === 'string' && /^UC[\w-]{22}$/.test(y.channelId) ? y.channelId : '';
    const gizliDegil = !y.unlisted;
    const e = {
      type: IZLIYOR,
      status_display_type: 1,
      details: alan(y.title),
      state: durdu ? 'Duraklatıldı' : (alan(y.author) ? alan(y.author) : undefined),
      assets: {
        large_image: kisa ? LOGO_SHORTS : (gizliDegil ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : LOGO_YT),
        large_text: alan(y.author) || 'YouTube'
      }
    };
    if (durdu && alan(y.author)) e.state = `Duraklatıldı • ${metin(y.author, 60)}`;
    if (y.ad) {
      e.details = 'Reklam izliyor';
      delete e.state;
      e.assets = { large_image: LOGO_YT, large_text: 'YouTube' };
      e.timestamps = { start: gez };
      return e;
    }
    if (canli) {
      e.timestamps = durdu ? undefined : { start: gez };
      if (!durdu) e.state = alan(y.author) ? `Canlı • ${metin(y.author, 60)}` : 'Canlı';
    } else {
      e.timestamps = zamanlar(simdi, sayi(v.currentTime, 0), sayi(v.duration, 0), durdu, sayi(v.rate, 1));
    }
    if (gizliDegil) {
      e.buttons = dugmeler(site, [
        [canli ? 'Yayını İzle' : (kisa ? 'Shorts’u İzle' : 'Videoyu İzle'), sayfa],
        ['Kanala Git', kanalId ? `https://www.youtube.com/channel/${kanalId}` : '']
      ], ayar);
    }
    return e;
  }

  // Video yok: gezinti
  const baslik = ytBaslik(s.title);
  if (yol === '/' || yol === '') return { ...temel, details: 'Ana sayfada geziniyor' };
  if (yol.startsWith('/results')) return { ...temel, details: 'YouTube’da arama yapıyor' };
  if (yol.startsWith('/shorts')) return { ...temel, details: 'Shorts izliyor', assets: { large_image: LOGO_SHORTS, large_text: 'YouTube Shorts' } };
  if (/^\/(@|channel\/|c\/|user\/)/.test(yol)) return { ...temel, details: 'Bir kanala göz atıyor', state: alan(baslik) };
  if (yol.startsWith('/playlist')) return { ...temel, details: 'Oynatma listesine bakıyor', state: alan(baslik) };
  return { ...temel, details: 'YouTube’da geziniyor' };
}

function anivesta(s, ayar, simdi, site) {
  const m = s.meta && typeof s.meta === 'object' ? s.meta : {};
  const yol = String(s.path || '');
  const sayfa = httpsAdres(s.href, site.host);
  const gez = ayar.gezinti || simdi;
  const temel = {
    type: IZLIYOR,
    assets: { large_image: LOGO_ANIVESTA, large_text: 'Anivesta' },
    timestamps: { start: gez }
  };

  if (yol.startsWith('/watch') || m.type === 'watching') {
    const pb = s.playback || {};
    const ms = s.mediaState || {};
    const baslik = metin(m.anime || pb.animeTitle || s.animeBaslik || 'Anime');
    const sezon = Math.floor(sayi(m.season || pb.season || '1', 1)) || 1;
    const bolum = Math.floor(sayi(m.episode || pb.episodeNumber || '1', 1)) || 1;
    const poster = httpsAdres(m.poster || pb.animeImage || '') || LOGO_ANIVESTA;
    // Gercek <video> varsa o esastir (veri-ozellikleri seyrek guncellenebiliyor);
    // yoksa sayfanin kendi medya durumuna dusulur.
    const videolar = Array.isArray(s.videolar) ? s.videolar : [];
    const v = videolar.find((x) => x && sayi(x.duration, 0) > 0 && !x.paused) || videolar.find((x) => x && sayi(x.duration, 0) > 0) || null;
    const durdu = v ? !!v.paused : ms.status === 'paused';
    const gecen = v ? sayi(v.currentTime, 0) : sayi(ms.currentTime || pb.currentTime, 0);
    const toplam = v ? sayi(v.duration, 0) : sayi(ms.duration || pb.duration, 1440);
    const bolumMetni = sezon > 1 ? `${sezon}. Sezon ${bolum}. Bölüm` : `${bolum}. Bölüm`;
    const slug = typeof pb.animeSlug === 'string' && /^[\w-]{1,100}$/.test(pb.animeSlug) ? pb.animeSlug : '';
    const animeUrl = m.animeUrl || (slug ? `https://anivesta.com/anime/${slug}` : '');

    const e = {
      ...temel,
      details: alan(baslik),
      state: durdu ? `Duraklatıldı • ${bolumMetni}` : bolumMetni,
      assets: {
        large_image: poster, large_text: alan(baslik) || 'Anivesta',
        small_image: LOGO_ANIVESTA, small_text: durdu ? 'Duraklatıldı' : 'Anivesta'
      },
      timestamps: zamanlar(simdi, gecen, toplam, durdu)
    };
    e.buttons = dugmeler(site, [["Anivesta'da İzle", m.url || sayfa], ['Anime Sayfası', animeUrl]], ayar);
    return e;
  }

  if (yol.startsWith('/anime') && !yol.includes('/bolumler')) {
    const baslik = metin(m.anime || s.detayBaslik || 'Anime Detayı');
    const poster = httpsAdres(m.poster || s.detayPoster || '') || LOGO_ANIVESTA;
    return {
      ...temel,
      details: alan(baslik),
      state: 'Animeyi İnceliyor',
      assets: { large_image: poster, large_text: alan(baslik) || 'Anivesta', small_image: LOGO_ANIVESTA, small_text: 'Anivesta' },
      buttons: dugmeler(site, [['Animeyi İncele', sayfa]], ayar)
    };
  }

  if (yol.startsWith('/social')) {
    let state;
    let details;
    if (m.type === 'community_topic' || yol.includes('/topic/')) {
      const konu = metin(m.title || s.konuBaslik || 'Forum Tartışması', 64);
      details = 'Toplulukta Tartışıyor';
      state = konu.length > 30 ? konu.slice(0, 27) + '...' : konu;
    } else {
      details = 'Topluluk & Forum';
      state = m.category ? `${metin(m.category, 40)} Kategorisinde` : 'Konuları Keşfediyor';
    }
    return {
      ...temel, details, state: alan(state),
      assets: { large_image: LOGO_ANIVESTA, large_text: 'Anivesta Topluluk' },
      buttons: dugmeler(site, [['Topluluğa Katıl', sayfa]], ayar)
    };
  }

  if (yol.includes('/kesfet') || /[?&]q=/.test(String(s.search || ''))) {
    return { ...temel, details: 'Anime Keşfediyor', state: 'Katalogda Arama Yapıyor' };
  }
  return { ...temel, details: 'Anasayfada Geziniyor', state: 'Anime Dünyasını Keşfediyor' };
}

function videovitrini(s, ayar, simdi, site) {
  const yol = String(s.path || '');
  const izleme = yol.startsWith('/watch');
  const kisa = yol.startsWith('/shorts');
  if (!izleme && !kisa) return null;

  const videolar = Array.isArray(s.videolar) ? s.videolar : [];
  const v = videolar.find((x) => x && !x.paused) || videolar[0] || null;
  const baslik = metin(String(s.title || 'Video Vitrini')
    .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  const sayfa = httpsAdres(s.href, site.host);

  const e = {
    type: IZLIYOR,
    details: alan(baslik) || 'Video Vitrini',
    state: 'Sitede geziniyor',
    assets: { large_image: LOGO_VITRIN, large_text: 'Video Vitrini' },
    buttons: dugmeler(site, [[kisa ? 'Kısa Videoyu İzle' : 'Videoyu İzle', sayfa]], ayar)
  };
  if (v) {
    if (!v.paused) {
      e.state = 'Video İzliyor';
      const gecen = sayi(v.currentTime, 0);
      const toplam = sayi(v.duration, 0);
      e.timestamps = zamanlar(simdi, gecen, Number.isFinite(toplam) ? toplam : 0, false);
      e.assets.small_text = 'Oynatılıyor';
    } else {
      e.state = 'Video Duraklatıldı';
    }
  }
  return e;
}

/**
 * @param {string} adres sekmenin adresi
 * @param {object} snapshot SNAPSHOT_BETIGI ciktisi
 * @param {{butonlar:boolean, gezinti?:number}} ayar
 * @param {number} [simdi] ms
 * @returns {{clientId:string, etkinlik:object}|null}
 */
function etkinlikUret(adres, snapshot, ayar, simdi = Date.now()) {
  const site = siteBul(adres);
  if (!site || !snapshot || typeof snapshot !== 'object') return null;
  const e = site.uret(snapshot, ayar || {}, simdi, site);
  if (!e) return null;
  // Tanimsiz alanlari ele (Discord bos alani reddediyor).
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  if (e.assets) for (const k of Object.keys(e.assets)) if (e.assets[k] === undefined) delete e.assets[k];
  return { clientId: site.clientId, etkinlik: e };
}

const CERCEVE_VIDEO_BETIGI = `JSON.stringify(Array.from(document.querySelectorAll('video')).map((v) => ({
  paused: !!v.paused, currentTime: Number(v.currentTime) || 0, duration: Number(v.duration) || 0
})))`;

module.exports = { CERCEVE_VIDEO_BETIGI, siteBul, etkinlikUret, SNAPSHOT_BETIGI, SITELER, metin };
