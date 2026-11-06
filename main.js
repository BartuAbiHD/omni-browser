'use strict';

const {
  app, BrowserWindow, WebContentsView, ipcMain, shell, session,
  dialog, Menu, clipboard, nativeTheme, protocol, webFrameMain, safeStorage, nativeImage, webContents, Notification
} = require('electron');
const path = require('node:path');

/*
 * ÇÖKME RAPORLAMA (yerel). Bazı ağır sayfalar (ör. consent.google.com) Chromium'da
 * kararsız native çökme (0xC0000005) veriyor. crashReporter minidump'ları
 * userData/Crashpad altına yazar (sunucuya GÖNDERİLMEZ, gizlilik korunur); bir
 * çökme olursa yığın sembolize edilip kök neden bulunabilir.
 */
try {
  require('electron').crashReporter.start({ uploadToServer: false, compress: true });
} catch (e) { /* çökme raporlama kritik değil */ }
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');

const { Store } = require('./src/store');
const { preloadKaynagi } = require('./src/anti-adblock');
const { kararlilikPreloadKaynagi } = require('./src/kararlilik');
const { anaDunyaKurulumKodu: betikKurulumKodu, yerleşikDepo: betikYerlesikDepo } = require('./src/betikler');
const { DEGERLENDIRICI_KODU: prosedurelKodu } = require('./src/prosedurel');
const { Blocker, kokAlanAdi, hostAl } = require('./src/blocker');
const { ListeYoneticisi } = require('./src/listeler');
const { dilCoz, ceviri, bicimle, dilListesi } = require('./src/diller');
const { FaviconDeposu, SEMA: FAVICON_SEMASI } = require('./src/faviconlar');
const { GuncellemeYoneticisi } = require('./src/guncelleme');
const {
  sayfadanGezilebilir, disSemaIzinli, indirmeAdiNormalle,
  calistirilabilirMi, icSayfaDenetleyici
} = require('./src/guvenlik');
const { EklentiYoneticisi, magazaIdCoz, KIMLIK_RE: EKLENTI_KIMLIK_RE } = require('./src/eklentiler');
const { EklentiVeri } = require('./src/eklenti-veri');
const { EklentiBaglamMenusu } = require('./src/eklenti-baglam');
const { EklentiApi, guvenliDosyaAdi, izinVar: eklentiIzinVar, hostIzni: eklentiHostIzni, urlEslesir: eklentiUrlEslesir } = require('./src/eklenti-api');
const gecisAnahtari = require('./src/gecis-anahtari');
const { SEARCH_ENGINES, resolveInput, prettyURL, secilenUrlCoz, dahiliUrlPanel, dahiliAdres } = require('./src/urls');
const {
  genislikTahmini, olcumdenGenislik, xKonumu, xKonumuSol
} = require('./src/menu-yerlesim');
const { SertifikaDeposu } = require('./src/sertifikalar');
const { silinecekCerezler, cerezSilmeUrl } = require('./src/cerezler');
const cerezKasa = require('./src/cerez-kasa');
const httpsZorla = require('./src/https-zorla');
const { vekilKurallari, adresGecerliMi, atlamaGecerliMi } = require('./src/vekil');
const { vpnVekilKurali, lokasyonGecerliMi: vpnLokasyonGecerliMi, katalog: vpnKatalog, vpnKayitUrl } = require('./src/vpn');
const { vekilliFetch } = require('./src/vekil-istek');
const yenilikler = require('./src/yenilikler');
const { ipucuBasliklari } = require('./src/istemci-ipuclari');
const { flowmusicMi, flowmusicKodu } = require('./src/flowmusic');
const dpi = require('./src/dpi');
const varsayilanWindows = require('./src/varsayilan-windows');
const { kuruluTarayicilariBul, tarayicidanCek, htmlYerImleriAyristir, protonPassAyristir } = require('./src/tarayici-aktar');
const { htmlYerImleriUret } = require('./src/yerimi-html');

/*
 * UCUNCU TARAF CEREZLERI: CHROMIUM'UN KENDI ENGELI.
 *
 * Bizim engelimiz webRequest uzerinden calisiyor ve yalnizca BASLIKLARI
 * gorebiliyor. Olculdu: ucuncu taraf bir cercevenin document.cookie ile
 * yazdigi kimlik dokunulmadan kaliyor, izleyici onu okuyup URL'e tasiyor.
 * Yani "ucuncu taraf cerezler tasinmiyor" cumlesi yalnizca baslik icin
 * dogruydu.
 *
 * Chromium'un kendi anahtari bu bosluğu kapatiyor - olculdu: anahtarsiz
 * cerez kavanoza dusuyor, anahtarla hic yazilmiyor. Komut satiri anahtari
 * uygulama hazir olmadan verilmeli, o yuzden ayar dosyasi burada dogrudan
 * okunuyor; Store henuz kurulmus degil.
 *
 * SINIR: anahtar surec basina. Ayari degistirmek ya da bir siteye istisna
 * vermek baslik katmanina hemen isliyor, bu katman icin yeniden baslatmak
 * gerekiyor. Ayarlar sayfasi bunu yaziyor.
 */
function ucuncuTarafCerezAyariniOku() {
  try {
    const yol = path.join(app.getPath('userData'), 'pusula-veri.json');
    const kayit = JSON.parse(require('node:fs').readFileSync(yol, 'utf8'));
    return !(kayit && kayit.ayarlar && kayit.ayarlar.ucuncuTarafCerez === false);
  } catch {
    return true;   // ilk acilis: varsayilan acik
  }
}

if (ucuncuTarafCerezAyariniOku()) {
  app.commandLine.appendSwitch('test-third-party-cookie-phaseout');
}

/*
 * omni://flags: kullanicinin sectigi Chromium ozellikleri (bkz. src/bayraklar.js).
 * Komut satiri anahtarlari uygulama hazir olmadan verilmeli; Store henuz kurulu
 * degil, o yuzden ayar dosyasi dogrudan okunuyor. Dosya yok/bozuksa katalog
 * varsayilanlari uygulanir (ornegin WebRTC Kyber kapali).
 * enable-features / disable-features TEK anahtar: ayri appendSwitch cagrilari
 * birbirinin uzerine yazar.
 */
const guvenliDns = require('./src/guvenli-dns');
/*
 * Guvenli DNS (DoH): varsayilan KAPALI, yalniz kullanici acarsa sifreli sorgu
 * gider. Ayar degisince aninda uygulanir (yeniden baslatma gerekmez); eski
 * sonuclar yeni cozucuyle karismasin diye cozucu onbellegi de temizlenir.
 */
function guvenliDnsUygula() {
  try {
    app.configureHostResolver(guvenliDns.cozucuAyari(store.ayarlar));
    for (const o of [ses, sesGizli]) {
      if (o && o.clearHostResolverCache) o.clearHostResolverCache().catch(() => {});
    }
  } catch (e) {
    console.error('Guvenli DNS ayarlanamadi:', e.message);
  }
}
const bayraklar = require('./src/bayraklar');
function bayraklariUygula() {
  let ham = {};
  try {
    const yol = path.join(app.getPath('userData'), 'pusula-veri.json');
    const kayit = JSON.parse(require('node:fs').readFileSync(yol, 'utf8'));
    ham = (kayit && kayit.ayarlar && kayit.ayarlar.bayraklar) || {};
  } catch { /* ilk acilis */ }
  const s = bayraklar.uygula(ham);
  if (s.enable.length) app.commandLine.appendSwitch('enable-features', s.enable.join(','));
  if (s.disable.length) app.commandLine.appendSwitch('disable-features', s.disable.join(','));
  for (const a of s.anahtarlar) app.commandLine.appendSwitch(a);
  if (s.donanimKapali) app.disableHardwareAcceleration();
}
bayraklariUygula();

// Şema ayrıcalıkları uygulama hazır olmadan bildirilmeli.
protocol.registerSchemesAsPrivileged([{
  scheme: FAVICON_SEMASI,
  privileges: { standard: true, secure: true, supportFetchAPI: false, corsEnabled: false }
}]);

const UI_DIR = path.join(__dirname, 'ui');
const OTURUM = 'persist:pusula';
const OTURUM_GIZLI = 'gizli';
const GIZLI_PENCERE = process.argv.includes('--gizli-pencere');
const VARSAYILAN_CHROME_YUKSEKLIK = 84;

const { SpeedTest } = require('./src/speedtest');
let aktifSpeedTest = null;

let win = null;
let store = null;
let blocker = null;
let ses = null;
let sesGizli = null;
let listeler = null;
let faviconlar = null;
let guncelleme = null;
let ceviriler = ceviri('en');
const sertifikalar = new SertifikaDeposu();

// Çeviri kısayolu: cev('menu.dosya'), cev('menu.nSekme', { n: 3 })
function cev(anahtar, degerler) {
  return bicimle(ceviriler.metin[anahtar] || anahtar, degerler);
}

const argvDil = (process.argv.find((a) => a.startsWith('--dil=')) || '').replace('--dil=', '');
const argvTema = (process.argv.find((a) => a.startsWith('--tema=')) || '').replace('--tema=', '');

function diliUygula() {
  const dil = argvDil || store.ayarlar.dil;
  ceviriler = ceviri(dilCoz(dil, app.getLocale()));
  if (typeof eklentiler !== 'undefined' && eklentiler) eklentiler.dil = ceviriler.dil;
}

let chromeYukseklik = VARSAYILAN_CHROME_YUKSEKLIK;
// Arayüzdeki panel (Geçmiş/Ayarlar/İndirilenler) açık mı.
// DİKKAT: katmanAcikMi() ile karıştırılmasın - o, sayfanın üstündeki açılır
// kutu katmanını sorar. İkisi bir süre 'panelAcik' ve 'katmanAcikMi' olarak
// yan yana durdu; bu adlandırma hataya davetiyeydi.
let panelAcik = false;
let yanPanelGorunum = null;
let yanPanelYukleniyor = false;
let yanPanelGeriGidebilir = false;
let yanPanelIleriGidebilir = false;
let yanPanelBaslik = '';
let yanPanelUrl = '';
const sekmeler = new Map();       // id -> sekme
const kozmetikAnahtari = new Map(); // webContentsId -> insertCSS anahtari
let aktifId = null;
let sonrakiId = 1;
const indirmeler = [];
const MAX_INDIRME = 500;

// Tamamlanmış indirmeler yeniden başlatmada kaybolmasın diye store'a yazılır.
// "Geçmişi kaydet" kapalıysa diske hiçbir şey yazılmaz.
function indirmeleriKaydet() {
  if (!store) return;
  store.veri.indirmeler = store.ayarlar.gecmisiKaydet === false
    ? []
    : indirmeler.filter((k) => k.durum === 'tamam' && k.yol).slice(0, MAX_INDIRME);
  store.kaydet();
}

/* ---------------------------------------------------------------- */
/* Yardımcılar                                                       */
/* ---------------------------------------------------------------- */

// Yeni sekme sayfası korumalı (sandbox) ve preload'suz çalışıyor, yani ana
// süreçle konuşamıyor. Göstereceği her şey adres parametreleriyle veriliyor.
function motorAnahtari(gizli = false) {
  return (gizli || GIZLI_PENCERE) ? store.ayarlar.gizliAramaMotoru : store.ayarlar.aramaMotoru;
}

function yeniSekmeAdresi(gizli = false) {
  const engellenen = store.veri.istatistik.engellenen;
  const url = pathToFileURL(path.join(UI_DIR, 'newtab.html'));
  url.searchParams.set('motor', motorAnahtari(gizli));
  url.searchParams.set('dil', ceviriler.dil);
  url.searchParams.set('yon', ceviriler.yon);
  if (gizli || GIZLI_PENCERE) {
    url.searchParams.set('gizli', '1');
    url.searchParams.set('sonlar', JSON.stringify([]));
    url.searchParams.set('duyurular', JSON.stringify([]));
  } else {
    const sonlar = store.sikGidilenler(16)
      .map((s) => ({ ...s, favicon: 'pusula-favicon://' + s.host }));
    url.searchParams.set('sonlar', JSON.stringify(sonlar));
    url.searchParams.set('duyurular', JSON.stringify(store.ayarlar.duyurular || []));
  }
  // Sayfa çeviri tablosuna erişemediği için metinler burada çözülüp gönderilir.
  url.searchParams.set('metin', JSON.stringify({
    slogan: cev('hakkinda.detay'),
    ara: cev('yenisekme.ara'),
    araIpucu: cev('arac.adresIpucu'),
    sik: cev('yenisekme.sik'),
    oneCikan: cev('yenisekme.oneCikan'),
    kisayolEkle: cev('yenisekme.kisayolEkle'),
    kisayolIpucu: cev('yenisekme.kisayolIpucu'),
    gecersiz: cev('yenisekme.gecersizAdres'),
    kisayol: cev('yenisekme.kisayol'),
    kaldir: cev('panel.kaldir'),
    sikKaldir: cev('yenisekme.sikKaldir'),
    bosNot: cev('yenisekme.bosNot'),
    gizliBaslik: cev('yenisekme.gizliBaslik'),
    gizliAciklama: cev('yenisekme.gizliAciklama'),
    gizliKaydedilmez: cev('yenisekme.gizliKaydedilmez'),
    yeniSekme: cev('arac.yeniSekmeBaslik'),
    gizliSekme: cev('arac.gizli'),
    alt: engellenen > 0
      ? cev('yenisekme.engellendi', { n: engellenen.toLocaleString(ceviriler.yerel) })
      : cev('yenisekme.engelleyiciAcik')
  }));
  return url.href;
}

// Chromium hata kodlarını, kullanıcıya anlatılabilir gruplara indiriyoruz.
const HATA_GRUPLARI = {
  '-105': 'dns',
  '-106': 'cevrimdisi',
  /*
   * VEKİL HATALARI AYRI GRUP. Vekil ayarı bozukken her sayfa "bağlantı
   * hatası" diyordu; kullanıcı sorunun KENDİ ayarında olduğunu anlayamayıp
   * ağını ya da siteyi suçluyordu (ölçüldü: adresi boş 'elle' vekil bütün
   * tarayıcıyı sessizce kapatıyor). Artık hata sayfası doğrudan vekili
   * işaret ediyor.
   */
  '-130': 'vekil',   // PROXY_CONNECTION_FAILED
  '-131': 'vekil',   // PROXY_AUTH_UNSUPPORTED
  '-336': 'vekil',   // PROXY_AUTH_REQUESTED
  '-115': 'vekil',   // TUNNEL_CONNECTION_FAILED
  '-102': 'baglanti', '-101': 'baglanti', '-324': 'baglanti',
  '-7': 'zamanAsimi', '-118': 'zamanAsimi',
  '-200': 'sertifikaAd',
  '-201': 'sertifikaSure',
  '-202': 'sertifikaMakam', '-501': 'sertifikaMakam',
  COKME: 'cokme'
};

const HATA_ONERILERI = {
  dns: ['sayfa.oneriAdres', 'sayfa.oneriBaglanti', 'sayfa.oneriYenile'],
  cevrimdisi: ['sayfa.oneriBaglanti', 'sayfa.oneriYenile'],
  baglanti: ['sayfa.oneriYenile', 'sayfa.oneriBaglanti'],
  vekil: ['sayfa.oneriVekil', 'sayfa.oneriYenile'],
  zamanAsimi: ['sayfa.oneriYenile', 'sayfa.oneriBaglanti'],
  sertifikaAd: ['sayfa.oneriAdres', 'sayfa.oneriBilgiGirme'],
  sertifikaSure: ['sayfa.oneriBilgiGirme', 'sayfa.oneriYenile'],
  sertifikaMakam: ['sayfa.oneriBilgiGirme'],
  cokme: ['sayfa.oneriYenile'],
  bilinmeyen: ['sayfa.oneriYenile', 'sayfa.oneriAdres']
};

function hataAdresi(kod, aciklama, hedef) {
  const grup = HATA_GRUPLARI[String(kod)] || 'bilinmeyen';
  const url = pathToFileURL(path.join(UI_DIR, 'error.html'));
  url.searchParams.set('kod', String(kod));
  url.searchParams.set('aciklama', aciklama || '');
  url.searchParams.set('adres', hedef || '');
  url.searchParams.set('dil', ceviriler.dil);
  url.searchParams.set('yon', ceviriler.yon);
  url.searchParams.set('metin', JSON.stringify({
    baslik: cev('hata.' + grup + '.baslik'),
    aciklama: cev('hata.' + grup + '.metin'),
    oneriler: HATA_ONERILERI[grup].map((k) => cev(k)),
    tekrar: cev('sayfa.tekrarDene')
  }));
  return url.href;
}

const IC_SAYFALAR = new Set([
  pathToFileURL(path.join(UI_DIR, 'newtab.html')).href,
  pathToFileURL(path.join(UI_DIR, 'error.html')).href
]);

const icSayfaMi = icSayfaDenetleyici(IC_SAYFALAR);

function aktifSekme() {
  return aktifId != null ? sekmeler.get(aktifId) : null;
}

function sekmeSerilestir(t) {
  const wc = t.view.webContents;
  const yuklenen = t.url || '';
  const ic = icSayfaMi(yuklenen);
  // Hata sayfasındayken adres çubuğu boşalmasın: denenen adresi gösteriyoruz,
  // yoksa kullanıcı Ctrl+L ile adresi düzeltemez.
  const url = ic ? (t.hataAdresi || '') : yuklenen;
  const alan = kokAlanAdi(hostAl(url));
  return {
    id: t.id,
    baslik: t.baslik,
    url,
    gorunenUrl: url ? prettyURL(url) : '',
    // Uzak adres değil, yerel önbellek: ayrıcalıklı arayüz penceresi
    // saldırgan kontrolündeki görsel baytlarını çözmüyor.
    favicon: faviconlar ? faviconlar.adres(hostAl(url)) : '',
    yukleniyor: t.yukleniyor,
    geriGidebilir: t.geriGidebilir,
    ileriGidebilir: t.ileriGidebilir,
    guvenli: url.startsWith('https://') && !t.hataAdresi,
    hatali: !!t.hataAdresi,
    engellenen: wc.isDestroyed() ? 0 : blocker.sayac(wc.id),
    yerImi: !!url && store.yerImiVarMi(url),
    alanAdi: alan,
    siteIzinli: store.siteIzinliMi(alan),
    tamEkran: !!t.tamEkran,
    yakinlastirma: t.zoom,
    gizli: !!t.gizli,
    dahiliPanel: t.dahiliPanel || null,
    gezinme: t.gezinme || 0
  };
}

/*
 * DEĞİŞMEYEN VERİ HER DURUMDA GÖNDERİLMİYOR.
 *
 * durum yayını saniyede birkaç kez akıyor (her gezinme adımı, favicon, başlık,
 * engellenen sayacı, sekme geçişi). Ölçüldü: tek mesaj ~23 KB ve bunun ~15 KB'ı
 * ceviri + dil/motor/izin listeleri - HİÇ değişmeyen (yalnızca dil seçilince)
 * veri. Her olayda bu bloğu serileştirip IPC'den geçirmek boşuna CPU ve çöp.
 * Artık yalnızca arayüz hazır olduğunda ve dil değişince gönderiliyor; arayüz
 * gelen durumu öncekinin ÜSTÜNE birleştirdiği için atlanan alanlar korunuyor.
 */
let _sonYerImiSurum = -1;      // en son gönderilen yer imi sürümü
let _yerImiFaviconKirli = true; // favicon değişince yer imi şeridi tazelensin

function durumGonder(statikDe = false) {
  if (!win || win.isDestroyed()) return;
  const veri = {
    sekmeler: [...sekmeler.values()].map(sekmeSerilestir),
    aktifId,
    ayarlar: store.ayarlar,
    listeler: listeler ? listeler.durum() : [],
    toplamEngellenen: store.veri.istatistik.engellenen,
    indirmeler: indirmeler.slice(0, 30).map(indirmeArayuzOgesi),
    guncelleme: guncelleme ? guncelleme.bilgi() : null,
    pencereGizli: GIZLI_PENCERE,
    vekilReddedildi,
    yanPanel: {
      acik: !!(store && store.ayarlar && store.ayarlar.yanPanelAcik),
      cubukGoster: !!(store && store.ayarlar && store.ayarlar.yanCubukGoster),
      aktif: (store && store.ayarlar && store.ayarlar.yanPanelAktif) || 'wikipedia',
      mobil: !!(store && store.ayarlar && store.ayarlar.yanPanelMobil),
      genislik: (store && store.ayarlar && store.ayarlar.yanPanelGenislik) || 380,
      yukleniyor: yanPanelYukleniyor,
      geriGidebilir: yanPanelGeriGidebilir,
      ileriGidebilir: yanPanelIleriGidebilir,
      baslik: yanPanelBaslik,
      url: yanPanelUrl
    }
  };
  /*
   * Yer imleri (favicon'larıyla ~6 KB) yalnızca DEĞİŞTİĞİNDE gönderiliyor: yer
   * imi eklenip çıkınca (sürüm) ya da bir favicon gelince (şerit simgesi). Sayfa
   * geçişi/yükleme gibi olaylarda tekrar tekrar yollanmıyor. İlk/statik
   * gönderimde her zaman var - arayüz yeni bağlanmış olabilir.
   */
  if (statikDe || _yerImiFaviconKirli || store.yerImiSurum !== _sonYerImiSurum) {
    veri.yerImleri = store.veri.yerImleri.slice(0, 1000).map((y) => ({
      ...y,
      favicon: faviconlar ? faviconlar.adres(hostAl(y.url)) : '',
      klasor: y.klasor || ''
    }));
    veri.yerImiKlasorleri = store.yerImiKlasorleri();
    _sonYerImiSurum = store.yerImiSurum;
    _yerImiFaviconKirli = false;
  }
  // Sabitlenmiş eklenti düğmeleri (simgeleriyle) yalnızca değişince gönderilir.
  if (eklentiler && (statikDe || eklentiler.surum !== _sonEklentiSurum)) {
    veri.eklentiSabit = eklentiler.liste()
      .filter((e) => e.etkin && e.sabit)
      .map((e) => ({ id: e.id, ad: e.ad, simge: e.simge, popup: !!e.popup, secenekler: !!e.secenekler }));
    _sonEklentiSurum = eklentiler.surum;
  }
  if (statikDe) {
    veri.ceviri = ceviriler;
    veri.diller = dilListesi();
    veri.motorlar = SEARCH_ENGINES;
    veri.izinTurleri = IZIN_TURLERI;
    veri.vpnKatalog = yerelVpnKatalog();
    veri.surumBilgisi = {
      surum: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      mimari: process.arch,
      platform: process.platform
    };
  }
  win.webContents.send('durum', veri);
}

/*
 * Arayüze olay gönderir. Odağı önce arayüze almak şart: arayüz ile sayfa ayrı
 * webContents'lerde olduğu için, odak sayfadayken gönderilen "adres çubuğuna
 * git" gibi komutlardan sonra tuşlar sayfaya gitmeye devam ediyordu.
 */
function uiyeGonder(kanal, veri) {
  if (!win || win.isDestroyed()) return;
  win.webContents.focus();
  win.webContents.send(kanal, veri);
}

/* ---------------------------------------------------------------- */
/* Açılır kutu katmanı                                               */
/* ---------------------------------------------------------------- */

/*
 * Sayfa görünümü, arayüz penceresinin üstünde duran yerel bir katman. Bu
 * yüzden chrome içindeki hiçbir HTML kutusu sayfanın üzerine binemiyor:
 * indirilenler paneli chrome'u büyütüp sayfayı aşağı itiyordu, izin isteği de
 * yerel işletim sistemi kutusu olmak zorundaydı.
 *
 * Çözüm, sayfa görünümlerinden SONRA eklenen ikinci bir görünüm. Alt görünümler
 * eklenme sırasına göre üst üste bindiği için bu görünüm sayfanın üstünde
 * çizilir. Yalnızca bir kutu açıkken var; kapanınca kaldırılıyor, böylece
 * sayfa etkileşimi geri geliyor.
 */
// Boyut metni arayuzde de var; katman icerigi ana surecte kuruldugu icin
// burada da gerekiyor. Tek satirlik bir bicimlendirme, ortak modul acmiyoruz.
function boyutMetni(bayt) {
  if (!bayt || bayt < 0) return '';
  const birim = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bayt;
  while (n >= 1024 && i < birim.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(1)) + ' ' + birim[i];
}

// "1 sa 5 dk" / "3 dk 20 sn" / "12 sn": en çok iki birim.
function sureMetni(sn) {
  sn = Math.max(1, Math.round(sn));
  const sa = Math.floor(sn / 3600), dk = Math.floor((sn % 3600) / 60), s = sn % 60;
  if (sa > 0) return sa + ' ' + cev('indirme.sa') + (dk ? ' ' + dk + ' ' + cev('indirme.dk') : '');
  if (dk > 0) return dk + ' ' + cev('indirme.dk') + (s ? ' ' + s + ' ' + cev('indirme.sn') : '');
  return s + ' ' + cev('indirme.sn');
}

/**
 * İndirme satırının ikinci satırı (Chrome'daki gibi):
 * "1.2 MB/sn · 45.0 MB / 120.0 MB · 1 dk 5 sn kaldı", duraklatılmışsa
 * "Duraklatıldı · 45.0 MB / 120.0 MB".
 */
function indirmeAltMetni(i) {
  if (i.durum !== 'devam' && i.durum !== 'kesildi') {
    return cev('indirme.' + i.durum) + (i.toplam > 0 ? ' · ' + boyutMetni(i.alinan) + ' / ' + boyutMetni(i.toplam) : '');
  }
  const parcalar = [];
  if (i.durum === 'kesildi') parcalar.push(cev('indirme.kesildi'));
  else if (i.duraklatildi) parcalar.push(cev('indirme.duraklatildi'));
  else if (i.hiz > 0) parcalar.push(boyutMetni(i.hiz) + '/' + cev('indirme.sn'));
  parcalar.push(i.toplam > 0 ? boyutMetni(i.alinan) + ' / ' + boyutMetni(i.toplam) : boyutMetni(i.alinan) || '0 B');
  if (i.durum === 'devam' && !i.duraklatildi && i.hiz > 0 && i.toplam > i.alinan) {
    parcalar.push(cev('indirme.kalan').replace('{sure}', sureMetni((i.toplam - i.alinan) / i.hiz)));
  }
  return parcalar.join(' · ');
}

// Arayüze giden indirme kaydı: hazır metin + yapılabilecek eylemler.
function indirmeArayuzOgesi(k) {
  const it = indirmeNesneleri.get(k.no);
  const suruyor = k.durum === 'devam' || k.durum === 'kesildi';
  return {
    ...k,
    alt: indirmeAltMetni(k),
    yuzde: k.durum === 'devam' && k.toplam > 0 ? Math.min(100, Math.round((k.alinan / k.toplam) * 100)) : null,
    belirsiz: k.durum === 'devam' && !(k.toplam > 0),
    surdurulebilir: suruyor && !!it && (k.duraklatildi || (k.durum === 'kesildi' && it.canResume())),
    duraklatilabilir: k.durum === 'devam' && !k.duraklatildi && !!it,
    iptalEdilebilir: suruyor && !!it,
    silinebilir: !suruyor
  };
}

/**
 * Açık indirilenler kutusunu güncel veriyle yeniden gönderir (canlı ilerleme).
 * Kutu açık değilse ya da başka bir kutu açıksa hiçbir şey yapmaz.
 */
let indirmeKatmanKonumu = null;

function indirmeKatmanIcerik(konum) {
  const ogeler = indirmeler.slice(0, 10).map((i) => {
    const o = indirmeArayuzOgesi(i);
    return {
      id: o.id, ad: o.ad, alt: o.alt, yuzde: o.yuzde, belirsiz: o.belirsiz,
      riskli: !!o.calistirilabilir,
      acilabilir: o.durum === 'tamam',
      surdurulebilir: o.surdurulebilir, duraklatilabilir: o.duraklatilabilir,
      iptalEdilebilir: o.iptalEdilebilir, silinebilir: o.silinebilir,
      durum: o.durum, duraklatildi: !!o.duraklatildi
    };
  });
  return {
    tur: 'indirmeler',
    yon: 'sag',
    // Düğmenin alt kenarı; yerel menülerin kullandığı çapanın aynısı.
    ust: Math.max(0, Math.round((konum && konum.y) || chromeYukseklik)),
    kenar: Math.max(6, Math.round((konum && konum.sagKenar) || 8)),
    genislik: 400,
    baslik: cev('panel.indirilenler'),
    bosMetni: cev('indirme.bos'),
    tumunuMetni: cev('indirme.tumunuGoster'),
    klasorMetni: cev('indirme.klasor'),
    kapatMetni: cev('bul.kapat'),
    duraklatMetni: cev('indirme.duraklat'),
    surdurMetni: cev('indirme.surdur'),
    iptalMetni: cev('indirme.iptalEt'),
    silMetni: cev('indirme.listedenKaldir'),
    temizleMetni: cev('indirme.listeyiTemizle'),
    ogeler
  };
}

function indirmeKatmaniniYenile() {
  if (!indirmeKatmanKonumu || !katmanAcikMi() || katmanGorunum.webContents.isDestroyed()) return;
  if (!katmanHazirMi) return;
  katmanGorunum.webContents.send('katman:icerik', { ...indirmeKatmanIcerik(indirmeKatmanKonumu), yenile: true });
}

// Arayüzün ölçüp bildirdiği çapa noktaları. İzin kutusu bir tıklamayla
// açılmadığı için konumunu tıklama anında ölçemiyoruz.
let arayuzOlculeri = {};

let katmanGorunum = null;
let katmanHazirMi = false;
let katmanBekleyenIcerik = null;
let katmanIzinKarari = null;   // izin kutusu açıkken çözülecek söz
let katmanOnayKarari = null;   // onay penceresi açıkken çözülecek söz

function katmanOlustur() {
  if (katmanGorunum) return katmanGorunum;
  const g = new WebContentsView({
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      safeDialogs: true,
      transparent: true,
      preload: path.join(UI_DIR, 'katman-onyukleme.js')
    }
  });
  g.setBackgroundColor('#00000000');

  const wc = g.webContents;
  // Katman yalnızca kendi yerel sayfasını gösterir; hiçbir yere gitmez.
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));

  wc.loadFile(path.join(UI_DIR, 'katman.html'));
  katmanGorunum = g;
  return g;
}

function katmanGoster(icerik) {
  if (!win || win.isDestroyed()) return;
  indirmeKatmanKonumu = null;   // başka bir kutu açılıyor; indirme kutusu canlı yenilemesi biter
  const g = katmanOlustur();
  const { width, height } = win.getContentBounds();

  // Sayfa görünümlerinin üstünde kalması için her açılışta yeniden ekleniyor:
  // arada yeni sekme açıldıysa onun görünümü sonradan eklenmiş olurdu.
  try { win.contentView.removeChildView(g); } catch { /* ekli değildi */ }
  win.contentView.addChildView(g);
  // Katman TÜM pencereyi kaplıyor. Yalnızca sayfa alanını kaplasaydı kutu en
  // yukarı chrome'un altından başlayabilirdi; yer imleri çubuğu araya girince
  // düğmeyle kutu arasında boşluk kalıyordu. Artık kutu, düğmenin alt kenarına
  // yerel menülerle aynı şekilde çapalanıyor.
  g.setBounds({ x: 0, y: 0, width, height });

  if (katmanHazirMi) katmanGorunum.webContents.send('katman:icerik', icerik);
  else katmanBekleyenIcerik = icerik;      // sayfa yüklenince gönderilecek

  // Odak verilmezse katmandaki Escape dinleyicisi ve "odak Reddet'te başlasın"
  // savunması hiç çalışmıyor; tuşlar isteği yapan sayfada kalıyor.
  g.webContents.focus();
}

// Katman açıksa en üste geri alır.
function katmaniOneAl() {
  if (!katmanAcikMi()) return;
  try {
    win.contentView.removeChildView(katmanGorunum);
    win.contentView.addChildView(katmanGorunum);
  } catch { /* pencere kapanıyor olabilir */ }
}

/**
 * Sayfanın ortasında tarayıcı temalı onay penceresi. true = onaylandı; kapatma,
 * Escape ve dışarı tıklama false döner (fail-closed). vazgecMetni verilmezse tek
 * düğmeli bilgi/hata kutusu olur.
 */
function katmanOnay(o) {
  return new Promise((coz) => {
    if (!win || win.isDestroyed()) return coz(false);
    if (katmanOnayKarari) { const eski = katmanOnayKarari; katmanOnayKarari = null; eski(false); }
    katmanOnayKarari = coz;
    katmanGoster({ ust: 0, kenar: 0, genislik: 460, ...o, tur: 'onay' });
  });
}

/* ---------------- Yenilikler (güncelleme sonrası ilk açılış) ---------------- */

let yenilikBolumu = null;                 // { surum, tarih, govde } (İngilizce özgün)
const yenilikCeviriOnbellek = new Map();  // dil -> çevrilmiş gövde
let yenilikKontrolEdildi = false;
let ilkKurulumMu = false;

const yenilikGetir = (url) => vekilliFetch(session.fromPartition('liste-indirme'), url,
  { cache: 'no-cache', zamanAsimi: 20000, headers: { 'User-Agent': 'CVSBrowser/' + app.getVersion() } }, vpnKimlik)
  .then((y) => { if (!y.ok) throw new Error('HTTP ' + y.status); return y.text(); });

function yenilikMetinleri() {
  return {
    dil: cev('yenilik.dil'), kapat: cev('yenilik.kapat'),
    ceviriyor: cev('yenilik.ceviriyor'), ceviriHata: cev('yenilik.ceviriHata'),
    bolumler: {
      Added: cev('yenilik.eklendi'), Changed: cev('yenilik.degisti'), Fixed: cev('yenilik.duzeltildi'),
      Security: cev('yenilik.guvenlik'), Removed: cev('yenilik.kaldirildi'), Deprecated: cev('yenilik.kullanimdanKalkan')
    }
  };
}

/**
 * Sürüm değiştiyse (güncelleme) o sürümün notlarını gösterir. İlk kurulumda
 * göstermez, yalnızca sürümü kaydeder. Notlar alınamazsa (çevrimdışı vb.)
 * sessizce vazgeçilir ve sürüm "görüldü" sayılmaz; sonraki açılışta yeniden denenir.
 */
async function yenilikleriGoster(ilkKurulum) {
  if (yenilikKontrolEdildi || GIZLI_PENCERE) return;
  yenilikKontrolEdildi = true;
  const surum = app.getVersion();
  const gorulen = store.veri.sonGorulenSurum;
  if (gorulen === surum) return;
  if (ilkKurulum && !gorulen) { store.veri.sonGorulenSurum = surum; store.hemenKaydet(); return; }
  try {
    const bolum = await yenilikler.yenilikleriGetir(yenilikGetir, surum);
    if (!bolum || !win || win.isDestroyed()) return;
    yenilikBolumu = bolum;
    yenilikCeviriOnbellek.clear();
    store.veri.sonGorulenSurum = surum;
    store.hemenKaydet();
    katmanGoster({
      tur: 'yenilikler', ust: 0, kenar: 0, genislik: 680,
      baslik: cev('yenilik.baslik'), surum: bolum.surum, tarih: bolum.tarih, govde: bolum.govde,
      // Açılışta özgün (İngilizce) metin; çeviri yalnızca kullanıcı dil seçince istenir.
      diller: dilListesi(), secili: 'en', m: yenilikMetinleri()
    });
  } catch { /* çevrimdışı: bir sonraki açılışta yeniden denenir */ }
}

