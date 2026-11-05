'use strict';

/*
 * Guvenli DNS (DNS-over-HTTPS). Chrome'daki "Guvenli DNS kullan" ayarinin karsiligi.
 *
 * Saf modul: Electron yok. Ayarlardan app.configureHostResolver() secenegini uretir.
 *
 * VARSAYILAN KAPALI: kapaliyken hicbir sey yapilmaz ('off'), alan adi sorgulari
 * yalniz isletim sisteminin DNS'ine gider. Acikken:
 *   - 'sistem'  : 'automatic' kipi, sunucu verilmez. Isletim sisteminin DNS
 *                 saglayicisi sifreli DNS destekliyorsa o kullanilir, yoksa
 *                 duz DNS'e dusulur (Chrome'daki "isletim sistemi varsayilani").
 *   - saglayici : 'secure' kipi, YALNIZ secilen sunucu; ulasilamazsa duz DNS'e
 *                 DUSMEZ (Chrome ile ayni; secimin anlami "bu sunucuyu kullan").
 * Hicbir sunucuya kullanici secmeden sorgu gitmez (sifir telemetri ilkesi).
 */

const SAGLAYICILAR = {
  opendns: { ad: 'OpenDNS', url: 'https://doh.opendns.com/dns-query' },
  cleanbrowsing: { ad: 'CleanBrowsing (Family Filter)', url: 'https://doh.cleanbrowsing.org/doh/family-filter/' },
  cloudflare: { ad: 'Cloudflare (1.1.1.1)', url: 'https://cloudflare-dns.com/dns-query' },
  google: { ad: 'Google (Public DNS)', url: 'https://dns.google/dns-query' }
};

/** Ozel sunucu: yalniz https, sunucu adi var, kimlik bilgisi/parcali adres yok. */
function ozelUrlGecerliMi(ham) {
  if (typeof ham !== 'string' || ham.length > 300) return false;
  let u;
  try { u = new URL(ham); } catch { return false; }
  return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && !u.hash;
}

function saglayiciGecerliMi(v) {
  return v === 'sistem' || v === 'ozel' || Object.hasOwn(SAGLAYICILAR, v);
}

/**
 * @returns {{secureDnsMode: 'off'|'automatic'|'secure', secureDnsServers: string[]}}
 */
function cozucuAyari(ayar) {
  if (!ayar || ayar.guvenliDns !== true) return { secureDnsMode: 'off', secureDnsServers: [] };
  const s = ayar.dnsSaglayici;
  if (s === 'ozel') {
    // Gecersiz/bos ozel adres sessizce duz DNS'e dusmez; ama sistem varsayilanina
    // donmek de "korunuyorum" yaniltmasi olur. Otomatik kip + sunucusuz = sistem.
    return ozelUrlGecerliMi(ayar.dnsOzel)
      ? { secureDnsMode: 'secure', secureDnsServers: [ayar.dnsOzel] }
      : { secureDnsMode: 'automatic', secureDnsServers: [] };
  }
  if (Object.hasOwn(SAGLAYICILAR, s)) return { secureDnsMode: 'secure', secureDnsServers: [SAGLAYICILAR[s].url] };
  return { secureDnsMode: 'automatic', secureDnsServers: [] };
}

module.exports = { SAGLAYICILAR, ozelUrlGecerliMi, saglayiciGecerliMi, cozucuAyari };
