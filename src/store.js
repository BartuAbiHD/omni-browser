'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VARSAYILAN_YAN_PANELLER = [
  { id: 'wikipedia', ad: 'Wikipedia', url: 'https://tr.wikipedia.org', varsayilanUrl: 'https://tr.wikipedia.org', ikon: 'wikipedia' },
  { id: 'gemini', ad: 'Gemini', url: 'https://gemini.google.com', varsayilanUrl: 'https://gemini.google.com', ikon: 'gemini' },
  { id: 'claude', ad: 'Claude', url: 'https://claude.ai', varsayilanUrl: 'https://claude.ai', ikon: 'claude' },
  { id: 'chatgpt', ad: 'ChatGPT', url: 'https://chatgpt.com', varsayilanUrl: 'https://chatgpt.com', ikon: 'chatgpt' },
  { id: 'deepseek', ad: 'DeepSeek', url: 'https://chat.deepseek.com', varsayilanUrl: 'https://chat.deepseek.com', ikon: 'deepseek' },
  { id: 'grok', ad: 'Grok', url: 'https://grok.com', varsayilanUrl: 'https://grok.com', ikon: 'grok' }
];

const DEFAULTS = {
  ayarlar: {
    // 'sistem' -> işletim sisteminin diline göre seçilir
    dil: 'sistem',
    // 'sistem' | 'acik' | 'koyu' -> nativeTheme.themeSource'a aktarilir,
    // boylece ic sayfalar ve yerel menuler de birlikte doner.
    // Varsayilan KOYU (kullanici istegi); Ayarlar > Gorunum'den degistirilir.
    tema: 'koyu',
    aramaMotoru: 'duckduckgo',
    gizliAramaMotoru: 'startpage',
    engelleyiciAcik: true,
    // uBlock Origin ağ motoru (SNFE). Kapatılırsa ~120 MB bellek düşer, ağ
    // engelleme eski çıplak-alan motoruna iner. Varsayılan açık.
    uboMotorAcik: true,
    dntGonder: true,
    // Üçüncü taraf çerezleri siteler arası takibin ana taşıyıcısı; varsayılan
    // olarak taşınmıyorlar. Bozulan bir site çıkarsa adres çubuğundaki site
    // menüsünden o siteye özel istisna verilebilir.
    ucuncuTarafCerez: true,
    // omni://flags: { [bayrakId]: 'etkin' | 'kapali' }. Bos = katalog varsayilanlari.
    bayraklar: {},
    // Guvenli DNS (DoH): varsayilan KAPALI (bkz. src/guvenli-dns.js).
    guvenliDns: false,
    dnsSaglayici: 'sistem',
    dnsOzel: '',
    // Kapanışta çerezleri sil. Yer imlerindeki siteler korunur: onlar
    // kullanıcının bilerek sakladığı, oturumunu kaybetmek istemediği siteler.
    kapanistaCerezSil: false,
    // İndirme klasörü. Boşsa varsayılan davranış (kaydetme penceresi); doluysa
    // dosyalar sorulmadan bu klasöre kaydedilir.
    indirmeKlasoru: '',
    // Tema stili: varsayilan | gece-mavisi | mor-nebula | zumrut | gun-batimi | saf-koyu
    temaStil: 'varsayilan',
    // Özel arka plan resmi (Base64 data URL)
    temaResmi: '',
    // HTTPS-First: ust duzey gezinmeler https e yukseltilir, sunucu HTTPS
    // konusmuyorsa o host icin geri dusulur (bkz. src/https-zorla.js).
    httpsZorla: true,
    // Cerez kasasinin IKINCI katmani: kullanicidan gelen ana parola. Anahtar
    // diske yazilmaz; acilista sorulur. Varsayilan KAPALI (her acilista parola
    // yazmak istemeyeni zorlamayalim).
    anaParolaAcik: false,
    // Geçiş anahtarlarını tarayıcı yönetir: açıkken navigator.credentials yaması
    // kilitlenir, eklentiler (Proton Pass vb.) üzerine yazamaz. Yeni sayfalarda geçerli.
    gecisAnahtariTarayici: true,
    // Vekil sunucu. 'kapali' | 'sistem' | 'elle'
    // Tor için: elle + socks5://127.0.0.1:9050
    vekilKip: 'sistem',
    vekilAdres: '',
    vekilAtla: '',
    // VPN: kendi proxy sunucularına şifreli tünel. vpnAcik açıkken elle vekili
    // geçersiz kılar. Bant limiti (100 Mbps/kullanıcı) SUNUCUDA uygulanır (açık
    // kaynak istemci limiti sökülebilir; bkz. src/vpn.js).
    vpnAcik: false,
    vpnLokasyon: 'de-1',
    cihazToken: '',    // proxy kimlik doğrulama token'ı (sunucudan)
    cihazKimlik: '',   // kalıcı anonim cihaz kimliği (ilk gerekince üretilir)
    // DPI sansür aşma (yalnızca bu tarayıcıya özel SOCKS5 ByeDPI motoru)
    dpiMod: 'kapali',  // 'kapali' | 'dahili' | 'ciadpi'
    dpiStrateji: 'split-1', // 'split-1' | 'split-2' | 'split-sni' | 'fake-split'
    dpiSozlesmeKabul: false, // DPI kullanım sözleşmesi kabul edilmeden DPI açılamaz
    gecmisiKaydet: true,
    // Masaüstü Discord'a yerel IPC ile 'izliyor' durumu (yalnız desteklenen siteler, gizli sekme asla).
    discordSunum: true,
    discordButonlar: true,
    anasayfa: '',
    baslangicSekmeleri: [],
    yerImleriCubugu: true,
    varsayilanOneriGizle: false,
    // Yeni sekme sayfasındaki tanıtım/reklam alanı. Üçüncü taraf bir reklam
    // ağı KULLANILMIYOR: kartlar buradan okunur, sayfa dışarı istek atmaz.
    // Kendi kartlarınızı eklemek için pusula-veri.json içindeki bu diziyi
    // düzenleyin: { etiket, baslik, metin, url }.
    duyurular: [
      {
        etiket: 'CVS Browser',
        baslik: 'İzleyici engelleyici çalışıyor',
        metin: 'EasyList ve EasyPrivacy listeleri arka planda güncelleniyor; bu sayfa hiçbir yere istek atmıyor.',
        url: ''
      }
    ],
    // Uygulama güncellemesi
    guncellemeKontrol: true,
    guncellemeIndir: true,
    // Firefox gibi: arka planda inen güncelleme, tarayıcı kapatılınca (ya da PC
    // kapanınca) SESSİZCE kurulur; yeniden başlatma istemi çıkmaz. Varsayılan
    // AÇIK. Kullanıcı yine de Ayarlar'dan "Yeniden başlat ve kur" ile anında
    // kurabilir. Güvenlik kapısı değişmez: yalnız imzalı manifest + sha512
    // doğrulamasından geçmiş paket kurulur (bkz. src/guncelleme.js).
    guncellemeOtomatikKur: true,
    guncellemeKanali: 'kararli',
    // İndirilen filtre listeleri (EasyList vb.)
    filtreListeleriAcik: true,
    otomatikGuncelle: true,
    ekListeler: [],          // [{ id, ad, url }]
    // Kenar çubuğu ve Vivaldi benzeri web panelleri
    yanCubukGoster: true,
    yanPanelAcik: false,
    yanPanelAktif: 'wikipedia',
    yanPanelGenislik: 380,
    yanPanelMobil: false,
    yanPaneller: VARSAYILAN_YAN_PANELLER,
    // İzin türü başına genel karar: 'sor' | 'izin' | 'ret'.
    // Gürültülü ve nadiren istenen izinler varsayılan olarak sessizce reddedilir;
    // kullanıcı Ayarlar'dan her birini "Sor"a çevirebilir.
    izinVarsayilan: {
      notifications: 'ret',
      geolocation: 'ret',
      midi: 'ret',
      midiSysex: 'ret',
      'clipboard-read': 'ret',
      'idle-detection': 'ret',
      pointerLock: 'ret',
      media: 'sor',
      'display-capture': 'sor',
      openExternal: 'sor',
      fullscreen: 'izin'
    }
  },
  gecmis: [],        // { url, baslik, zaman }
  yerImleri: [],     // { url, baslik, zaman }
  parolalar: [],     // { id, origin, kullaniciAdi, parola, zaman }
  gecisAnahtarlari: [], // passkey: { id, rpId, rpAdi, kullaniciKimlik, kullaniciAdi, kullaniciGoruntu, ozelAnahtar, sayac, zaman, sonKullanim }
  eklentiler: {},    // kurulu eklentiler: { [kimlik]: { yol, etkin, sabit, kaynak } }
  indirmeler: [],    // tamamlanmış indirmeler: { id, ad, url, zaman, toplam, alinan, durum, yol, calistirilabilir }
  izinler: {},       // origin -> { [permission]: 'izin' | 'ret' }
  siteIzinleri: [],     // engelleyicinin devre dışı bırakıldığı alan adları
  cerezIstisnalari: [], // üçüncü taraf çereze izin verilen üst seviye kökler
  istatistik: { engellenen: 0 }
};