function katmanGizle() {
  indirmeKatmanKonumu = null;
  if (katmanOnayKarari) {
    const coz = katmanOnayKarari;
    katmanOnayKarari = null;
    coz(false);
  }
  // Açık bir izin isteği varsa kapanış reddetme sayılır: fail-closed.
  if (katmanIzinKarari) {
    const coz = katmanIzinKarari;
    katmanIzinKarari = null;
    coz({ izinVer: false, hatirla: false });
  }
  if (!katmanGorunum || !win || win.isDestroyed()) return;
  try { win.contentView.removeChildView(katmanGorunum); } catch { /* zaten yok */ }
}

function katmanAcikMi() {
  return !!(katmanGorunum && win && !win.isDestroyed()
    && win.contentView.children.includes(katmanGorunum));
}

function yerlesimGuncelle() {
  if (!win || win.isDestroyed()) return;
  const { width, height } = win.getContentBounds();
  if (katmanAcikMi()) katmanGorunum.setBounds({ x: 0, y: 0, width, height });
  /*
   * HTML tam ekran (video oynatıcının tam ekran düğmesi): aktif sayfa TÜM
   * pencereyi kaplamalı, chrome'un üstüne binmeli. Bu olmadan yerlesimGuncelle
   * sayfayı her zaman chrome'un altında bıraktığı için video "tam ekran"
   * denince bile araç çubuğu görünür kalıyor ve video büyümüyordu.
   */
  const a = aktifSekme();
  const htmlTam = !!(a && a.tamEkran);

  if (htmlTam) {
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
      yanPanelGorunum.setVisible(false);
    }
    for (const t of sekmeler.values()) {
      if (t.view.webContents.isDestroyed()) continue;
      t.view.setBounds({ x: 0, y: 0, width, height });
    }
    return;
  }

  const y = panelAcik ? height : chromeYukseklik;
  const icYukseklik = Math.max(0, height - y);

  const yanCubukGoster = store && store.ayarlar && store.ayarlar.yanCubukGoster;
  const yanPanelAcikMi = yanCubukGoster && store && store.ayarlar && store.ayarlar.yanPanelAcik;
  const cubukG = yanCubukGoster ? 44 : 0;
  const panelG = yanPanelAcikMi ? ((store && store.ayarlar && store.ayarlar.yanPanelGenislik) || 380) : 0;
  const solOfset = cubukG + panelG;

  const aktifPanelObj = (store && store.ayarlar && Array.isArray(store.ayarlar.yanPaneller))
    ? store.ayarlar.yanPaneller.find((p) => p.id === store.ayarlar.yanPanelAktif)
    : null;
  const webPaneliMi = !!(aktifPanelObj && aktifPanelObj.url);

  if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
    if (yanPanelAcikMi && !panelAcik && webPaneliMi) {
      const baslikYukseklik = 38;
      yanPanelGorunum.setVisible(true);
      yanPanelGorunum.setBounds({
        x: cubukG,
        y: y + baslikYukseklik,
        width: Math.max(0, panelG),
        height: Math.max(0, icYukseklik - baslikYukseklik)
      });
    } else {
      yanPanelGorunum.setVisible(false);
    }
  }

  const anaGenislik = Math.max(0, width - solOfset);
  for (const t of sekmeler.values()) {
    if (t.view.webContents.isDestroyed()) continue;
    t.view.setBounds({ x: solOfset, y, width: anaGenislik, height: icYukseklik });
  }
}

function yanPanelGorunumAl() {
  if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
    return yanPanelGorunum;
  }
  const koyu = nativeTheme.shouldUseDarkColors;
  yanPanelGorunum = new WebContentsView({
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  yanPanelGorunum.setBackgroundColor(koyu ? '#16181d' : '#ffffff');
  win.contentView.addChildView(yanPanelGorunum);
  katmaniOneAl();

  const wc = yanPanelGorunum.webContents;
  wc.setWebRTCIPHandlingPolicy(webrtcPolitikasi());

  wc.on('did-start-loading', () => {
    yanPanelYukleniyor = true;
    durumGonder();
  });
  wc.on('did-stop-loading', () => {
    yanPanelYukleniyor = false;
    yanPanelGeriGidebilir = wc.navigationHistory.canGoBack();
    yanPanelIleriGidebilir = wc.navigationHistory.canGoForward();
    yanPanelUrl = wc.getURL();
    durumGonder();
  });
  wc.on('page-title-updated', (_e, b) => {
    yanPanelBaslik = b;
    durumGonder();
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (sayfadanGezilebilir(url)) {
      sekmeOlustur(url, false);
    }
    return { action: 'deny' };
  });

  if (store && store.ayarlar && store.ayarlar.yanPanelMobil) {
    wc.enableDeviceEmulation({
      screenPosition: 'mobile',
      screenSize: { width: 412, height: 915 },
      viewSize: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      fitToView: true
    });
  }

  return yanPanelGorunum;
}

function yanPanelAc(id) {
  if (!win || win.isDestroyed()) return;
  const paneller = (store && store.ayarlar && store.ayarlar.yanPaneller) || [];
  const panel = paneller.find((p) => p.id === id);

  // Zaten açık olan panele tekrar tıklandıysa paneli kapat (toggle)
  if (store.ayarlar.yanPanelAcik && store.ayarlar.yanPanelAktif === id) {
    yanPanelKapat();
    return;
  }

  store.ayarlar.yanPanelAcik = true;
  store.ayarlar.yanPanelAktif = id;
  store.kaydet();

  if (panel && panel.url) {
    const g = yanPanelGorunumAl();
    const suankiUrl = g.webContents.getURL();
    if (!suankiUrl || suankiUrl === 'about:blank' || (panel.varsayilanUrl && !suankiUrl.includes(kokAlanAdi(hostAl(panel.url))))) {
      g.webContents.loadURL(panel.url);
    }
  } else if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
    yanPanelGorunum.setVisible(false);
  }
  yerlesimGuncelle();
  durumGonder();
}

function yanPanelKapat() {
  if (!store) return;
  store.ayarlar.yanPanelAcik = false;
  store.kaydet();
  if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
    yanPanelGorunum.setVisible(false);
  }
  yerlesimGuncelle();
  durumGonder();
  const a = aktifSekme();
  if (a && !a.view.webContents.isDestroyed()) a.view.webContents.focus();
}

function yanPanelMobilAyarla(aktif) {
  if (!yanPanelGorunum || yanPanelGorunum.webContents.isDestroyed()) return;
  const wc = yanPanelGorunum.webContents;
  if (aktif) {
    wc.enableDeviceEmulation({
      screenPosition: 'mobile',
      screenSize: { width: 412, height: 915 },
      viewSize: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      fitToView: true
    });
  } else {
    wc.disableDeviceEmulation();
  }
  wc.reload();
}

/* ---------------------------------------------------------------- */
/* Sekme yaşam döngüsü                                               */
/* ---------------------------------------------------------------- */

function yeniPencereAc(url) {
  const { spawn } = require('node:child_process');
  const os = require('node:os');
  const profilDizin = path.join(os.tmpdir(), 'cvs-profil-' + Date.now());
  const args = [
    path.join(__dirname, '.'),
    '--yeni-pencere',
    '--user-data-dir=' + profilDizin,
    '--dil=' + ceviriler.dil,
    '--tema=' + store.ayarlar.tema
  ];
  if (url) args.push(url);
  const cocuk = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore'
  });
  cocuk.unref();
}

function yeniGizliPencereAc(url) {
  const { spawn } = require('node:child_process');
  const os = require('node:os');
  const profilDizin = path.join(os.tmpdir(), 'cvs-gizli-' + Date.now());
  const args = [
    path.join(__dirname, '.'),
    '--gizli-pencere',
    '--asil-veri=' + path.join(app.getPath('userData'), 'pusula-veri.json'),
    '--user-data-dir=' + profilDizin,
    '--dil=' + ceviriler.dil,
    '--tema=' + store.ayarlar.tema
  ];
  if (url) args.push(url);
  const cocuk = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore'
  });
  cocuk.unref();
}

const PANEL_ANAHTARI = {
  gecmis: 'panel.gecmis',
  yerImleri: 'panel.yerImleri',
  indirmeler: 'panel.indirilenler',
  ayarlar: 'panel.ayarlar',
  siteIzinleri: 'panel.siteIzinleri',
  istatistik: 'panel.istatistik',
  parolalar: 'panel.parolalar',
  hizTesti: 'panel.hizTesti',
  hakkinda: 'panel.hakkinda',
  aktarma: 'aktarma.baslik',
  eklentiler: 'panel.eklentiler',
  bayraklar: 'panel.bayraklar'
};

const DAHILI_PANEL_ADLARI = {
  flags: 'bayraklar',
  bayraklar: 'bayraklar',
  eklentiler: 'eklentiler',
  extensions: 'eklentiler',
  gecmis: 'gecmis',
  history: 'gecmis',
  yerimleri: 'yerImleri',
  yerimler: 'yerImleri',
  bookmarks: 'yerImleri',
  indirilenler: 'indirmeler',
  indirmeler: 'indirmeler',
  downloads: 'indirmeler',
  ayarlar: 'ayarlar',
  settings: 'ayarlar',
  parolalar: 'parolalar',
  passwords: 'parolalar',
  'hiz-testi': 'hizTesti',
  hiztesti: 'hizTesti',
  speedtest: 'hizTesti',
  hakkinda: 'hakkinda',
  about: 'hakkinda',
  version: 'hakkinda',
  aktar: 'aktarma',
  aktarma: 'aktarma',
  import: 'aktarma',
  istatistik: 'istatistik',
  istatistikler: 'istatistik',
  statistics: 'istatistik',
  stats: 'istatistik'
};

function dahiliSayfaSekmesiAc(ad) {
  const panelKodu = dahiliUrlPanel(ad) || DAHILI_PANEL_ADLARI[ad] || ad;
  const url = dahiliAdres(panelKodu);

  for (const t of sekmeler.values()) {
    if (t.url === url || t.dahiliPanel === panelKodu) {
      sekmeSec(t.id);
      return;
    }
  }

  const a = aktifSekme();
  if (a && (!a.url || a.url === yeniSekmeAdresi(a.gizli))) {
    a.url = url;
    a.dahiliPanel = panelKodu;
    a.baslik = cev(PANEL_ANAHTARI[panelKodu] || 'panel.' + panelKodu);
    if (!a.view.webContents.isDestroyed()) a.view.webContents.loadURL('about:blank');
    uiyeGonder('panel-ac', { ad: panelKodu, kip: 'ac' });
    durumGonder();
  } else {
    sekmeOlustur({ url });
  }
}

function sekmeOlustur({ url, arkaPlan = false, kaynak = 'kullanici', gizli = false } = {}) {
  if (kaynak === 'sayfa' && url && !sayfadanGezilebilir(url)) return null;
  // macOS'ta son pencere kapandıktan sonra menü canlı kalır; Cmd+T ile
  // buraya penceresiz düşülebiliyor.
  if (!win || win.isDestroyed()) {
    pencereOlustur();
    return null;
  }

  const isGizli = gizli || GIZLI_PENCERE;
  const dahili = dahiliUrlPanel(url);
  let dahiliPanel = null;
  if (dahili) {
    if (dahili === 'yenisekme') {
      url = yeniSekmeAdresi(isGizli);
    } else {
      dahiliPanel = dahili;
      url = dahiliAdres(dahili);
    }
  }

  const tabSession = isGizli ? session.fromPartition(OTURUM_GIZLI, { cache: false }) : ses;
  const view = new WebContentsView({
    webPreferences: {
      session: tabSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // Chromium yazım denetimi sözlüklerini Google sunucusundan indirir;
      // gizlilik odaklı bir tarayıcıda beyan edilmemiş bağlantı olmasın.
      spellcheck: false,
      safeDialogs: true
    }
  });
  view.setBackgroundColor('#ffffff');

  const t = {
    id: sonrakiId++,
    view,
    baslik: dahiliPanel ? cev(PANEL_ANAHTARI[dahiliPanel] || 'panel.' + dahiliPanel) : cev(isGizli ? 'arac.gizli' : 'arac.yeniSekmeBaslik'),
    url: dahiliPanel ? url : '',
    favicon: null,
    yukleniyor: false,
    geriGidebilir: false,
    ileriGidebilir: false,
    zoom: 0,
    gizli: !!isGizli,
    dahiliPanel
  };
  sekmeler.set(t.id, t);
  win.contentView.addChildView(view);
  if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed() && win.contentView.children.includes(yanPanelGorunum)) {
    try {
      win.contentView.removeChildView(yanPanelGorunum);
      win.contentView.addChildView(yanPanelGorunum);
    } catch {}
  }
  // Sekme görünümü sonradan eklendiği için katmanın üstüne çıkar ve açık bir
  // izin kutusunu gömer; kutu gömülünce söz hiç çözülmez ve izinOnayAcik
  // takılı kalıp SONRAKİ TÜM izin isteklerini sessizce reddeder.
  katmaniOneAl();
  view.setVisible(false);

  olaylariBagla(t);
  eklentiSekmeDinle(t);
  // Vekil acikken WebRTC gercek adresi yayinlayabiliyor. Politika sekme
  // BASINA; yeni acilan sekmeye ayrica uygulanmazsa o sekme sizdirir.
  view.webContents.setWebRTCIPHandlingPolicy(webrtcPolitikasi());
  view.webContents.loadURL(dahiliPanel ? 'about:blank' : (url || yeniSekmeAdresi(isGizli)));

  eklentiSekmeOlayi('onCreated', t);
  if (!arkaPlan) {
    sekmeSec(t.id);
  } else {
    yerlesimGuncelle();
    durumGonder();
  }
  return t;
}

// Yok edilmiş görünümde view.webContents undefined olabilir; güvenli kontrol.
function gorunumYasiyor(tab) {
  try {
    const wc = tab && tab.view && tab.view.webContents;
    return !!wc && !wc.isDestroyed();
  } catch { return false; }
}

function sekmeSec(id) {
  const t = sekmeler.get(id);
  if (!t || !gorunumYasiyor(t)) return;
  const gorunur = !panelAcik;
  /*
   * ÖNCE GELEN SEKMEYİ GÖSTER, SONRA ÖTEKİLERİ GİZLE. Tersini yapınca (eskiyi
   * gizle, sonra yeniyi göster) aradaki karede hiçbir görünüm görünmez kalıp
   * pencere arka planı sızıyor - beyaz/boş bir parlama. Sırayı çevirince geçiş
   * daha akıcı görünüyor.
   */
  if (gorunur && !t.dahiliPanel) t.view.setVisible(true);
  for (const [tid, tab] of sekmeler) {
    if (tid === id) continue;
    if (gorunumYasiyor(tab)) tab.view.setVisible(false);
  }
  if (!gorunur || t.dahiliPanel) t.view.setVisible(false);
  const oncekiAktif = aktifId;
  aktifId = id;
  if (oncekiAktif !== id) eklentiSekmeOlayi('onActivated', t);
  if (t.dahiliPanel) {
    uiyeGonder('panel-ac', { ad: t.dahiliPanel, kip: 'ac', sekmeModu: true });
  } else if (panelAcik) {
    uiyeGonder('panel-kapat');
  }
  yerlesimGuncelle();
  // Panel açıkken odağı görünmez sayfaya vermek panelde yazmayı öldürüyordu.
  if (gorunur && gorunumYasiyor(t)) t.view.webContents.focus();
  durumGonder();
}

// Ctrl+W: son sekme kapatılınca pencere de kapanır (× düğmesi yeni sekme açmaya devam eder).
function sekmeyiKlavyeKapat() {
  if (!aktifId) return;
  if (sekmeler.size <= 1 && win && !win.isDestroyed()) { win.close(); return; }
  sekmeKapat(aktifId);
}

function sekmeKapat(id) {
  const t = sekmeler.get(id);
  if (!t) return;
  const sira = [...sekmeler.keys()];
  const konum = sira.indexOf(id);
  const kapananWcId = gorunumYasiyor(t) ? t.view.webContents.id : null;

  sekmeler.delete(id);
  if (kapananWcId != null) eklentiSekmeOlayi('onRemoved', t, { wcId: kapananWcId });
  try {
    win.contentView.removeChildView(t.view);
    blocker.unut(t.view.webContents.id);
    t.view.webContents.close();
  } catch { /* zaten kapanmış olabilir */ }

  if (t.gizli) {
    const baskaGizliVar = [...sekmeler.values()].some((s) => s.gizli);
    if (!baskaGizliVar) {
      session.fromPartition(OTURUM_GIZLI, { cache: false }).clearStorageData().catch(() => {});
    }
  }

  if (sekmeler.size === 0) {
    aktifId = null;
    sekmeOlustur({});
    return;
  }
  if (aktifId === id) {
    const kalan = [...sekmeler.keys()];
    sekmeSec(kalan[Math.min(konum, kalan.length - 1)]);
  } else {
    durumGonder();
  }
}

function olaylariBagla(t) {
  const wc = t.view.webContents;
  const wcId = wc.id;   // 'destroyed' tetiklendiğinde wc.id artık okunamaz

  const tazele = () => {
    if (wc.isDestroyed()) return;
    t.geriGidebilir = wc.navigationHistory.canGoBack();
    t.ileriGidebilir = wc.navigationHistory.canGoForward();
    durumGonder();
  };

  wc.on('page-title-updated', (_e, baslik) => {
    const yeni = baslik || cev('arac.adsiz');
    // Başlığını sayaçla güncelleyen siteler saniyede birkaç kez diske yazma
    // ve arayüz yeniden çizimi tetikliyordu.
    if (yeni === t.baslik) return;
    t.baslik = yeni;
    if (!t.gizli && !GIZLI_PENCERE) {
      store.gecmiseEkle(t.url, t.baslik);
    }
    durumGonder();
  });

  wc.on('page-favicon-updated', (_e, favicons) => {
    const yeni = favicons && favicons[0] ? favicons[0] : null;
    if (yeni === t.favicon) return;
    t.favicon = yeni;
    // Simgeyi bir kez indirip yerel önbelleğe alıyoruz; arayüz oradan okuyor.
    // ziyaretEdildi: kullanıcı bu sekmeyi açtı, yani birinci taraf simge için
    // kimlikli istek uygun (Cloudflare çerezi yeniden kullanılabilsin).
    if (yeni && faviconlar && !t.gizli && !GIZLI_PENCERE) faviconlar.kaydet(hostAl(t.url), yeni, { ziyaretEdildi: true });
    durumGonder();
  });

  wc.on('did-start-loading', () => { t.yukleniyor = true; durumGonder(); });
  wc.on('did-stop-loading', () => { t.yukleniyor = false; tazele(); });

  wc.on('did-start-navigation', (e) => {
    /*
     * YALNIZCA SAYAC. Buraya ustAlanAyarla koymak haritayi henuz ISLENMEMIS
     * bir gezinmenin adresiyle dolduruyordu; gezinme tamamlanmazsa (indirme
     * baglantisi, 204 yanit) did-navigate de did-fail-load da GELMIYOR ve
     * harita kalici olarak yanlis kaliyordu. Olculdu.
     *
     * Sonucu cerez sistemi geldikten sonra agirlasti: acik duran sayfanin her
     * istegi ucuncu taraf sayilip cerezi kesiliyor, yani kullanici oturumdan
     * dusuyor. Sayfa hala oradayken.
     *
     * Ayni belge icindeki (SPA rota) gezinmelerde sayac da sifirlanmiyor.
     */
    if (e.isMainFrame && !e.isSameDocument) blocker.sayaciSifirla(wcId);
  });

  wc.on('did-navigate', (_e, url) => {
    t.gezinme = (t.gezinme || 0) + 1;   // yenileme de sayılır; arayüz adres taslağını buna bağlıyor
    // İç sayfalar about:blank üzerinde çiziliyor; adres çubuğunda omni:// adresi kalsın.
    if (t.dahiliPanel && url === 'about:blank') {
      t.url = dahiliAdres(t.dahiliPanel);
      t.favicon = null;
      tazele();
      return;
    }
    t.url = url;
    t.favicon = null;
    if (!icSayfaMi(url)) t.hataAdresi = null;
    blocker.ustAlanAyarla(wcId, url);
    kozmetigiUygula(wc, url);
    if (!t.gizli && !GIZLI_PENCERE) {
      store.gecmiseEkle(url, t.baslik);
    }
    tazele();
  });

  /*
   * Alt cerceve SONRADAN olusuyor ve sonradan geziniyor. Ana cerceve
   * icin yapilan enjeksiyon o anda henuz var olmayan cerceveye
   * ulasmiyor; reklam cercevesi de zaten sayfadan sonra yukleniyor.
   */
  wc.on('did-frame-navigate', (e, _url, _kod, _metin, anaCerceve) => {
    if (anaCerceve) return;
    // YALNIZCA yeni gezilen çerçeveyi giydir - tüm çerçeveleri değil (N*N patlaması).
    const css = kozmetikCssAl(t.url);
    if (css && e && e.frame) cerceveGiydir(e.frame, css);
  });

  /*
   * Electron 44'te did-frame-navigate, alt çerçevelerin İLK yüklenmesinde
   * güvenilir tetiklenmiyor (ölçüldü: aynı-köken iframe'de hiç ya da çok geç);
   * iframe içindeki reklamlar gizlenmeden kalıyordu. did-frame-finish-load HER
   * çerçeve yüklenince tetikleniyor; çerçeveyi webFrameMain.fromId ile çözüp
   * kozmetiği uyguluyoruz. Yalnız o çerçeve giydiriliyor -> O(N), N*N değil.
   * (Liste açılıştan geç gelirse kozmetigiTazele alt çerçeveleri yeniden giydirir.)
   */
  wc.on('did-frame-finish-load', (_e, anaCerceve, pid, rid) => {
    if (anaCerceve) return;
    const css = kozmetikCssAl(t.url);
    if (!css) return;
    try {
      const cerceve = webFrameMain.fromId(pid, rid);
      if (cerceve) cerceveGiydir(cerceve, css);
    } catch (e2) { /* çerçeve gitmiş olabilir */ }
  });

  wc.on('dom-ready', () => {
    if (flowmusicMi(t.url || wc.getURL())) {
      wc.executeJavaScript(flowmusicKodu(ceviriler.dil), true).catch(() => {});
    }
  });

  wc.on('did-navigate-in-page', (_e, url, anaCerceve) => {
    if (!anaCerceve) return;
    t.url = url;
    if (flowmusicMi(url)) {
      wc.executeJavaScript(flowmusicKodu(ceviriler.dil), true).catch(() => {});
    }
    tazele();
  });

  wc.on('did-navigate', () => { t.sonReset = null; });

  wc.on('did-fail-load', (_e, kod, aciklama, adres, anaCerceve) => {
    // -3 = ABORTED: kullanıcı gezinmeyi iptal etti, hata sayfası gösterme.
    if (wc.isDestroyed() || !anaCerceve || kod === -3) return;

    /*
     * -101 = CONNECTION_RESET: çoğunlukla boşta kalmış bir soketin sunucu
     * tarafında kapatılması. Kullanıcı zaten elle "tekrar dene" deyince
     * açılıyor (ölçüldü: bizim başlıklarımız/vekilimiz üretmiyor, ağ tarafı
     * geçici). Bunu bir kez kendimiz deniyoruz; hata sayfası ancak ikinci kez
     * de sıfırlarsa çıkıyor. Yalnızca aynı adres için TEK sefer: kalıcı bir
     * sıfırlamada sonsuz döngü olmasın. GET olmayan gezinmeler yeniden
     * denenmez - Electron did-fail-load'da yöntemi vermiyor, ama -101 el
     * sıkışmadan önce olur, yani gövde henüz gönderilmemiştir; yine de
     * güvende kalmak için yalnızca bir kez.
     */
    /*
     * HTTPS ZORLAMA GERİ DÜŞMESİ. Adresi https'e biz yükselttiysek ve sunucu
     * HTTPS konuşmuyorsa (bağlantı reddi/sıfırlama/zaman aşımı/SSL protokol)
     * o hostu bu oturum için istisnaya alıp http ile açıyoruz; aksi hâlde
     * yalnız http sunan siteler tamamen erişilemez olurdu. SERTİFİKA hataları
     * buraya girmez: orada Chromium'un uyarısı görünmeli (bkz. https-zorla.js).
     */
    if (httpsZorla.geriDusulurMu(kod) && /^https:\/\//i.test(adres || '')) {
      try {
        const u = new URL(adres);
        if (!httpsZorla.istisnaVarMi(u.hostname)) {
          httpsZorla.istisnaEkle(u.hostname);
          u.protocol = 'http:';
          console.log('HTTPS zorlama: ' + u.hostname + ' HTTPS konuşmuyor (' + kod + '), http ile açılıyor');
          setTimeout(() => { if (!wc.isDestroyed()) wc.loadURL(u.toString()); }, 0);
          return;
        }
      } catch { /* adres ayrıştırılamadı: normal hata akışına düş */ }
    }

    if (kod === -101 && t.sonReset !== adres) {
      t.sonReset = adres;
      setTimeout(() => { if (!wc.isDestroyed()) wc.reload(); }, 250);
      return;
    }

    t.hataAdresi = adres || t.url || '';
    wc.loadURL(hataAdresi(kod, aciklama, adres));
  });

  wc.on('render-process-gone', (_e, ayrinti) => {
    if (wc.isDestroyed()) return;
    t.hataAdresi = t.url || '';
    wc.loadURL(hataAdresi('COKME', 'Sayfa beklenmedik şekilde kapandı (' + ayrinti.reason + ').', t.url));
  });

  wc.setWindowOpenHandler(({ url, disposition }) => {
    sekmeOlustur({ url, arkaPlan: disposition === 'background-tab', kaynak: 'sayfa' });
    return { action: 'deny' };
  });

  wc.on('will-navigate', (e, url) => {
    if (sayfadanGezilebilir(url) || /^about:/i.test(url)) return;
    e.preventDefault();
    disHarici(url);
  });

  // Chrome'da F12 geliştirici araçlarını açar. Menüde Ctrl+Shift+I bağlıydı
  // ama F12 hiçbir şey yapmıyordu; bu tuş sayfaya değil kabuğa ait olmalı.
  wc.on('before-input-event', (e, girdi) => {
    if (girdi.type !== 'keyDown' || girdi.key !== 'F12') return;
    if (girdi.control || girdi.alt || girdi.meta || girdi.shift) return;
    e.preventDefault();
    wc.toggleDevTools();
  });

  wc.on('found-in-page', (_e, sonuc) => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('bulma-sonucu', {
      etkin: sonuc.activeMatchOrdinal, toplam: sonuc.matches
    });
  });

  /*
   * Sayfa HTML tam ekrana geçtiğinde görünümü pencerenin tamamına BÜYÜTMÜYORUZ.
   * 2026'da Chrome'da art arda kapatılan tam ekran sahteciliği açıkları
   * (CVE-2026-5882, -13988, -11666, -84356) tam olarak bunu kullanıyordu:
   * sayfa tam ekrana geçip üstüne sahte bir adres çubuğu çiziyordu. Gerçek
   * adres çubuğu her zaman ekranda kaldığı sürece bu numara tutmaz.
   */
  wc.on('enter-html-full-screen', () => {
    t.tamEkran = true;
    // Pencereyi de OS tam ekrana al: video gerçekten tüm ekranı kaplasın
    // (görev çubuğu dahil). setFullScreen enter-full-screen'i tetikleyip
    // yerlesimGuncelle çağırıyor; yine de doğrudan dayatıyoruz.
    if (win && !win.isFullScreen()) win.setFullScreen(true);
    yerlesimGuncelle();
    durumGonder();
  });
  wc.on('leave-html-full-screen', () => {
    t.tamEkran = false;
    if (win && win.isFullScreen()) win.setFullScreen(false);
    yerlesimGuncelle();
    durumGonder();
  });

  wc.on('context-menu', (_e, params) => baglamMenusu(t, params));

  // chrome.webNavigation: gezinme olayları, webNavigation izni + host izni olan eklentilere.
  const gezinmeYayinla = (ad, adres, ekstra) => {
    if (!eklentiler || wc.isDestroyed() || !/^https?:/i.test(adres || '')) return;
    for (const k of eklentiler.etkinKimlikler()) {
      const m = eklentiler.etkinManifest(k);
      if (!m || !eklentiIzinVar(m, 'webNavigation') || !eklentiHostIzni(m, adres)) continue;
      eklentiOlayYayinla(k, 'webNavigation', ad, {
        tabId: wc.id, url: adres, frameId: 0, parentFrameId: -1, processId: -1,
        timeStamp: Date.now(), ...(ekstra || {})
      });
    }
  };
  const cerceveBilgisi = (islemKimligi, yonlendirmeKimligi) => {
    try {
      const f = webFrameMain.fromId(islemKimligi, yonlendirmeKimligi);
      if (!f) return null;
      const ust = f.parent;
      return {
        frameId: eklentiCerceveKimligi(f, wc),
        parentFrameId: ust ? eklentiCerceveKimligi(ust, wc) : -1,
        processId: f.processId, url: f.url
      };
    } catch { return null; }
  };
  wc.on('did-start-navigation', (e) => {
    if (e.isSameDocument) return;
    let c = { frameId: 0, parentFrameId: -1 };
    if (!e.isMainFrame) {
      try { c = e.frame ? { frameId: eklentiCerceveKimligi(e.frame, wc), parentFrameId: e.frame.parent ? eklentiCerceveKimligi(e.frame.parent, wc) : 0 } : { frameId: -1, parentFrameId: 0 }; }
      catch { c = { frameId: -1, parentFrameId: 0 }; }
    }
    gezinmeYayinla('onBeforeNavigate', e.url, { frameId: c.frameId, parentFrameId: c.parentFrameId });
  });
  wc.on('did-frame-navigate', (_e, adres, _kod, _durum, anaCerceve, islem, yonlendirme) => {
    const c = anaCerceve ? { frameId: 0, parentFrameId: -1, processId: islem } : (cerceveBilgisi(islem, yonlendirme) || { frameId: -1, parentFrameId: 0 });
    const ek = { frameId: c.frameId, parentFrameId: c.parentFrameId, processId: c.processId };
    gezinmeYayinla('onCommitted', adres, { ...ek, transitionType: 'link', transitionQualifiers: [] });
    gezinmeYayinla('onDOMContentLoaded', adres, ek);
  });
  wc.on('did-frame-finish-load', (_e, anaCerceve, islem, yonlendirme) => {
    const c = anaCerceve ? { frameId: 0, parentFrameId: -1, processId: islem, url: wc.getURL() } : cerceveBilgisi(islem, yonlendirme);
    if (c && c.frameId >= 0) gezinmeYayinla('onCompleted', c.url || wc.getURL(), { frameId: c.frameId, parentFrameId: c.parentFrameId, processId: c.processId });
  });
  wc.on('did-navigate-in-page', (_e, adres, anaCerceve) => {
    if (anaCerceve) gezinmeYayinla('onHistoryStateUpdated', adres, { transitionType: 'link', transitionQualifiers: [] });
  });
  wc.on('destroyed', () => { blocker.unut(wcId); kozmetikAnahtari.delete(wcId); });
}

// Harici uygulamaya devredilebilecek şemalar. Windows'ta search-ms:, ms-msdt:
// gibi şemalar tek tıkla kod çalıştırma zincirine kapı açtığı için liste dar.
let disOnayAcik = false;

async function disHarici(url) {
  // Aynı anda tek onay kutusu: sayfa döngüyle çağırıp pencereyi kilitleyemesin.
  if (disOnayAcik || !win || win.isDestroyed()) return;

  let u;
  try { u = new URL(url); } catch { return; }
  if (!disSemaIzinli(url)) return;

  disOnayAcik = true;
  try {
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: [cev('dialog.iptal'), cev('dialog.ac')],
      defaultId: 0,
      cancelId: 0,
      title: cev('dialog.disBaslik'),
      message: cev('dialog.disMesaj', { sema: u.protocol.slice(0, -1) }),
      detail: String(url).slice(0, 400)
    });
    if (response === 1) shell.openExternal(url);
  } finally {
    disOnayAcik = false;
  }
}

/* ---------------------------------------------------------------- */
/* Bağlam menüsü                                                     */
/* ---------------------------------------------------------------- */

// Arayüz dilinin kendi adı ("Türkçe", "English", ...): "Seçimi Türkçe diline çevir".
function hedefDilAdi() {
  const kod = ceviriler.dil || 'en';
  try {
    const ad = new Intl.DisplayNames([kod], { type: 'language' }).of(kod);
    return ad ? ad.charAt(0).toLocaleUpperCase(kod) + ad.slice(1) : kod;
  } catch { return kod; }
}

// Seçili metin yalnızca kullanıcı bu menü öğesine tıklayınca Google Çeviri'ye gider.
function secimCeviriAdresi(metin) {
  const u = new URL('https://translate.google.com/');
  u.searchParams.set('sl', 'auto');
  u.searchParams.set('tl', ceviriler.dil || 'en');
  u.searchParams.set('text', String(metin).slice(0, 5000));
  u.searchParams.set('op', 'translate');
  return u.href;
}

