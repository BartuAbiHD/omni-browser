'use strict';

const SEARCH_ENGINES = {
  duckduckgo: { ad: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google:     { ad: 'Google',     url: 'https://www.google.com/search?q=%s' },
  yandex:     { ad: 'Yandex',     url: 'https://yandex.com.tr/search/?text=%s' },
  bing:       { ad: 'Bing',       url: 'https://www.bing.com/search?q=%s' },
  startpage:  { ad: 'Startpage',  url: 'https://www.startpage.com/sp/search?query=%s' },
  brave:      { ad: 'Brave',      url: 'https://search.brave.com/search?q=%s' },
  vuhuv:      { ad: 'Vuhuv',      url: 'https://vuhuv.com/?q=%s' },
  arama:      { ad: 'Arama.com',  url: 'https://www.arama.com/search.php?what=%s' }
};

// "scheme://..." biçimi kesin adrestir.
const PROTOKOLLU = /^[a-z][a-z0-9+.-]*:\/\//i;
// Eğik çizgisiz ama geçerli şemalar. "ornek.com:8080" bunlara benzediği için
// şema kontrolünü serbest bırakmıyoruz.
const OZEL_SEMA = /^(about|mailto|tel|view-source|chrome|omni|file|data|blob|javascript):/i;
const TEHLIKELI_SEMA = /^(javascript|data|blob):/i;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
const ADRES_GIBI = /^[a-z0-9¡-￿][a-z0-9¡-￿._-]*\.[a-z¡-￿]{2,}(:\d+)?([/?#].*)?$/i;

function search(query, engineKey = 'duckduckgo') {
  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES.duckduckgo;
  return engine.url.replace('%s', encodeURIComponent(query));
}

// Adres çubuğuna yazılanı ya adrese ya da arama sorgusuna çevirir.
function resolveInput(raw, engineKey = 'duckduckgo') {
  const input = String(raw || '').trim();
  if (!input) return null;

  // javascript:/data: adres çubuğundan çalıştırılmasın; aramaya düşsün.
  if (TEHLIKELI_SEMA.test(input)) return search(input, engineKey);
  if (PROTOKOLLU.test(input) || OZEL_SEMA.test(input)) return input;

  const ilk = input.split(/[/?#]/)[0];
  if (ilk === 'localhost' || /^localhost:\d+$/.test(ilk) || IPV4.test(ilk)) {
    return 'http://' + input;
  }
  if (!/\s/.test(input) && ADRES_GIBI.test(input)) {
    return 'https://' + input;
  }
  return search(input, engineKey);
}

// Yön değiştirme (bidi) ve kontrol karakterleri adres çubuğunda görünürse
// "evil.com/‮moc.knab" gerçek bankaymış gibi okunur. Görünmez olanları
// yüzde kodlamasına geri çevirerek gösteriyoruz.
const GORUNMEZ = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Kodlanmış hâlleri gerçek yüzde kodlaması olsun (U+202E -> %E2%80%AE),
// böylece adres çubuğundaki metin URL'in kendisiyle tutarlı kalır.
function metniGuvenliGoster(s) {
  return String(s).replace(GORUNMEZ, (c) => encodeURIComponent(c));
}

// Boşluk gerçek adreslerde kodlu kalmalı: "evil.com/<40 boşluk>bank.com" ile
// gerçek alan adı adres çubuğundan kaydırılıyor. Adres olmayan metinlerde
// (arama sorgusu, bozuk girdi) böyle bir tehlike yok, dokunmuyoruz.
function bosluklariKodla(s) {
  return s.replace(/ /g, '%20');
}

// Adres çubuğunda gösterilecek sadeleştirilmiş biçim.
function prettyURL(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return bosluklariKodla(metniGuvenliGoster(url));
    // "bank.com.login@evil.example" tuzağını kurmasın diye kimlik bilgisi gizlenir.
    u.username = '';
    u.password = '';
    return bosluklariKodla(metniGuvenliGoster(decodeURI(u.href)));
  } catch {
    return metniGuvenliGoster(url || '');
  }
}

function secilenUrlCoz(metin) {
  const s = String(metin || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(s) && !/\s/.test(s)) return 'https://' + s;
  return null;
}

const DAHILI_SAYFALAR = {
  gecmis: 'gecmis',
  history: 'gecmis',
  yerimleri: 'yerImleri',
  bookmarks: 'yerImleri',
  indirilenler: 'indirmeler',
  downloads: 'indirmeler',
  ayarlar: 'ayarlar',
  settings: 'ayarlar',
  hakkinda: 'hakkinda',
  about: 'hakkinda',
  version: 'hakkinda',
  parolalar: 'parolalar',
  passwords: 'parolalar',
  'hiz-testi': 'hizTesti',
  hiztesti: 'hizTesti',
  speedtest: 'hizTesti',
  aktar: 'aktarma',
  import: 'aktarma',
  eklentiler: 'eklentiler',
  extensions: 'eklentiler',
  istatistik: 'istatistik',
  istatistikler: 'istatistik',
  statistics: 'istatistik',
  stats: 'istatistik',
  'speed-test': 'hizTesti',
  flags: 'bayraklar',
  bayraklar: 'bayraklar',
  'new-tab': 'yenisekme',
  'yeni-sekme': 'yenisekme',
  newtab: 'yenisekme'
};

// Panel kodu -> adres çubuğunda görünen (İngilizce) kanonik ad. Türkçe adlar
// eski bağlantılar için kabul edilmeye devam ediyor ama artık üretilmiyor.
const PANEL_ADRES_ADI = {
  gecmis: 'history',
  yerImleri: 'bookmarks',
  indirmeler: 'downloads',
  ayarlar: 'settings',
  hakkinda: 'about',
  parolalar: 'passwords',
  hizTesti: 'speed-test',
  aktarma: 'import',
  istatistik: 'statistics',
  eklentiler: 'extensions',
  bayraklar: 'flags'
};

function dahiliAdres(panelKodu) {
  return 'omni://' + (PANEL_ADRES_ADI[panelKodu] || panelKodu);
}

function dahiliUrlPanel(url) {
  if (!url) return null;
  const m = String(url).trim().match(/^(?:chrome|omni):\/\/?([a-z0-9-]+)\/?$/i);
  if (!m) return null;
  const anahtar = m[1].toLowerCase();
  return DAHILI_SAYFALAR[anahtar] || null;
}

module.exports = { SEARCH_ENGINES, resolveInput, search, prettyURL, metniGuvenliGoster, secilenUrlCoz, dahiliUrlPanel, dahiliAdres };