const MAX_GECMIS = 5000;

class Store {
  constructor(dosya) {
    this.dosya = dosya;
    this.veri = structuredClone(DEFAULTS);
    this._zamanlayici = null;
    this.yukle();
  }

  yukle() {
    try {
      const ham = fs.readFileSync(this.dosya, 'utf8');
      const kayit = JSON.parse(ham);
      this.veri = {
        ...structuredClone(DEFAULTS),
        ...kayit,
        ayarlar: { ...DEFAULTS.ayarlar, ...(kayit.ayarlar || {}) },
        istatistik: { ...DEFAULTS.istatistik, ...(kayit.istatistik || {}) }
      };
      // İç içe ayar: yeni sürümde eklenen izin türleri kaybolmasın.
      this.veri.ayarlar.izinVarsayilan = {
        ...DEFAULTS.ayarlar.izinVarsayilan,
        ...((kayit.ayarlar && kayit.ayarlar.izinVarsayilan) || {})
      };
      /*
       * DİZİ OLMASI GEREKEN ALANLAR ZORLANIYOR.
       *
       * Bu dosya elle düzenlenebiliyor (yeni sekme kartları için öyle
       * söylüyoruz). Bir dizi alanı yanlışlıkla nesne ya da metin olursa
       * .includes çağrısı fırlıyor; o çağrı webRequest işleyicisinin içinde
       * olduğu için tarayıcıda HİÇBİR istek tamamlanmıyordu. Ölçüldü.
       */
      for (const alan of ['gecmis', 'yerImleri', 'indirmeler', 'siteIzinleri', 'cerezIstisnalari']) {
        if (!Array.isArray(this.veri[alan])) this.veri[alan] = [];
      }
      if (!this.veri.izinler || typeof this.veri.izinler !== 'object' || Array.isArray(this.veri.izinler)) {
        this.veri.izinler = {};
      }
      if (!Array.isArray(this.veri.ayarlar.ekListeler)) this.veri.ayarlar.ekListeler = [];
      if (!Array.isArray(this.veri.ayarlar.baslangicSekmeleri)) this.veri.ayarlar.baslangicSekmeleri = [];
      if (!Array.isArray(this.veri.ayarlar.yanPaneller) || this.veri.ayarlar.yanPaneller.length === 0) {
        this.veri.ayarlar.yanPaneller = structuredClone(VARSAYILAN_YAN_PANELLER);
      }
    } catch {
      // İlk açılış ya da bozuk dosya: varsayılanlarla devam.
    }
  }