function baglamMenusu(t, p) {
  const wc = t.view.webContents;
  const ogeler = [];
  const secim = (p.selectionText || '').trim();
  const hedefUrl = p.linkURL || secilenUrlCoz(secim);

  if (hedefUrl) {
    const gezilebilir = sayfadanGezilebilir(hedefUrl);
    ogeler.push(
      {
        label: cev('baglam.baglantiAc'),
        enabled: gezilebilir,
        click: () => wc.loadURL(hedefUrl)
      },
      {
        label: cev('baglam.baglantiYeniSekme'),
        enabled: gezilebilir,
        click: () => sekmeOlustur({ url: hedefUrl, arkaPlan: false, kaynak: 'sayfa' })
      },
      {
        label: cev('baglam.baglantiYeniPencere'),
        enabled: gezilebilir,
        click: () => yeniPencereAc(hedefUrl)
      },
      {
        label: cev('baglam.baglantiGizliKapsayici'),
        enabled: gezilebilir,
        click: () => sekmeOlustur({ url: hedefUrl, gizli: true, arkaPlan: false })
      },
      {
        label: cev('baglam.baglantiYeniGizliPencere'),
        enabled: gezilebilir,
        click: () => yeniGizliPencereAc(hedefUrl)
      },
      { type: 'separator' },
      {
        label: cev('baglam.baglantiKopyala'),
        click: () => clipboard.writeText(hedefUrl)
      },
      {
        label: cev('baglam.baglantiYerImi'),
        click: () => {
          const baslik = (p.linkText || secim || hedefUrl).trim() || hedefUrl;
          store.yerImiEkle(hedefUrl, baslik);
          durumGonder();
        }
      },
      {
        label: cev('baglam.baglantiFarkliKaydet'),
        enabled: gezilebilir,
        click: () => wc.downloadURL(hedefUrl)
      },
      { type: 'separator' }
    );
  }

  if (p.mediaType === 'image' && p.srcURL) {
    ogeler.push(
      {
        label: cev('baglam.gorselYeniSekme'),
        enabled: sayfadanGezilebilir(p.srcURL),
        click: () => sekmeOlustur({ url: p.srcURL, arkaPlan: true, kaynak: 'sayfa' })
      },
      { label: cev('baglam.gorselKopyala'), click: () => clipboard.writeText(p.srcURL) },
      { label: cev('baglam.gorselKaydet'), click: () => wc.downloadURL(p.srcURL) },
      { type: 'separator' }
    );
  }

  if (p.isEditable) {
    ogeler.push(
      { role: 'undo', label: cev('menu.geriAl') },
      { role: 'redo', label: cev('menu.yinele') },
      { type: 'separator' },
      { role: 'cut', label: cev('menu.kes') },
      { role: 'copy', label: cev('menu.kopyala') },
      { role: 'paste', label: cev('menu.yapistir') },
      { role: 'selectAll', label: cev('menu.tumunuSec') },
      { type: 'separator' }
    );
  } else if (secim) {
    const kisaSecim = secim.slice(0, 40);
    ogeler.push(
      { role: 'copy', label: cev('menu.kopyala') },
      { role: 'selectAll', label: cev('menu.tumunuSec') },
      {
        label: cev('baglam.ara', { q: kisaSecim }),
        click: () => sekmeOlustur({ url: resolveInput(secim, store.ayarlar.aramaMotoru) })
      },
      {
        label: cev('baglam.gizliAra'),
        click: () => yeniGizliPencereAc(resolveInput(secim, motorAnahtari(true)))
      },
      { type: 'separator' },
      {
        label: cev('baglam.seciminCevir', { dil: hedefDilAdi() }),
        click: () => sekmeOlustur({ url: secimCeviriAdresi(secim) })
      },
      { type: 'separator' }
    );
  }

  ogeler.push(
    { label: cev('menu.geri'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: cev('menu.ileri'), enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: cev('menu.yenile'), click: () => wc.reload() },
    { type: 'separator' },
    ...(!p.isEditable && !secim ? [{ role: 'selectAll', label: cev('menu.tumunuSec') }, { type: 'separator' }] : []),
    {
      label: cev('baglam.kaynak'),
      enabled: /^https?:/i.test(t.url || ''),
      click: () => sekmeOlustur({ url: 'view-source:' + t.url, kaynak: 'sayfa' })
    },
    { label: cev('baglam.incele'), click: () => wc.inspectElement(p.x, p.y) }
  );

  // Eklentilerin chrome.contextMenus öğeleri: "Yeniden Yükle ... Sayfa kaynağı" arasına, Chrome gibi.
  const eklentiOgeleri = eklentiBaglamOgeleri(t, p);
  if (eklentiOgeleri.length) {
    const kaynakI = ogeler.findIndex((o) => o.label === cev('baglam.kaynak'));
    ogeler.splice(kaynakI >= 0 ? kaynakI : ogeler.length, 0, ...eklentiOgeleri, { type: 'separator' });
  }

  Menu.buildFromTemplate(ogeler).popup({ window: win });
}

function eklentiBaglamOgeleri(t, p) {
  if (!eklentiler || !eklentiBaglam) return [];
  const wc = t.view.webContents;
  try {
    const etkin = eklentiler.liste().filter((e) => e.etkin);
    const simgeYap = (d) => {
      try { const i = nativeImage.createFromDataURL(d).resize({ width: 16, height: 16 }); return i.isEmpty() ? undefined : i; } catch { return undefined; }
    };
    return eklentiBaglam.sablon(etkin, p, t.url || '', (kimlik, bilgi) => {
      const sekme = { id: wc.id, url: t.url || '', title: t.baslik || '', active: true, windowId: 1, index: 0, incognito: false };
      eklentiOlayYayinla(kimlik, 'contextMenus', 'onClicked', { __args: [bilgi, sekme] });
    }, simgeYap);
  } catch (e) {
    console.error('Eklenti menüsü kurulamadı:', e.message);
    return [];
  }
}

function yakinlastir(yon, sifirla = false) {
  const t = aktifSekme();
  if (!t || t.view.webContents.isDestroyed()) return;
  t.zoom = sifirla ? 0 : Math.max(-4, Math.min(6, t.zoom + yon * 0.5));
  t.view.webContents.setZoomLevel(t.zoom);
  durumGonder();
}

function sekmeAtla(yon) {
  const k = [...sekmeler.keys()];
  if (k.length < 2) return;
  const i = k.indexOf(aktifId);
  sekmeSec(k[(i + yon + k.length) % k.length]);
}

/* ---------------------------------------------------------------- */
/* Uygulama menüsü — kısayollar sayfa odaktayken de çalışsın diye     */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* Araç çubuğundaki ana menü                                         */
/* ---------------------------------------------------------------- */

// Electron yakınlaştırmayı seviye olarak tutuyor; kullanıcı yüzde bekliyor.
function yakinlastirmaYuzdesi(seviye) {
  return Math.round(Math.pow(1.2, seviye || 0) * 100);
}

async function sayfayiKaydet() {
  const s = aktifSekme();
  if (!s || s.view.webContents.isDestroyed() || icSayfaMi(s.url)) return;
  const ad = (s.baslik || 'sayfa').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) + '.html';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('downloads'), ad)
  });
  if (canceled || !filePath) return;
  try {
    await s.view.webContents.savePage(filePath, 'HTMLComplete');
  } catch (e) {
    console.error('Sayfa kaydedilemedi:', e.message);
  }
}

async function anaMenuGoster(konum) {
  if (!win || win.isDestroyed()) return;
  const s = aktifSekme();
  const wc = s && !s.view.webContents.isDestroyed() ? s.view.webContents : null;
  const gercekSayfa = !!(s && !icSayfaMi(s.url));

  // Alt menülerde son gezilen sayfalar ve yer imleri doğrudan açılabilsin.
  const sonGecmis = store.gecmisAra('', 8).map((k) => ({
    label: (k.baslik || k.url).slice(0, 60),
    click: () => sekmeOlustur({ url: k.url })
  }));
  const yerImleri = store.veri.yerImleri.slice(0, 12).map((y) => ({
    label: (y.baslik || y.url).slice(0, 60),
    click: () => sekmeOlustur({ url: y.url })
  }));

  const sablon = [
    { label: cev('menu.yeniSekme'), accelerator: 'CmdOrCtrl+T', click: () => sekmeOlustur({}) },
    { label: cev('menu.yeniGizliPencere'), accelerator: 'CmdOrCtrl+Shift+N', click: () => yeniGizliPencereAc() },
    { label: cev('menu.yeniPencere'), accelerator: 'CmdOrCtrl+N', click: () => yeniPencereAc() },
    { label: cev('menu.sekmeyiKapat'), accelerator: 'CmdOrCtrl+W', enabled: !!aktifId, click: sekmeyiKlavyeKapat },
    { type: 'separator' },
    { label: cev('menu.parolalar'), click: () => dahiliSayfaSekmesiAc('parolalar') },
    { label: cev('menu.eklentiler'), click: () => dahiliSayfaSekmesiAc('eklentiler') },
    { label: cev('menu.hizTesti'), click: () => dahiliSayfaSekmesiAc('hizTesti') },
    { type: 'separator' },
    {
      label: cev('menu.gecmis'),
      submenu: [
        { label: cev('menu.gecmisiGoster'), accelerator: 'CmdOrCtrl+H', click: () => dahiliSayfaSekmesiAc('gecmis') },
        ...(sonGecmis.length ? [{ type: 'separator' }, ...sonGecmis] : [])
      ]
    },
    { label: cev('menu.indirilenler'), accelerator: 'CmdOrCtrl+J', click: () => dahiliSayfaSekmesiAc('indirmeler') },
    {
      label: cev('menu.yerImleri'),
      submenu: [
        {
          label: cev('menu.yerImiEkle'),
          accelerator: 'CmdOrCtrl+D',
          enabled: gercekSayfa,
          click: () => { if (s) { store.yerImiDegistir(s.url, s.baslik); durumGonder(); } }
        },
        { label: cev('menu.yerImleriniGoster'), accelerator: 'CmdOrCtrl+Shift+O', click: () => dahiliSayfaSekmesiAc('yerImleri') },
        {
          label: cev('menu.yerImleriCubugu'),
          type: 'checkbox',
          checked: !!store.ayarlar.yerImleriCubugu,
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => { store.ayarla('yerImleriCubugu', !store.ayarlar.yerImleriCubugu); durumGonder(); }
        },
        ...(yerImleri.length ? [{ type: 'separator' }, ...yerImleri] : [])
      ]
    },
    { type: 'separator' },
    {
      label: cev('menu.yakinlastirma') + '  ' + yakinlastirmaYuzdesi(s && s.zoom) + '%',
      submenu: [
        { label: cev('menu.yakinlastir'), accelerator: 'CmdOrCtrl+Plus', enabled: !!wc, click: () => yakinlastir(1) },
        { label: cev('menu.uzaklastir'), accelerator: 'CmdOrCtrl+-', enabled: !!wc, click: () => yakinlastir(-1) },
        { label: cev('menu.normalBoyut'), accelerator: 'CmdOrCtrl+0', enabled: !!wc, click: () => yakinlastir(0, true) },
        { type: 'separator' },
        { label: cev('menu.tamEkran'), accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) }
      ]
    },
    {
      label: cev('ayar.tema'),
      submenu: [
        ['sistem', 'ayar.temaSistem'], ['acik', 'ayar.temaAcik'], ['koyu', 'ayar.temaKoyu']
      ].map(([deger, anahtar]) => ({
        label: cev(anahtar),
        type: 'radio',
        checked: (store.ayarlar.tema || 'sistem') === deger,
        click: () => { store.ayarla('tema', deger); temayiUygula(); durumGonder(); }
      }))
    },
    { type: 'separator' },
    { label: cev('menu.yazdir'), accelerator: 'CmdOrCtrl+P', enabled: gercekSayfa, click: () => wc && wc.print() },
    { label: cev('menu.sayfayiKaydet'), accelerator: 'CmdOrCtrl+S', enabled: gercekSayfa, click: () => sayfayiKaydet() },
    { label: cev('menu.sayfadaBul'), accelerator: 'CmdOrCtrl+F', enabled: !!wc, click: () => uiyeGonder('bulma-ac') },
    {
      label: cev('menu.digerAraclar'),
      submenu: [
        { label: cev('baglam.kaynak'), enabled: gercekSayfa, click: () => sekmeOlustur({ url: 'view-source:' + s.url, kaynak: 'sayfa' }) },
        { label: cev('menu.gelistirici'), accelerator: 'CmdOrCtrl+Shift+I', enabled: !!wc, click: () => wc.toggleDevTools() },
        { label: cev('menu.arayuzGelistirici'), accelerator: 'CmdOrCtrl+Shift+U', click: () => win.webContents.toggleDevTools() }
      ]
    },
    { type: 'separator' },
    { label: cev('menu.veriSil'), accelerator: 'CmdOrCtrl+Shift+Delete', click: () => dahiliSayfaSekmesiAc('ayarlar') },
    { label: cev('menu.ayarlar'), accelerator: 'CmdOrCtrl+,', click: () => dahiliSayfaSekmesiAc('ayarlar') },
    { label: cev('menu.hakkinda'), click: () => hakkindaGoster() },
    { type: 'separator' },
    { label: cev('menu.cikis'), accelerator: 'CmdOrCtrl+Q', role: 'quit' }
  ];

  const menu = Menu.buildFromTemplate(sablon);
  const genislik = await menuGenisligi(sablon);
  menu.popup({ window: win, ...menuKonumu(genislik, konum) });
}

/*
 * Menü genişliği tahmin edilmiyor, ölçülüyor: etiketleri arayüz penceresinde
 * canvas ile ölçtürüyoruz. Etiketler kendi çeviri tablomuzdan geliyor, yani
 * enjekte edilen metin bize ait. Ölçüm başarısız olursa kaba tahmine düşüyoruz.
 */
async function menuGenisligi(sablon) {
  const etiketler = sablon.filter((o) => o.label).map((o) => String(o.label));
  if (!etiketler.length || !win || win.isDestroyed()) return genislikTahmini(sablon);
  try {
    const kod = `(() => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '12px "Segoe UI", system-ui, sans-serif';
      return ${JSON.stringify(etiketler)}.reduce((m, s) => Math.max(m, c.measureText(s).width), 0);
    })()`;
    return olcumdenGenislik(await win.webContents.executeJavaScript(kod, false))
      || genislikTahmini(sablon);
  } catch {
    return genislikTahmini(sablon);
  }
}

function menuKonumu(genislik, konum) {
  if (!konum || !Number.isFinite(konum.y)) return {};
  const pencere = win.getContentBounds().width;
  // Sağdaki düğmeler sağ kenara, soldakiler sol kenara hizalanır.
  if (Number.isFinite(konum.sol)) {
    return { x: xKonumuSol(konum.sol, pencere, genislik), y: Math.round(konum.y) };
  }
  if (Number.isFinite(konum.sag)) {
    return { x: xKonumu(konum.sag, pencere, genislik), y: Math.round(konum.y) };
  }
  return {};
}

/* ---------------------------------------------------------------- */
/* Adres çubuğundaki site bilgisi menüsü                             */
/* ---------------------------------------------------------------- */

/*
 * Kapanışta çerezleri sil (ayar kapalıysa hiç çağrılmaz).
 *
 * Silme takılırsa uygulama kapanamaz hale gelirdi; bu yüzden bir zaman sınırı
 * var. Sınır aşılırsa kalan çerezler bir sonraki kapanışta silinir - çıkışı
 * süresiz bekletmekten iyidir.
 */
const CEREZ_TEMIZLIK_SINIRI = 4000;
let cikistaTemizlendi = false;
// Ana parola anahtarı: YALNIZ bellekte, diske hiç yazılmaz.
let anaParolaAnahtari = null;

async function kapanistaCerezleriSil() {
  const is = (async () => {
    const korunan = store.korunanCerezKokleri(kokAlanAdi);
    const hepsi = await ses.cookies.get({});
    const silinecek = silinecekCerezler(hepsi, korunan, kokAlanAdi);
    await Promise.all(silinecek.map((c) => {
      const adres = cerezSilmeUrl(c);
      return adres ? ses.cookies.remove(adres, c.name).catch(() => {}) : null;
    }));
  })();
  let bitti = false;
  is.then(() => { bitti = true; }).catch(() => {});
  const sinir = new Promise((coz) => setTimeout(coz, CEREZ_TEMIZLIK_SINIRI));
  await Promise.race([is.catch((e) => console.error('Çerezler silinemedi:', e.message)), sinir]);
  // Sessizce yarim kalmasin: bir dahaki kapanista tamamlanacagini bilelim.
  if (!bitti) console.error('Çerez temizliği ' + CEREZ_TEMIZLIK_SINIRI + ' ms icinde bitmedi; kalanlar bir sonraki kapanista silinecek.');
}

/*
 * Kapanışta kalıcı çerezleri şifreli kasaya alıp düz metin depoyu boşaltır.
 * Çıkışı süresiz bekletmemek için sınırlı; sınır aşılırsa kasa yazılmış ama
 * depo boşaltılmamış olabilir - bu VERİ KAYBI DEĞİL, yalnızca o kapanışta
 * koruma uygulanmamış olur (bir dahaki kapanışta yine denenir).
 */
async function cerezleriKasayaAl() {
  /*
   * Ana parola AÇIK ama anahtar elimizde yoksa (kullanıcı açılışta atladı):
   * kasaya DOKUNMUYORUZ. Üstüne yazmak, kasadaki gerçek oturumları geri
   * getirilemez biçimde yok etmek olurdu. Bu oturumun çerezleri korumasız
   * kalır - kullanıcı atlamayı seçti, durumu loglayıp geçiyoruz.
   */
  if (store.ayarlar.anaParolaAcik && !anaParolaAnahtari) {
    console.log('Çerez kasası: ana parola girilmedi; kasa korundu, bu oturum şifrelenmedi.');
    return;
  }
  const is = (async () => {
    const s = await cerezKasa.disariAktar({
      oturum: ses, safeStorage, veriDizini: app.getPath('userData'),
      anahtar: store.ayarlar.anaParolaAcik && anaParolaAnahtari ? anaParolaAnahtari.anahtar : null,
      tuz: store.ayarlar.anaParolaAcik && anaParolaAnahtari ? anaParolaAnahtari.tuz : null
    });
    console.log('Çerez kasası: ' + s.yazilan + ' çerez şifrelendi'
      + (store.ayarlar.anaParolaAcik ? ' (DPAPI + ana parola)' : ' (DPAPI)')
      + (s.silindi ? ', düz metin depo boşaltıldı' : ' (depo BOŞALTILMADI: ' + (s.sebep || '?') + ')'));
  })().catch((e) => console.error('Çerez kasası yazılamadı:', e.message));
  await Promise.race([is, new Promise((coz) => setTimeout(coz, CEREZ_TEMIZLIK_SINIRI))]);
}

/*
 * ANA PAROLA PENCERESİ. Kasanın ikinci katmanı kullanıcıdan gelen bir sır;
 * anahtar hiçbir yere YAZILMIYOR, yalnız bu oturum boyunca bellekte duruyor.
 * Ana pencereden ÖNCE açılıyor: çerezler geri yüklenmeden sayfa yüklenmesin.
 *
 * @param {'sor'|'kur'} kip  'sor': kasayı aç · 'kur': yeni parola belirle
 * @param {Function} dene    (anahtar) => boolean; parola doğru mu?
 * @returns {Promise<Buffer|null>} null = kullanıcı atladı/vazgeçti
 */
function anaParolaSor({ kip = 'sor', kdf = null, dene = () => true } = {}) {
  return new Promise((coz) => {
    const pen = new BrowserWindow({
      width: 460, height: kip === 'kur' ? 430 : 360,
      resizable: false, minimizable: false, maximizable: false,
      title: cev('anaparola.baslik'),
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#16181d' : '#eef0f4',
      show: false, autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'ui', 'anaparola-onyukleme.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false
      }
    });

    let bitti = false;
    const bizden = (e) => !pen.isDestroyed() && e.sender === pen.webContents;
    const kapat = (sonuc) => {
      if (bitti) return;
      bitti = true;
      ipcMain.removeListener('anaparola:hazir', hazirIsleyici);
      ipcMain.removeListener('anaparola:gonder', gonderIsleyici);
      ipcMain.removeListener('anaparola:atla', atlaIsleyici);
      if (!pen.isDestroyed()) pen.destroy();
      coz(sonuc);
    };

    const icerikYolla = (hata = '') => {
      if (pen.isDestroyed()) return;
      pen.webContents.send('anaparola:icerik', {
        kip, hata, dil: ceviriler.dil, yon: ceviriler.yon,
        metin: {
          baslik: cev('anaparola.baslik'),
          aciklama: cev(kip === 'kur' ? 'anaparola.aciklamaKur' : 'anaparola.aciklama'),
          etiket: cev('anaparola.etiket'),
          tekrarEtiket: cev('anaparola.tekrar'),
          atla: cev(kip === 'kur' ? 'anaparola.vazgec' : 'anaparola.atla'),
          tamam: cev(kip === 'kur' ? 'anaparola.kaydet' : 'anaparola.ac'),
          not: cev('anaparola.not')
        }
      });
    };

    const hazirIsleyici = (e) => { if (bizden(e)) { icerikYolla(); pen.show(); } };
    const atlaIsleyici = (e) => { if (bizden(e)) kapat(null); };
    const gonderIsleyici = (e, parola) => {
      if (!bizden(e)) return;
      try {
        const tuz = kip === 'kur'
          ? require('node:crypto').randomBytes(16).toString('base64')
          : (kdf && kdf.tuz);
        const anahtar = kdf
          ? cerezKasa.anahtarUret(String(parola || ''), tuz, kdf)
          : cerezKasa.anahtarUret(String(parola || ''), tuz);
        // Tuz anahtarla BİRLİKTE taşınır: kasayı yazarken aynısı kullanılmalı.
        if (kip === 'kur' || dene(anahtar)) return kapat({ anahtar, tuz });
        icerikYolla(cev('anaparola.yanlis'));   // yanlış parola: tekrar sorulur
      } catch (hata) {
        icerikYolla(cev('anaparola.yanlis'));
      }
    };

    ipcMain.on('anaparola:hazir', hazirIsleyici);
    ipcMain.on('anaparola:gonder', gonderIsleyici);
    ipcMain.on('anaparola:atla', atlaIsleyici);
    pen.on('closed', () => kapat(null));
    pen.loadFile(path.join(__dirname, 'ui', 'anaparola.html'));
  });
}

/*
 * Kozmetik filtreler: gizlenecek kutuların CSS'i.
 *
 * NEDEN did-navigate'te: gezinme işlendiği anda, belge daha ayrıştırılmadan
 * enjekte ediliyor. dom-ready'yi beklemek reklam alanının bir kare görünüp
 * kaybolmasına yol açardı - engellenmiş ama gözle görülen bir reklam.
 *
 * Engelleyici o site için kapatılmışsa CSS de uygulanmaz: "bu sitede kapat"
 * demek, kullanıcının gördüğü her şeyi kapsamalı.
 */
function kozmetikCssAl(url) {
  // GEÇİCİ: kozmetik CSS enjeksiyonu devre dışı (adblock yapısı kaldırıldı;
  // yerine açık kaynak engelleyici gelecek). Ağ engellemesi çalışmaya devam eder.
  if (!ADBLOCK_SAYFA_ENJEKSIYON) return '';
  if (!listeler || !store.ayarlar.engelleyiciAcik) return '';
  const host = hostAl(url);
  if (!host) return '';
  if (store.siteIzinliMi(kokAlanAdi(host))) return '';
  return listeler.kozmetikCss(host);
}

async function kozmetigiUygula(wc, url) {
  if (!wc || wc.isDestroyed()) return;
  const css = kozmetikCssAl(url);

  // Onceki gezinmenin stili varsa once kaldirilir; listeler guncellenince
  // ayni sayfaya ikinci kez enjekte edildiginde kopya birikirdi.
  const eskiAnahtar = kozmetikAnahtari.get(wc.id);
  if (eskiAnahtar) {
    kozmetikAnahtari.delete(wc.id);
    await wc.removeInsertedCSS(eskiAnahtar).catch(() => { /* belge degismis olabilir */ });
  }
  if (!css || wc.isDestroyed()) return;

  try {
    // cssOrigin 'user': sayfanin kendi !important kurallari bunu ezemesin.
    const anahtar = await wc.insertCSS(css, { cssOrigin: 'user' });
    kozmetikAnahtari.set(wc.id, anahtar);
  } catch { /* gezinme degismis olabilir */ }

  altCerceveleriGiydir(wc, css);
}

/*
 * ALT CERCEVELER.
 *
 * insertCSS yalnizca ANA cerceveye ulasiyor. Yayincilar reklamlarini ve
 * "reklam engelleyicinizi kapatin" seritlerini cogunlukla iframe'e koyuyor;
 * kozmetik CSS o cercevelere de gitmeli. Stil, cercevenin kendi dunyasina bir
 * <style> olarak ekleniyor (cerceve basina insertCSS yok).
 *
 * KRITIK PERFORMANS: did-frame-navigate HER alt cerceve gezindiginde tetikleniyor;
 * eskiden her seferinde TUM cercevelere yeniden enjekte ediyorduk, yani N cerceveli
 * sayfada N*N enjeksiyon (chromewebstore gibi onlarca Google iframe'i olan sayfada
 * onlarca MB CSS + yuzlerce <style> -> renderer cokmesi, olculdu). Artik
 * did-frame-navigate YALNIZ yeni gezilen cerceveyi giydiriyor; did-navigate ise
 * mevcut cerceveleri BIR KEZ, sinirli sayida giydiriyor.
 */
const EN_COK_ALT_CERCEVE = 12;

function cerceveGiydir(cerceve, css) {
  if (!css || !cerceve) return;
  try { if (cerceve.url && !/^https?:/i.test(cerceve.url)) return; } catch { return; }
  const kod = '(() => { try { const s = document.createElement("style");'
    + ' s.textContent = ' + JSON.stringify(css) + ';'
    + ' (document.head || document.documentElement).appendChild(s); } catch (e) {} })()';
  try {
    cerceve.executeJavaScript(kod, true).catch(() => { /* cerceve gitmis olabilir */ });
  } catch { /* cerceve gitmis olabilir */ }
}

function altCerceveleriGiydir(wc, css) {
  if (!css || wc.isDestroyed()) return;
  let cerceveler;
  try { cerceveler = wc.mainFrame.framesInSubtree; } catch { return; }

  let n = 0;
  for (const cerceve of cerceveler) {
    if (cerceve === wc.mainFrame) continue;
    cerceveGiydir(cerceve, css);
    if (++n >= EN_COK_ALT_CERCEVE) break;   // asiri iframe'li sayfada patlamayi onle
  }
}

/*
 * Listeler acilista ya da 6 saatlik denetimde GEZINMEDEN SONRA gelebiliyor.
 * Ag engellemesi kendini toparliyor (her istekte yeniden degerlendiriliyor),
 * kozmetik CSS toparlamiyor: bir kez enjekte ediliyor. Ilk calistirmada onbellek
 * bos oldugu icin acilistan onceki 15 saniyede acilan her sayfa omru boyunca
 * filtresiz kalirdi.
 */
function kozmetigiTazele() {
  for (const t of sekmeler.values()) {
    const wc = t.view.webContents;
    if (!wc.isDestroyed() && t.url) kozmetigiUygula(wc, t.url);
  }
}

async function siteVerisiSil(origin, host) {
  try {
    await ses.clearStorageData({ origin });
    // clearStorageData çerezleri origin'e göre silmiyor; tek tek kaldırıyoruz.
    const cerezler = await ses.cookies.get({ domain: host });
    for (const c of cerezler) {
      const adres = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
      await ses.cookies.remove(adres, c.name).catch(() => {});
    }
  } catch (e) {
    console.error('Site verisi silinemedi:', e.message);
  }
  const s = aktifSekme();
  if (s && !s.view.webContents.isDestroyed()) s.view.webContents.reload();
  durumGonder();
}

async function siteMenusuGoster(konum) {
  const s = aktifSekme();
  if (!s || !s.url || icSayfaMi(s.url)) return;

  let u;
  try { u = new URL(s.url); } catch { return; }
  const host = u.hostname;
  const kok = kokAlanAdi(hostAl(s.url));
  const guvenli = u.protocol === 'https:';

  let cerezSayisi = 0;
  try { cerezSayisi = (await ses.cookies.get({ domain: host })).length; } catch { /* yoksay */ }

  const sertifika = sertifikalar.ozetAl(host, ceviriler.yerel);
  const baglantiAlt = !guvenli
    ? [{ label: cev('site.guvensizUyari'), enabled: false }]
    : (sertifika
      ? [
        { label: cev('site.sertifikaVeren', { ad: sertifika.veren || '—' }), enabled: false },
        { label: cev('site.sertifikaSahip', { ad: sertifika.sahip || host }), enabled: false },
        { label: cev('site.sertifikaGecerlilik', { bas: sertifika.baslangic, bit: sertifika.bitis }), enabled: false },
        { type: 'separator' },
        {
          label: cev('site.parmakIzi'),
          enabled: !!sertifika.parmakIzi,
          click: () => clipboard.writeText(sertifika.parmakIzi)
        }
      ]
      : [{ label: cev('site.sertifikaYok'), enabled: false }]);

  const engelleyiciAcik = !!store.ayarlar.engelleyiciAcik && !store.siteIzinliMi(kok);

  const sablon = [
    { label: host, enabled: false },
    { type: 'separator' },
    { label: cev(guvenli ? 'site.baglantiGuvenli' : 'site.baglantiGuvensiz'), submenu: baglantiAlt },
    {
      label: cev('site.cerezler'),
      submenu: [
        { label: cev('site.cerezSayisi', { n: cerezSayisi }), enabled: false },
        { type: 'separator' },
        {
          // Bu sitede üçüncü taraf çerezlere izin ver. Anahtar sekmedeki
          // sayfanın kökü, isteğin değil: "bu site çalışsın" kararı.
          label: cev('site.ucuncuTarafCerez'),
          type: 'checkbox',
          checked: !!kok && store.cerezIstisnasiMi(kok),
          enabled: !!kok && store.ayarlar.ucuncuTarafCerez !== false,
          click: () => {
            if (!kok) return;
            store.cerezIstisnasiDegistir(kok);
            const a = aktifSekme();
            if (a && !a.view.webContents.isDestroyed()) a.view.webContents.reload();
            durumGonder();
          }
        },
        { type: 'separator' },
        { label: cev('site.veriSil'), click: () => siteVerisiSil(u.origin, host) }
      ]
    },
    {
      label: cev('site.engelleyici'),
      type: 'checkbox',
      checked: engelleyiciAcik,
      enabled: !!kok && !!store.ayarlar.engelleyiciAcik,
      click: () => {
        if (!kok) return;
        store.siteIzniDegistir(kok);
        const a = aktifSekme();
        if (a && !a.view.webContents.isDestroyed()) a.view.webContents.reload();
        durumGonder();
      }
    },
    { type: 'separator' },
    {
      label: cev('site.izinSifirla'),
      click: () => { store.izinSil(u.origin); durumGonder(); }
    },
    {
      label: cev('site.ayarlar'),
      // Genel ayarlar değil, BU sitenin izinleri açılıyor.
      click: () => uiyeGonder('site-izinleri', u.origin)
    }
  ];

  const menu = Menu.buildFromTemplate(sablon);
  const genislik = await menuGenisligi(sablon);
  menu.popup({ window: win, ...menuKonumu(genislik, konum) });
}

function hakkindaGoster() {
  dahiliSayfaSekmesiAc('hakkinda');
}

function menuKur() {
  const aktifWc = () => {
    const t = aktifSekme();
    return t && !t.view.webContents.isDestroyed() ? t.view.webContents : null;
  };
  const uiye = uiyeGonder;
  const wcIle = (fn) => () => { const c = aktifWc(); if (c) fn(c); };

  const sablon = [
    {
      label: cev('menu.dosya'),
      submenu: [
        { label: cev('menu.yeniSekme'), accelerator: 'CmdOrCtrl+T', click: () => sekmeOlustur({}) },
        { label: cev('menu.yeniGizliPencere'), accelerator: 'CmdOrCtrl+Shift+N', click: () => yeniGizliPencereAc() },
        { label: cev('menu.yeniPencere'), accelerator: 'CmdOrCtrl+N', click: () => yeniPencereAc() },
        { label: cev('menu.sekmeyiKapat'), accelerator: 'CmdOrCtrl+W', click: sekmeyiKlavyeKapat },
        { type: 'separator' },
        { label: cev('menu.parolalar'), click: () => dahiliSayfaSekmesiAc('parolalar') },
        { label: cev('menu.hizTesti'), click: () => dahiliSayfaSekmesiAc('hizTesti') },
        { type: 'separator' },
        { label: cev('menu.adresCubugu'), accelerator: 'CmdOrCtrl+L', click: () => uiye('adres-odak') },
        { label: cev('menu.sayfadaBul'), accelerator: 'CmdOrCtrl+F', click: () => uiye('bulma-ac') },
        { type: 'separator' },
        {
          label: cev('menu.yazdir'), accelerator: 'CmdOrCtrl+P',
          click: wcIle((c) => c.print())
        },
        { label: cev('menu.sayfayiKaydet'), accelerator: 'CmdOrCtrl+S', click: () => sayfayiKaydet() },
        {
          label: cev('menu.veriSil'), accelerator: 'CmdOrCtrl+Shift+Delete',
          click: () => dahiliSayfaSekmesiAc('ayarlar')
        },
        { type: 'separator' },
        { label: cev('menu.cikis'), accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: cev('menu.duzen'),
      submenu: [
        { role: 'undo', label: cev('menu.geriAl') },
        { role: 'redo', label: cev('menu.yinele') },
        { type: 'separator' },
        { role: 'cut', label: cev('menu.kes') },
        { role: 'copy', label: cev('menu.kopyala') },
        { role: 'paste', label: cev('menu.yapistir') },
        { role: 'selectAll', label: cev('menu.tumunuSec') }
      ]
    },
    {
      label: cev('menu.gorunum'),
      submenu: [
        { label: cev('menu.yenile'), accelerator: 'CmdOrCtrl+R', click: wcIle(c => c.reload()) },
        { label: cev('menu.onbelleksizYenile'), accelerator: 'CmdOrCtrl+Shift+R', click: wcIle(c => c.reloadIgnoringCache()) },
        { label: cev('menu.yenile'), accelerator: 'F5', visible: false, click: wcIle(c => c.reload()) },
        { label: cev('menu.onbelleksizYenile'), accelerator: 'CmdOrCtrl+F5', visible: false, click: wcIle(c => c.reloadIgnoringCache()) },
        { type: 'separator' },
        { label: cev('menu.yakinlastir'), accelerator: 'CmdOrCtrl+Plus', click: () => yakinlastir(1) },
        { label: cev('menu.yakinlastir'), accelerator: 'CmdOrCtrl+=', visible: false, click: () => yakinlastir(1) },
        { label: cev('menu.uzaklastir'), accelerator: 'CmdOrCtrl+-', click: () => yakinlastir(-1) },
        { label: cev('menu.normalBoyut'), accelerator: 'CmdOrCtrl+0', click: () => yakinlastir(0, true) },
        { type: 'separator' },
        { label: cev('menu.tamEkran'), accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
        { type: 'separator' },
        { label: cev('menu.gelistirici'), accelerator: 'CmdOrCtrl+Shift+I', click: wcIle(c => c.toggleDevTools()) },
        { label: cev('menu.arayuzGelistirici'), accelerator: 'CmdOrCtrl+Shift+U', click: () => win && win.webContents.toggleDevTools() }
      ]
    }
  ];

  sablon.push(
    {
      label: cev('menu.gecmis'),
      submenu: [
        { label: cev('menu.geri'), accelerator: 'Alt+Left', click: wcIle(c => c.navigationHistory.goBack()) },
        { label: cev('menu.ileri'), accelerator: 'Alt+Right', click: wcIle(c => c.navigationHistory.goForward()) },
        { type: 'separator' },
        { label: cev('menu.gecmisiGoster'), accelerator: 'CmdOrCtrl+H', click: () => dahiliSayfaSekmesiAc('gecmis') },
        { label: cev('menu.indirilenler'), accelerator: 'CmdOrCtrl+J', click: () => dahiliSayfaSekmesiAc('indirmeler') }
      ]
    },
    {
      label: cev('menu.yerImleri'),
      submenu: [
        { label: cev('menu.yerImiEkle'), accelerator: 'CmdOrCtrl+D', click: () => uiye('yer-imi-degistir') },
        { label: cev('menu.yerImleriniGoster'), accelerator: 'CmdOrCtrl+Shift+O', click: () => dahiliSayfaSekmesiAc('yerImleri') },
        { type: 'separator' },
        {
          label: cev('menu.yerImleriCubugu'), accelerator: 'CmdOrCtrl+Shift+B',
          click: () => { store.ayarla('yerImleriCubugu', !store.ayarlar.yerImleriCubugu); durumGonder(); }
        }
      ]
    },
    {
      label: cev('menu.sekmeler'),
      submenu: [
        { label: cev('menu.sonrakiSekme'), accelerator: 'Ctrl+Tab', click: () => sekmeAtla(1) },
        { label: cev('menu.oncekiSekme'), accelerator: 'Ctrl+Shift+Tab', click: () => sekmeAtla(-1) },
        { type: 'separator' },
        ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
          label: cev('menu.nSekme', { n }), accelerator: 'CmdOrCtrl+' + n, visible: false,
          click: () => { const k = [...sekmeler.keys()]; if (k[n - 1]) sekmeSec(k[n - 1]); }
        })),
        {
          label: cev('menu.sonSekme'), accelerator: 'CmdOrCtrl+9', visible: false,
          click: () => { const k = [...sekmeler.keys()]; if (k.length) sekmeSec(k[k.length - 1]); }
        }
      ]
    },
    {
      label: cev('menu.yardim'),
      submenu: [
        { label: cev('menu.ayarlar'), accelerator: 'CmdOrCtrl+,', click: () => dahiliSayfaSekmesiAc('ayarlar') },
        { label: cev('menu.guncellemeDenetle'), click: () => dahiliSayfaSekmesiAc('ayarlar') },
        { label: cev('menu.hakkinda'), click: () => hakkindaGoster() }
      ]
    }
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(sablon));
}

