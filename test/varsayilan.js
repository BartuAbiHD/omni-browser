'use strict';
// Windows "Varsayılan uygulamalar" kaydı: yazılacak anahtarların biçimi (registry'ye dokunmadan).
const V = require('../src/varsayilan-windows');

let hata = 0, gecen = 0;
function esit(ad, bulunan, beklenen) {
  if (JSON.stringify(bulunan) === JSON.stringify(beklenen)) { gecen++; return; }
  hata++;
  console.error('✗ ' + ad + '\n   bulunan:  ' + JSON.stringify(bulunan) + '\n   beklenen: ' + JSON.stringify(beklenen));
}

esit('paketli komut', V.komutOlustur({ exe: 'C:\\Uygulama\\cvs.exe', uygulamaYolu: null }), '"C:\\Uygulama\\cvs.exe" "%1"');
esit('geliştirme komutu uygulama klasörünü içerir',
  V.komutOlustur({ exe: 'C:\\e\\electron.exe', uygulamaYolu: 'H:\\Proje' }), '"C:\\e\\electron.exe" "H:\\Proje" "%1"');

const k = V.kayitlar({ komut: '"x.exe" "%1"', ikon: 'x.ico', ad: 'CVS Browser', aciklama: 'Açıklama' });
const bul = (anahtar, ad) => k.find((r) => r[0] === anahtar && r[1] === ad);
const deger = (anahtar, ad) => { const r = bul(anahtar, ad); return r ? r[2] : undefined; };
const CAP = 'HKCU\\' + V.CAP;

esit('yalnızca HKCU (yönetici gerektirmez)', k.every((r) => r[0].startsWith('HKCU\\')), true);
esit('http ilişkisi', deger(CAP + '\\URLAssociations', 'http'), 'CVSBrowserURL');
esit('https ilişkisi', deger(CAP + '\\URLAssociations', 'https'), 'CVSBrowserURL');
esit('.html ilişkisi', deger(CAP + '\\FileAssociations', '.html'), 'CVSBrowserHTML');
esit('.htm ilişkisi', deger(CAP + '\\FileAssociations', '.htm'), 'CVSBrowserHTML');
esit('uygulama adı', deger(CAP, 'ApplicationName'), 'CVS Browser');
esit('uygulama açıklaması', deger(CAP, 'ApplicationDescription'), 'Açıklama');
esit('uygulama simgesi (yol,indeks biçimi)', deger(CAP, 'ApplicationIcon'), 'x.ico,0');
esit('simge zaten indeksliyse dokunulmaz', V.kayitlar({ komut: 'k', ikon: 'a.exe,3' }).find((r) => r[1] === 'ApplicationIcon')[2], 'a.exe,3');
esit('InstallInfo IconsVisible', deger('HKCU\\Software\\Clients\\StartMenuInternet\\CVSBrowser\\InstallInfo', 'IconsVisible'), '1');
esit('kayıt sürümü işareti', !!deger('HKCU\\Software\\Clients\\StartMenuInternet\\CVSBrowser', 'KayitSurumu'), true);
esit('RegisteredApplications girdisi', deger('HKCU\\Software\\RegisteredApplications', 'CVS Browser'), V.CAP);
esit('StartMenuInternet kaydı', deger(CAP + '\\StartMenu', 'StartMenuInternet'), 'CVSBrowser');
esit('URL ProgId komutu', deger('HKCU\\Software\\Classes\\CVSBrowserURL\\shell\\open\\command', null), '"x.exe" "%1"');
esit('HTML ProgId komutu', deger('HKCU\\Software\\Classes\\CVSBrowserHTML\\shell\\open\\command', null), '"x.exe" "%1"');
esit('URL Protocol işareti', !!bul('HKCU\\Software\\Classes\\CVSBrowserURL', 'URL Protocol'), true);
esit('Clients altında komut', deger('HKCU\\Software\\Clients\\StartMenuInternet\\CVSBrowser\\shell\\open\\command', null), '"x.exe" "%1"');

if (hata) { console.error('\n' + hata + ' varsayılan uygulama testi başarısız.'); process.exit(1); }
console.log('✓ ' + gecen + ' varsayılan uygulama testinin hepsi geçti.');
