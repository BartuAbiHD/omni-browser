'use strict';

/**
 * Tema ve dahili sayfa sekme testleri: node test/tema.js
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Store } = require('../src/store');
const { dahiliUrlPanel } = require('../src/urls');

let gecen = 0;
const hatalar = [];
function esit(ad, bulunan, beklenen) {
  if (Object.is(bulunan, beklenen)) {
    gecen++;
    return;
  }
  hatalar.push(ad + '\n    bulunan:  ' + JSON.stringify(bulunan) + '\n    beklenen: ' + JSON.stringify(beklenen));
}

// 1. Dahili sayfa url çözümü (omni:// ve chrome://)
esit('omni://gecmis -> gecmis', dahiliUrlPanel('omni://gecmis'), 'gecmis');
esit('chrome://history -> gecmis', dahiliUrlPanel('chrome://history'), 'gecmis');
esit('omni://yerimleri -> yerImleri', dahiliUrlPanel('omni://yerimleri'), 'yerImleri');
esit('chrome://bookmarks -> yerImleri', dahiliUrlPanel('chrome://bookmarks'), 'yerImleri');
esit('omni://indirilenler -> indirmeler', dahiliUrlPanel('omni://indirilenler'), 'indirmeler');
esit('chrome://downloads -> indirmeler', dahiliUrlPanel('chrome://downloads'), 'indirmeler');
esit('omni://ayarlar -> ayarlar', dahiliUrlPanel('omni://ayarlar'), 'ayarlar');
esit('chrome://settings -> ayarlar', dahiliUrlPanel('chrome://settings'), 'ayarlar');
esit('omni://parolalar -> parolalar', dahiliUrlPanel('omni://parolalar'), 'parolalar');
esit('omni://hiz-testi -> hizTesti', dahiliUrlPanel('omni://hiz-testi'), 'hizTesti');
esit('omni://aktar -> aktarma', dahiliUrlPanel('omni://aktar'), 'aktarma');
esit('omni://flags -> bayraklar', dahiliUrlPanel('omni://flags'), 'bayraklar');
esit('chrome://flags -> bayraklar', dahiliUrlPanel('chrome://flags'), 'bayraklar');
esit('omni://hakkinda -> hakkinda', dahiliUrlPanel('omni://hakkinda'), 'hakkinda');
// İngilizce kanonik adresler: üretilen adres tekrar çözülebilmeli.
const { dahiliAdres } = require('../src/urls');
for (const kod of ['gecmis', 'yerImleri', 'indirmeler', 'ayarlar', 'hakkinda', 'parolalar', 'hizTesti', 'aktarma', 'istatistik']) {
  esit('dahiliAdres gidiş-dönüş: ' + kod, dahiliUrlPanel(dahiliAdres(kod)), kod);
}
esit('omni://history adresi', dahiliAdres('gecmis'), 'omni://history');
esit('omni://bookmarks adresi', dahiliAdres('yerImleri'), 'omni://bookmarks');
esit('omni://settings adresi', dahiliAdres('ayarlar'), 'omni://settings');
esit('https://google.com -> null', dahiliUrlPanel('https://google.com'), null);

// 2. Store gecmisTekilSil ve Tema ayarları
const tmpDir = path.join(os.tmpdir(), 'cvs-test-tema-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });
const storePath = path.join(tmpDir, 'store.json');
const store = new Store(storePath);

// Geçmiş ekleme ve tekil silme
store.veri.gecmis = [
  { url: 'https://site-a.com', baslik: 'Site A', zaman: 1000 },
  { url: 'https://site-b.com', baslik: 'Site B', zaman: 2000 },
  { url: 'https://site-c.com', baslik: 'Site C', zaman: 3000 }
];
store.hemenKaydet();

esit('İlk geçmiş 3 öğe', store.veri.gecmis.length, 3);
const silSonuc = store.gecmisTekilSil('https://site-b.com', 2000);
esit('Tekil silme başarılı döndü', silSonuc, true);
esit('Kalan geçmiş 2 öğe', store.veri.gecmis.length, 2);
esit('Site B silindi', store.veri.gecmis.some(k => k.url === 'https://site-b.com'), false);
esit('Site A ve C duruyor', store.veri.gecmis.length === 2 && store.veri.gecmis[0].url === 'https://site-a.com' && store.veri.gecmis[1].url === 'https://site-c.com', true);

// Olmayan öğeyi silme testi
const olumsuzSonuc = store.gecmisTekilSil('https://olmayan-site.com', 9999);
esit('Olmayan öğe silinmedi', olumsuzSonuc, false);
esit('Kalan geçmiş hala 2 öğe', store.veri.gecmis.length, 2);

// Tema stil ve resim ayarları
esit('Varsayılan temaStil', store.ayarlar.temaStil, 'varsayilan');
store.ayarla('temaStil', 'gece-mavisi');
esit('Yeni temaStil', store.ayarlar.temaStil, 'gece-mavisi');

store.ayarla('temaResmi', 'data:image/png;base64,iVBORw0KGgo=');
esit('Tema resmi kaydedildi', store.ayarlar.temaResmi.startsWith('data:image/png'), true);
store.ayarla('temaResmi', '');
esit('Tema resmi sıfırlandı', store.ayarlar.temaResmi, '');

// Temizlik
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

if (hatalar.length) {
  console.error(hatalar.join('\n\n'));
  process.exit(1);
}
console.log('✓ ' + gecen + ' tema ve dahili sayfa testinin hepsi geçti.');
