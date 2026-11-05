'use strict';

/**
 * Windows'ta "Varsayılan uygulamalar" listesine tarayıcı olarak kayıt.
 *
 * Windows, bir uygulamayı yalnızca kendini TARAYICI olarak kaydettiyse (Capabilities +
 * RegisteredApplications) Ayarlar > Varsayılan uygulamalar listesinde gösterir. Bunu
 * normalde yükleyici yapar; burada yönetici yetkisi gerektirmeyen kullanıcı kaydı (HKCU)
 * olarak çalışma anında yazıyoruz. Böylece kurulu sürüm, taşınabilir sürüm ve
 * `npm start` ile açılan geliştirme sürümü de listede görünür.
 *
 * Yazılan anahtarlar (hepsi HKCU\Software altında):
 *   Classes\CVSBrowserURL   - http/https için ProgId
 *   Classes\CVSBrowserHTML  - .html/.htm/.xhtml için ProgId
 *   Clients\StartMenuInternet\CVSBrowser  - Capabilities (adı, simgesi, URL/dosya ilişkileri)
 *   RegisteredApplications  - "CVS Browser" -> Capabilities yolu
 */

const { execFile } = require('node:child_process');

const ID = 'CVSBrowser';
const URL_PROGID = 'CVSBrowserURL';
const HTML_PROGID = 'CVSBrowserHTML';
const KAYITLI_AD = 'CVS Browser';
const CAP = 'Software\\Clients\\StartMenuInternet\\' + ID + '\\Capabilities';
// Kayıt biçimi değişince artırılır: eski kaydı olan kullanıcılarda kayıt yeniden yazılsın.
const KAYIT_SURUMU = '2';

function reg(args) {
  return new Promise((coz, red) => {
    execFile('reg.exe', args, { windowsHide: true, timeout: 10000 }, (hata, cikti) => {
      if (hata) red(hata); else coz(String(cikti || ''));
    });
  });
}

/** Kaydedilecek [anahtar, değer adı, değer, tür] dörtlüleri; değer adı null ise "(Varsayılan)". */
function kayitlar({ komut, ikon, ad = KAYITLI_AD, aciklama = '' }) {
  const hkcu = (k) => 'HKCU\\' + k;
  const liste = [];
  const ekle = (anahtar, deger, adi = null, tur = 'REG_SZ') => liste.push([hkcu(anahtar), adi, deger, tur]);

  // Windows simge değerlerini "yol,indeks" biçiminde bekler (.ico için de).
  if (!/,-?\d+$/.test(ikon)) ikon += ',0';

  // ProgId'ler
  ekle('Software\\Classes\\' + URL_PROGID, ad + ' URL');
  ekle('Software\\Classes\\' + URL_PROGID, ad + ' URL', 'FriendlyTypeName');
  ekle('Software\\Classes\\' + URL_PROGID, '', 'URL Protocol');
  ekle('Software\\Classes\\' + URL_PROGID, '2', 'EditFlags', 'REG_DWORD');
  ekle('Software\\Classes\\' + URL_PROGID + '\\DefaultIcon', ikon);
  ekle('Software\\Classes\\' + URL_PROGID + '\\shell', 'open');
  ekle('Software\\Classes\\' + URL_PROGID + '\\shell\\open\\command', komut);
  ekle('Software\\Classes\\' + HTML_PROGID, ad + ' HTML');
  ekle('Software\\Classes\\' + HTML_PROGID, ad + ' HTML', 'FriendlyTypeName');
  ekle('Software\\Classes\\' + HTML_PROGID, '2', 'EditFlags', 'REG_DWORD');
  ekle('Software\\Classes\\' + HTML_PROGID + '\\DefaultIcon', ikon);
  ekle('Software\\Classes\\' + HTML_PROGID + '\\shell', 'open');
  ekle('Software\\Classes\\' + HTML_PROGID + '\\shell\\open\\command', komut);

  // Tarayıcı olarak kayıt
  const kok = 'Software\\Clients\\StartMenuInternet\\' + ID;
  ekle(kok, ad);
  ekle(kok, KAYIT_SURUMU, 'KayitSurumu');
  ekle(kok + '\\DefaultIcon', ikon);
  ekle(kok + '\\InstallInfo', '1', 'IconsVisible', 'REG_DWORD');
  ekle(kok + '\\shell\\open\\command', komut);
  ekle(CAP, ad, 'ApplicationName');
  ekle(CAP, aciklama || ad, 'ApplicationDescription');
  ekle(CAP, ikon, 'ApplicationIcon');
  ekle(CAP + '\\URLAssociations', URL_PROGID, 'http');
  ekle(CAP + '\\URLAssociations', URL_PROGID, 'https');
  for (const uz of ['.htm', '.html', '.xhtml', '.shtml']) ekle(CAP + '\\FileAssociations', HTML_PROGID, uz);
  ekle(CAP + '\\StartMenu', ID, 'StartMenuInternet');
  ekle('Software\\RegisteredApplications', CAP, ad);
  return liste;
}