/* ---------------------------------------------------------------- */
/* Oturum: engelleyici, izinler, indirmeler                          */
/* ---------------------------------------------------------------- */

// Adları src/diller altındaki 'izin.*' anahtarlarından geliyor.
const IZIN_TURLERI = [
  'notifications', 'geolocation', 'media', 'midi', 'midiSysex',
  'clipboard-read', 'display-capture', 'openExternal', 'idle-detection',
  'storage-access',
  'pointerLock', 'fullscreen'
];

// Görünmez yön/kontrol karakterleri dosya adında uzantıyı ters çevirebiliyor:
// "fatura‮gnp.exe" arayüzde "faturaexe.png" diye okunur.

let izinOnayAcik = false;

/*
 * KULLANICI ARACISI DIZESINE DOKUNULMUYOR.
 *
 * Bir sure "Electron/x" ve uygulama adi UA'dan siliniyordu; amac tipik bir
 * Chrome gibi gorunmekti. Olculdu, ters etki yapiyordu:
 *
 *   UA'ya dokunulmadan          -> blackhatworld.com acildi (iki kosuda da)
 *   Electron belirteci silinmis -> Cloudflare dogrulama dongusu (iki kosuda da)
 *
 * Sebebi tutarsizlik: "ben Chrome'um" deyip Chrome'un gonderdigi Client
 * Hints'i gondermemek, bot korumalarinin baktigi en net celiskilerden biri.
 * Electron kendi adiyla gezerken boyle bir iddia yok.
 *
 * Dizede "Chrome/152 ... Safari/537.36" duruyor, yani UA'ya bakan siteler
 * calismaya devam ediyor; paketlenmis surumde ayrica "CVSBrowser/x"
 * geciyor - tarayicinin kendi kimligi.
 *
 * UYARI: Cloudflare kararlari IP itibarina bagli. Ayni adrese arka arkaya
 * onlarca otomatik istek attiktan sonra BUTUN varyantlar takildi; yani
 * yukaridaki iki kosu sonucu yonlendirici, tek basina kanit degil. Temiz bir
 * IP'den dogrulanmasi gerekiyor.
 *
 * Accept-Language'a da dokunulmuyor: basligi degistirmek navigator.languages'i
 * degistirmiyor ve ikisinin ayrismasi, tek etiketli bir baslıktan cok daha
 * guclu bir bot sinyali uretiyor (bu da olculdu).
 */

/*
 * Sec-CH-UA basliklari sayfanin kendi userAgentData degerlerinden uretiliyor.
 * Degerleri arayuz penceresinden BIR KEZ okuyup onbellege aliyoruz: boylece
 * tel uzerindeki bilgi ile JavaScript API'sinin soyledigi ayrisamaz.
 * Okunamazsa baslik hic eklenmez - eksik baslik, yanlis basliktan iyidir.
 */
let istemciIpuclari = null;

async function ipucuBasliklariniOku(wc) {
  if (istemciIpuclari || !wc || wc.isDestroyed()) return;
  try {
    const d = await wc.executeJavaScript(
      '(() => { const d = navigator.userAgentData;'
      + ' return d ? { brands: d.brands, mobile: d.mobile, platform: d.platform } : null; })()'
    );
    if (d) istemciIpuclari = ipucuBasliklari(d.brands, d.mobile, d.platform);
  } catch { /* okunamadi: baslik eklenmez */ }
}

/*
 * VEKILDEN GECECEK BUTUN OTURUMLAR.
 *
 * Bir vekil ya her yere uygulanir ya da hicbir ise yaramaz: sekme vekilden
 * cikarken guncelleme denetimi ya da liste indirmesi dogrudan cikarsa gercek
 * adres yine gorunur, ustelik kullanici korundugunu sanarak gezer.
 *
 * "electron-updater" adini biz uydurmadik; electron-updater kendi istegini o
 * bolumden atiyor (node_modules/electron-updater/out/electronHttpExecutor.js).
 * Yeni bir oturum eklenirse buraya da eklenmeli; test/sozlesme.js kaynakta
 * gecen her fromPartition adinin bu listede oldugunu denetliyor.
 */
const VEKIL_OTURUMLARI = [OTURUM, OTURUM_GIZLI, 'liste-indirme', 'electron-updater'];

function vekilOturumlari() {
  return [
    session.defaultSession,
    ...VEKIL_OTURUMLARI.map((ad) => session.fromPartition(ad, { cache: ad !== 'electron-updater' }))
  ];
}

// Vekil acikken WebRTC gercek adresi acikca yayinlayabiliyor; bu bilinen bir
// sizinti yolu ve vekilin butun anlamini goturur.
/*
 * WebRTC yalnizca KULLANICI bilerek vekil ayarladiginda sikilastiriliyor.
 * Varsayilan kip 'sistem' oldugu icin bunu her zaman acmak, vekil kullanmayan
 * herkesin gorusme uygulamalarini bozardi.
 */
function webrtcPolitikasi() {
  return store.ayarlar.vekilKip === 'elle' ? 'disable_non_proxied_udp' : 'default';
}

/*
 * Anti-adblock karşı-önlemini oturuma bağlar.
 *
 * Preload metni çalışma anında diske yazılıyor (kaynağı src/anti-adblock.js;
 * sandbox preload yerel modül require edemediği için gömülü). setPreloads
 * OTURUM kapsamlı ve mevcut preload'ların üzerine yazar, o yüzden var olanları
 * koruyarak ekliyoruz.
 *
 * Yazma başarısız olursa (disk) karşı-önlem sessizce devre dışı kalırdı; hata
 * loglanıyor ve uygulama yine de açılıyor - karşı-önlem kritik değil.
 */
const ANTI_ADBLOCK_ID = 'anti-adblock';

/*
 * SAYFA-ENJEKSİYON ADBLOCK ETKİN.
 *
 * Kozmetik CSS + scriptlet + anti-adblock preload yeniden açık. Bunu kapatma
 * gerekçesi (0.4.5-0.4.8) YANLIŞ çıktı: chromewebstore çökmesi bu katman değil,
 * Electron'da uygulanmayan chrome.webstorePrivate idi (minidump ile kanıtlandı,
 * 0.4.9'da src/kararlilik.js ile düzeltildi). Ağ tarafı artık uBlock Origin
 * motoruyla (SNFE, src/ubo-motor.js) tam uBO söz dizimini uyguluyor.
 */
const ADBLOCK_SAYFA_ENJEKSIYON = true;

/*
 * Bir host için çalışacak scriptlet eşleşmeleri. Sekme preload'ı her gezinmede
 * 'betik:coz' sendSync'iyle burayı çağırıyor; yalnızca O host'a ait küçük liste
 * dönüyor (~1 KB). Kuralları her sayfaya gömen eski yol ~590 KB'tı ve tarayıcıyı
 * donduruyordu. Eşleştirme burada, canlı veriyle yapılıyor - preload sabit.
 *
 * @returns {[string, string[]][]} [[ad, argümanlar], ...]  (ad kanonik)
 */
function betikEslesenler(host) {
  try {
    if (!ADBLOCK_SAYFA_ENJEKSIYON) return [];   // GEÇİCİ: scriptlet enjeksiyonu devre dışı
    if (!host || !store.ayarlar.engelleyiciAcik) return [];
    const kok = kokAlanAdi(host);
    if (kok && store.siteIzinliMi(kok)) return [];   // bu sitede engelleyici kapalı
    // Listeler hazırsa canlı depo (yerleşik + listeler); değilse yalnız yerleşik.
    const depo = (listeler && listeler.betik) ? listeler.betik : betikYerlesikDepo();
    return depo.eslesenler(host).map((e) => [e.ad, e.argümanlar]);
  } catch (e) {
    return [];
  }
}

/*
 * Bir host için YORDAMSAL kozmetik seçiciler ('kozmetik:proc' sendSync'i
 * bunu çağırıyor). Sayfa değerlendiricisi bunları MutationObserver ile canlı
 * uyguluyor - dinamik/rastgele-sınıflı reklamları da yakalar.
 */
function prosedurelEslesenler(host) {
  try {
    if (!ADBLOCK_SAYFA_ENJEKSIYON) return [];
    if (!host || !store.ayarlar.engelleyiciAcik) return [];
    const kok = kokAlanAdi(host);
    if (kok && store.siteIzinliMi(kok)) return [];
    return listeler ? listeler.prosedurelSeciciler(host) : [];
  } catch (e) {
    return [];
  }
}

/*
 * Çıkış IP'sini gezinti oturumundan alır (VPN açıksa sunucu IP'si). net.request
 * kullanılıyor: session.fetch proxy 407'de app 'login' olayını TETİKLEMEZ (o olay
 * webContents gezinmeleri için), ClientRequest'in kendi 'login' olayı ise
 * proxy kimlik doğrulamasını yapar — böylece token'lı çıkış gerçekten ölçülür.
 */
/*
 * Proxy kimliği (yalnızca VPN açıkken): kullanıcı = cihaz kimliği, parola =
 * otomatik alınan token. app 'login' ile aynı kural; net.request tabanlı
 * isteklerin (güncelleme, liste, favicon, çıkış IP) 'login' olayına verilir.
 * Yalnız isProxy için çağrılır; sitelerin kendi HTTP-auth'una karışmaz.
 */
function vpnKimlik(authInfo) {
  if (!store || !authInfo || !authInfo.isProxy || !store.ayarlar.vpnAcik) return null;
  return [cihazKimligi(), store.ayarlar.cihazToken || ''];
}

async function vpnCikisIpAl() {
  try {
    const y = await vekilliFetch(ses, 'https://api.ipify.org', { cache: 'no-store', zamanAsimi: 15000 }, vpnKimlik);
    if (!y.ok) return '';
    return (await y.text()).trim().slice(0, 64);
  } catch (e) { return ''; }
}

/*
 * Katalog + DİLE GÖRE görünen ad: ülke adı i18n'den gelir ("Almanya #1" /
 * "Germany #1" ...). Katalogda ad tutulmaz; dil değişince yeniden kurulur.
 */
function yerelVpnKatalog() {
  return vpnKatalog().map((s) => ({ ...s, ad: cev('ulke.' + s.ulke) + (s.no ? ' #' + s.no : '') }));
}

// VPN açılır kutusu (katman) içeriği: durum + çevrilmiş etiketler + katalog.
function vpnKatmanIcerik(konum) {
  const a = store.ayarlar;
  const kat = yerelVpnKatalog();
  const lok = kat.find((s) => s.id === a.vpnLokasyon) || kat[0] || { id: '', ad: '', ulke: '', limitMbps: 100 };
  return {
    tur: 'vpn', yon: 'sag',
    ust: Math.max(0, Math.round((konum && konum.y) || chromeYukseklik)),
    kenar: Math.max(6, Math.round((konum && konum.sagKenar) || 8)),
    genislik: 320,
    acik: !!a.vpnAcik,
    lokasyon: lok,
    katalog: kat,
    metin: {
      baslik: cev('arac.vpn'),
      baglantiAcik: cev('vpn.baglantiAcik'), baglantiKapali: cev('vpn.baglantiKapali'),
      baglaniyor: cev('vpn.baglaniyor'),
      ac: cev('vpn.ac'), lokasyon: cev('vpn.lokasyon'),
      ipBaslik: cev('vpn.ipBaslik'), ipGoster: cev('vpn.ipGoster'), ipHata: cev('vpn.ipHata'),
      hataKayit: cev('vpn.hataKayit'), otomatik: cev('vpn.otomatik'),
      limit: cev('vpn.limitAciklama', { limit: lok.limitMbps }), kapat: cev('bul.kapat')
    }
  };
}

/*
 * Anti-adblock karşı-önlemini + scriptlet kurulumunu oturuma bağlar.
 *
 * Preload STATİK: yalnızca kütüphaneyi + window.__pusulaBetikCalistir'ı kurar ve
 * o host'un eşleşmelerini sendSync ile ana süreçten ister. Kural gömmediği için
 * bir kez yazılıp kaydediliyor; liste/ayar değişince YENİDEN ÜRETİLMESİ GEREKMEZ
 * (eşleştirme betik:coz handler'ında canlı yapılıyor).
 *
 * Yazma başarısız olursa (disk) karşı-önlem sessizce devre dışı kalırdı; hata
 * loglanıyor ve uygulama yine de açılıyor - karşı-önlem kritik değil.
 */
/*
 * ANA_DUNYA_KODU (getComputedStyle Proxy'si + prototip getter override'ları) +
 * scriptlet kurulumu preload'ı ETKİN. Kapatma gerekçesi yanlıştı: chromewebstore
 * çökmesi bu preload değil, Electron'da olmayan chrome.webstorePrivate idi
 * (0.4.9'da src/kararlilik.js düzeltti). Preload sayfa script'lerinden önce ana
 * dünyaya girip yem-öge ölçümünü kandırır ve o host'un scriptlet'lerini sendSync
 * ile alıp çalıştırır. Kayıt idempotent (kayitli bekçisi).
 */
function antiAdblockKur() {
  try {
    const yol = path.join(app.getPath('userData'), 'anti-adblock-preload.js');
    fs.writeFileSync(yol, preloadKaynagi(betikKurulumKodu(), prosedurelKodu), 'utf8');

    if (typeof ses.registerPreloadScript === 'function') {
      const kayitli = (ses.getPreloadScripts ? ses.getPreloadScripts() : [])
        .some((p) => p.id === ANTI_ADBLOCK_ID);
      if (!kayitli) ses.registerPreloadScript({ type: 'frame', id: ANTI_ADBLOCK_ID, filePath: yol });
    } else {
      const mevcut = ses.getPreloads ? ses.getPreloads() : [];
      if (!mevcut.includes(yol)) ses.setPreloads([...mevcut, yol]);
    }
  } catch (e) {
    console.error('Anti-adblock karşı-önlemi kurulamadı:', e.message);
  }
}

const PAROLA_ONERI_ID = 'parola-oneri';

// Parola önerisi preload'ı hem normal hem gizli oturuma kayıtlı olmalı.
function parolaOneriKur() {
  const yol = path.join(__dirname, 'src', 'parola-onyukleme.js');
  for (const o of [ses, sesGizli]) {
    try {
      if (!o || typeof o.registerPreloadScript !== 'function') continue;
      const kayitli = (o.getPreloadScripts ? o.getPreloadScripts() : [])
        .some((p) => p.id === PAROLA_ONERI_ID);
      if (!kayitli) o.registerPreloadScript({ type: 'frame', id: PAROLA_ONERI_ID, filePath: yol });
    } catch (e) {
      console.error('Parola önerisi kurulamadı:', e.message);
    }
  }
}

const GECIS_ANAHTARI_ID = 'gecis-anahtari';

// Geçiş anahtarı (WebAuthn) önyüklemesi: normal oturuma kayıtlı. Gizli pencerede
// anahtar saklanmaz; orada create reddedilir (aşağıdaki işleyici).
function gecisAnahtariKur() {
  const yol = path.join(__dirname, 'src', 'gecis-anahtari-onyukleme.js');
  for (const o of [ses, sesGizli]) {
    try {
      if (!o || typeof o.registerPreloadScript !== 'function') continue;
      const kayitli = (o.getPreloadScripts ? o.getPreloadScripts() : [])
        .some((p) => p.id === GECIS_ANAHTARI_ID);
      if (!kayitli) o.registerPreloadScript({ type: 'frame', id: GECIS_ANAHTARI_ID, filePath: yol });
    } catch (e) {
      console.error('Geçiş anahtarı kurulamadı:', e.message);
    }
  }
}

/*
 * Geçiş anahtarı IPC'si. Kanal sekme sayfalarından çağrılır (arayuzden() değil);
 * bu yüzden KÖKEN yalnızca gönderen çerçevenin URL'sinden alınır, istek verisine
 * güvenilmez. Her kayıt / imza kullanıcı onayı ister (fail-closed).
 */
function gecisAnahtariIpcKur() {
  const RET = { hata: 'NotAllowedError' };
  const kokenAl = (e) => {
    const f = e.senderFrame;
    return f && f.url ? gecisAnahtari.kokenAl(f.url) : null;
  };
  // Sayfa önyüklemesi eşzamanlı sorar (yama belge başlamadan önce kurulmalı).
  ipcMain.on('gecisanahtari:ayar', (e) => {
    e.returnValue = store.ayarlar.gecisAnahtariTarayici !== false;
  });
  const hataYanit = (err) => ({ hata: (err && err.ad) || 'NotAllowedError' });

  ipcMain.handle('gecisanahtari:olustur', async (e, o) => {
    try {
      const origin = kokenAl(e);
      if (!origin || !o || typeof o !== 'object' || GIZLI_PENCERE) return RET;
      const sonuc = gecisAnahtari.olustur(o, origin, store.gecisAnahtarHam());
      const k = sonuc.kayit;
      const onay = await katmanOnay({
        simge: 'soru',
        baslik: cev('gecis.kaydetSor', { site: k.rpId }),
        aciklama: cev('gecis.kaydetAciklama', { kullanici: gecisAnahtari.kullaniciGoruntu(k) }),
        tamamMetni: cev('gecis.kaydet'),
        vazgecMetni: cev('dialog.iptal')
      });
      if (!onay) return RET;
      store.gecisAnahtarEkle(k);
      return sonuc.yanit;
    } catch (err) { return hataYanit(err); }
  });

  ipcMain.handle('gecisanahtari:al', async (e, o) => {
    try {
      const origin = kokenAl(e);
      if (!origin || !o || typeof o !== 'object') return RET;
      const { rpId, liste } = gecisAnahtari.adaylar(o, origin, store.gecisAnahtarHam());
      if (!liste.length) return RET;
      liste.sort((a, b) => (b.sonKullanim || 0) - (a.sonKullanim || 0));
      let secilen = liste[0];
      if (liste.length > 1) {
        const kisa = liste.slice(0, 6);
        const { response } = await dialog.showMessageBox(win, {
          type: 'question', title: cev('gecis.girisSor', { site: rpId }),
          message: cev('gecis.girisSor', { site: rpId }), noLink: true,
          buttons: [...kisa.map((k) => gecisAnahtari.kullaniciGoruntu(k)), cev('dialog.iptal')],
          cancelId: kisa.length, defaultId: 0
        });
        if (response >= kisa.length) return RET;
        secilen = kisa[response];
      } else {
        const onay = await katmanOnay({
          simge: 'soru',
          baslik: cev('gecis.girisSor', { site: rpId }),
          aciklama: gecisAnahtari.kullaniciGoruntu(secilen),
          tamamMetni: cev('gecis.girisYap'),
          vazgecMetni: cev('dialog.iptal')
        });
        if (!onay) return RET;
      }
      const yanit = gecisAnahtari.imzala(secilen, o, origin);
      store.gecisAnahtarKullanildi();
      return yanit;
    } catch (err) { return hataYanit(err); }
  });
}

const KARARLILIK_ID = 'kararlilik-webstore';

/*
 * KARARLILIK YAMASI kurulumu (bkz. src/kararlilik.js).
 *
 * chrome.webstorePrivate.getReferrerChain() çağrısı Electron'da uygulanmadığı
 * için chromewebstore.google.com açılınca tarayıcı süreci NATIVE çöküyordu
 * (0xC0000005, minidump ile doğrulandı). Bu preload sayfa script'lerinden önce
 * o API'yi zararsız noop'larla körlüyor. Adblock katmanından BAĞIMSIZ: küçük,
 * statik, yalnızca electron'a dayanıyor ve ana dünyayı yalnız bu tek konuda
 * yamalıyor. Bir kez yazılıp kaydediliyor; ayar/liste değişince yeniden
 * üretilmesi gerekmez.
 */
function kararlilikKur() {
  try {
    const yol = path.join(app.getPath('userData'), 'kararlilik-preload.js');
    fs.writeFileSync(yol, kararlilikPreloadKaynagi(), 'utf8');
    const kayitli = (ses.getPreloadScripts ? ses.getPreloadScripts() : [])
      .some((p) => p.id === KARARLILIK_ID);
    if (!kayitli) {
      ses.registerPreloadScript({ type: 'frame', id: KARARLILIK_ID, filePath: yol });
    }
  } catch (e) {
    console.error('Kararlilik yamasi kurulamadi:', e.message);
  }
}

/*
 * Chromium kuralimizi gercekten kabul etti mi?
 *
 * proxyRules bir URL degil, Chromium'un kendi mini dili; dizeye bakan hicbir
 * denetim o ayristiriciyla tam ayni fikirde kalamaz. Reddedilen bir kural
 * kume BOS birakiliyor ve her sey dogrudan gidiyor - ustelik sessizce.
 * Uyguladiktan sonra karari geri okuyoruz: DIRECT geliyorsa erisilemeyen bir
 * vekile geciyoruz, yani hata gorunur oluyor, sizinti degil.
 */
const VEKIL_SINAMA_ADRESI = 'https://ornek.gecersiz/';
let vekilReddedildi = false;

async function vekilKararaGore(o, ayar) {
  await o.setProxy(ayar);
  if (ayar.mode !== 'fixed_servers') return true;
  const karar = await o.resolveProxy(VEKIL_SINAMA_ADRESI).catch(() => '');
  if (!String(karar).startsWith('DIRECT')) return true;
  await o.setProxy({
    mode: 'fixed_servers',
    proxyRules: 'http://0.0.0.0:1',
    proxyBypassRules: ayar.proxyBypassRules
  });
  return false;
}

/*
 * VPN kimlik doğrulaması için kalıcı, ANONİM cihaz kimliği (kişisel veri değil;
 * token'la eşleşen rastgele id). İlk gerekince üretilip ayarlara yazılıyor.
 */
function cihazKimligi() {
  if (!store.ayarlar.cihazKimlik) store.ayarla('cihazKimlik', 'c-' + require('node:crypto').randomUUID());
  return store.ayarlar.cihazKimlik;
}

/*
 * OTOMATİK CİHAZ KAYDI — kullanıcı hiçbir şey girmez. Cihaz kimliğini VPN
 * sunucusunun /kayit ucuna gönderir, sunucu HMAC ile üretilmiş token'ı döner.
 * VPN proxy'sine TAKILMAYAN ayrı bir oturumdan gider (VEKIL_OTURUMLARI dışında;
 * yoksa token'ı almak için token gerekirdi — tavuk-yumurta). Token'ı ayarlara
 * yazar ve döner; başarısızsa '' (çağıran fail-closed davranır, VPN açılmaz).
 */
async function cihazKaydiYap(lokasyonId) {
  const url = vpnKayitUrl(lokasyonId || store.ayarlar.vpnLokasyon, cihazKimligi());
  if (!url) return '';
  try {
    const o = session.fromPartition('vpn-kayit');   // proxy'siz, kalıcı olmayan
    const y = await o.fetch(url, { cache: 'no-store' });
    if (!y.ok) return '';
    const j = await y.json();
    const t = j && typeof j.token === 'string' ? j.token.trim() : '';
    if (t) store.ayarla('cihazToken', t);
    return t;
  } catch (e) {
    console.error('Cihaz kaydı başarısız:', e.message);
    return '';
  }
}

async function vekiliUygula() {
  /*
   * VPN AÇIKSA proxy'yi VPN sunucusu belirler; elle vekil ayarını geçersiz kılar.
   * VPN açık ama sunucu kuralı üretilemezse (katalog/adres bozuk) FAIL-CLOSED:
   * erişilemez proxy -> trafik doğrudan SIZMAZ, hata görünür.
   * VPN kapalı ve DPI açıksa, yalnızca bu tarayıcıya özel yerel SOCKS5 ByeDPI kullanılır.
   */
  let kural;
  if (store.ayarlar.vpnAcik) {
    dpi.durdur();
    kural = vpnVekilKurali(store.ayarlar.vpnLokasyon)
      || { mode: 'fixed_servers', proxyRules: 'http://0.0.0.0:1', proxyBypassRules: '', gecerli: false };
  } else if (store.ayarlar.dpiSozlesmeKabul === true
    && store.ayarlar.dpiMod && store.ayarlar.dpiMod !== 'kapali') {
    try {
      await dpi.baslat(store.ayarlar);
      kural = dpi.vekilKurali() || { mode: 'direct', gecerli: false };
    } catch (e) {
      console.error('DPI vekil başlatılamadı:', e.message);
      kural = { mode: 'direct', gecerli: false };
    }
  } else {
    dpi.durdur();
    kural = vekilKurallari(store.ayarlar);
  }
  const ayar = { mode: kural.mode };
  if (kural.proxyRules) {
    ayar.proxyRules = kural.proxyRules;
    ayar.proxyBypassRules = kural.proxyBypassRules;
  }

  let kabul = kural.gecerli !== false;
  for (const o of vekilOturumlari()) {
    try {
      if (!(await vekilKararaGore(o, ayar))) kabul = false;
      /*
       * ACIK BAGLANTILAR KAPATILIYOR. setProxy yalnizca YENI baglantilari
       * etkiliyor; WebSocket ve HTTP/2 oturumlari gercek adresten konusmaya
       * devam ediyordu. Kullanici vekili actigi anda anonim oldugunu sanarken
       * acik sekmelerinin trafigi disari akmaya devam ediyordu. Olculdu.
       */
      await o.closeAllConnections();
    } catch (e) {
      kabul = false;
      console.error('Vekil uygulanamadi:', e.message);
    }
  }
  vekilReddedildi = !kabul;

  for (const t of sekmeler.values()) {
    const wc = t.view.webContents;
    if (!wc.isDestroyed()) wc.setWebRTCIPHandlingPolicy(webrtcPolitikasi());
  }
  durumGonder();
}

/* ---------------------------------------------------------------- */
/* Eklentiler (Chromium)                                             */
/* ---------------------------------------------------------------- */

let eklentiler = null;                 // EklentiYoneticisi
let eklentiKurAkisiAcik = false;       // aynı anda tek onay penceresi
let _sonEklentiSurum = -1;
const MAGAZA_HOSTLARI = new Set(['chromewebstore.google.com', 'chrome.google.com']);
const EKLENTI_PREFIX = 'chrome-extension://';

async function eklentiIndir(adres) {
  const yanit = await ses.fetch(adres, { redirect: 'follow' });
  if (!yanit.ok) throw new Error('HTTP ' + yanit.status);
  const uzun = Number(yanit.headers.get('content-length') || 0);
  if (uzun > 200 * 1024 * 1024) throw new Error('Dosya çok büyük');
  const tampon = Buffer.from(await yanit.arrayBuffer());
  if (!tampon.length) throw new Error(cev('eklenti.magazaBos'));
  return tampon;
}

const EVAL_KOPRU_ID = 'eklenti-eval';
const evalDunyaIpuclari = new Map(); // süreç kimliği -> dünya sırası (numaralar süreç başına ayrılır)
const evalSurecAnahtari = (e) => (e.processId !== undefined ? e.processId : (e.sender && e.sender.getOSProcessId ? e.sender.getOSProcessId() : 0));

// Electron'un uygulamadığı chrome.* API'leri için uyumluluk katmanı (src/eklenti-uyumluluk-onyukleme.js).
// Eklentiler YÜKLENMEDEN önce kayıtlı olmalı.
function eklentiUyumlulukKur() {
  // userScripts izinli eklentiler için eval köprüsü (sekme çerçeveleri); liste boşsa kendiliğinden etkisiz.
  try {
    if (typeof ses.registerPreloadScript === 'function') {
      const evalYol = path.join(__dirname, 'src', 'eklenti-eval-onyukleme.js');
      const evalKayitli = (ses.getPreloadScripts ? ses.getPreloadScripts() : []).some((p) => p.id === EVAL_KOPRU_ID);
      if (!evalKayitli) ses.registerPreloadScript({ type: 'frame', id: EVAL_KOPRU_ID, filePath: evalYol });
    }
  } catch (e) {
    console.error('Eklenti eval köprüsü kurulamadı:', e.message);
  }
  const yol = path.join(__dirname, 'src', 'eklenti-uyumluluk-onyukleme.js');
  for (const [tur, id] of [['service-worker', 'eklenti-uyum-sw'], ['frame', 'eklenti-uyum-frame']]) {
    try {
      if (typeof ses.registerPreloadScript !== 'function') return;
      const kayitli = (ses.getPreloadScripts ? ses.getPreloadScripts() : []).some((p) => p.id === id);
      if (!kayitli) ses.registerPreloadScript({ type: tur, id, filePath: yol });
    } catch (e) {
      console.error('Eklenti uyumluluk katmanı kurulamadı:', e.message);
    }
  }
}

/* ---- chrome.cookies / chrome.downloads köprüsü ---- */

let eklentiApi = null;
let eklentiBaglam = null;
let eklentiVeri = null;               // chrome.bookmarks/history/browsingData/...              // chrome.contextMenus kaydı
const eklentiIsciler = new Map();          // kimlik -> Set<ServiceWorkerMain>
const eklentiIsciBagli = new WeakSet();

/* ---- chrome.tabCapture: etkin sekmenin sesi ---- */

// kimlik -> { tabId, bitis }: eklenti sayfasının getDisplayMedia isteğine tek seferlik onay.
const ekranYakalaBekleyen = new Map();

const eklentiEkranKancalari = {
  hazirla(kimlik) {
    const t = aktifSekme();
    if (!t || t.view.webContents.isDestroyed() || t.dahiliPanel || !/^https?:\/\//i.test(t.url || '')) {
      throw new Error('Etkin sekmenin sesi yakalanamıyor (iç sayfa ya da sekme yok)');
    }
    ekranYakalaBekleyen.set(kimlik, { tabId: t.id, bitis: Date.now() + 15000 });
    return true;
  }
};

// Bu adresteki eklenti sayfası, bekleyen bir sekme yakalama onayına sahip mi?
function ekranYakalaOnayli(adres) {
  const kimlik = eklentiKimligiAdresten(adres);
  const b = kimlik && ekranYakalaBekleyen.get(kimlik);
  return !!(b && Date.now() < b.bitis);
}

const eklentiIsciSurum = new Map();        // versionId -> { kimlik, w }

function eklentiKimligiAdresten(adres) {
  try {
    const u = new URL(String(adres));
    return u.protocol === 'chrome-extension:' && EKLENTI_KIMLIK_RE.test(u.hostname) ? u.hostname : null;
  } catch { return null; }
}


/* ---- chrome.tabs: gerçek sekmelerimiz ---------------------------------------
 * Electron kendi chrome.tabs'ında oturumdaki HER WebContents'i (açılır pencere, arka plan
 * sayfası, arayüz...) "sekme" sayıyor ve "etkin sekme"yi de yanlış seçiyordu: Proton Pass gibi
 * eklentiler tabs.query({active:true,currentWindow:true}) ile açılır pencere kendi kendini
 * görüyor, gerçek sayfanın adresini bilemiyordu. Burada sekme listesi, etkin sekme, adres
 * görünürlüğü (Chrome kuralı: 'tabs' izni, host izni ya da activeTab) ve olaylar bizim
 * sekmelerimizden gelir. Kimlik = WebContents kimliği (tabs.sendMessage/executeScript uyumu için).
 */
function eklentiSekmeBul(wcId) {
  for (const t of sekmeler.values()) {
    if (gorunumYasiyor(t) && t.view.webContents.id === Number(wcId)) return t;
  }
  return null;
}