  /*
   * Gizli pencere: asıl profilin yer imleri ve geçmişi SALT OKUNUR içe alınır.
   * Yalnız bu iki alan alınır (parola, izin, indirme vb. gizli pencereye
   * sızmaz). Sonrasında bu store diske HİÇ yazmaz: gizli pencerede eklenen
   * yer imi/silinen geçmiş yalnızca o pencerenin ömrü boyunca bellekte kalır
   * ve asıl profil dosyası (başka süreç yazıyor) ezilmez.
   */
  gizliPencereIcinYukle(asilDosya) {
    this.salt = true;
    if (!asilDosya || path.basename(asilDosya) !== 'pusula-veri.json') return false;
    try {
      const kayit = JSON.parse(fs.readFileSync(asilDosya, 'utf8'));
      if (Array.isArray(kayit.yerImleri)) this.veri.yerImleri = kayit.yerImleri;
      if (Array.isArray(kayit.gecmis)) this.veri.gecmis = kayit.gecmis;
      this._yerImiDegisti();
      return true;
    } catch {
      return false;
    }
  }

  // Geçici dosyaya yazıp yeniden adlandırıyoruz: yazma sırasındaki bir çökme
  // mevcut veriyi yarım bırakmasın.
  _diskeYaz() {
    if (this.salt) return;
    try {
      fs.mkdirSync(path.dirname(this.dosya), { recursive: true });
      const gecici = this.dosya + '.tmp';
      fs.writeFileSync(gecici, JSON.stringify(this.veri, null, 2), 'utf8');
      fs.renameSync(gecici, this.dosya);
    } catch (e) {
      console.error('Ayarlar kaydedilemedi:', e.message);
    }
  }