/** Uygulama komutu: geliştirmede (electron.exe) uygulama klasörü de argüman olur. */
function komutOlustur({ exe, uygulamaYolu }) {
  return '"' + exe + '"' + (uygulamaYolu ? ' "' + uygulamaYolu + '"' : '') + ' "%1"';
}

/**
 * Kayıt güncel mi? Komut satırı ve kayıt sürümü eşleşiyorsa true: açılışta gereksiz yere ~30
 * reg.exe çağrısı yapmamak için.
 */
async function guncelMi(komut) {
  try {
    const cikti = await reg(['query', 'HKCU\\Software\\Clients\\StartMenuInternet\\' + ID + '\\shell\\open\\command', '/ve']);
    const regKaydi = await reg(['query', 'HKCU\\Software\\RegisteredApplications', '/v', KAYITLI_AD]);
    const surum = await reg(['query', 'HKCU\\Software\\Clients\\StartMenuInternet\\' + ID, '/v', 'KayitSurumu']);
    return cikti.includes(komut) && regKaydi.includes(CAP)
      && new RegExp('KayitSurumu\\s+REG_SZ\\s+' + KAYIT_SURUMU + '\\s*$', 'm').test(surum);
  } catch { return false; }
}

/**
 * Windows'a "dosya/protokol ilişkileri değişti" bildirimi (SHCNE_ASSOCCHANGED). Yükleyiciler bunu
 * yapar; yapılmazsa Ayarlar > Varsayılan uygulamalar listesi yeni kaydı çıkış-giriş yapılana
 * kadar göstermeyebilir.
 */
function iliskiDegisikligiBildir() {
  const betik = 'Add-Type -Namespace Cvs -Name Kabuk -MemberDefinition '
    + "'[DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int olay, uint bayrak, IntPtr a, IntPtr b);';"
    + '[Cvs.Kabuk]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)';
  return new Promise((coz) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', betik],
      { windowsHide: true, timeout: 15000 }, () => coz());
  });
}

async function kaydet({ exe, uygulamaYolu = null, ikon = null, ad = KAYITLI_AD, aciklama = '' }) {
  if (process.platform !== 'win32') return false;
  const komut = komutOlustur({ exe, uygulamaYolu });
  if (await guncelMi(komut)) return true;
  for (const [anahtar, adi, deger, tur] of kayitlar({ komut, ikon: ikon || exe + ',0', ad, aciklama })) {
    const args = ['add', anahtar, adi === null ? '/ve' : '/v', ...(adi === null ? [] : [adi]), '/t', tur || 'REG_SZ', '/d', deger, '/f'];
    await reg(args);
  }
  await iliskiDegisikligiBildir();
  return true;
}

/** Kayıtları siler (kaldırma betiğinin yaptığının aynısı). */
async function kaldir() {
  if (process.platform !== 'win32') return false;
  const anahtarlar = [
    'HKCU\\Software\\Classes\\' + URL_PROGID,
    'HKCU\\Software\\Classes\\' + HTML_PROGID,
    'HKCU\\Software\\Clients\\StartMenuInternet\\' + ID
  ];
  for (const a of anahtarlar) { try { await reg(['delete', a, '/f']); } catch { /* yoktu */ } }
  try { await reg(['delete', 'HKCU\\Software\\RegisteredApplications', '/v', KAYITLI_AD, '/f']); } catch { /* yoktu */ }
  await iliskiDegisikligiBildir();
  return true;
}

/** Ayarlar'da doğrudan bu uygulamanın varsayılanlar sayfasını açan adres. */
function ayarlarAdresi() {
  return 'ms-settings:defaultapps?registeredAppUser=' + encodeURIComponent(KAYITLI_AD);
}

module.exports = { kaydet, kaldir, kayitlar, komutOlustur, ayarlarAdresi, KAYITLI_AD, CAP };