function eklentiDesenUyar(desen, adres) {
  if (/^(\*|https?):\/\//.test(desen) || desen === '<all_urls>') return eklentiUrlEslesir(desen, adres);
  return new RegExp('^' + String(desen).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(adres);
}

/*
 * Eklentiye gorunen sekme adresi. Hata sayfasi (error.html) yerel bir dosya
 * olarak yuklendigi icin t.url ona isaret eder; Chrome'da ise basarisiz bir
 * gezinmenin sekmesi, denenen adresi tasir. PreMiD gibi eklentiler bunu
 * kullanir: login.premid.app'in DNS kaydi yoktur, eklenti "sekme bu adreste
 * yuklendi" olayini yakalayip kendi oauth2.html sayfasina yonlendirir.
 */
function eklentiSekmeAdresi(t) {
  const u = t.url || t.view.webContents.getURL() || '';
  return t.hataAdresi && icSayfaMi(u) ? t.hataAdresi : u;
}

function eklentiSekmeNesnesi(kimlik, t) {
  const wc = t.view.webContents;
  const m = eklentiler ? eklentiler.etkinManifest(kimlik) : null;
  const url = eklentiSekmeAdresi(t);
  const aktif = t === aktifSekme();
  const gorur = !!m && (eklentiIzinVar(m, 'tabs') || eklentiHostIzni(m, url)
    || (eklentiIzinVar(m, 'activeTab') && aktif) || url.startsWith(EKLENTI_PREFIX + kimlik + '/'));
  const sira = [...sekmeler.keys()].indexOf(t.id);
  const o = {
    id: wc.id, index: sira, windowId: 1, active: aktif, highlighted: aktif, selected: aktif,
    pinned: false, audible: wc.isCurrentlyAudible(), discarded: false, autoDiscardable: true,
    frozen: false, groupId: -1, incognito: false,
    mutedInfo: { muted: wc.audioMuted, ...(wc.audioMuted ? { reason: 'user' } : {}) },
    status: wc.isLoading() ? 'loading' : 'complete',
    lastAccessed: Date.now()
  };
  if (gorur) {
    o.url = url;
    o.title = t.baslik || wc.getTitle() || '';
    if (typeof t.favicon === 'string' && /^(https?:|data:)/.test(t.favicon)) o.favIconUrl = t.favicon;
  }
  return o;
}

function eklentiSekmeSorgu(kimlik, f) {
  f = f && typeof f === 'object' ? f : {};
  const sonuc = [];
  for (const t of sekmeler.values()) {
    if (!gorunumYasiyor(t) || t.gizli) continue;
    const o = eklentiSekmeNesnesi(kimlik, t);
    if (typeof f.active === 'boolean' && f.active !== o.active) continue;
    if (typeof f.highlighted === 'boolean' && f.highlighted !== o.highlighted) continue;
    if (typeof f.pinned === 'boolean' && f.pinned !== o.pinned) continue;
    if (typeof f.audible === 'boolean' && f.audible !== o.audible) continue;
    if (typeof f.muted === 'boolean' && f.muted !== o.mutedInfo.muted) continue;
    if (typeof f.discarded === 'boolean' && f.discarded) continue;
    if (typeof f.autoDiscardable === 'boolean' && !f.autoDiscardable) continue;
    if (typeof f.status === 'string' && f.status !== o.status) continue;
    if (typeof f.index === 'number' && f.index !== o.index) continue;
    if (f.currentWindow === false || f.lastFocusedWindow === false) continue;
    if (typeof f.windowId === 'number' && f.windowId !== 1 && f.windowId !== -2) continue;
    if (f.windowType !== undefined && f.windowType !== 'normal') continue;
    if (f.url !== undefined) {
      if (o.url === undefined) continue;
      const desenler = Array.isArray(f.url) ? f.url : [f.url];
      if (!desenler.some((d) => eklentiDesenUyar(String(d), o.url))) continue;
    }
    if (f.title !== undefined) {
      if (o.title === undefined) continue;
      if (!eklentiDesenUyar(String(f.title), o.title)) continue;
    }
    sonuc.push(o);
  }
  return sonuc;
}

function eklentiSekmeIslem(kimlik, yontem, args, baglam) {
  const f = args[0];
  const al = (id) => {
    const t = eklentiSekmeBul(id);
    if (!t || t.gizli) throw new Error('No tab with id: ' + id + '.');
    return t;
  };
  switch (yontem) {
    case 'query': return eklentiSekmeSorgu(kimlik, f);
    case 'get': return eklentiSekmeNesnesi(kimlik, al(f));
    case 'getCurrent': {
      const t = baglam && baglam.sekmeWcId != null ? eklentiSekmeBul(baglam.sekmeWcId) : null;
      return t && !t.gizli ? eklentiSekmeNesnesi(kimlik, t) : undefined;
    }
    case 'create': {
      const o = f && typeof f === 'object' ? f : {};
      const url = o.url !== undefined ? String(o.url) : undefined;
      const t = sekmeOlustur({ url, arkaPlan: o.active === false, kaynak: 'sayfa' });
      if (!t) throw new Error('Bu adres açılamaz: ' + url);
      return eklentiSekmeNesnesi(kimlik, t);
    }
    case 'duplicate': {
      const t = al(f);
      const y = sekmeOlustur({ url: t.url, kaynak: 'sayfa' });
      return y ? eklentiSekmeNesnesi(kimlik, y) : undefined;
    }
    case 'update': {
      const tek = typeof f === 'number';
      const t = tek ? al(f) : aktifSekme();
      const o = (tek ? args[1] : f) || {};
      if (!t) throw new Error('No tab to update.');
      if (typeof o.url === 'string') {
        // Eklenti KENDI sayfalarina da gidebilir (OAuth donusu: oauth2.html);
        // baska eklentinin ya da herhangi bir chrome-extension adresi hayir.
        const kendi = o.url.startsWith(EKLENTI_PREFIX + kimlik + '/');
        if (!sayfadanGezilebilir(o.url) && !kendi) throw new Error('Bu adres açılamaz: ' + o.url);
        t.view.webContents.loadURL(o.url);
      }
      if (typeof o.muted === 'boolean') t.view.webContents.setAudioMuted(o.muted);
      if (o.active === true || o.highlighted === true) sekmeSec(t.id);
      return eklentiSekmeNesnesi(kimlik, t);
    }
    case 'remove': {
      const idler = Array.isArray(f) ? f : [f];
      for (const id of idler) { const t = al(id); sekmeKapat(t.id); }
      return undefined;
    }
    default:
      throw new Error('chrome.tabs.' + yontem + ' desteklenmiyor');
  }
}

// Sekme olayı: her etkin eklentiye, o eklentinin görebileceği alanlarla.
function eklentiSekmeOlayi(ad, t, ekstra) {
  if (!eklentiler || !t || t.gizli) return;
  const wcId = ekstra && ekstra.wcId != null ? ekstra.wcId : (gorunumYasiyor(t) ? t.view.webContents.id : null);
  if (wcId == null) return;
  for (const k of eklentiler.etkinKimlikler()) {
    let args;
    if (ad === 'onRemoved') {
      args = [wcId, { windowId: 1, isWindowClosing: false }];
    } else if (ad === 'onActivated') {
      args = [{ tabId: wcId, windowId: 1 }];
    } else {
      if (!gorunumYasiyor(t)) continue;
      const tab = eklentiSekmeNesnesi(k, t);
      if (ad === 'onCreated') args = [tab];
      else {
        const degisim = { ...(ekstra && ekstra.degisim) };
        if (tab.url === undefined) { delete degisim.url; delete degisim.title; delete degisim.favIconUrl; }
        if (!Object.keys(degisim).length) continue;
        args = [wcId, degisim, tab];
      }
    }
    // Sayfa yuklemesi bitti olayi durmus bir servis calisanini UYANDIRIR (Chrome gibi).
    const uyandir = ad === 'onUpdated' && args[1] && args[1].status === 'complete';
    eklentiOlayYayinla(k, 'tabs', ad, { __args: args }, uyandir);
  }
}

function eklentiSekmeDinle(t) {
  const wc = t.view.webContents;
  const g = (degisim) => eklentiSekmeOlayi('onUpdated', t, { degisim });
  wc.on('did-start-loading', () => g({ status: 'loading' }));
  wc.on('did-stop-loading', () => { if (gorunumYasiyor(t)) g({ status: 'complete', url: eklentiSekmeAdresi(t), title: t.baslik }); });
  wc.on('did-navigate', (_e, adres) => g({ url: t.hataAdresi && icSayfaMi(adres) ? t.hataAdresi : adres }));
  wc.on('did-navigate-in-page', (_e, adres, ana) => { if (ana) g({ url: adres }); });
  wc.on('page-title-updated', (_e, baslik) => g({ title: baslik }));
  wc.on('audio-state-changed', (e) => g({ audible: !!e.audible }));
}

// chrome.webNavigation.getFrame / getAllFrames: gerçek çerçeve ağacı (Chrome çerçeve kimliği: ana = 0, diğerleri = çerçeve ağacı düğüm kimliği).
function eklentiCerceveKimligi(f, wc) {
  try { return f === wc.mainFrame ? 0 : f.frameTreeNodeId; } catch { return -1; }
}

function eklentiCerceveBilgisi(f, wc) {
  const ust = f.parent;
  return {
    frameId: eklentiCerceveKimligi(f, wc),
    parentFrameId: ust ? eklentiCerceveKimligi(ust, wc) : -1,
    processId: f.processId,
    url: f.url || '',
    errorOccurred: false,
    documentLifecycle: 'active',
    frameType: f === wc.mainFrame ? 'outermost_frame' : 'sub_frame'
  };
}

function eklentiGezinmeIslem(yontem, args) {
  const f = args[0] && typeof args[0] === 'object' ? args[0] : {};
  const t = eklentiSekmeBul(f.tabId);
  if (!t || t.gizli) return yontem === 'getAllFrames' ? null : null;
  const wc = t.view.webContents;
  const hepsi = wc.mainFrame.framesInSubtree;
  if (yontem === 'getAllFrames') return hepsi.map((c) => eklentiCerceveBilgisi(c, wc));
  if (yontem === 'getFrame') {
    const c = hepsi.find((x) => eklentiCerceveKimligi(x, wc) === Number(f.frameId));
    return c ? eklentiCerceveBilgisi(c, wc) : null;
  }
  throw new Error('chrome.webNavigation.' + yontem + ' desteklenmiyor');
}

async function eklentiApiCagrisi(kimlik, ns, yontem, args, baglam) {
  // Hata zarfı: önyükleme betiği { hata } görünce Error fırlatır.
  if (!eklentiApi || !kimlik) return { hata: 'Eklenti bilinmiyor' };
  try {
    if (ns === 'webNavigation') {
      const m = eklentiler && eklentiler.etkinManifest(kimlik);
      if (!m || !eklentiIzinVar(m, 'webNavigation')) throw new Error("'webNavigation' izni manifest'te bildirilmemiş");
      return { deger: eklentiGezinmeIslem(String(yontem), Array.isArray(args) ? args : []) };
    }
    if (ns === 'tabs') return { deger: eklentiSekmeIslem(kimlik, String(yontem), Array.isArray(args) ? args : [], baglam || {}) };
    return { deger: await eklentiApi.cagir(kimlik, String(ns), String(yontem), Array.isArray(args) ? args : []) };
  } catch (e) {
    return { hata: String(e && e.message || e) };
  }
}

// Eklentinin çalışan bağlamlarına (servis çalışanı + sayfalar) olay yollar.
/*
 * MV3 servis calisani bosta durur (Chrome ~30 sn); olay gelince Chrome onu
 * uyandirir. Biz durmus calisani listeden dusuruyorduk, olay kimseye
 * ulasmiyordu: PreMiD OAuth donusu (login.premid.app) bu yuzden kayboluyordu,
 * cunku kullanici Discord'da gezerken calisan uyuyordu. Calisan yoksa
 * baslatilir, 'running' olup kanala baglaninca olay gonderilir.
 */
const eklentiUyandirma = new Map();   // kimlik -> Promise (ayni anda tek baslatma)
function eklentiIsciUyandir(kimlik) {
  if (eklentiUyandirma.has(kimlik)) return eklentiUyandirma.get(kimlik);
  const p = (async () => {
    try {
      await ses.serviceWorkers.startWorkerForScope(EKLENTI_PREFIX + kimlik + '/');
      // 'running' olayi kanali baglar; en cok ~3 sn bekle.
      for (let i = 0; i < 30 && !(eklentiIsciler.get(kimlik) || { size: 0 }).size; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    } catch { /* eklentinin servis calisani yok ya da baslatilamadi */ }
  })().finally(() => eklentiUyandirma.delete(kimlik));
  eklentiUyandirma.set(kimlik, p);
  return p;
}

function eklentiOlayYayinla(kimlik, ns, ad, veri, uyandir) {
  const calisan = eklentiIsciler.get(kimlik);
  if (uyandir && !(calisan && calisan.size)) {
    eklentiIsciUyandir(kimlik).then(() => eklentiOlayYayinla(kimlik, ns, ad, veri, false));
    return;
  }
  for (const w of eklentiIsciler.get(kimlik) || []) {
    try { w.send('eklenti:olay', ns, ad, veri); } catch { /* işçi durmuş */ }
  }
  const onek = EKLENTI_PREFIX + kimlik + '/';
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed()) continue;
    try {
      for (const f of wc.mainFrame.framesInSubtree) {
        if (f.url && f.url.startsWith(onek)) f.send('eklenti:olay', ns, ad, veri);
      }
    } catch { /* çerçeve kapanmış */ }
  }
}

function eklentiIsciBagla(versionId) {
  let w;
  try { w = ses.serviceWorkers.getWorkerFromVersionID(versionId); } catch { return; }
  if (!w) return;
  const kimlik = eklentiKimligiAdresten(w.scope);
  if (!kimlik) return;
  eklentiIsciSurum.set(versionId, { kimlik, w });
  if (!eklentiIsciler.has(kimlik)) eklentiIsciler.set(kimlik, new Set());
  eklentiIsciler.get(kimlik).add(w);
  if (eklentiIsciBagli.has(w)) return;       // kanal zaten bağlı (işçi yeniden başladı)
  eklentiIsciBagli.add(w);
  // Çağıran kimliği İSTEKTEN değil, işçinin kapsamından (scope) alınır.
  w.ipc.handle('eklenti:api', (_e, ns, yontem, args) => eklentiApiCagrisi(kimlik, ns, yontem, args));
}

/*
 * runtime.onInstalled / runtime.onStartup: Electron bunları HİÇ tetiklemiyor (ölçüldü). Birçok
 * eklenti varsayılan ayarlarını ve kimliğini onInstalled'da yazar (ör. DeepL: installationId,
 * Statsig kimliği); tetiklenmeyince açılışta hata verir ya da boş ayarlarla çalışır.
 *   - yeni kurulum -> reason 'install'
 *   - sürüm değişti -> reason 'update' + previousVersion
 *   - bu özellikten ÖNCE kurulmuş eklenti (kayıt yok) -> 'update' (kurulum karşılama sayfası açılmasın)
 *   - her uygulama açılışında bir kez onStartup
 */
const eklentiYeniKurulacak = new Set();
const eklentiYasamBildirildi = new Set();

function eklentiYasamOlaylari(kimlik) {
  if (eklentiYasamBildirildi.has(kimlik) || !eklentiler) return;
  const m = eklentiler.etkinManifest(kimlik);
  if (!m) return;
  eklentiYasamBildirildi.add(kimlik);
  if (!store.veri.eklentiYasam || typeof store.veri.eklentiYasam !== 'object') store.veri.eklentiYasam = {};
  const kayit = store.veri.eklentiYasam;
  const surum = String(m.version || '');
  const onceki = kayit[kimlik];
  let ayrinti = null;
  if (eklentiYeniKurulacak.has(kimlik) && onceki === undefined) ayrinti = { reason: 'install' };
  else if (onceki === undefined) ayrinti = { reason: 'update', previousVersion: surum };
  else if (onceki !== surum) ayrinti = { reason: 'update', previousVersion: onceki };
  eklentiYeniKurulacak.delete(kimlik);
  if (ayrinti) { kayit[kimlik] = surum; store.kaydet(); }
  // Dinleyiciler kaydolsun diye kısa bir gecikmeyle; uyumluluk katmanı gelen olayı bekletir.
  setTimeout(() => {
    if (ayrinti) eklentiOlayYayinla(kimlik, 'runtime', 'onInstalled', ayrinti);
    eklentiOlayYayinla(kimlik, 'runtime', 'onStartup', undefined);
  }, 150);
}

/* ---- chrome.identity.launchWebAuthFlow ---- */

/**
 * OAuth girişi için ayrı pencere. Kullanıcının tarayıcı oturumunu (çerezler) kullanır, bu yüzden
 * zaten açık hesaplara tek tıkla girilir. Yönlendirme eklentinin kendi adresine
 * (https://<kimlik>.chromiumapp.org/…) ulaşınca pencere kapanır ve o adres eklentiye döner.
 * Pencere başlığı her zaman gerçek alan adını gösterir (sahte giriş sayfalarına karşı).
 */
function eklentiWebAuth({ url, interactive, redirectBase }) {
  return new Promise((coz, red) => {
    if (!win || win.isDestroyed()) return red(new Error('Pencere yok'));
    let bitti = false;
    let zaman = null;
    const alan = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
    const pen = new BrowserWindow({
      parent: win,
      width: 520,
      height: 740,
      show: !!interactive,
      autoHideMenuBar: true,
      title: alan(url),
      webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
    });
    const bitir = (hata, deger) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(zaman);
      try { if (!pen.isDestroyed()) pen.destroy(); } catch { /* kapanmış */ }
      if (hata) red(new Error(hata)); else coz(deger);
    };
    const wc = pen.webContents;
    const yakala = (e, adres) => {
      if (typeof adres === 'string' && (adres.startsWith(redirectBase) || adres === redirectBase.slice(0, -1))) {
        e.preventDefault();
        bitir(null, adres);
      }
    };
    wc.on('will-redirect', yakala);
    wc.on('will-navigate', yakala);
    wc.on('did-navigate', (_e, adres) => { try { if (!pen.isDestroyed()) pen.setTitle(alan(adres)); } catch { /* kapanmış */ } });
    wc.setWindowOpenHandler(({ url: hedef }) => {
      // Açılır pencere isteyen sağlayıcılar: aynı pencerede açılır (yalnızca https).
      if (/^https:/i.test(hedef)) wc.loadURL(hedef).catch(() => {});
      return { action: 'deny' };
    });
    wc.on('did-fail-load', (_e, kod, aciklama, adres, anaCerceve) => {
      if (anaCerceve && kod !== -3 && !String(adres).startsWith(redirectBase)) bitir('Sayfa yüklenemedi: ' + aciklama);
    });
    pen.on('closed', () => bitir('The user did not approve access.'));
    zaman = setTimeout(
      () => bitir(interactive ? 'Zaman aşımı' : 'User interaction is required.'),
      interactive ? 10 * 60 * 1000 : 15000
    );
    wc.loadURL(url).catch(() => {});
  });
}

/* ---- chrome.permissions (isteğe bağlı izinler) ---- */

const eklentiIzinKancalari = {
  async onayIste(kimlik, istek) {
    const e = eklentiler && eklentiler.liste({ simge: false }).find((x) => x.id === kimlik);
    return katmanOnay({
      simge: 'soru',
      baslik: cev('eklenti.izinIstegi', { ad: e ? e.ad : kimlik }),
      aciklama: cev('eklenti.izinIstegiAciklama'),
      bolumler: [
        { etiket: cev('eklenti.izinler'), ogeler: istek.permissions },
        { etiket: cev('eklenti.siteler'), ogeler: istek.origins, mono: true }
      ],
      tamamMetni: cev('eklenti.izinVer'),
      vazgecMetni: cev('eklenti.izinVerme')
    });
  },
  ver: (kimlik, istek) => eklentiler.izinVer(kimlik, istek),
  kaldir: (kimlik, istek) => eklentiler.izinKaldir(kimlik, istek),
  verilen: (kimlik) => eklentiler.verilenIzinler(kimlik)
};

const eklentiBildirimler = new Map();      // kimlik + '|' + id -> Notification
const eklentiBildirimKancalari = {
  goster(kimlik, id, o) {
    if (!Notification.isSupported()) return;
    const anahtar = kimlik + '|' + id;
    const eski = eklentiBildirimler.get(anahtar);
    if (eski) { try { eski.close(); } catch { /* kapanmış */ } }
    const n = new Notification({ title: String(o.title || ''), body: String(o.message || ''), silent: o.silent === true });
    n.on('click', () => eklentiOlayYayinla(kimlik, 'notifications', 'onClicked', id));
    n.on('close', () => { eklentiBildirimler.delete(anahtar); eklentiOlayYayinla(kimlik, 'notifications', 'onClosed', { __args: [id, true] }); });
    eklentiBildirimler.set(anahtar, n);
    n.show();
  },
  kapat(kimlik, id) {
    const n = eklentiBildirimler.get(kimlik + '|' + id);
    if (!n) return false;
    try { n.close(); } catch { /* kapanmış */ }
    return true;
  }
};

// chrome.browsingData.remove: istenen veri türlerini (ve isteğe bağlı origin/since) siler.
async function eklentiVeriTemizle(turler, since, secenek) {
  const DEPO = {
    cookies: 'cookies', localStorage: 'localstorage', indexedDB: 'indexdb', cacheStorage: 'cachestorage',
    serviceWorkers: 'serviceworkers', fileSystems: 'filesystem', webSQL: 'websql', appcache: 'appcache'
  };
  const depolar = turler.filter((t) => DEPO[t]).map((t) => DEPO[t]);
  const origins = Array.isArray(secenek.origins) ? secenek.origins.filter((o) => typeof o === 'string') : [];
  for (const s of [ses, session.defaultSession]) {
    if (depolar.length) {
      if (origins.length) {
        for (const origin of origins) {
          await s.clearStorageData({ origin, storages: depolar.filter((d) => d !== 'cookies') }).catch(() => {});
          if (depolar.includes('cookies')) {
            for (const c of await s.cookies.get({ url: origin }).catch(() => [])) {
              await s.cookies.remove(origin, c.name).catch(() => {});
            }
          }
        }
      } else {
        await s.clearStorageData({ storages: depolar });
      }
    }
    if (turler.includes('cache')) await s.clearCache();
  }
  if (turler.includes('history')) {
    if (since > 0) { for (const g of store.veri.gecmis.slice()) if (g.zaman >= since) store.gecmisTekilSil(g.url, g.zaman); }
    else store.gecmisiTemizle();
  }
  if (turler.includes('downloads')) {
    const eski = store.veri.indirmeler || [];
    store.veri.indirmeler = eski.filter((x) => since > 0 && (x.zaman || x.tarih || 0) < since);
    store.kaydet();
  }
  if (turler.includes('cookies') || turler.includes('history')) durumGonder();
}

function eklentiApiKur() {
  eklentiBaglam = new EklentiBaglamMenusu({
    bildir: eklentiOlayYayinla,
    yukle: () => store.veri.eklentiMenuleri,
    kaydet: (v) => { store.veri.eklentiMenuleri = v; store.kaydet(); }
  });
  eklentiVeri = new EklentiVeri({
    store,
    yayinla: (ns, ad, veri) => {
      for (const k of eklentiler ? eklentiler.etkinKimlikler() : []) {
        const m = eklentiler.etkinManifest(k);
        if (m && eklentiIzinVar(m, ns)) eklentiOlayYayinla(k, ns, ad, veri);
      }
    },
    kanca: {
      temizle: eklentiVeriTemizle,
      ara: async (metin, yer) => {
        const adres = resolveInput(metin, store.ayarlar.aramaMotoru);
        if (!adres) return;
        if (yer === 'CURRENT_TAB' && aktifSekme()) aktifSekme().view.webContents.loadURL(adres);
        else if (yer === 'NEW_WINDOW') yeniPencereAc(adres);
        else sekmeOlustur({ url: adres });
      }
    }
  });
  store.gecmisKancasi = (g) => eklentiVeri.yayinla('history', 'onVisited', {
    id: String(g.zaman), url: g.url, title: g.baslik || '', lastVisitTime: g.zaman, visitCount: 1, typedCount: 0
  });
  eklentiApi = new EklentiApi({
    veri: eklentiVeri,
    baglam: eklentiBaglam,
    ses,
    manifest: (k) => (eklentiler ? eklentiler.etkinManifest(k) : null),
    bildir: eklentiOlayYayinla,
    indirme: eklentiIndirmeKancalari,
    kimlik: { webAuth: eklentiWebAuth },
    izinler: eklentiIzinKancalari,
    bildirim: eklentiBildirimKancalari,
    ekran: eklentiEkranKancalari
  });
  eklentiApi.cerezOlaylariniBaslat(() => (eklentiler ? eklentiler.etkinKimlikler() : []));

  // Eval köprüsü (src/eklenti-eval-onyukleme.js): manifestinde "userScripts" izni olan etkin eklentilerin
  // kimlikleri. returnValue tam bir kez atanır (sendSync).
  // Önyükleme bulduğu dünya numarasını (tabana göre sıra) bildirir; sonraki belgelerde erken yama için.
  ipcMain.on('cvs:eval-dunya', (e, sira) => {
    if (Number.isInteger(sira) && sira >= 0 && sira < 256) evalDunyaIpuclari.set(evalSurecAnahtari(e), sira);
  });
  ipcMain.on('cvs:eval-kopru', (e) => {
    let sonuc = { kimlikler: [], dunyaSayisi: 0, ipucu: 0 };
    try {
      const etkin = eklentiler ? eklentiler.etkinKimlikler() : [];
      const kimlikler = etkin.filter((k) => {
        const m = eklentiler.etkinManifest(k);
        return !!m && Array.isArray(m.permissions) && m.permissions.includes('userScripts');
      });
      // Dünya numaraları eklenti başına ayrılır: en çok etkin eklenti sayısı kadar numara olabilir.
      sonuc = { kimlikler, dunyaSayisi: etkin.length, ipucu: evalDunyaIpuclari.get(evalSurecAnahtari(e)) || 0 };
    } catch { /* boş liste */ }
    e.returnValue = sonuc;
  });

  // Sayfalar (açılır pencere, seçenekler, arka plan sayfası): gönderen çerçevenin adresinden.
  ipcMain.handle('eklenti:api', (e, ns, yontem, args) => {
    const f = e.senderFrame;
    return eklentiApiCagrisi(f ? eklentiKimligiAdresten(f.url) : null, ns, yontem, args, { sekmeWcId: e.sender && e.sender.id });
  });

  // Servis çalışanları: başladıkça kanala bağlanır, durunca listeden düşer.
  ses.serviceWorkers.on('running-status-changed', ({ versionId, runningStatus }) => {
    if (runningStatus === 'starting' || runningStatus === 'running') {
      eklentiIsciBagla(versionId);
      // Yaşam döngüsü olayları işçi ÇALIŞIRKEN gider (betik değerlendirildi, dinleyiciler kayıtlı).
      if (runningStatus === 'running') {
        const kayit = eklentiIsciSurum.get(versionId);
        if (kayit) eklentiYasamOlaylari(kayit.kimlik);
      }
    } else if (runningStatus === 'stopped') {
      // Durmuş işçi listeden düşer (Ayrıntılar sayfasında "Etkin değil" görünsün).
      const kayit = eklentiIsciSurum.get(versionId);
      if (kayit) {
        eklentiIsciSurum.delete(versionId);
        const kume = eklentiIsciler.get(kayit.kimlik);
        if (kume) { kume.delete(kayit.w); if (!kume.size) eklentiIsciler.delete(kayit.kimlik); }
      }
    }
  });
  // Tanı: CVS_EKLENTI_LOG=<dosya> verilirse eklenti servis çalışanlarının konsol çıktısı oraya yazılır.
  const tanıDosyası = process.env['CVS_EKLENTI_' + 'LOG'];
  if (tanıDosyası) {
    // Sekmelerdeki eklenti içerik betikleri (ör. PreMiD köprüsü) de aynı dosyaya yazılsın.
    app.on('web-contents-created', (_ev, wc) => {
      wc.on('console-message', (d) => {
        if (!d || typeof d !== 'object') return;
        const kaynak = String(d.sourceId || '');
        if (!/^chrome-extension:/.test(kaynak) && !/premid/i.test(String(d.message))) return;
        try {
          require('node:fs').appendFileSync(tanıDosyası,
            new Date().toISOString() + ' [sekme ' + d.level + '] ' + kaynak.slice(-60) + ' ' + String(d.message).slice(0, 1500) + '\n');
        } catch { /* tanı yazılamadı */ }
      });
    });
    ses.serviceWorkers.on('console-message', (_e, d) => {
      if (!d) return;
      try {
        require('node:fs').appendFileSync(tanıDosyası,
          new Date().toISOString() + ' [' + d.level + '] ' + String(d.message).slice(0, 2000) + '\n');
      } catch { /* tanı yazılamadı */ }
    });
  }
  for (const id of Object.keys(ses.serviceWorkers.getAllRunning())) {
    eklentiIsciBagla(Number(id));
    const kayit = eklentiIsciSurum.get(Number(id));
    if (kayit) eklentiYasamOlaylari(kayit.kimlik);
  }
}

/* ---- indirme kancaları (chrome.downloads) ---- */

let sonIndirmeNo = 0;
const indirmeNesneleri = new Map();        // no -> DownloadItem (yaşıyorsa)
const eklentiIndirmeBekleyen = [];         // { url, filename, conflictAction, coz, red, zamanAsimi }

function indirmeNo(k) {
  if (!k.no) k.no = ++sonIndirmeNo;
  return k.no;
}

function indirmeOgesi(k) {
  const durum = k.durum === 'tamam' ? 'complete' : k.durum === 'devam' ? 'in_progress' : 'interrupted';
  const o = {
    id: indirmeNo(k),
    url: k.url || '',
    finalUrl: k.url || '',
    referrer: '',
    filename: k.yol || '',
    incognito: false,
    danger: 'safe',
    mime: '',
    startTime: new Date(k.zaman || Date.now()).toISOString(),
    state: durum,
    paused: false,
    canResume: k.durum === 'kesildi',
    bytesReceived: k.alinan || 0,
    totalBytes: k.toplam || 0,
    fileSize: k.toplam || k.alinan || 0,
    exists: k.durum === 'tamam' && !!k.yol && fs.existsSync(k.yol)
  };
  if (k.bitis) o.endTime = new Date(k.bitis).toISOString();
  if (k.durum === 'iptal') o.error = 'USER_CANCELED';
  else if (k.durum === 'hata') o.error = 'FILE_FAILED';
  return o;
}

function indirmeOlayiYayinla(ad, veri) {
  if (!eklentiler) return;
  for (const kimlik of eklentiler.etkinKimlikler()) {
    const m = eklentiler.etkinManifest(kimlik);
    if (m && eklentiIzinVar(m, 'downloads')) eklentiOlayYayinla(kimlik, 'downloads', ad, veri);
  }
}

const eklentiIndirmeKancalari = {
  baslat({ url, filename, saveAs, conflictAction, headers }) {
    return new Promise((coz, red) => {
      const girdi = { url, filename, saveAs, conflictAction, coz, red };
      girdi.zamanAsimi = setTimeout(() => {
        const i = eklentiIndirmeBekleyen.indexOf(girdi);
        if (i >= 0) eklentiIndirmeBekleyen.splice(i, 1);
        red(new Error('İndirme başlatılamadı (zaman aşımı)'));
      }, 20000);
      eklentiIndirmeBekleyen.push(girdi);
      const basliklar = {};
      for (const h of headers.slice(0, 20)) {
        if (h && typeof h.name === 'string' && typeof h.value === 'string' && /^[A-Za-z0-9-]+$/.test(h.name)) basliklar[h.name] = h.value;
      }
      try { ses.downloadURL(url, Object.keys(basliklar).length ? { headers: basliklar } : undefined); }
      catch (e) {
        clearTimeout(girdi.zamanAsimi);
        eklentiIndirmeBekleyen.splice(eklentiIndirmeBekleyen.indexOf(girdi), 1);
        red(e);
      }
    });
  },
  async ara(q) {
    let liste = indirmeler.slice();
    if (q.id !== undefined) liste = liste.filter((k) => indirmeNo(k) === Number(q.id));
    if (typeof q.url === 'string') liste = liste.filter((k) => k.url === q.url);
    if (typeof q.state === 'string') {
      liste = liste.filter((k) => indirmeOgesi(k).state === q.state);
    }
    for (const [alan, hedef] of [['urlRegex', 'url'], ['filenameRegex', 'yol']]) {
      if (typeof q[alan] === 'string' && q[alan].length < 200) {
        try { const re = new RegExp(q[alan]); liste = liste.filter((k) => re.test(k[hedef] || '')); } catch { /* geçersiz desen */ }
      }
    }
    if (Array.isArray(q.query) && q.query.length) {
      const terimler = q.query.filter((t) => typeof t === 'string').map((t) => t.toLowerCase());
      liste = liste.filter((k) => terimler.every((t) => (t.startsWith('-')
        ? !((k.url || '') + ' ' + (k.yol || '')).toLowerCase().includes(t.slice(1))
        : ((k.url || '') + ' ' + (k.yol || '')).toLowerCase().includes(t))));
    }
    const ogeler = liste.map(indirmeOgesi);
    const sirala = Array.isArray(q.orderBy) && typeof q.orderBy[0] === 'string' ? q.orderBy[0] : '';
    if (sirala.replace('-', '') === 'startTime') {
      ogeler.sort((a, b) => (a.startTime < b.startTime ? -1 : 1) * (sirala.startsWith('-') ? -1 : 1));
    }
    const sinir = Number.isInteger(q.limit) && q.limit >= 0 ? q.limit : 1000;
    return ogeler.slice(0, sinir);
  },
  async iptal(no) { const it = indirmeNesneleri.get(no); if (it) it.cancel(); },
  async duraklat(no) { const it = indirmeNesneleri.get(no); if (it && !it.isPaused()) it.pause(); },
  async surdur(no) { const it = indirmeNesneleri.get(no); if (it && it.canResume()) it.resume(); },
  async sil(q) {
    const silinecek = new Set((await this.ara(q)).map((o) => o.id));
    const silinenler = [];
    for (let i = indirmeler.length - 1; i >= 0; i--) {
      if (silinecek.has(indirmeNo(indirmeler[i]))) { silinenler.push(indirmeNo(indirmeler[i])); indirmeler.splice(i, 1); }
    }
    if (silinenler.length) { indirmeleriKaydet(); durumGonder(); for (const id of silinenler) indirmeOlayiYayinla('onErased', id); }
    return silinenler;
  },
  async goster(no) {
    const k = indirmeler.find((x) => indirmeNo(x) === no);
    if (k && k.yol) shell.showItemInFolder(k.yol);
  },
  async klasoruAc() { await shell.openPath(store.ayarlar.indirmeKlasoru || app.getPath('downloads')); }
};

function eklentiBaslat() {
  eklentiUyumlulukKur();
  eklentiApiKur();
  eklentiler = new EklentiYoneticisi({
    ses,
    store,
    dizin: path.join(app.getPath('userData'), 'eklentiler'),
    indir: eklentiIndir,
    chromeSurumu: process.versions.chrome,
    dil: ceviriler.dil
  });
  eklentiler.kaldirildi = (k) => { if (store.veri.eklentiYasam) delete store.veri.eklentiYasam[k]; eklentiYasamBildirildi.delete(k); if (eklentiBaglam) eklentiBaglam.temizle(k); if (eklentiApi) eklentiApi.oturumTemizle(k); };
  fs.mkdirSync(eklentiler.dizin, { recursive: true });
  // Yarım kalmış kurulumların artıkları
  try {
    for (const d of fs.readdirSync(eklentiler.dizin)) {
      if (d.startsWith('.kur-')) fs.rmSync(path.join(eklentiler.dizin, d), { recursive: true, force: true });
    }
  } catch { /* dizin okunamadı */ }
  return eklentiler.baslat().catch((e) => console.error('Eklentiler yüklenemedi:', e.message));
}

function klasorMu(yol) {
  try { return fs.statSync(yol).isDirectory(); } catch { return false; }
}

// Aynı adlı dosya varsa "ad (1).uzanti" gibi bir ad seçer; var olanın üstüne yazmaz.
function benzersizYol(klasor, ad) {
  const { name, ext } = path.parse(ad);
  let aday = path.join(klasor, ad);
  for (let i = 1; fs.existsSync(aday) && i < 10000; i++) aday = path.join(klasor, name + ' (' + i + ')' + ext);
  return aday;
}