  // Diske yazmayı topluca yap; her gezinmede senkron yazmak arayüzü takar.
  kaydet() {
    if (this._zamanlayici) return;
    this._zamanlayici = setTimeout(() => {
      this._zamanlayici = null;
      this._diskeYaz();
    }, 400);
  }

  hemenKaydet() {
    if (this._zamanlayici) {
      clearTimeout(this._zamanlayici);
      this._zamanlayici = null;
    }
    this._diskeYaz();
  }

  get ayarlar() { return this.veri.ayarlar; }

  ayarla(anahtar, deger) {
    this.veri.ayarlar[anahtar] = deger;
    this.kaydet();
    return this.veri.ayarlar;
  }

  gecmiseEkle(url, baslik, gizli = false) {
    if (gizli || this.salt || process.argv.includes('--gizli-pencere')) return;
    if (!this.veri.ayarlar.gecmisiKaydet) return;
    // Yalnızca gerçek web adresleri: data:/blob:/view-source:/file: diske yazılmaz.
    if (!url || !/^https?:\/\//i.test(url)) return;
    const son = this.veri.gecmis[0];
    if (son && son.url === url) {
      // Başlık da değişmediyse diske yazmaya değmez; başlığını sürekli
      // güncelleyen siteler saniyede birkaç kez kayıt tetikliyordu.
      const ayni = son.baslik === (baslik || son.baslik);
      son.baslik = baslik || son.baslik;
      son.zaman = Date.now();
      if (ayni) return;
    } else {
      this.veri.gecmis.unshift({ url, baslik: baslik || url, zaman: Date.now() });
      if (this.veri.gecmis.length > MAX_GECMIS) this.veri.gecmis.length = MAX_GECMIS;
      if (typeof this.gecmisKancasi === 'function') {
        try { this.gecmisKancasi(this.veri.gecmis[0]); } catch { /* kanca hatası kaydı durdurmasın */ }
      }
    }
    this.kaydet();
  }

  gecmisAra(sorgu, limit = 200) {
    const q = String(sorgu || '').toLowerCase().trim();
    const kaynak = this.veri.gecmis;
    if (!q) return kaynak.slice(0, limit);
    return kaynak.filter(k =>
      k.url.toLowerCase().includes(q) || (k.baslik || '').toLowerCase().includes(q)
    ).slice(0, limit);
  }

  // Yeni sekme sayfasındaki "Sık gidilenler" için: alan adı başına tekilleştirip
  // ziyaret sayısına, eşitlikte tazeliğe göre sıralar.
  sikGidilenler(limit = 8) {
    const kovalar = new Map();
    for (const k of this.veri.gecmis) {
      let host;
      try { host = new URL(k.url).hostname.replace(/^www\./, ''); } catch { continue; }
      if (!host) continue;
      const v = kovalar.get(host);
      if (v) {
        v.sayi++;
        if (k.zaman > v.zaman) { v.zaman = k.zaman; v.url = k.url; v.baslik = k.baslik; }
      } else {
        kovalar.set(host, { host, url: k.url, baslik: k.baslik || host, zaman: k.zaman, sayi: 1 });
      }
    }
    return [...kovalar.values()]
      .sort((a, b) => (b.sayi - a.sayi) || (b.zaman - a.zaman))
      .slice(0, limit)
      .map(v => ({ url: v.url, host: v.host, baslik: v.baslik, sayi: v.sayi }));
  }

  gecmisiTemizle() {
    this.veri.gecmis = [];
    this.hemenKaydet();
  }

  gecmisTekilSil(url, zaman) {
    if (!url) return false;
    const oncekiUzunluk = this.veri.gecmis.length;
    this.veri.gecmis = this.veri.gecmis.filter(k => {
      if (zaman != null) {
        return !(k.url === url && k.zaman === zaman);
      }
      return k.url !== url;
    });
    if (this.veri.gecmis.length !== oncekiUzunluk) {
      this.hemenKaydet();
      return true;
    }
    return false;
  }

  /*
   * Değişmez: "geçmişi kaydetme" kapalıyken saklanan geçmiş BOŞ tutulur.
   * gecmiseEkle() yalnızca yeni eklemeyi durduruyor; ayar kapatılmadan önce
   * birikmiş kayıtlar diskte kalıp açılışta geri geliyordu. Bu yüzden hem
   * açılışta hem ayar kapatılınca çağrılır; kuralı tek yerde tutar.
   * Döner: temizleme yapıldıysa true.
   */
  gecmisPolitikasiniUygula() {
    if (!this.veri.ayarlar.gecmisiKaydet && this.veri.gecmis.length) {
      this.gecmisiTemizle();
      return true;
    }
    return false;
  }

  /*
   * Yer imi listesi her değiştiğinde artan sürüm. durum yayını yer imlerini
   * (favicon'larıyla ~6 KB) yalnızca bu sürüm değişince gönderiyor; sayfa
   * geçişi/yükleme gibi olaylarda boşuna tekrar tekrar yollamıyor.
   */
  get yerImiSurum() { return this._yerImiSurum || 0; }
  _yerImiDegisti() { this._yerImiSurum = (this._yerImiSurum || 0) + 1; }

  yerImiVarMi(url) {
    return this.veri.yerImleri.some(y => y.url === url);
  }

  topluYerImiEkle(liste) {
    if (!Array.isArray(liste)) return 0;
    const mevcutlar = new Set(this.veri.yerImleri.map(y => y.url));
    let eklenen = 0;
    for (const item of liste) {
      if (item && item.url && !mevcutlar.has(item.url)) {
        mevcutlar.add(item.url);
        this.veri.yerImleri.push({
          url: item.url,
          baslik: item.baslik || item.url,
          zaman: item.zaman || Date.now(),
          klasor: (item.klasor || '').trim()
        });
        eklenen++;
      }
    }
    if (eklenen > 0) {
      this._yerImiDegisti();
      this.hemenKaydet();
    }
    return eklenen;
  }

  topluGecmisEkle(liste) {
    if (!Array.isArray(liste) || !this.veri.ayarlar.gecmisiKaydet) return 0;
    let eklenen = 0;
    for (const item of liste) {
      if (!item || !item.url || !/^https?:\/\//i.test(item.url)) continue;
      this.veri.gecmis.push({
        url: item.url,
        baslik: item.baslik || item.url,
        zaman: item.zaman || Date.now()
      });
      eklenen++;
    }
    if (this.veri.gecmis.length > MAX_GECMIS) {
      this.veri.gecmis.length = MAX_GECMIS;
    }
    if (eklenen > 0) {
      this.hemenKaydet();
    }
    return eklenen;
  }

  yerImiEkle(url, baslik, klasor = '') {
    if (!url) return false;
    const k = (klasor || '').trim();
    const i = this.veri.yerImleri.findIndex(y => y.url === url);
    if (i >= 0) {
      if (baslik) this.veri.yerImleri[i].baslik = baslik.trim().slice(0, 200);
      this.veri.yerImleri[i].klasor = k;
    } else {
      this.veri.yerImleri.unshift({
        url,
        baslik: (baslik || url).trim().slice(0, 200),
        zaman: Date.now(),
        klasor: k
      });
    }
    this._yerImiDegisti();
    this.kaydet();
    return true;
  }

  yerImiDegistir(url, baslik, klasor = '') {
    const i = this.veri.yerImleri.findIndex(y => y.url === url);
    if (i >= 0) this.veri.yerImleri.splice(i, 1);
    else this.veri.yerImleri.unshift({ url, baslik: baslik || url, zaman: Date.now(), klasor: (klasor || '').trim() });
    this._yerImiDegisti();
    this.kaydet();
    return i < 0;
  }

  yerImiSil(url) {
    const i = this.veri.yerImleri.findIndex(y => y.url === url);
    if (i >= 0) { this.veri.yerImleri.splice(i, 1); this._yerImiDegisti(); this.kaydet(); }
  }

  // Yer iminin adını, adresini ve/veya klasörünü değiştirir.
  yerImiGuncelle(eskiUrl, { ad, url, klasor }) {
    const y = this.veri.yerImleri.find(k => k.url === eskiUrl);
    if (!y) return false;
    if (typeof ad === 'string') y.baslik = ad.trim().slice(0, 200) || y.baslik;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      // Aynı adrese ikinci bir kayıt oluşmasın.
      if (url !== eskiUrl && this.veri.yerImleri.some(k => k.url === url)) return false;
      y.url = url;
    }
    if (typeof klasor === 'string') {
      y.klasor = klasor.trim();
    }
    this._yerImiDegisti();
    this.kaydet();
    return true;
  }

  yerImiKlasorleri() {
    const set = new Set();
    for (const y of this.veri.yerImleri) {
      if (y.klasor && typeof y.klasor === 'string') {
        const k = y.klasor.trim();
        if (k) set.add(k);
      }
    }
    return Array.from(set).sort();
  }

  yerImiKlasorSil(klasorAdi) {
    if (!klasorAdi) return false;
    const hedef = klasorAdi.trim();
    const oncekiSayi = this.veri.yerImleri.length;
    this.veri.yerImleri = this.veri.yerImleri.filter(y => {
      const k = (y.klasor || '').trim();
      return k !== hedef && !k.startsWith(hedef + '/');   // alt klasörler de gider
    });
    if (this.veri.yerImleri.length !== oncekiSayi) {
      this._yerImiDegisti();
      this.hemenKaydet();
      return true;
    }
    return false;
  }

  yerImiKlasorYenidenAdlandir(eskiAd, yeniAd) {
    if (!eskiAd) return false;
    const eski = eskiAd.trim();
    const yeni = (yeniAd || '').trim();
    let degisti = false;
    for (const y of this.veri.yerImleri) {
      const k = (y.klasor || '').trim();
      if (k === eski) {
        y.klasor = yeni;
        degisti = true;
      } else if (k.startsWith(eski + '/')) {
        y.klasor = yeni + k.slice(eski.length);   // alt klasörler yolu izler
        degisti = true;
      }
    }
    if (degisti) {
      this._yerImiDegisti();
      this.hemenKaydet();
    }
    return degisti;
  }

  // Verilen adres sırasına göre yeniden dizer; listede olmayanlar sonda kalır.
  yerImiSirala(sirali) {
    if (!Array.isArray(sirali)) return false;
    const konum = new Map(sirali.map((u, i) => [u, i]));
    this.veri.yerImleri.sort((a, b) => {
      const x = konum.has(a.url) ? konum.get(a.url) : Number.MAX_SAFE_INTEGER;
      const y = konum.has(b.url) ? konum.get(b.url) : Number.MAX_SAFE_INTEGER;
      return x - y;
    });
    this._yerImiDegisti();
    this.kaydet();
    return true;
  }

  engellendiSay(adet = 1) {
    this.veri.istatistik.engellenen += adet;
    this.kaydet();
  }

  siteIzinliMi(alanAdi) {
    return this.veri.siteIzinleri.includes(alanAdi);
  }

  siteIzniDegistir(alanAdi) {
    const i = this.veri.siteIzinleri.indexOf(alanAdi);
    if (i >= 0) this.veri.siteIzinleri.splice(i, 1);
    else this.veri.siteIzinleri.push(alanAdi);
    this.kaydet();
    return i < 0;
  }

  /*
   * Üçüncü taraf çerez istisnası. Anahtar, isteğin değil SEKMEDEKİ sayfanın
   * kökü: kullanıcı "şu sitede çerezler çalışsın" diyor, "şu izleyici her
   * yerde çalışsın" demiyor.
   */
  cerezIstisnasiMi(kok) {
    return this.veri.cerezIstisnalari.includes(kok);
  }

  cerezIstisnasiDegistir(kok) {
    if (!kok) return false;
    const i = this.veri.cerezIstisnalari.indexOf(kok);
    if (i >= 0) this.veri.cerezIstisnalari.splice(i, 1);
    else this.veri.cerezIstisnalari.push(kok);
    this.kaydet();
    return i < 0;
  }

  /*
   * Kapanışta silinmeyecek kökler: yer imleri. Ayrı bir "korunan siteler"
   * listesi tutmuyoruz; kullanıcının zaten bilerek işaretlediği siteler bu
   * soruya yeterince iyi cevap veriyor ve doldurulmayı bekleyen boş bir liste
   * bırakmıyor.
   */
  korunanCerezKokleri(kokBul) {
    const kokler = new Set();
    for (const y of this.veri.yerImleri) {
      let host;
      try { host = new URL(y.url).hostname; } catch { continue; }
      const kok = kokBul(host);
      if (kok) kokler.add(kok);
    }
    return kokler;
  }

  izinKaydet(origin, izinAdi, karar) {
    if (!this.veri.izinler[origin]) this.veri.izinler[origin] = {};
    this.veri.izinler[origin][izinAdi] = karar;
    this.kaydet();
  }

  izinOku(origin, izinAdi) {
    return this.veri.izinler[origin] && this.veri.izinler[origin][izinAdi];
  }

  /*
   * Site izin duvarı için üç durumlu ayar. 'sor' kaydı SİLER: kayıt yokluğu
   * zaten "genel varsayılana dön" demek. Ayrı bir 'sor' değeri saklamak,
   * varsayılan sonradan değişince kullanıcının hiç vermediği bir kararı
   * dondurmuş olurdu.
   */
  izinAyarla(origin, izinAdi, karar) {
    if (karar === 'sor') {
      if (this.veri.izinler[origin]) {
        delete this.veri.izinler[origin][izinAdi];
        if (!Object.keys(this.veri.izinler[origin]).length) delete this.veri.izinler[origin];
        this.kaydet();
      }
      return true;
    }
    if (karar !== 'izin' && karar !== 'ret') return false;
    this.izinKaydet(origin, izinAdi, karar);
    return true;
  }

  // Bir sitenin hatırlanan bütün kararları.
  izinlerOku(origin) {
    return { ...(this.veri.izinler[origin] || {}) };
  }

  // Kayıtlı kararı olan siteler; izin duvarı listesinde gösteriliyor.
  izinliOriginler() {
    return Object.keys(this.veri.izinler).sort();
  }

  izinVarsayilanAyarla(izinAdi, karar) {
    this.veri.ayarlar.izinVarsayilan[izinAdi] = karar;
    this.kaydet();
    return this.veri.ayarlar.izinVarsayilan;
  }

  // Tek bir sitenin hatırlanan izin kararlarını siler.
  izinSil(origin) {
    if (!this.veri.izinler[origin]) return false;
    delete this.veri.izinler[origin];
    this.kaydet();
    return true;
  }

  izinleriTemizle() {
    this.veri.izinler = {};
    this.veri.siteIzinleri = [];
    this.veri.cerezIstisnalari = [];
    this.hemenKaydet();
  }

  parolaListesi(filtre = '') {
    const dize = String(filtre || '').trim().toLowerCase();
    const l = this.veri.parolalar || [];
    if (!dize) return l;
    return l.filter(p => (p.origin && p.origin.toLowerCase().includes(dize))
      || (p.kullaniciAdi && p.kullaniciAdi.toLowerCase().includes(dize)));
  }

  parolaEkle({ origin, kullaniciAdi, parola }) {
    if (!this.veri.parolalar) this.veri.parolalar = [];
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const kayit = {
      id,
      origin: String(origin || '').trim(),
      kullaniciAdi: String(kullaniciAdi || '').trim(),
      parola: String(parola || ''),
      zaman: Date.now()
    };
    this.veri.parolalar.push(kayit);
    this.kaydet();
    return kayit;
  }

  parolaSil(id) {
    if (!this.veri.parolalar) return false;
    const ilk = this.veri.parolalar.length;
    this.veri.parolalar = this.veri.parolalar.filter(p => p.id !== id);
    if (this.veri.parolalar.length !== ilk) {
      this.kaydet();
      return true;
    }
    return false;
  }

  /** Arayüze özel anahtar ASLA verilmez; yalnızca gösterim alanları. */
  gecisAnahtarListesi(filtre = '') {
    const dize = String(filtre || '').trim().toLowerCase();
    return (this.veri.gecisAnahtarlari || [])
      .filter((k) => !dize || [k.rpId, k.rpAdi, k.kullaniciAdi, k.kullaniciGoruntu]
        .some((a) => a && String(a).toLowerCase().includes(dize)))
      .map(({ id, rpId, rpAdi, kullaniciAdi, kullaniciGoruntu, zaman, sonKullanim }) =>
        ({ id, rpId, rpAdi, kullaniciAdi, kullaniciGoruntu, zaman, sonKullanim }));
  }

  gecisAnahtarHam() { return this.veri.gecisAnahtarlari || []; }

  gecisAnahtarEkle(kayit) {
    if (!this.veri.gecisAnahtarlari) this.veri.gecisAnahtarlari = [];
    // Aynı site + aynı kullanıcı kimliği: yeni anahtar eskisinin yerini alır.
    this.veri.gecisAnahtarlari = this.veri.gecisAnahtarlari
      .filter((k) => !(k.rpId === kayit.rpId && k.kullaniciKimlik === kayit.kullaniciKimlik));
    this.veri.gecisAnahtarlari.push(kayit);
    this.hemenKaydet();
    return kayit;
  }

  gecisAnahtarKullanildi() { this.hemenKaydet(); }

  gecisAnahtarSil(id) {
    const ilk = (this.veri.gecisAnahtarlari || []).length;
    this.veri.gecisAnahtarlari = (this.veri.gecisAnahtarlari || []).filter((k) => k.id !== id);
    if (this.veri.gecisAnahtarlari.length === ilk) return false;
    this.hemenKaydet();
    return true;
  }
}

module.exports = { Store, DEFAULTS, VARSAYILAN_YAN_PANELLER };