// Windows "Varsayılan uygulamalar" için tarayıcı kaydı (src/varsayilan-windows.js).
function tarayiciKaydiYaz() {
  const ico = path.join(__dirname, 'yapi-kaynaklari', 'icon.ico');
  return varsayilanWindows.kaydet({
    exe: process.execPath,
    uygulamaYolu: process.defaultApp ? app.getAppPath() : null,
    ikon: !app.isPackaged && fs.existsSync(ico) ? ico : null,
    aciklama: 'CVS Browser — gizlilik odaklı web tarayıcısı'
  });
}

function eklentiHataKutusu(mesaj, ayrinti) {
  return katmanOnay({ simge: 'uyari', baslik: mesaj, aciklama: ayrinti, tamamMetni: cev('eklenti.tamam') });
}

/**
 * Kurulum akışı: hazırla (indir/aç, YÜKLEME) -> kullanıcıya izinleriyle sor ->
 * onaylarsa yükle. Onaysız hiçbir eklenti çalışmaz.
 */
async function eklentiKur({ kimlik, dosya }) {
  if (!eklentiler || !win || win.isDestroyed()) return { basarili: false };
  if (eklentiKurAkisiAcik) return { basarili: false, hata: 'busy' };
  eklentiKurAkisiAcik = true;
  let hazir = null;
  try {
    try {
      hazir = kimlik ? await eklentiler.hazirlaMagaza(kimlik) : eklentiler.hazirlaDosya(dosya);
    } catch (e) {
      await eklentiHataKutusu(cev('eklenti.kurulamadi'), e.message);
      return { basarili: false, hata: e.message };
    }

    const fazla = (liste, n) => (liste.length > n ? [...liste.slice(0, n), '+' + (liste.length - n)] : liste);
    const onaylandi = await katmanOnay({
      simge: 'soru',
      baslik: cev('eklenti.kurSor', { ad: hazir.ad }),
      aciklama: hazir.aciklama ? hazir.aciklama.slice(0, 240) : '',
      bolumler: [
        { etiket: cev('eklenti.surum'), ogeler: [hazir.surum] },
        { etiket: cev('eklenti.izinler'), ogeler: hazir.izinler.length ? fazla(hazir.izinler, 14) : [cev('eklenti.izinYok')] },
        { etiket: cev('eklenti.siteler'), ogeler: fazla(hazir.siteler, 6), mono: true }
      ],
      tamamMetni: cev('eklenti.kur'),
      vazgecMetni: cev('eklenti.vazgec')
    });
    if (!onaylandi) {
      eklentiler.iptal(hazir);
      hazir = null;
      return { basarili: false, iptal: true };
    }
    try {
      const ad = hazir.ad;
      if (hazir.kimlik) eklentiYeniKurulacak.add(hazir.kimlik);
      const id = await eklentiler.tamamla(hazir, kimlik ? 'magaza' : (hazir.yerinde ? 'klasor' : 'crx'));
      hazir = null;
      durumGonder(true);
      return { basarili: true, id, ad };
    } catch (e) {
      eklentiler.iptal(hazir);
      hazir = null;
      await eklentiHataKutusu(cev('eklenti.kurulamadi'), e.message);
      return { basarili: false, hata: e.message };
    }
  } finally {
    if (hazir) eklentiler.iptal(hazir);
    eklentiKurAkisiAcik = false;
  }
}

async function eklentiKaldirOnayli(id) {
  const e = eklentiler && eklentiler.liste({ simge: false }).find((x) => x.id === id);
  if (!e) return false;
  const onaylandi = await katmanOnay({
    simge: 'uyari',
    tehlikeli: true,
    baslik: cev('eklenti.kaldirSor', { ad: e.ad }),
    aciklama: cev('eklenti.kaldirDetay'),
    tamamMetni: cev('eklenti.kaldir'),
    vazgecMetni: cev('eklenti.vazgec')
  });
  if (!onaylandi) return false;
  eklentiPopupKapat();
  await eklentiler.kaldir(id);
  durumGonder(true);
  return true;
}

function eklentiSekmesiAc(id, sayfa) {
  if (!EKLENTI_KIMLIK_RE.test(id) || !sayfa) return;
  sekmeOlustur({ url: EKLENTI_PREFIX + id + '/' + sayfa });
}

/* ---- araç çubuğu açılır penceresi (popup) ---- */

let eklentiPopup = null;   // { view, temizle }

function eklentiPopupKapat() {
  if (!eklentiPopup) return;
  const p = eklentiPopup;
  eklentiPopup = null;
  uiyeGonder('eklenti-popup', null);
  try { p.temizle(); } catch { /* dinleyici gitmiş olabilir */ }
  try { if (win && !win.isDestroyed()) win.contentView.removeChildView(p.view); } catch { /* ekli değildi */ }
  try { if (!p.view.webContents.isDestroyed()) p.view.webContents.close(); } catch { /* kapanmış */ }
}

// Açılır pencere içeriğinin boyutu: Chrome gibi belgenin içerik boyutu, en çok 800x600.
// Bu işlev eklenti sayfasında (sayfa dünyasında) çalıştırılır; document orada vardır.
/* global document */
function eklentiOlcumKodu() {
  const d = document.documentElement;
  const b = document.body;
  return {
    w: Math.max(d.scrollWidth, b ? b.scrollWidth : 0),
    h: Math.max(d.scrollHeight, b ? b.scrollHeight : 0)
  };
}

function eklentiPopupAc(id, konum) {
  eklentiPopupKapat();
  if (!eklentiler || !win || win.isDestroyed() || !EKLENTI_KIMLIK_RE.test(id)) return;
  const e = eklentiler.liste({ simge: false }).find((x) => x.id === id && x.etkin);
  if (!e) return;
  if (!e.popup) {
    // Açılır penceresi olmayan eklenti: seçenek sayfası varsa onu aç.
    if (e.secenekler) eklentiSekmesiAc(id, e.secenekler);
    return;
  }

  const view = new WebContentsView({
    webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  view.setBackgroundColor('#ffffff');
  const wc = view.webContents;
  wc.on('will-navigate', (ev, u) => { if (!u.startsWith(EKLENTI_PREFIX + id + '/')) ev.preventDefault(); });
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) sekmeOlustur({ url });
    return { action: 'deny' };
  });
  wc.on('before-input-event', (ev, giris) => {
    if (giris.type === 'keyDown' && giris.key === 'Escape') { ev.preventDefault(); eklentiPopupKapat(); }
  });

  let genislik = 320, yukseklik = 200;
  const yerlestir = () => {
    if (!win || win.isDestroyed()) return;
    const { width, height } = win.getContentBounds();
    const sag = Math.round((konum && Number(konum.sag)) || width - 8);
    const ust = Math.round((konum && Number(konum.y)) || 80);
    const x = Math.max(4, Math.min(width - genislik - 4, sag - genislik));
    view.setBounds({ x, y: ust, width: genislik, height: Math.min(yukseklik, Math.max(60, height - ust - 8)) });
  };
  yerlestir();
  win.contentView.addChildView(view);

  // Odak başka bir yere (sayfa ya da arayüz) geçince kapat.
  const hedefler = [win.webContents, ...[...sekmeler.values()].map((t) => t.view && t.view.webContents)]
    .filter((w) => w && !w.isDestroyed());
  const kapat = () => eklentiPopupKapat();
  for (const w of hedefler) w.once('focus', kapat);
  const yenidenBoyut = () => yerlestir();
  win.on('resize', yenidenBoyut);
  let olcum = null;
  uiyeGonder('eklenti-popup', id);
  eklentiPopup = {
    view,
    temizle() {
      clearInterval(olcum);
      for (const w of hedefler) { if (!w.isDestroyed()) w.removeListener('focus', kapat); }
      win.removeListener('resize', yenidenBoyut);
    }
  };

  const olc = async () => {
    if (wc.isDestroyed()) return;
    try {
      const o = await wc.executeJavaScript(`(${eklentiOlcumKodu})()`, true);
      const w = Math.max(100, Math.min(800, Math.ceil(o.w)));
      const h = Math.max(60, Math.min(600, Math.ceil(o.h)));
      if (w !== genislik || h !== yukseklik) { genislik = w; yukseklik = h; yerlestir(); }
    } catch { /* sayfa henüz hazır değil */ }
  };
  wc.on('did-finish-load', () => {
    olc();
    let n = 0;
    olcum = setInterval(() => { olc(); if (++n > 100) clearInterval(olcum); }, 300);
    if (!wc.isDestroyed()) wc.focus();
  });
  wc.loadURL(EKLENTI_PREFIX + id + '/' + e.popup).catch(() => eklentiPopupKapat());
}

// Tek bir eklentinin menüsü (araç çubuğu düğmesine sağ tık ve yapboz menüsü).
function eklentiOgeMenusu(e) {
  return [
    {
      label: cev('eklenti.ac'),
      enabled: e.etkin && !!(e.popup || e.secenekler),
      click: () => eklentiPopupAc(e.id, null)
    },
    {
      label: e.sabit ? cev('eklenti.sabitiKaldir') : cev('eklenti.sabitle'),
      click: () => { eklentiler.sabitle(e.id, !e.sabit); durumGonder(true); }
    },
    {
      label: cev('eklenti.secenekler'),
      enabled: e.etkin && !!e.secenekler,
      click: () => eklentiSekmesiAc(e.id, e.secenekler)
    },
    {
      label: e.etkin ? cev('eklenti.pasifYap') : cev('eklenti.etkinYap'),
      click: () => {
        eklentiler.etkinYap(e.id, !e.etkin)
          .catch((err) => eklentiHataKutusu(cev('eklenti.kurulamadi'), err.message))
          .finally(() => durumGonder(true));
      }
    },
    { type: 'separator' },
    { label: cev('eklenti.kaldir'), click: () => { eklentiKaldirOnayli(e.id).catch(() => {}); } }
  ];
}

function eklentiMenusuGoster(konum) {
  if (!win || win.isDestroyed() || !eklentiler) return;
  const sablon = [];
  const liste = eklentiler.liste();
  for (const e of liste) {
    let icon;
    if (e.simge) {
      try { icon = nativeImage.createFromDataURL(e.simge).resize({ width: 16, height: 16 }); } catch { /* simgesiz */ }
    }
    sablon.push({
      label: e.ad + (e.etkin ? '' : ' (' + cev('eklenti.pasif') + ')') + (e.sabit ? '  📌' : ''),
      ...(icon && !icon.isEmpty() ? { icon } : {}),
      submenu: eklentiOgeMenusu(e)
    });
  }
  if (!sablon.length) sablon.push({ label: cev('eklenti.yok'), enabled: false });
  sablon.push({ type: 'separator' });
  sablon.push({ label: cev('eklenti.yonet'), click: () => dahiliSayfaSekmesiAc('eklentiler') });
  sablon.push({ label: cev('eklenti.magaza'), click: () => sekmeOlustur({ url: 'https://chromewebstore.google.com/' }) });
  Menu.buildFromTemplate(sablon).popup({
    window: win,
    x: Math.round(Number(konum && (konum.sol != null ? konum.sol : konum.sag)) || 0),
    y: Math.round(Number(konum && konum.y) || 0)
  });
}

const EKLENTI_MAGAZA_ID = 'eklenti-magaza';

// Web Store sayfalarında "CVS Browser'a ekle" düğmesi (src/eklenti-magaza-onyukleme.js).
function eklentiMagazaOnyuklemeKur() {
  const yol = path.join(__dirname, 'src', 'eklenti-magaza-onyukleme.js');
  try {
    if (typeof ses.registerPreloadScript !== 'function') return;
    const kayitli = (ses.getPreloadScripts ? ses.getPreloadScripts() : []).some((p) => p.id === EKLENTI_MAGAZA_ID);
    if (!kayitli) ses.registerPreloadScript({ type: 'frame', id: EKLENTI_MAGAZA_ID, filePath: yol });
  } catch (e) {
    console.error('Eklenti mağaza düğmesi kurulamadı:', e.message);
  }
}

async function oturumKur() {
  ses = session.fromPartition(OTURUM);
  sesGizli = session.fromPartition(OTURUM_GIZLI, { cache: false });

  /*
   * ÇEREZ KASASI GERİ YÜKLEME. Sayfalar açılmadan ÖNCE olmalı; oturumKur()
   * bekleniyor ve pencere ondan sonra açılıyor (bkz. çağıran taraf).
   */
  try {
    const s = await cerezKasa.iceAktar({
      oturum: ses, safeStorage, veriDizini: app.getPath('userData'),
      // Kasa ana parolalıysa kullanıcıya sorulur; anahtar bellekte tutulur
      // (kapanışta yeniden şifrelemek için). Atlarsa kasa olduğu gibi kalır.
      anahtarSagla: async (kdf, dene) => {
        const sonuc = await anaParolaSor({ kip: 'sor', kdf, dene });
        anaParolaAnahtari = sonuc;             // { anahtar, tuz } - kapanışta gerekli
        return sonuc && sonuc.anahtar;
      }
    });
    if (s.vardi) console.log('Çerez kasası: ' + s.yuklenen + ' çerez geri yüklendi'
      + (s.atlanan ? ', ' + s.atlanan + ' atlandı (süresi geçmiş/geçersiz)' : '')
      + (s.atlandi ? ' (ana parola atlandı)' : ''));
  } catch (e) {
    console.error('Çerez kasası geri yüklenemedi:', e.message);
  }

  antiAdblockKur();
  kararlilikKur();
  parolaOneriKur();
  gecisAnahtariKur();
  eklentiMagazaOnyuklemeKur();
  await eklentiBaslat();

  /*
   * Sertifikayı yalnızca İZLİYORUZ: -3 "Chromium'un kendi doğrulama sonucunu
   * kullan" demek. 0 dönmek doğrulamayı atlamak olurdu.
   */
  const certHandler = (istek, geriCagir) => {
    sertifikalar.kaydet(istek.hostname, istek.certificate);
    geriCagir(-3);
  };
  ses.setCertificateVerifyProc(certHandler);
  sesGizli.setCertificateVerifyProc(certHandler);

  blocker = new Blocker(store);
  blocker.ipuclariniBagla(() => istemciIpuclari);
  blocker.bagla(ses, durumGonder);
  blocker.bagla(sesGizli, durumGonder);

  // Liste indirmeleri ayrı ve kalıcı olmayan bir oturumdan çıkar: çerez
  // saklamaz, gezinti oturumunun başlıklarını ve önbelleğini kirletmez.
  const indirmeOturumu = session.fromPartition('liste-indirme');
  listeler = new ListeYoneticisi({
    store,
    veriDizini: app.getPath('userData'),
    getir: async (url, basliklar) => {
      // vekilliFetch: VPN (kimlikli proxy) açıkken session.fetch 407 yiyordu,
      // listeler sessizce güncellenemiyordu.
      const y = await vekilliFetch(indirmeOturumu, url, {
        cache: 'no-cache',
        headers: { 'User-Agent': 'CVSBrowser/' + app.getVersion(), ...basliklar }
      }, vpnKimlik);
      const baslik = (ad) => { const v = y.headers[ad]; return Array.isArray(v) ? (v[0] || '') : (v || ''); };
      return {
        durum: y.status,
        metin: y.status === 200 ? await y.text() : '',
        etag: baslik('etag'),
        sonDegisiklik: baslik('last-modified')
      };
    },
    degisti: () => { durumGonder(); kozmetigiTazele(); antiAdblockKur(); blocker.uboyuKur(); }
  });
  blocker.listeleriBagla(listeler);

  faviconlar = new FaviconDeposu({
    veriDizini: app.getPath('userData'),
    oturum: ses,
    // Favicon gelince yer imi şeridinin simgesi de tazelensin: yer imleri
    // yalnızca değişince gönderildiği için bu bayrak olmadan simge güncellenmezdi.
    degisti: () => { _yerImiFaviconKirli = true; durumGonder(); }
  });
  faviconlar.protokoluBagla();

  guncelleme = new GuncellemeYoneticisi({
    app,
    oturum: indirmeOturumu,
    kimlikVer: vpnKimlik,   // VPN açıkken manifest + paket indirme proxy kimliğiyle gitsin (407 düzeltmesi)
    degisti: durumGonder,
    ayarOku: () => ({
      otomatikKontrol: store.ayarlar.guncellemeKontrol,
      otomatikIndir: store.ayarlar.guncellemeIndir,
      otomatikKur: store.ayarlar.guncellemeOtomatikKur,
      kanal: store.ayarlar.guncellemeKanali
    })
  });

  /*
   * Vekil, oturumlar kurulduktan hemen sonra. AWAIT EDILIYOR: fire-and-forget
   * birakilirsa "ilk istek cikmadan once" cumlesi yalnizca bir temenni olurdu.
   * oturumKur() cagiran taraf pencereyi bundan sonra aciyor.
   */
  await vekiliUygula();

  /*
   * Kayıtlı karar + genel varsayılandan tek bir cevap üretir. Hem istek
   * işleyicisi hem de senkron denetim işleyicisi bunu kullanıyor; ikisi ayrı
   * yazılırsa zamanla farklı cevap verirler.
   * Döner: 'izin' | 'ret' | 'sor'
   */
  /*
   * Electron 46 izin adi uretiyor, bizim tablomuzda 11 tanesi var. Cevirisi
   * olmayan tur icin cev() anahtarin KENDISINI donduruyordu; kullanici
   * kutuda "izin.window-management" yaziyordu.
   */
  function izinAdi(izin) {
    const anahtar = 'izin.' + izin;
    const metin = cev(anahtar);
    if (metin !== anahtar) return metin;

    // Özel eşleştirmeler ve varyantlar
    if (izin === 'clipboard-sanitized-write' || izin === 'clipboard-write') {
      const p = cev('izin.clipboard-sanitized-write');
      if (p !== 'izin.clipboard-sanitized-write') return p;
    }

    // Bilinmeyen izinler için teknik adı insani okunabilir hale getir
    const temizAd = String(izin || '')
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase();
    return cev('izin.bilinmeyen', { ad: temizAd });
  }

  function izinKarari(origin, izin) {
    const kayitli = store.izinOku(origin, izin);
    if (kayitli) return kayitli;
    return (store.ayarlar.izinVarsayilan || {})[izin] || 'sor';
  }

  /*
   * Origin anahtarini tek bicime indirger. Chromium, setPermissionCheckHandler'a
   * origin'i sondaki '/' ile veriyor ("https://site/"), URL.origin ise slashsiz
   * uretiyor ("https://site"). Ikisi ayni anahtar sayilmazsa denetim kapisi
   * KAYITLI HICBIR karari goremez: izin verilmis siteye "reddedildi",
   * engellenmis siteye genel varsayilan uygulanir. Olculerek bulundu.
   */
  function originNormalle(deger) {
    try {
      const u = new URL(String(deger));
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.origin;
    } catch { return null; }
  }

  function istekOrigini(wc, ayrinti) {
    try {
      const u = new URL((ayrinti && ayrinti.requestingUrl) || wc.getURL());
      // data:, blob:, about: gibi opak kaynaklar origin olarak "null" döndürür.
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.origin;
    } catch { return null; }
  }

  /*
   * Senkron izin DENETİMİ. navigator.permissions.query(), medya aygıtı
   * sıralaması gibi yerler buradan geçiyor ve bu kapı bugüne kadar hiç
   * bağlanmamıştı: Electron'un varsayılanı her şeye TRUE döner, yani site
   * "izinliyim" cevabını alıp gerçek istek reddedilene kadar öyle davranıyordu.
   *
   * Sınırı olduğu gibi yazalım: bu işleyici SENKRON ve boolean döner, yani
   * kullanıcıya soramaz. 'sor' durumunda "henüz verilmedi" anlamında false
   * dönüyoruz; bunun bedeli permissions.query()'nin 'prompt' yerine 'denied'
   * demesi. Alternatifi (true dönmek) siteye yalan söylemek olurdu.
   */
  const checkHandler = (wc, izin, kaynakOrigin, ayrinti) => {
    // Eklenti sayfasının, kendisine açılmış tek kullanımlık sekme yakalama onayı.
    if ((izin === 'display-capture' || izin === 'media') && ekranYakalaOnayli((ayrinti && ayrinti.requestingUrl) || kaynakOrigin)) return true;
    const origin = originNormalle(kaynakOrigin) || istekOrigini(wc || {}, ayrinti);
    if (!origin) return false;
    return izinKarari(origin, izin) === 'izin';
  };
  ses.setPermissionCheckHandler(checkHandler);
  sesGizli.setPermissionCheckHandler(checkHandler);

  ses.setDevicePermissionHandler(() => false);
  sesGizli.setDevicePermissionHandler(() => false);

  // Ekran/pencere paylaşımı her zaman reddedilir; tek istisna, etkin sekme sesini isteyen eklenti
  // sayfasının (chrome.tabCapture) tek kullanımlık onayıdır: o sayfaya yalnızca etkin sekmenin
  // çerçevesi verilir (görüntü + ses; ses yakalanırken sekmenin kendi çıkışı susar).
  const displayHandler = (istek, callback) => {
    try {
      const kimlik = istek.frame ? eklentiKimligiAdresten(istek.frame.url) : null;
      const b = kimlik && ekranYakalaBekleyen.get(kimlik);
      if (b) {
        ekranYakalaBekleyen.delete(kimlik);
        const t = sekmeler.get(b.tabId);
        if (Date.now() < b.bitis && t && !t.view.webContents.isDestroyed()) {
          const f = t.view.webContents.mainFrame;
          return callback({ video: f, audio: f });
        }
      }
    } catch { /* reddet */ }
    callback();
  };
  ses.setDisplayMediaRequestHandler(displayHandler);
  sesGizli.setDisplayMediaRequestHandler((_istek, callback) => { callback(); });

  const requestHandler = async (wc, izin, callback, ayrinti) => {
    // Eklenti sayfasının tek kullanımlık sekme yakalama onayı (aktif sekme kuralından önce).
    if ((izin === 'display-capture' || izin === 'media') && ekranYakalaOnayli(ayrinti && ayrinti.requestingUrl)) return callback(true);
    // Yalnızca kullanıcının o an baktığı sekme izin isteyebilir; arka plandaki
    // bir sekme, öndeki siteye aitmiş gibi görünen bir kutu açamasın.
    const s = aktifSekme();
    if (!s || s.view.webContents.isDestroyed() || s.view.webContents.id !== wc.id) return callback(false);

    const origin = istekOrigini(wc, ayrinti);
    if (!origin) return callback(false);

    // Karar senkron denetim kapısıyla ORTAK: ikisi ayrı yazılırsa zamanla
    // farklı cevap verir ve site "izinliyim" deyip reddedilir.
    const karar = izinKarari(origin, izin);
    if (karar !== 'sor') return callback(karar === 'izin');

    // 3) Kullanıcıya sor
    if (izinOnayAcik) return callback(false);
    izinOnayAcik = true;
    try {
      // Yerel işletim sistemi kutusu yerine sayfanın üstündeki katman: tema
      // uyumlu, adres çubuğunun altına yaslanıyor, pencereyi kilitlemiyor.
      // Kutu kapatılırsa (Escape ya da dışarı tıklama) karar RET olur.
      const karar = await new Promise((coz) => {
        katmanIzinKarari = coz;
        katmanGoster({
          tur: 'izin',
          yon: 'sol',
          ust: (arayuzOlculeri.kilitAlt || chromeYukseklik) + 2,
          kenar: Math.max(6, Math.round(arayuzOlculeri.kilitSol || 8)),
          genislik: 340,
          baslik: cev('dialog.izinBaslik'),
          kaynak: origin,
          istiyor: cev('dialog.izinIstiyor'),
          ne: izinAdi(izin),
          hatirlaMetni: cev('dialog.izinHatirla'),
          reddetMetni: cev('dialog.reddet'),
          izinMetni: cev('dialog.izinVer')
        });
      });
      if (karar.hatirla) store.izinKaydet(origin, izin, karar.izinVer ? 'izin' : 'ret');
      callback(karar.izinVer);
    } finally {
      izinOnayAcik = false;
    }
  };
  ses.setPermissionRequestHandler(requestHandler);
  sesGizli.setPermissionRequestHandler(requestHandler);

  ses.on('will-download', (_e, item) => {
    const ad = indirmeAdiNormalle(item.getFilename());
    // Bir eklentinin chrome.downloads.download çağrısıyla mı başladı? (adres eşleşmesiyle)
    const zincir = item.getURLChain();
    const bi = eklentiIndirmeBekleyen.findIndex((b) => b.url === item.getURL() || zincir.includes(b.url));
    const bekleyen = bi >= 0 ? eklentiIndirmeBekleyen.splice(bi, 1)[0] : null;

    // Klasör ayarlıysa kaydetme penceresi çıkmadan oraya kaydedilir (saveAs isteyen eklenti hariç).
    const hedefKlasor = store.ayarlar.indirmeKlasoru;
    if (!(bekleyen && bekleyen.saveAs) && hedefKlasor && klasorMu(hedefKlasor)) item.setSavePath(benzersizYol(hedefKlasor, ad));
    if (bekleyen) {
      clearTimeout(bekleyen.zamanAsimi);
      // Kaydetme penceresi çıkmasın (Chrome'da da çıkmaz): ayarlı klasöre ya da İndirilenler'e.
      const kok = hedefKlasor && klasorMu(hedefKlasor) ? hedefKlasor : app.getPath('downloads');
      const goreli = bekleyen.filename ? guvenliDosyaAdi(bekleyen.filename) : null;
      let hedef = path.join(kok, goreli || ad);
      const kokYol = path.resolve(kok);
      if (path.resolve(hedef) !== kokYol && !path.resolve(hedef).startsWith(kokYol + path.sep)) hedef = path.join(kok, ad);
      try { fs.mkdirSync(path.dirname(hedef), { recursive: true }); } catch { /* klasör açılamadı */ }
      if (bekleyen.conflictAction !== 'overwrite') hedef = benzersizYol(path.dirname(hedef), path.basename(hedef));
      // saveAs: true -> Chrome'daki gibi "Farklı kaydet" penceresi, önerilen yolla açılır.
      if (bekleyen.saveAs) item.setSaveDialogOptions({ defaultPath: hedef });
      else item.setSavePath(hedef);
    }
    const kayit = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      ad,
      calistirilabilir: calistirilabilirMi(ad),
      url: item.getURL(),
      zaman: Date.now(),
      toplam: item.getTotalBytes(),
      alinan: 0,
      durum: 'devam',
      hiz: 0,
      duraklatildi: false,
      yol: ''
    };
    indirmeler.unshift(kayit);
    durumGonder();
    const no = indirmeNo(kayit);
    indirmeNesneleri.set(no, item);
    if (bekleyen) bekleyen.coz(no);
    indirmeOlayiYayinla('onCreated', indirmeOgesi(kayit));

    // Hız: son ölçümden bu yana alınan bayt, üstel yumuşatmayla (ani dalgalanma olmasın).
    let sonOlcumZamani = Date.now();
    let sonOlcumBayt = 0;
    let sonYayin = 0;
    item.on('updated', (_ev, durum) => {
      const simdi = Date.now();
      kayit.alinan = item.getReceivedBytes();
      kayit.durum = durum === 'interrupted' ? 'kesildi' : 'devam';
      kayit.duraklatildi = kayit.durum === 'devam' && item.isPaused();
      kayit.toplam = item.getTotalBytes();
      const dt = (simdi - sonOlcumZamani) / 1000;
      if (kayit.duraklatildi || kayit.durum === 'kesildi') {
        kayit.hiz = 0;
        sonOlcumZamani = simdi; sonOlcumBayt = kayit.alinan;
      } else if (dt >= 0.5) {
        const anlik = Math.max(0, (kayit.alinan - sonOlcumBayt) / dt);
        kayit.hiz = kayit.hiz > 0 ? kayit.hiz * 0.6 + anlik * 0.4 : anlik;
        sonOlcumZamani = simdi; sonOlcumBayt = kayit.alinan;
      }
      // Güncelleme olayı çok sık gelebilir; arayüze en çok ~2 kez/sn gönderilir.
      if (simdi - sonYayin >= 500) { sonYayin = simdi; durumGonder(); indirmeKatmaniniYenile(); }
    });
    item.once('done', (_ev, durum) => {
      kayit.hiz = 0;
      kayit.duraklatildi = false;
      kayit.durum = durum === 'completed' ? 'tamam' : (durum === 'cancelled' ? 'iptal' : 'hata');
      kayit.yol = item.getSavePath();
      // Kullanıcı kaydetme kutusunda adı değiştirmiş olabilir; kararı diskteki
      // gerçek ada göre yeniden veriyoruz.
      if (kayit.yol) kayit.calistirilabilir = calistirilabilirMi(path.basename(kayit.yol));
      kayit.bitis = Date.now();
      indirmeNesneleri.delete(no);
      indirmeleriKaydet();
      durumGonder();
      indirmeKatmaniniYenile();
      const yeni = indirmeOgesi(kayit);
      indirmeOlayiYayinla('onChanged', {
        id: no,
        state: { previous: 'in_progress', current: yeni.state },
        endTime: { current: yeni.endTime },
        ...(yeni.error ? { error: { current: yeni.error } } : {})
      });
    });
  });
}

/* ---------------------------------------------------------------- */
/* Pencere                                                           */
/* ---------------------------------------------------------------- */

/*
 * Tema ayari nativeTheme.themeSource'a aktariliyor. Bunun bir yan etkisi var
 * ve tam da istedigimiz sey: Chromium butun renderer'larda prefers-color-scheme
 * degerini buna gore bildiriyor. Yani arayuz, yeni sekme/gecmis gibi ic
 * sayfalar ve yerel menuler tek yerden donuyor; ayri bir CSS anahtari
 * tasimamiza gerek kalmiyor.
 */
function temayiUygula() {
  const t = argvTema || store.ayarlar.tema;
  nativeTheme.themeSource = t === 'acik' ? 'light' : t === 'koyu' ? 'dark' : 'system';
}

function baslikCubuguRengi() {
  if (GIZLI_PENCERE) {
    return {
      color: '#0d0f14',
      symbolColor: '#c084fc',
      height: 38
    };
  }
  const koyu = nativeTheme.shouldUseDarkColors;
  return {
    color: koyu ? '#16181d' : '#eef0f4',
    symbolColor: koyu ? '#e8eaee' : '#3a3f4b',
    height: 38   // #baslik ile aynı (sekme üstündeki boşluk 7px -> 3px)
  };
}

function pencereOlustur() {
  const koyu = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 560,
    minHeight: 380,
    backgroundColor: GIZLI_PENCERE ? '#0d0f14' : (koyu ? '#16181d' : '#eef0f4'),
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : baslikCubuguRengi(),
    trafficLightPosition: { x: 12, y: 13 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Preload yalnızca contextBridge/ipcRenderer kullanıyor, sandbox'la
      // çalışır. Ayrıcalıklı olan tek pencere bu olduğu için önemli:
      // favicon'lar burada çözülüyor.
      sandbox: true,
      // Favicon istekleri de engelleyiciden ve DNT başlıklarından geçsin,
      // çerezleri sekmelerle aynı kavanoza yazılsın.
      session: ses
    }
  });

  win.loadFile(path.join(UI_DIR, 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('resize', yerlesimGuncelle);
  win.on('enter-full-screen', yerlesimGuncelle);
  win.on('leave-full-screen', () => {
    /*
     * Kullanıcı OS tam ekrandan (ESC ya da pencere düğmesi) çıktıysa ama aktif
     * sayfa hâlâ HTML tam ekrandaysa, sayfayı da çıkar - yoksa video oynatıcı
     * "tam ekran" sanmaya devam eder ve araç çubuğu üstüne binmiş görünür.
     * leave-html-full-screen yoluyla gelindiyse tamEkran zaten false, döngü yok.
     */
    const a = aktifSekme();
    if (a && a.tamEkran && !a.view.webContents.isDestroyed()) {
      a.view.webContents.executeJavaScript(
        'document.exitFullscreen && document.exitFullscreen()', true
      ).catch(() => { /* zaten çıkmış olabilir */ });
    }
    yerlesimGuncelle();
  });
  win.on('closed', () => {
    // Sekmeler pencereyle birlikte yok edilmezse renderer süreçleri ayakta kalır.
    for (const t of sekmeler.values()) {
      try { if (!t.view.webContents.isDestroyed()) t.view.webContents.close(); } catch { /* zaten kapanmış */ }
    }
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
      try { yanPanelGorunum.webContents.close(); } catch {}
      yanPanelGorunum = null;
    }
    win = null;
    sekmeler.clear();
    aktifId = null;
  });

  win.webContents.on('did-finish-load', () => {
    ipucuBasliklariniOku(win.webContents);
    if (sekmeler.size === 0) {
      const baslangic = !GIZLI_PENCERE && Array.isArray(store.ayarlar.baslangicSekmeleri) && store.ayarlar.baslangicSekmeleri.map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean);
      if (baslangic && baslangic.length > 0) {
        let ilk = true;
        for (const url of baslangic) {
          sekmeOlustur({ url: resolveInput(url, store.ayarlar.aramaMotoru), arkaPlan: !ilk });
          ilk = false;
        }
      } else if (!GIZLI_PENCERE && store.ayarlar.anasayfa && typeof store.ayarlar.anasayfa === 'string' && store.ayarlar.anasayfa.trim()) {
        sekmeOlustur({ url: resolveInput(store.ayarlar.anasayfa.trim(), store.ayarlar.aramaMotoru) });
      } else {
        sekmeOlustur({});
      }
    } else {
      yerlesimGuncelle();
      durumGonder();
    }
    setTimeout(() => { yenilikleriGoster(ilkKurulumMu).catch(() => {}); }, 1500);
  });

  // Arayüz penceresinin kendisi hiçbir yere gezinmesin.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) sekmeOlustur({ url });
    return { action: 'deny' };
  });

  return win;
}

/* ---------------------------------------------------------------- */
/* IPC                                                               */
/* ---------------------------------------------------------------- */

// Ayar anahtarları ve kabul edilen değer tipleri. Doğrulamasız yazmak
// "__proto__" gibi anahtarların ayar nesnesine geçmesine izin verirdi.
const GECERLI_DILLER = new Set(['sistem', ...dilListesi().map(d => d.kod)]);

const AYAR_DOGRULAMA = {
  dil: (v) => typeof v === 'string' && GECERLI_DILLER.has(v),
  tema: (v) => v === 'sistem' || v === 'acik' || v === 'koyu',
  aramaMotoru: (v) => typeof v === 'string' && Object.hasOwn(SEARCH_ENGINES, v),
  gizliAramaMotoru: (v) => typeof v === 'string' && Object.hasOwn(SEARCH_ENGINES, v),
  anasayfa: (v) => typeof v === 'string' && v.length <= 2048,
  baslangicSekmeleri: (v) => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length <= 2048),
  engelleyiciAcik: (v) => typeof v === 'boolean',
  uboMotorAcik: (v) => typeof v === 'boolean',
  dntGonder: (v) => typeof v === 'boolean',
  ucuncuTarafCerez: (v) => typeof v === 'boolean',
  kapanistaCerezSil: (v) => typeof v === 'boolean',
  indirmeKlasoru: (v) => typeof v === 'string' && v.length <= 1024
    && (v === '' || (path.isAbsolute(v) && klasorMu(v))),
  httpsZorla: (v) => typeof v === 'boolean',
  anaParolaAcik: (v) => typeof v === 'boolean',
  gecisAnahtariTarayici: (v) => typeof v === 'boolean',
  vekilKip: (v) => v === 'kapali' || v === 'sistem' || v === 'elle',
  // Bos adres kabul ediliyor: kullanici once kutuyu doldurup sonra kipi
  // degistirmek isteyebilir. Bos adresle "elle" kipi zaten istekleri kesiyor.
  vekilAdres: (v) => typeof v === 'string' && v.length <= 300 && (v === '' || adresGecerliMi(v)),
  // Tek bir "*" butun vekili sessizce kapatiyordu; girdiler dogrulaniyor.
  vekilAtla: (v) => typeof v === 'string' && v.length <= 1000 && atlamaGecerliMi(v),
  vpnAcik: (v) => typeof v === 'boolean',
  vpnLokasyon: (v) => vpnLokasyonGecerliMi(v),
  cihazToken: (v) => typeof v === 'string' && v.length <= 256,
  dpiMod: (v) => v === 'kapali' || v === 'dahili' || v === 'ciadpi',
  dpiSozlesmeKabul: (v) => typeof v === 'boolean',
  dpiStrateji: (v) => v === 'split-1' || v === 'split-2' || v === 'split-sni' || v === 'fake-split',
  gecmisiKaydet: (v) => typeof v === 'boolean',
  yerImleriCubugu: (v) => typeof v === 'boolean',
  varsayilanOneriGizle: (v) => typeof v === 'boolean',
  filtreListeleriAcik: (v) => typeof v === 'boolean',
  otomatikGuncelle: (v) => typeof v === 'boolean',
  guncellemeKontrol: (v) => typeof v === 'boolean',
  guncellemeIndir: (v) => typeof v === 'boolean',
  guncellemeOtomatikKur: (v) => typeof v === 'boolean',
  guncellemeKanali: (v) => v === 'kararli' || v === 'beta',
  bayraklar: (v) => bayraklar.gecerliMi(v),
  guvenliDns: (v) => typeof v === 'boolean',
  dnsSaglayici: (v) => guvenliDns.saglayiciGecerliMi(v),
  // Bos kabul: kullanici once kipi secip sonra adresi yazabilir.
  dnsOzel: (v) => typeof v === 'string' && (v === '' || guvenliDns.ozelUrlGecerliMi(v))
};

const DIS_SEMA_GIRDISI = /^(mailto|tel|sms|magnet|ftp|ftps|webcal):/i;
const TEMIZLENECEK = ['cookies', 'localstorage', 'indexdb', 'cachestorage', 'serviceworkers'];

function ipcKur() {
  const wcAl = () => {
    const s = aktifSekme();
    return s && !s.view.webContents.isDestroyed() ? s.view.webContents : null;
  };

  // Bugün preload yalnızca arayüz penceresine bağlı; yine de her kanalın
  // yalnızca oradan çağrılabildiğini burada sabitliyoruz.
  const arayuzden = (e) =>
    !!win && !win.isDestroyed() && !!e.senderFrame && e.senderFrame === win.webContents.mainFrame;
  const on = (kanal, fn) => ipcMain.on(kanal, (e, ...a) => { if (arayuzden(e)) fn(e, ...a); });
  const handle = (kanal, fn) => ipcMain.handle(kanal, (e, ...a) => (arayuzden(e) ? fn(e, ...a) : null));

  /*
   * Katman ayrı bir WebContentsView, yani mesajları arayüz penceresinin ana
   * çerçevesinden GELMİYOR. arayuzden() ile kontrol edilirse hepsi sessizce
   * düşer; kutunun boş kalmasının sebebi buydu. Kontrolü gevşetmek yerine
   * katmanın kendi çerçevesini tanıyan ikinci bir kapı açıyoruz.
   */
  const katmandan = (e) =>
    !!katmanGorunum && !katmanGorunum.webContents.isDestroyed()
    && !!e.senderFrame && e.senderFrame === katmanGorunum.webContents.mainFrame;
  const katmanOn = (kanal, fn) => ipcMain.on(kanal, (e, ...a) => { if (katmandan(e)) fn(e, ...a); });
  const katmanHandle = (kanal, fn) => ipcMain.handle(kanal, (e, ...a) => (katmandan(e) ? fn(e, ...a) : null));

  /*
   * SCRIPTLET EŞLEŞTİRME (SENKRON). Sekme preload'ı her gezinmede bu host'un
   * scriptlet'lerini istiyor. Mesaj SEKME renderer'ından gelir (arayüzden değil),
   * o yüzden 'on' sarmalayıcısı DEĞİL ham ipcMain.on kullanılıyor. returnValue
   * HER durumda set edilmeli: aksi halde sendSync sonsuza dek asılır = donma.
   * Yük küçük (yalnız eşleşen kurallar); sözdizimi güvenli (sadece dizi/dizge).
   */
  ipcMain.on('betik:coz', (e, host) => {
    try { e.returnValue = betikEslesenler(String(host || '')); }
    catch (_) { e.returnValue = []; }
  });

  /*
   * PAROLA ÖNERİSİ. Sekme sayfasındaki preload (src/parola-onyukleme.js) bir
   * alana tıklanınca konumu bildirir; burada o çerçevenin adresine uyan kayıtlar
   * yerel bir menüyle listelenir (sayfa görünümü üstte olduğu için HTML açılır
   * kutu kullanılamıyor). Sayfaya yalnızca SEÇİLEN kaydın değerleri gönderilir.
   * Kanal sekme renderer'ından gelir; gönderen bilinen bir sekme değilse düşer.
   */
  const parolaHostu = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
  const parolaEslesir = (kayitOrigin, sayfaUrl) => {
    try {
      const k = new URL(kayitOrigin);
      const s = new URL(sayfaUrl);
      if (s.protocol !== 'https:' && s.protocol !== 'http:') return false;
      if (k.protocol === 'https:' && s.protocol !== 'https:') return false;
      const kh = parolaHostu(k.hostname);
      const sh = parolaHostu(s.hostname);
      return kh === sh || sh.endsWith('.' + kh);
    } catch { return false; }
  };

  ipcMain.on('parola:oneri-iste', (e, o) => {
    try {
      if (!win || win.isDestroyed() || !o || e.senderFrame !== e.sender.mainFrame) return;
      const sekme = [...sekmeler.values()].find((t) => t.view.webContents === e.sender);
      if (!sekme || sekme.dahiliPanel) return;
      const frame = e.senderFrame;
      const url = frame.url;
      const liste = store.parolaListesi()
        .filter((k) => k.parola && parolaEslesir(k.origin, url));
      if (!liste.length) return;

      const alan = o.alan === 'parola' ? 'parola' : 'kullanici';
      const gorulen = new Set();
      const ogeler = [];
      for (const k of liste) {
        const anahtar = k.kullaniciAdi + '\n' + k.parola;
        if (gorulen.has(anahtar)) continue;
        gorulen.add(anahtar);
        let host = '';
        try { host = new URL(k.origin).hostname; } catch { /* etiketsiz */ }
        ogeler.push({
          label: (k.kullaniciAdi || host || '—') + (host && k.kullaniciAdi ? '  (' + host + ')' : ''),
          click: () => {
            if (frame.isDestroyed?.() || e.sender.isDestroyed()) return;
            frame.send('parola:doldur', { kullaniciAdi: k.kullaniciAdi, parola: k.parola, alan });
          }
        });
      }
      ogeler.push({ type: 'separator' });
      ogeler.push({ label: cev('menu.parolalar'), click: () => dahiliSayfaSekmesiAc('parolalar') });

      const b = sekme.view.getBounds();
      const z = e.sender.getZoomFactor();
      const x = Math.round(b.x + Number(o.x) * z);
      const y = Math.round(b.y + Number(o.y) * z);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      Menu.buildFromTemplate(ogeler).popup({ window: win, x, y });
    } catch (err) {
      console.error('Parola önerisi gösterilemedi:', err.message);
    }
  });

  ipcMain.on('kozmetik:proc', (e, host) => {
    try { e.returnValue = prosedurelEslesenler(String(host || '')); }
    catch (_) { e.returnValue = []; }
  });

  // Arayüz (yeniden) bağlanınca değişmeyen veriyi de yolla: çeviri/dil/motor/izin.
  on('ui:hazir', () => durumGonder(true));

  on('ui:yukseklik', (_e, px) => {
    if (!Number.isFinite(px)) return;
    const yeni = Math.max(40, Math.min(2000, Math.round(px)));
    if (yeni !== chromeYukseklik) { chromeYukseklik = yeni; yerlesimGuncelle(); }
  });

  // Arayüz, çapa noktalarını chrome yeniden boyutlanınca bildiriyor.
  on('ui:olcu', (_e, o) => {
    if (!o || typeof o !== 'object') return;
    const sayi = (v) => (Number.isFinite(v) ? Math.round(v) : null);
    arayuzOlculeri = { kilitSol: sayi(o.kilitSol), kilitAlt: sayi(o.kilitAlt) };
  });

  on('ui:panel', (_e, acik) => {
    panelAcik = !!acik;
    const s = aktifSekme();
    if (s && !s.view.webContents.isDestroyed()) s.view.setVisible(!panelAcik);
    // Panel açılırken odak arayüzde kalmalı, yoksa panelde yazılamaz.
    if (panelAcik && win && !win.isDestroyed()) win.webContents.focus();
    yerlesimGuncelle();
  });

  on('sekme:yeni', (_e, url) => sekmeOlustur({ url: url || undefined }));
  on('sekme:yeni-gizli', () => sekmeOlustur({ gizli: true }));
  on('dahili-sayfa:ac', (_e, sayfa) => dahiliSayfaSekmesiAc(sayfa));
  on('pencere:yeni', () => yeniPencereAc());
  on('pencere:yeni-gizli', () => yeniGizliPencereAc());
  on('sekme:kapat', (_e, id, orta) => {
    if (orta === true && sekmeler.size <= 1 && win && !win.isDestroyed()) { win.close(); return; }
    sekmeKapat(id);
  });
  on('sekme:sec', (_e, id) => sekmeSec(id));

  /*
   * SEKME SIRALAMA (sürükleyerek taşıma). Sıra, sekmeler Map'inin ekleme
   * sırasıdır; arayüz yeni sırayı id listesi olarak bildiriyor.
   *
   * Gelen liste DOĞRULANIYOR: yalnız var olan id'ler, tekrarsız ve TAM sayıda
   * olmalı. Eksik/fazla listeyle Map'i yeniden kurmak sekme kaybettirirdi -
   * arayüz ile ana süreç bir an için ayrışırsa (yeni sekme tam o anda açıldı)
   * bu kolayca olur, o yüzden sessizce yok sayıyoruz.
   */
  on('sekme:sirala', (_e, sira) => {
    if (!Array.isArray(sira) || sira.length !== sekmeler.size) return;
    const gorulen = new Set();
    for (const id of sira) {
      if (!sekmeler.has(id) || gorulen.has(id)) return;
      gorulen.add(id);
    }
    const yeni = sira.map((id) => [id, sekmeler.get(id)]);
    sekmeler.clear();
    for (const [id, t] of yeni) sekmeler.set(id, t);
    durumGonder();
  });

  on('gez:git', (_e, girdi) => {
    const dahili = dahiliUrlPanel(girdi);
    if (dahili) {
      if (dahili === 'yenisekme') {
        const a = aktifSekme();
        if (a) {
          a.url = '';
          a.dahiliPanel = null;
          a.baslik = cev(a.gizli ? 'arac.gizli' : 'arac.yeniSekmeBaslik');
          if (!a.view.webContents.isDestroyed()) a.view.webContents.loadURL(yeniSekmeAdresi(a.gizli));
          uiyeGonder('panel-kapat');
          durumGonder();
        }
      } else {
        dahiliSayfaSekmesiAc(dahili);
      }
      return;
    }
    const hedef = resolveInput(girdi, motorAnahtari(!!aktifSekme()?.gizli));
    if (!hedef) return;
    const dahiliHedef = dahiliUrlPanel(hedef);
    if (dahiliHedef) {
      if (dahiliHedef === 'yenisekme') {
        const a = aktifSekme();
        if (a) {
          a.url = '';
          a.dahiliPanel = null;
          a.baslik = cev(a.gizli ? 'arac.gizli' : 'arac.yeniSekmeBaslik');
          if (!a.view.webContents.isDestroyed()) a.view.webContents.loadURL(yeniSekmeAdresi(a.gizli));
          uiyeGonder('panel-kapat');
          durumGonder();
        }
      } else {
        dahiliSayfaSekmesiAc(dahiliHedef);
      }
      return;
    }
    // mailto: gibi girdiler sekmede yüklenemez; harici uygulama akışına gitsin.
    if (DIS_SEMA_GIRDISI.test(hedef)) return disHarici(hedef);
    const a = aktifSekme();
    if (a && a.dahiliPanel) {
      a.dahiliPanel = null;
      uiyeGonder('panel-kapat');
    }
    const c = wcAl();
    if (c) c.loadURL(hedef); else sekmeOlustur({ url: hedef });
  });
  on('gez:geri', () => { const c = wcAl(); if (c) c.navigationHistory.goBack(); });
  on('gez:ileri', () => { const c = wcAl(); if (c) c.navigationHistory.goForward(); });
  on('gez:yenile', () => { const c = wcAl(); if (c) c.reload(); });
  on('gez:dur', () => { const c = wcAl(); if (c) c.stop(); });
  on('yan-panel:ac', (_e, id) => yanPanelAc(id));
  on('yan-panel:kapat', () => yanPanelKapat());
  on('yan-cubuk:gecis', () => {
    if (!store) return;
    store.ayarlar.yanCubukGoster = !store.ayarlar.yanCubukGoster;
    store.kaydet();
    yerlesimGuncelle();
    durumGonder();
  });
  on('yan-panel:geri', () => {
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed() && yanPanelGorunum.webContents.navigationHistory.canGoBack()) {
      yanPanelGorunum.webContents.navigationHistory.goBack();
    }
  });
  on('yan-panel:ileri', () => {
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed() && yanPanelGorunum.webContents.navigationHistory.canGoForward()) {
      yanPanelGorunum.webContents.navigationHistory.goForward();
    }
  });
  on('yan-panel:yenile', () => {
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
      yanPanelGorunum.webContents.reload();
    }
  });
  on('yan-panel:anasayfa', () => {
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
      const p = (store.ayarlar.yanPaneller || []).find((x) => x.id === store.ayarlar.yanPanelAktif);
      if (p && p.url) yanPanelGorunum.webContents.loadURL(p.varsayilanUrl || p.url);
    }
  });
  on('yan-panel:mobil-gecis', () => {
    if (!store) return;
    store.ayarlar.yanPanelMobil = !store.ayarlar.yanPanelMobil;
    store.kaydet();
    yanPanelMobilAyarla(store.ayarlar.yanPanelMobil);
    durumGonder();
  });
  on('yan-panel:sekmede-ac', () => {
    if (yanPanelGorunum && !yanPanelGorunum.webContents.isDestroyed()) {
      const u = yanPanelGorunum.webContents.getURL();
      if (u && sayfadanGezilebilir(u)) sekmeOlustur(u, false);
    }
  });
  on('yan-panel:genislik', (_e, px) => {
    if (!store) return;
    const g = Math.max(260, Math.min(800, Math.round(px) || 380));
    store.ayarlar.yanPanelGenislik = g;
    store.kaydet();
    yerlesimGuncelle();
  });
  handle('yan-panel:ekle', (_e, veri) => {
    if (!store || !veri || !veri.url) return null;
    let url = String(veri.url).trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const id = 'ozel_' + Date.now();
    const ad = (veri.ad || '').trim() || hostAl(url) || 'Web Paneli';
    const yeni = { id, ad, url, varsayilanUrl: url, ozel: true, ikon: 'kure' };
    if (!Array.isArray(store.ayarlar.yanPaneller)) store.ayarlar.yanPaneller = [];
    store.ayarlar.yanPaneller.push(yeni);
    store.kaydet();
    yanPanelAc(id);
    return yeni;
  });
  handle('yan-panel:sil', (_e, id) => {
    if (!store || !id || !Array.isArray(store.ayarlar.yanPaneller)) return false;
    store.ayarlar.yanPaneller = store.ayarlar.yanPaneller.filter((p) => p.id !== id);
    if (store.ayarlar.yanPanelAktif === id) {
      yanPanelKapat();
    }
    store.kaydet();
    durumGonder();
    return true;
  });
  on('gez:anasayfa', () => {
    const c = wcAl();
    if (!c) return;
    const a = store.ayarlar.anasayfa;
    c.loadURL(a ? resolveInput(a, motorAnahtari(!!aktifSekme()?.gizli)) : yeniSekmeAdresi(!!aktifSekme()?.gizli));
  });

  on('bul:ara', (_e, { metin, ileri = true, sonraki = false } = {}) => {
    const c = wcAl();
    if (!c) return;
    if (!metin) return c.stopFindInPage('clearSelection');
    c.findInPage(String(metin), { forward: !!ileri, findNext: !!sonraki });
  });
  on('bul:kapat', () => { const c = wcAl(); if (c) c.stopFindInPage('clearSelection'); });

  on('yakinlastir', (_e, yon) => yakinlastir(yon, yon === 0));

  // İndirmeler kimlikle adreslenir: arayüzden gelen ham bir dosya yolu
  // hiçbir zaman açılmaz.
  const indirmeBul = (id) => indirmeler.find(k => k.id === id && k.durum === 'tamam' && k.yol);

  on('indirme:klasor', (_e, id) => {
    const k = indirmeBul(id);
    if (k) shell.showItemInFolder(k.yol);
  });

  async function indirmeyiAc(id) {
    const k = indirmeBul(id);
    if (!k) return;
    if (k.calistirilabilir) {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: [cev('dialog.iptal'), cev('dialog.calistirDevam')],
        defaultId: 0,
        cancelId: 0,
        title: cev('dialog.calistirBaslik'),
        message: cev('dialog.calistirMesaj'),
        detail: k.ad + '\n\n' + cev('dialog.kaynak') + ': ' + String(k.url).slice(0, 300)
      });
      if (response !== 1) return;
    }
    shell.openPath(k.yol);
  }

  on('indirme:ac', (_e, id) => { indirmeyiAc(id); });

  on('dis:ac', (_e, url) => disHarici(url));

  handle('izin:site', (_e, origin) => {
    if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) return null;
    return {
      origin,
      turler: IZIN_TURLERI,
      kayitli: store.izinlerOku(origin),
      varsayilan: store.ayarlar.izinVarsayilan || {}
    };
  });

  handle('izin:siteAyarla', (_e, p) => {
    if (!p || typeof p.origin !== 'string' || !/^https?:\/\//.test(p.origin)) return false;
    if (!IZIN_TURLERI.includes(p.izin)) return false;
    const ok = store.izinAyarla(p.origin, p.izin, p.karar);
    if (ok) durumGonder();
    return ok;
  });

  handle('gecmis:listele', (_e, sorgu) => store.gecmisAra(sorgu));
  handle('gecmis:temizle', () => { store.gecmisiTemizle(); return true; });
  handle('gecmis:tekil-sil', (_e, p) => {
    if (!p || !p.url) return false;
    const silindi = store.gecmisTekilSil(p.url, p.zaman);
    durumGonder();
    return silindi;
  });
  handle('tema:resim-sec', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: cev('tema.resimSec'),
      filters: [{ name: 'Görseller', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths.length) return { iptal: true };
    try {
      const dosya = filePaths[0];
      const stats = fs.statSync(dosya);
      if (stats.size > 8 * 1024 * 1024) {
        return { basarili: false, hata: 'Boyut sınırı (8 MB) aşıldı.' };
      }
      const ext = path.extname(dosya).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'avif' ? 'image/avif' : 'image/jpeg';
      const buf = fs.readFileSync(dosya);
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      store.ayarla('temaResmi', dataUrl);
      durumGonder();
      return { basarili: true, dataUrl };
    } catch (err) {
      return { basarili: false, hata: err.message };
    }
  });
  handle('tema:resim-kaldir', () => {
    store.ayarla('temaResmi', '');
    durumGonder();
    return true;
  });
  handle('parola:liste', (_e, filtre) => store.parolaListesi(filtre));
  handle('parola:kaydet', (_e, veri) => store.parolaEkle(veri));
  handle('parola:sil', (_e, id) => store.parolaSil(id));
  // Tarih biçimi arayüz dilinden değil, işletim sisteminin bölge ayarından gelir.
  handle('gecisanahtari:liste', (_e, filtre) =>
    ({ liste: store.gecisAnahtarListesi(filtre), yerel: app.getSystemLocale() }));
  handle('gecisanahtari:sil', (_e, id) => store.gecisAnahtarSil(String(id)));
  gecisAnahtariIpcKur();

  handle('speedtest:baslat', async () => {
    if (aktifSpeedTest) aktifSpeedTest.iptal();
    aktifSpeedTest = new SpeedTest();
    return aktifSpeedTest.calistir((ilerleme) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('speedtest:ilerleme', ilerleme);
      }
    });
  });
  handle('speedtest:durdur', () => {
    if (aktifSpeedTest) {
      aktifSpeedTest.iptal();
      aktifSpeedTest = null;
      return true;
    }
    return false;
  });

  handle('veri:temizle', async () => {
    // Varsayılan oturum da temizlenmeli; aksi halde oraya düşmüş çerezler
    // "temizlendi" denmesine rağmen kalıcı olur.
    for (const s of [ses, session.defaultSession]) {
      await s.clearStorageData({ storages: TEMIZLENECEK });
      await s.clearCache();
    }
    if (faviconlar) faviconlar.temizle();   // site simgeleri de site verisi
    durumGonder();
    return true;
  });

  /*
   * ONBELLEGI SIFIRLA - KAPSAMLI.
   *
   * Yalnizca HTTP onbellegi degil, tarayicinin tuttugu TUM uctan-uca onbellekler
   * temizleniyor. Kullanici "sadece browser cache siliniyor, DNS de silinsin"
   * dedi; Chromium'un kendi onbellekleri session API'siyle boşaltiliyor:
   *   - clearCache()             HTTP (sayfa/kaynak) onbellegi
   *   - clearHostResolverCache() DNS / host cozumleyici onbellegi
   *   - clearAuthCache()         HTTP kimlik dogrulama onbellegi (Basic/NTLM/...)
   *   - clearCodeCaches({urls:[]}) derlenmis JS/WASM kod onbellegi (bos = hepsi)
   *   - closeAllConnections()    canli HTTP/2 & QUIC baglantilari (kapatilmazsa
   *                              acik soketler eski cozumu/oturumu kullanmaya devam eder)
   *
   * NOT (isletim sistemi DNS'i AYRI): bunlar Chromium'un IC onbellekleridir.
   * Windows'un kendi DNS onbellegi (ipconfig /flushdns) tarayici disi, sistem
   * geneli bir sey; tarayici davranisi icin gereken IC onbellek bu.
   *
   * Her cagri kendi try/catch'inde: biri (surum farki vs.) yoksa/hata verirse
   * otekiler yine calisir. GEZINTI VERISI (cerez/gecmis/oturum) SILINMIYOR.
   */
  /*
   * İŞLETİM SİSTEMİ DNS ÖNBELLEĞİ (tarayıcı dışı).
   *
   * clearHostResolverCache Chromium'un IÇ DNS'ini temizliyor; işletim sisteminin
   * kendi çözümleyici önbelleği ayrı. Windows'ta 'ipconfig /flushdns' bunu
   * temizler ve YÖNETİCİ GEREKTİRMEZ (ölçüldü: admin=false ile başarılı).
   * Sabit komut + sabit argüman (shell YOK, kullanıcı girdisi YOK) -> enjeksiyon
   * riski yok. windowsHide: konsol penceresi çakmasın. macOS/Linux'ta sudo
   * gerektiği için ŞİMDİLİK atlanıyor (cross-platform adımında ele alınacak).
   */
  function isletimSistemiDnsTemizle() {
    return new Promise((coz, red) => {
      if (process.platform !== 'win32') { coz(); return; }
      try {
        execFile('ipconfig', ['/flushdns'], { timeout: 8000, windowsHide: true }, (hata) => {
          if (hata) red(hata); else coz();
        });
      } catch (e) { red(e); }
    });
  }

  handle('onbellek:temizle', async () => {
    let tumu = true;
    const guvenli = async (ad, fn) => {
      try { if (typeof fn === 'function') await fn(); }
      catch (e) { tumu = false; console.error('onbellek/' + ad + ' temizlenemedi:', e.message); }
    };
    // Gezinti + liste-indirme + guncelleme oturumlari; ayrica varsayilan oturum.
    const oturumlar = [...vekilOturumlari(), session.defaultSession];
    for (const o of oturumlar) {
      await guvenli('http', () => o.clearCache());
      await guvenli('dns', () => o.clearHostResolverCache && o.clearHostResolverCache());
      await guvenli('kimlik', () => o.clearAuthCache && o.clearAuthCache());
      await guvenli('kod', () => o.clearCodeCaches && o.clearCodeCaches({ urls: [] }));
      await guvenli('baglanti', () => o.closeAllConnections && o.closeAllConnections());
    }
    // İşletim sistemi DNS önbelleği (Windows: ipconfig /flushdns).
    await guvenli('os-dns', () => isletimSistemiDnsTemizle());
    const t = aktifSekme();
    if (t && !t.view.webContents.isDestroyed()) t.view.webContents.reloadIgnoringCache();
    return tumu;
  });

  handle('varsayilan:durum', () => {
    try {
      return app.isDefaultProtocolClient('http');
    } catch {
      return false;
    }
  });

  handle('varsayilan:yap', async () => {
    try {
      if (process.platform === 'win32') {
        // Windows yalnızca tarayıcı olarak KAYITLI uygulamayı listede gösterir.
        await tarayiciKaydiYaz().catch((e) => console.error('Tarayıcı kaydı yazılamadı:', e.message));
      }
      app.setAsDefaultProtocolClient('http');
      app.setAsDefaultProtocolClient('https');
      if (process.platform === 'win32') {
        // Doğrudan bu uygulamanın varsayılan ayarları sayfasına gider.
        shell.openExternal(varsayilanWindows.ayarlarAdresi()).catch(() => {});
      }
      return app.isDefaultProtocolClient('http');
    } catch {
      return false;
    }
  });

  handle('izin:varsayilan', (_e, p) => {
    const gecerli = ['sor', 'izin', 'ret'];
    if (!p || !IZIN_TURLERI.includes(p.izin) || !gecerli.includes(p.karar)) {
      return store.ayarlar.izinVarsayilan;
    }
    const v = store.izinVarsayilanAyarla(p.izin, p.karar);
    durumGonder();
    return v;
  });

  handle('guncelleme:kontrol', async () => {
    if (!guncelleme) return null;
    const b = await guncelleme.kontrolEt(true);
    durumGonder();
    return b;
  });
  handle('guncelleme:indir', async () => {
    if (!guncelleme) return null;
    const b = await guncelleme.indir();
    durumGonder();
    return b;
  });
  handle('guncelleme:kur', () => !!guncelleme && guncelleme.kurVeYenidenBaslat());

  handle('izin:temizle', () => {
    store.izinleriTemizle();
    durumGonder();
    return true;
  });

  handle('vpn:durum', () => ({
    acik: !!store.ayarlar.vpnAcik,
    lokasyon: store.ayarlar.vpnLokasyon,
    katalog: yerelVpnKatalog(),
    tokenVar: !!store.ayarlar.cihazToken,
    reddedildi: vekilReddedildi
  }));

  // Çıkış IP'sini gösterir (gezinti oturumundan, yani VPN açıksa sunucu IP'si).
  handle('vpn:cikisIp', () => vpnCikisIpAl());

  handle('yerimi:ekle', (_e, p) => {
    if (!p || !p.url) return false;
    const oldu = store.yerImiEkle(p.url, p.baslik, p.klasor);
    durumGonder();
    return oldu;
  });

  handle('yerimi:degistir', (_e, p) => {
    const s = aktifSekme();
    if (!s || icSayfaMi(s.url)) return false;
    const url = (p && p.url) || s.url;
    const baslik = (p && p.baslik) || s.baslik;
    const klasor = p && p.klasor;
    const eklendi = store.yerImiDegistir(url, baslik, klasor);
    durumGonder();
    return eklendi;
  });
  handle('yerimi:sil', (_e, url) => { store.yerImiSil(url); durumGonder(); return true; });

  handle('yerimi:guncelle', (_e, p) => {
    const oldu = !!p && store.yerImiGuncelle(p.eskiUrl, { ad: p.ad, url: p.url, klasor: p.klasor });
    durumGonder();
    return oldu;
  });

  handle('yerimi:klasorler', () => store.yerImiKlasorleri());

  handle('yerimi:klasor-sil', (_e, klasor) => {
    const oldu = store.yerImiKlasorSil(klasor);
    durumGonder();
    return oldu;
  });

  handle('yerimi:klasor-adlandir', (_e, p) => {
    const oldu = !!p && store.yerImiKlasorYenidenAdlandir(p.eskiAd, p.yeniAd);
    durumGonder();
    return oldu;
  });

  handle('yerimi:sirala', (_e, sirali) => {
    const oldu = store.yerImiSirala(sirali);
    durumGonder();
    return oldu;
  });

  /* ---- eklentiler ---- */
  handle('eklenti:liste', () => (eklentiler
    ? eklentiler.liste().map((e) => ({ ...e, isciCalisiyor: !!(eklentiIsciler.get(e.id) && eklentiIsciler.get(e.id).size) }))
    : []));
  handle('eklenti:detay', (_e, id) => {
    const d = eklentiler && eklentiler.detay(String(id));
    return d ? { ...d, isciCalisiyor: !!(eklentiIsciler.get(d.id) && eklentiIsciler.get(d.id).size) } : null;
  });
  handle('eklenti:yenile', async (_e, id) => {
    try {
      await eklentiler.etkinYap(String(id), false);
      await eklentiler.etkinYap(String(id), true);
      durumGonder(true);
      return { basarili: true };
    } catch (err) {
      durumGonder(true);
      return { basarili: false, hata: err.message };
    }
  });
  handle('eklenti:dosya-erisimi', async (_e, id, acik) => {
    try { await eklentiler.dosyaErisimi(String(id), !!acik); return { basarili: true }; }
    catch (err) { return { basarili: false, hata: err.message }; }
  });
  handle('eklenti:magazada-goster', (_e, id) => {
    const d = eklentiler && eklentiler.detay(String(id));
    if (d && d.magazaUrl) sekmeOlustur({ url: d.magazaUrl });
    return !!(d && d.magazaUrl);
  });
  handle('eklenti:guncelle', async () => {
    if (!eklentiler) return { guncellenen: 0, guncel: 0, hata: 0 };
    const s = await eklentiler.guncellemeKontrol();
    let guncellenen = s.guncellenen.length;
    // Yeni izin isteyen güncellemeler kullanıcı onayıyla.
    for (const g of s.onayGereken) {
      const onay = await katmanOnay({
        simge: 'soru',
        baslik: cev('eklenti.kurSor', { ad: g.ad + ' ' + g.yeni }),
        aciklama: cev('eklenti.guncellemeIzin'),
        bolumler: [
          { etiket: cev('eklenti.izinler'), ogeler: g.hazir.izinler.length ? g.hazir.izinler : [cev('eklenti.izinYok')] },
          { etiket: cev('eklenti.siteler'), ogeler: g.hazir.siteler.slice(0, 8), mono: true }
        ],
        tamamMetni: cev('eklenti.guncelle'),
        vazgecMetni: cev('eklenti.vazgec')
      });
      if (onay) {
        try { await eklentiler.tamamla(g.hazir, 'magaza'); guncellenen++; } catch { s.hata++; }
      } else {
        eklentiler.iptal(g.hazir);
      }
    }
    durumGonder(true);
    return { guncellenen, guncel: s.guncel, hata: s.hata };
  });
  handle('eklenti:kur-magaza', async (_e, girdi) => {
    const kimlik = magazaIdCoz(girdi);
    if (!kimlik) return { basarili: false, hata: cev('eklenti.gecersizId') };
    return eklentiKur({ kimlik });
  });
  handle('eklenti:kur-dosya', async (_e, tur) => {
    const klasor = tur === 'klasor';
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: cev(klasor ? 'eklenti.klasorYukle' : 'eklenti.crxYukle'),
      properties: [klasor ? 'openDirectory' : 'openFile'],
      filters: klasor ? [] : [{ name: cev('eklenti.crxFiltre'), extensions: ['crx', 'zip'] }]
    });
    if (canceled || !filePaths || !filePaths.length) return { basarili: false, iptal: true };
    return eklentiKur({ dosya: filePaths[0] });
  });
  handle('eklenti:kaldir', (_e, id) => eklentiKaldirOnayli(String(id)));
  handle('eklenti:etkin', async (_e, id, etkin) => {
    try {
      const tamam = await eklentiler.etkinYap(String(id), !!etkin);
      durumGonder(true);
      return { basarili: tamam };
    } catch (err) {
      durumGonder(true);
      return { basarili: false, hata: err.message };
    }
  });
  handle('eklenti:sabitle', (_e, id, sabit) => {
    const tamam = eklentiler.sabitle(String(id), !!sabit);
    durumGonder(true);
    return tamam;
  });
  handle('eklenti:ac', (_e, p) => { eklentiPopupAc(String(p && p.id), p); return true; });
  handle('eklenti:secenekler', (_e, id) => {
    const e = eklentiler.liste({ simge: false }).find((x) => x.id === String(id));
    if (e && e.etkin && e.secenekler) eklentiSekmesiAc(e.id, e.secenekler);
    return true;
  });
  on('eklenti:menu', (_e, konum) => eklentiMenusuGoster(konum));
  on('eklenti:baglam', (_e, p) => {
    const e = eklentiler && eklentiler.liste({ simge: false }).find((x) => x.id === String(p && p.id));
    if (!e) return;
    Menu.buildFromTemplate(eklentiOgeMenusu(e)).popup({ window: win, x: Math.round(p.x || 0), y: Math.round(p.y || 0) });
  });
  on('eklenti:magaza-ac', () => sekmeOlustur({ url: 'https://chromewebstore.google.com/' }));

  // Web Store sayfasındaki düğme (sekme renderer'ından gelir; yalnızca mağaza alan adlarından).
  const magazadan = (e) => {
    try {
      return !!e.senderFrame && e.senderFrame === e.sender.mainFrame
        && new URL(e.senderFrame.url).protocol === 'https:'
        && MAGAZA_HOSTLARI.has(new URL(e.senderFrame.url).hostname)
        && [...sekmeler.values()].some((t) => t.view.webContents === e.sender);
    } catch { return false; }
  };
  ipcMain.on('eklenti:magaza-bilgi', (e, kimlik) => {
    // returnValue YALNIZ BİR KEZ atanır: ilk atama yanıtı gönderir, ikincisi yok sayılır.
    if (!magazadan(e) || !EKLENTI_KIMLIK_RE.test(String(kimlik))) { e.returnValue = null; return; }
    e.returnValue = {
      kurulu: !!eklentiler && eklentiler.kurulu(String(kimlik)),
      ekle: cev('eklenti.magazaEkle'),
      kaldir: cev('eklenti.magazaKaldir'),
      kuruluyor: cev('eklenti.kuruluyor'),
      kaldiriliyor: cev('eklenti.kaldiriliyor')
    };
  });
  // Kurulum/kaldırma (iptal dahil) bitince mağaza sayfasındaki düğme durumunu yeniden okusun.
  const magazaSonucu = (e, kimlik) => {
    try {
      if (!e.sender.isDestroyed()) e.sender.mainFrame.send('eklenti:magaza-sonuc', { kimlik });
    } catch { /* sayfa gezinmiş ya da kapanmış */ }
  };
  ipcMain.on('eklenti:magaza-kur', (e, kimlik) => {
    if (!magazadan(e) || !EKLENTI_KIMLIK_RE.test(String(kimlik))) return;
    eklentiKur({ kimlik: String(kimlik) }).catch(() => {}).finally(() => magazaSonucu(e, String(kimlik)));
  });
  ipcMain.on('eklenti:magaza-kaldir', (e, kimlik) => {
    if (!magazadan(e) || !EKLENTI_KIMLIK_RE.test(String(kimlik))) return;
    eklentiKaldirOnayli(String(kimlik)).catch(() => {}).finally(() => magazaSonucu(e, String(kimlik)));
  });

  handle('indirme:klasor-sec', async () => {
    const simdiki = store.ayarlar.indirmeKlasoru;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: cev('ayar.indirmeKlasoru'),
      defaultPath: simdiki && klasorMu(simdiki) ? simdiki : app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths || !filePaths.length) return null;
    store.ayarla('indirmeKlasoru', filePaths[0]);
    durumGonder();
    return filePaths[0];
  });

  handle('pano:yaz', (_e, metin) => {
    if (typeof metin !== 'string' || metin.length > 10000) return false;
    clipboard.writeText(metin);
    return true;
  });

  // Proton Pass yerel profil değil, dışa aktarım dosyasıdır; listede hep görünür.
  handle('tarayici:listele', () => [...kuruluTarayicilariBul(), { id: 'protonpass', ad: 'Proton Pass', tur: 'dosya' }]);

  handle('tarayici:protonpass-aktar', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Proton Pass',
      filters: [{ name: 'Proton Pass (CSV / JSON)', extensions: ['csv', 'json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths.length) return { iptal: true };
    try {
      const dosya = filePaths[0];
      if (fs.statSync(dosya).size > 50 * 1024 * 1024) return { basarili: false, hata: 'Dosya çok büyük' };
      const veri = protonPassAyristir(fs.readFileSync(dosya, 'utf8'));
      const var_ = new Set(store.parolaListesi().map((k) => k.origin + '\n' + k.kullaniciAdi));
      let parolaSayisi = 0;
      for (const k of veri.parolalar) {
        const anahtar = k.origin + '\n' + k.kullaniciAdi;
        if (var_.has(anahtar)) continue;
        var_.add(anahtar);
        store.parolaEkle(k);
        parolaSayisi++;
      }
      let gecisSayisi = 0;
      for (const k of veri.gecis) { store.gecisAnahtarEkle(k); gecisSayisi++; }
      return { basarili: true, parolaSayisi, parolaAtlanan: veri.atlanan, gecisSayisi, gecisAtlanan: veri.gecisAtlanan };
    } catch (err) {
      return { basarili: false, hata: err.message };
    }
  });

  handle('tarayici:aktar', (_e, p) => {
    try {
      const tarayiciId = p && p.tarayiciId;
      const secenekler = (p && p.secenekler) || { yerImleri: true, gecmis: true };
      const veri = tarayicidanCek(tarayiciId, secenekler);
      let yerImiSayisi = 0;
      let gecmisSayisi = 0;
      if (secenekler.yerImleri && Array.isArray(veri.yerImleri)) {
        yerImiSayisi = store.topluYerImiEkle(veri.yerImleri);
      }
      if (secenekler.gecmis && Array.isArray(veri.gecmis)) {
        gecmisSayisi = store.topluGecmisEkle(veri.gecmis);
      }
      let indirmeSayisi = 0;
      if (secenekler.indirmeler && Array.isArray(veri.indirmeler)) {
        const var_ = new Set(indirmeler.map((k) => k.yol));
        for (const i of veri.indirmeler) {
          if (var_.has(i.yol)) continue;
          var_.add(i.yol);
          indirmeler.push({
            id: 'ice-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            ad: i.ad,
            calistirilabilir: calistirilabilirMi(i.ad),
            url: i.url,
            zaman: i.zaman,
            toplam: i.toplam,
            alinan: i.toplam,
            durum: 'tamam',
            yol: i.yol
          });
          indirmeSayisi++;
        }
      }
      let parolaSayisi = 0;
      if (secenekler.parolalar && Array.isArray(veri.parolalar)) {
        const var_ = new Set(store.parolaListesi().map((k) => k.origin + '\n' + k.kullaniciAdi));
        for (const k of veri.parolalar) {
          const anahtar = k.origin + '\n' + k.kullaniciAdi;
          if (var_.has(anahtar)) continue;
          var_.add(anahtar);
          store.parolaEkle(k);
          parolaSayisi++;
        }
      }
      if (indirmeSayisi) indirmeleriKaydet();
      durumGonder(true);
      return {
        basarili: true, tarayici: veri.tarayici, yerImiSayisi, gecmisSayisi,
        indirmeSayisi, parolaSayisi, parolaAtlanan: veri.parolaAtlanan || 0
      };
    } catch (err) {
      return { basarili: false, hata: err.message };
    }
  });

  handle('tarayici:html-aktar', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: cev('aktarma.htmlSec'),
      filters: [{ name: 'HTML Bookmarks', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths.length) return { iptal: true };
    try {
      const html = fs.readFileSync(filePaths[0], 'utf8');
      const yerImleri = htmlYerImleriAyristir(html);
      const yerImiSayisi = store.topluYerImiEkle(yerImleri);
      durumGonder(true);
      return { basarili: true, yerImiSayisi };
    } catch (err) {
      return { basarili: false, hata: err.message };
    }
  });

  handle('tarayici:html-disa-aktar', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: cev('aktarma.htmlDisa'),
      defaultPath: path.join(app.getPath('documents'), 'cvs-browser-yer-imleri.html'),
      filters: [{ name: 'HTML Bookmarks', extensions: ['html'] }]
    });
    if (canceled || !filePath) return { iptal: true };
    try {
      const { html, sayi } = htmlYerImleriUret(store.veri.yerImleri);
      fs.writeFileSync(filePath, html, 'utf8');
      return { basarili: true, yerImiSayisi: sayi };
    } catch (err) {
      return { basarili: false, hata: err.message };
    }
  });

  // Yer imleri çubuğunun sağ tık menüsü. Sayfa görünümü arayüzün üstünde
  // yerel bir katman olduğu için açılır menüyü HTML ile çizemiyoruz; işletim
  // sisteminin kendi menüsünü kullanıyoruz.
  // Araç çubuğundaki ≡ düğmesi. Konum, düğmenin arayüzdeki dikdörtgeninden
  // geliyor; arayüz penceresinin sol üstünde olduğu için doğrudan pencere
  // içeriği koordinatı sayılır.
  on('menu:ana', (_e, konum) => { anaMenuGoster(konum).catch(() => {}); });
  on('site:menu', (_e, konum) => { siteMenusuGoster(konum).catch(() => {}); });

  /* ---- açılır kutu katmanı ---- */

  katmanOn('katman:hazir', () => {
    katmanHazirMi = true;
    if (katmanBekleyenIcerik && katmanGorunum) {
      katmanGorunum.webContents.send('katman:icerik', katmanBekleyenIcerik);
      katmanBekleyenIcerik = null;
    }
  });

  katmanOn('katman:kapat', () => katmanGizle());

  katmanOn('katman:indirme-klasor', (_e, id) => {
    const k = indirmeBul(id);
    if (k) shell.showItemInFolder(k.yol);
  });

  katmanOn('katman:indirme-ac', (_e, id) => {
    katmanGizle();
    indirmeyiAc(id);
  });

  katmanOn('katman:tumunu-goster', () => {
    katmanGizle();
    dahiliSayfaSekmesiAc('indirmeler');
  });

  // Yenilikler penceresinde dil seçimi. Yalnızca dil kodu gelir; çevrilecek metin
  // ana süreçte tutulan sürüm notudur (katmandan metin kabul edilmez).
  katmanHandle('katman:yenilik-cevir', async (_e, kod) => {
    if (!yenilikBolumu || typeof kod !== 'string' || !dilListesi().some((d) => d.kod === kod)) return null;
    if (kod === 'en') return { govde: yenilikBolumu.govde };
    let govde = yenilikCeviriOnbellek.get(kod);
    if (!govde) {
      const bolum = yenilikBolumu;
      try { govde = await yenilikler.govdeyiCevir(bolum.govde, kod, yenilikGetir); } catch { govde = null; }
      if (!govde) return null;
      if (bolum === yenilikBolumu) yenilikCeviriOnbellek.set(kod, govde);
    }
    return { govde };
  });

  katmanOn('katman:onay', (_e, tamam) => {
    const coz = katmanOnayKarari;
    katmanOnayKarari = null;
    katmanGizle();
    if (coz) coz(!!tamam);
  });

  katmanOn('katman:izin', (_e, karar) => {
    const coz = katmanIzinKarari;
    katmanIzinKarari = null;
    katmanGizle();
    if (coz) coz({ izinVer: !!(karar && karar.izinVer), hatirla: !!(karar && karar.hatirla) });
  });

  // VPN açılır kutusu eylemleri (katmandan gelir).
  // Aç/kapa OTOMATİK KAYIT içerir: açarken cihaz token'ı sunucudan alınıyor
  // (kullanıcı hiçbir şey girmez). invoke: katman sonucu bekleyip UI'yi güncelliyor.
  katmanHandle('katman:vpn-ackapa', async (_e, deger) => {
    if (deger) {
      const t = await cihazKaydiYap();
      if (!t) return { acik: false, hata: 'kayit' };   // kayıt olamadı -> açma (fail-closed)
    }
    store.ayarla('vpnAcik', !!deger);
    await vekiliUygula();
    durumGonder();
    const s = aktifSekme();
    if (s && !s.view.webContents.isDestroyed()) s.view.webContents.reload();
    return { acik: !!store.ayarlar.vpnAcik, hata: '' };
  });
  katmanOn('katman:vpn-lokasyon', (_e, id) => {
    if (!vpnLokasyonGecerliMi(id)) return;
    store.ayarla('vpnLokasyon', id);
    if (store.ayarlar.vpnAcik) { vekiliUygula(); const s = aktifSekme(); if (s && !s.view.webContents.isDestroyed()) s.view.webContents.reload(); }
    durumGonder();
  });
  katmanHandle('katman:vpn-ip', () => vpnCikisIpAl());

  // VPN kutusu: arayüz düğmenin konumunu ölçüp gönderiyor, içerik burada üretiliyor.
  on('vpn:menu', (_e, konum) => {
    if (katmanAcikMi()) return katmanGizle();   // ikinci tıklama kapatır
    katmanGoster(vpnKatmanIcerik(konum));
  });

  // İndirilenler kutusu: arayüz düğmenin konumunu ölçüp gönderiyor.
  on('indirme:menu', (_e, konum) => {
    if (katmanAcikMi()) return katmanGizle();      // ikinci tıklama kapatır
    katmanGoster(indirmeKatmanIcerik(konum));
    indirmeKatmanKonumu = konum || {};             // katmanGoster sıfırlıyor; canlı yenileme için yeniden kur
  });

  // Düğme eylemleri (arayüz paneli ve açılır kutu aynı kimliklerle çalışır).
  // Yalnızca bilinen kimlik + bilinen eylem; ham dosya yolu hiç kabul edilmez.
  function indirmeEylemi(id, eylem) {
    const k = indirmeler.find((x) => x.id === id);
    if (!k) return;
    const it = indirmeNesneleri.get(k.no);
    if (eylem === 'duraklat') { if (it && !it.isPaused()) { it.pause(); k.duraklatildi = true; k.hiz = 0; } }
    else if (eylem === 'surdur') { if (it && it.canResume()) { it.resume(); k.duraklatildi = false; } }
    else if (eylem === 'iptal') { if (it) it.cancel(); return; }   // 'done' olayı durumu ve yayını halleder
    else if (eylem === 'sil') {
      if (k.durum === 'devam' || k.durum === 'kesildi') return;   // önce iptal edilmeli
      indirmeler.splice(indirmeler.indexOf(k), 1);
      indirmeleriKaydet();
      indirmeOlayiYayinla('onErased', indirmeNo(k));
    } else return;
    durumGonder();
    indirmeKatmaniniYenile();
  }
  on('indirme:eylem', (_e, id, eylem) => indirmeEylemi(String(id), String(eylem)));
  katmanOn('katman:indirme-eylem', (_e, id, eylem) => indirmeEylemi(String(id), String(eylem)));
  on('indirme:temizle', () => {
    for (let i = indirmeler.length - 1; i >= 0; i--) {
      if (indirmeler[i].durum === 'devam' || indirmeler[i].durum === 'kesildi') continue;
      indirmeOlayiYayinla('onErased', indirmeNo(indirmeler[i]));
      indirmeler.splice(i, 1);
    }
    indirmeleriKaydet();
    durumGonder();
    indirmeKatmaniniYenile();
  });

  // Yer imleri menüsü: arayüz düğmenin konumunu ve menü ağacını gönderiyor;
  // çizim katmanda. Katmandan geri gelen adres kayıtlı yer imleriyle
  // eşleşmiyorsa yok sayılır.
  function yerimiAgacTemizle(liste, derinlik = 0) {
    if (!Array.isArray(liste) || derinlik > 8) return [];
    const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
    const cikti = [];
    for (const o of liste.slice(0, 2000)) {
      if (!o || typeof o !== 'object') continue;
      if (o.tur === 'ayrac') cikti.push({ tur: 'ayrac' });
      else if (o.tur === 'eylem') cikti.push({ tur: 'eylem', ad: s(o.ad, 200) });
      else if (o.tur === 'klasor') cikti.push({ tur: 'klasor', ad: s(o.ad, 200), yol: s(o.yol, 400), alt: yerimiAgacTemizle(o.alt, derinlik + 1) });
      else if (o.tur === 'yerimi') {
        const fav = s(o.favicon, 200);
        cikti.push({
          tur: 'yerimi', url: s(o.url, 2048), baslik: s(o.baslik, 300),
          favicon: /^(pusula-favicon:|data:image\/)/.test(fav) ? fav : ''
        });
      }
    }
    return cikti;
  }
  on('yerimi:katman', (_e, veri) => {
    if (katmanAcikMi()) return katmanGizle();   // ikinci tıklama kapatır
    if (!veri || typeof veri !== 'object') return;
    const n = (v) => (Number.isFinite(v) ? Math.round(v) : 0);
    katmanGoster({
      tur: 'yerimi', yon: 'sol', ust: Math.max(0, n(veri.ust)), kenar: 0,
      sol: n(veri.sol), sag: n(veri.sag), sagaHizala: !!veri.sagaHizala,
      ogeler: yerimiAgacTemizle(veri.ogeler)
    });
  });
  katmanOn('katman:yerimi-git', (_e, url, yeniSekme) => {
    katmanGizle();
    if (typeof url !== 'string' || !store.veri.yerImleri.some((y) => y.url === url)) return;
    if (yeniSekme) sekmeOlustur({ url });
    else { const c = wcAl(); if (c) c.loadURL(url); }
  });
  on('yerimi:popover', (_e, v) => {
    if (katmanAcikMi()) return katmanGizle();
    if (!v || typeof v.url !== 'string') return;
    const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
    const m = v.metin || {};
    const n = (x) => (Number.isFinite(x) ? Math.round(x) : 0);
    katmanGoster({
      tur: 'yerimipop', yon: 'sag', genislik: 300,
      ust: Math.max(0, n(v.ust)), kenar: Math.max(6, n(v.kenar)),
      url: str(v.url, 2048), baslik: str(v.baslik, 300), klasor: str(v.klasor, 400),
      favicon: /^pusula-favicon:/.test(str(v.favicon, 200)) ? str(v.favicon, 200) : '',
      klasorler: (Array.isArray(v.klasorler) ? v.klasorler : []).slice(0, 500).map((k) => str(k, 400)),
      metin: Object.fromEntries(['baslik', 'duzenleBaslik', 'ad', 'klasor', 'cubuk', 'yeniKlasor', 'klasorAdi', 'kaldir', 'bitti', 'baskaKlasor', 'url', 'kaydet', 'iptal', 'kapat']
        .map((k) => [k, str(m[k], 120)]))
    });
  });
  katmanOn('katman:yerimi-kaydet', (_e, v) => {
    katmanGizle();
    if (!v || typeof v.url !== 'string' || !store.veri.yerImleri.some((y) => y.url === v.url)) return;
    store.yerImiGuncelle(v.url, {
      ad: typeof v.ad === 'string' ? v.ad.slice(0, 300) : undefined,
      url: typeof v.yeniUrl === 'string' && v.yeniUrl.trim() ? v.yeniUrl.trim().slice(0, 2048) : v.url,
      klasor: typeof v.klasor === 'string' ? v.klasor.slice(0, 400) : undefined
    });
    durumGonder();
  });
  katmanOn('katman:yerimi-kaldir', (_e, url) => {
    katmanGizle();
    if (typeof url !== 'string') return;
    store.yerImiSil(url);
    durumGonder();
  });
  katmanOn('katman:yerimi-tumu', () => {
    katmanGizle();
    dahiliSayfaSekmesiAc('yerImleri');
  });

  on('yerimi:menu', (_e, url) => {
    const secili = url ? store.veri.yerImleri.find(y => y.url === url) : null;
    const ogeler = [];

    if (secili) {
      ogeler.push(
        { label: cev('yerimi.ac'), click: () => { const c = wcAl(); if (c) c.loadURL(secili.url); } },
        { label: cev('yerimi.yeniSekmedeAc'), click: () => sekmeOlustur({ url: secili.url }) },
        { label: cev('yerimi.adresiKopyala'), click: () => clipboard.writeText(secili.url) },
        { type: 'separator' },
        { label: cev('yerimi.duzenle'), click: () => uiyeGonder('yerimi-duzenle', secili.url) },
        {
          label: cev('panel.kaldir'),
          click: () => { store.yerImiSil(secili.url); durumGonder(); }
        },
        { type: 'separator' }
      );
    }

    const s = aktifSekme();
    ogeler.push(
      {
        label: cev('menu.yerImiEkle'),
        enabled: !!(s && !icSayfaMi(s.url)),
        click: () => { if (s) { store.yerImiDegistir(s.url, s.baslik); durumGonder(); } }
      },
      { label: cev('menu.yerImleriniGoster'), click: () => dahiliSayfaSekmesiAc('yerImleri') },
      {
        label: cev('yerimi.cubuguGizle'),
        click: () => { store.ayarla('yerImleriCubugu', false); durumGonder(); }
      }
    );

    Menu.buildFromTemplate(ogeler).popup({ window: win });
  });

  on('adres:menu', (_e, p = {}) => {
    const { x, y, seciliVarMi = false } = (p || {});
    if (win && !win.isDestroyed()) {
      win.webContents.focus();
    }
    let pano = '';
    try {
      const metin = clipboard.readText();
      pano = typeof metin === 'string' ? metin.trim() : '';
    } catch (_) {
      pano = '';
    }
    const panoVar = Boolean(pano);
    const ogeler = [
      { role: 'undo', label: cev('menu.geriAl') },
      { role: 'redo', label: cev('menu.yinele') },
      { type: 'separator' },
      { role: 'cut', label: cev('menu.kes'), enabled: seciliVarMi },
      { role: 'copy', label: cev('menu.kopyala'), enabled: seciliVarMi },
      { role: 'paste', label: cev('menu.yapistir'), enabled: panoVar },
      {
        label: cev('baglam.yapistirVeGit'),
        enabled: panoVar,
        click: () => {
          const c = wcAl();
          if (c && pano) {
            c.loadURL(resolveInput(pano, motorAnahtari(!!aktifSekme()?.gizli)));
          }
        }
      },
      { role: 'delete', label: cev('baglam.sil'), enabled: seciliVarMi },
      { type: 'separator' },
      { role: 'selectAll', label: cev('menu.tumunuSec') }
    ];

    const popupOpts = { window: win };
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      popupOpts.x = Math.round(x);
      popupOpts.y = Math.round(y);
    }
    Menu.buildFromTemplate(ogeler).popup(popupOpts);
  });

  handle('bayrak:liste', () => bayraklar.liste(store.ayarlar.bayraklar));
  on('bayrak:yenidenBaslat', () => { app.relaunch(); app.quit(); });

  handle('ayar:degistir', (_e, p) => {
    if (!p || !Object.hasOwn(AYAR_DOGRULAMA, p.anahtar) || !AYAR_DOGRULAMA[p.anahtar](p.deger)) {
      return store.ayarlar;
    }
    // DPI, sözleşme kabul edilmeden açılamaz (arayüz atlatılsa bile burada durur).
    if (p.anahtar === 'dpiMod' && p.deger !== 'kapali' && store.ayarlar.dpiSozlesmeKabul !== true) {
      return store.ayarlar;
    }
    // Sözleşme geri çekilirse DPI de kapanır.
    if (p.anahtar === 'dpiSozlesmeKabul' && p.deger === false) store.ayarla('dpiMod', 'kapali');
    const a = store.ayarla(p.anahtar, p.deger);
    if (p.anahtar === 'filtreListeleriAcik' && listeler) listeler.tazele();
    // Scriptlet demeti engelleyici durumuna ve listeye bağlı; ikisi de tazelenmeli.
    if (p.anahtar === 'filtreListeleriAcik' || p.anahtar === 'engelleyiciAcik') antiAdblockKur();
    if (p.anahtar === 'uboMotorAcik') blocker.uboyuKur();
    // "Geçmişi kaydetme" kapatılınca birikmiş geçmişi HEMEN sil: kullanıcı
    // yeniden başlatmadan da geçmişinin (ve adres önerilerinin) gittiğini
    // görsün. Açılıştaki değişmez uygulamasıyla aynı kural (tek metot).
    if (p.anahtar === 'gecmisiKaydet') store.gecmisPolitikasiniUygula();
    // Çıkışta otomatik kurulum tercihi: quit anındaki yeniden-denetim bu
    // bayrağı okuduğu için canlı güncelliyoruz (yeni indirme beklemeden).
    if (p.anahtar === 'guncellemeOtomatikKur' && guncelleme) guncelleme.otomatikKurGuncelle();
    if (p.anahtar === 'guvenliDns' || p.anahtar === 'dnsSaglayici' || p.anahtar === 'dnsOzel') guvenliDnsUygula();
    if (p.anahtar === 'tema') temayiUygula();
    if (p.anahtar.startsWith('vekil') || p.anahtar === 'dpiMod' || p.anahtar === 'dpiSozlesmeKabul') vekiliUygula();
    /*
     * Ana parola açıldığında parolayı HEMEN kuruyoruz: anahtar bu oturum
     * boyunca bellekte tutulup kapanışta kasayı şifrelemekte kullanılacak.
     * Kullanıcı vazgeçerse ayarı geri alıyoruz - yoksa "açık" görünüp
     * hiçbir şey şifrelemeyen sahte bir güvenlik olurdu.
     */
    if (p.anahtar === 'anaParolaAcik') {
      if (p.deger) {
        anaParolaSor({ kip: 'kur' }).then((anahtar) => {
          if (anahtar) { anaParolaAnahtari = anahtar; }
          else { store.ayarla('anaParolaAcik', false); durumGonder(); }
        });
      } else {
        anaParolaAnahtari = null;
      }
    }
    if (p.anahtar === 'vpnAcik' || p.anahtar === 'vpnLokasyon') {
      vekiliUygula();
      const sv = aktifSekme();
      if (sv && !sv.view.webContents.isDestroyed()) sv.view.webContents.reload();
    }
    /*
     * Genel engelleyici toggle'ı sağ üstteki düğmeden geliyor. Aktif sekmeyi
     * yeniliyoruz: kozmetikCssAl ve engellensinMi engelleyiciAcik'i yalnızca
     * gezinme anında okuyor, yenileme olmadan açık sayfada değişiklik
     * görünmezdi - kullanıcı "çalışmadı" sanardı.
     */
    if (p.anahtar === 'engelleyiciAcik') {
      const s = aktifSekme();
      if (s && !s.view.webContents.isDestroyed()) s.view.webContents.reload();
    }
    if (p.anahtar === 'dil') {
      // Dil anında uygulanır: menü yeniden kurulur, arayüz yeni tabloyu alır.
      diliUygula();
      menuKur();
    }
    // Dil değişince değişmeyen veri (çeviri tablosu) yeniden gönderilmeli.
    durumGonder(p.anahtar === 'dil');
    return a;
  });

  handle('liste:guncelle', async () => {
    if (!listeler) return false;
    await listeler.guncelle({ zorla: true });
    durumGonder();
    return true;
  });

  handle('liste:ekle', async (_e, url) => {
    if (!listeler) return { hata: 'Liste yöneticisi hazır değil.' };
    const sonuc = listeler.listeEkle(url);
    if (sonuc.hata) return sonuc;
    await listeler.guncelle({ zorla: true });
    durumGonder();
    return sonuc;
  });

  handle('liste:sil', (_e, id) => {
    const oldu = !!listeler && listeler.listeSil(id);
    durumGonder();
    return oldu;
  });

  handle('site:engelleyici', () => {
    const s = aktifSekme();
    if (!s) return false;
    const alan = kokAlanAdi(hostAl(s.url));
    if (!alan) return false;
    store.siteIzniDegistir(alan);
    // İzin listesi scriptlet demetine gömülü; değişince preload'ı tazele.
    antiAdblockKur();
    if (!s.view.webContents.isDestroyed()) s.view.webContents.reload();
    durumGonder();
    return true;
  });

  /*
   * Öneri listesi açık/kapandı.
   *
   * Öneri listesi arayüz penceresinde; sayfa görünümü onun ÜSTÜNDE render
   * edildiği için liste sayfanın üstüne binemiyordu ve chrome büyüyünce sayfa
   * aşağı itiliyordu. Çözüm: öneri açılınca sayfanın anlık görüntüsünü alıp
   * arayüze ver ve sayfa görünümünü GİZLE - liste artık boşalan alanın değil,
   * sabit görüntünün üstüne biner, sayfa yerinde kalır.
   *
   * SIRA NUMARASI: capturePage asenkron; kullanıcı hızlı yazarken öneri açılıp
   * kapanabiliyor. Yalnızca en son isteği uyguluyoruz, yoksa geç gelen bir
   * "aç" sayfayı kapalı bırakır (görünmez sayfa - klasik sessiz hata).
   */
  handle('oneri:durum', async (_e, acik) => {
    const s = aktifSekme();
    if (!s || s.view.webContents.isDestroyed()) return false;
    const sira = ++oneriDurumSira;

    if (!acik) {
      s.view.setVisible(true);
      uiyeGonder('sayfa-goruntu', null);
      return true;
    }

    let veriUrl = '';
    try {
      const img = await s.view.webContents.capturePage();
      if (!img.isEmpty()) veriUrl = img.toDataURL();
    } catch { /* görüntü alınamadı: aşağıda sayfa gizlenmez, eski davranışa döner */ }

    // Bu istek beklerken daha yeni bir durum geldiyse dokunma.
    if (sira !== oneriDurumSira) return false;
    // Görüntü alınamadıysa sayfayı gizleme: boş alan, itilmiş sayfadan kötü.
    if (!veriUrl) return false;
    if (aktifSekme() !== s || s.view.webContents.isDestroyed()) return false;

    uiyeGonder('sayfa-goruntu', veriUrl);
    s.view.setVisible(false);
    return true;
  });
}

// Öneri açılış/kapanış isteklerini sıralamak için; capturePage asenkron.
let oneriDurumSira = 0;

/* ---------------------------------------------------------------- */
/* Başlangıç                                                         */
/* ---------------------------------------------------------------- */

const cokluPencereMi = process.argv.includes('--yeni-pencere');
if (!cokluPencereMi && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Komut satirinda verilen ilk http(s) adresi. Isletim sisteminden bir
  // baglanti acildiginda Electron adresi argv'ye koyuyor.
  const argvAdresi = (argv) => (argv || []).find((a) => /^https?:\/\//i.test(a));

  /*
   * VEKİL/VPN KİMLİK DOĞRULAMA. Proxy 407 dönerse Chromium 'login' olayını
   * tetikliyor. VPN açıkken cihaz token'ını (kullanıcı adı = anonim cihaz kimliği,
   * parola = token) veriyoruz; sunucu bununla yetkilendiriyor VE token başına
   * 100 Mbps'e kısıyor. Yalnız isProxy + VPN açık: sitelerin kendi HTTP-auth
   * istekleri buradan ETKİLENMEZ.
   */
  app.on('login', (event, _wc, _details, authInfo, callback) => {
    if (store && authInfo && authInfo.isProxy && store.ayarlar.vpnAcik) {
      event.preventDefault();
      callback(cihazKimligi(), store.ayarlar.cihazToken || '');
    }
  });

  app.on('second-instance', (_e, argv) => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const url = argvAdresi(argv);
    if (url) sekmeOlustur({ url });
  });

  app.whenReady().then(async () => {
    const veriDosyasi = path.join(app.getPath('userData'), 'pusula-veri.json');
    ilkKurulumMu = !fs.existsSync(veriDosyasi);
    store = new Store(veriDosyasi);
    if (GIZLI_PENCERE) {
      // Gizli pencere asıl profilin yer imi/geçmişini salt okunur görür.
      const arg = process.argv.find((a) => a.startsWith('--asil-veri='));
      store.gizliPencereIcinYukle(arg ? arg.slice('--asil-veri='.length) : '');
    }
    indirmeler.push(...store.veri.indirmeler.filter((k) => k && k.yol && k.ad));
    sonIndirmeNo = indirmeler.reduce((m, k) => Math.max(m, k.no || 0), 0);
    /*
     * "Geçmişi kaydetme" kapalıyken geçmiş HİÇ saklanmamalı. Ayarı kapatmak
     * yalnızca yeni eklemeyi durduruyordu (store.gecmiseEkle); kapatmadan önce
     * birikmiş kayıtlar diskte kalıyor ve açılışta hem geçmiş sayfasında hem
     * adres çubuğu önerilerinde tekrar görünüyordu (ölçüldü: ayar kapalı,
     * gecmis=10). Açılışta değişmezi uygula: kapalıysa birikmiş ne varsa sil.
     */
    store.gecmisPolitikasiniUygula();
    diliUygula();
    // Pencere olusmadan once: arka plan rengi ve baslik cubugu dogru temayla acilsin.
    temayiUygula();
    guvenliDnsUygula();
    // Vekil de burada uygulaniyor; pencere ondan SONRA aciliyor ki ilk istek
    // her zaman dogru yapilandirmayla ciksin.
    await oturumKur();
    ipcKur();
    menuKur();
    pencereOlustur();
    // Windows'ta Varsayılan uygulamalar listesinde görünmek için (arka planda, bir kez).
    if (process.platform === 'win32') tarayiciKaydiYaz().catch((e) => console.error('Tarayıcı kaydı yazılamadı:', e.message));

    /*
     * ILK ACILISTA da komut satirindaki adres aciliyor. Yalnizca
     * second-instance'ta bakiliyordu: tarayici KAPALIYKEN isletim sisteminden
     * bir baglanti acmak uygulamayi baslatiyor ama bos yeni sekmede
     * birakiyordu - hicbir hata yok, sadece istenen sayfa gelmiyor.
     */
    const acilisAdresi = argvAdresi(process.argv);
    if (acilisAdresi) sekmeOlustur({ url: acilisAdresi });

    // Önbellekteki listeleri yükler, ardından bayat olanları arka planda çeker.
    listeler.baslat().catch(e => console.error('Filtre listeleri başlatılamadı:', e.message));
    guncelleme.baslat();

    // Geçmişteki ve yer imlerindeki siteler için simgeleri arka planda topla:
    // yeni sekme sayfası ilk açılışta harf rozetiyle kalmasın.
    setTimeout(() => {
      const hostlar = [
        ...store.sikGidilenler(12).map((s) => s.host),
        ...store.veri.yerImleri.slice(0, 20).map((y) => hostAl(y.url))
      ];
      faviconlar.onIsit(hostlar).catch(() => {});
    }, 4000).unref?.();

    // Pencere kapanirken asili bir izin istegi kalirsa izinOnayAcik sonsuza
    // dek true kalir ve SONRAKI TUM izin istekleri sessizce reddedilir.
    win.on('closed', () => {
      katmanGizle();
      // Bayrak modul duzeyinde; sifirlanmazsa yeni pencerede butun
      // sekme gorunumleri gizli kalir.
      panelAcik = false;
    });

    nativeTheme.on('updated', () => {
      if (!win || win.isDestroyed() || process.platform === 'darwin') return;
      try { win.setTitleBarOverlay(baslikCubuguRengi()); } catch { /* platform desteklemeyebilir */ }
      durumGonder();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) pencereOlustur();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  /*
   * Kapanışta çerez temizliği.
   *
   * will-quit SENKRON çalışır: orada başlatılan bir silme işlemi bitmeden
   * uygulama kapanır ve hiçbir çerez silinmez - klasik sessiz başarısızlık.
   * Bu yüzden çıkış bir kez erteleniyor.
   */
  app.on('before-quit', (olay) => {
    if (cikistaTemizlendi || !store) return;
    cikistaTemizlendi = true;
    olay.preventDefault();
    (async () => {
      if (store.ayarlar.kapanistaCerezSil) await kapanistaCerezleriSil();
      // Kalanları ŞİFRELİ kasaya al ve düz metin depoyu boşalt (bkz. cerez-kasa.js).
      await cerezleriKasayaAl();
    })().finally(() => app.quit());
  });

  app.on('will-quit', () => {
    dpi.durdur();
    if (listeler) listeler.dur();
    if (guncelleme) guncelleme.dur();
    if (store) store.hemenKaydet();
  });
}
