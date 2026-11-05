'use strict';

/**
 * Tarayıcı içe aktarma motoru testleri: node test/aktar.js
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  TARAYICILAR,
  kuruluTarayicilariBul,
  chromiumYerImleriAyristir,
  htmlYerImleriAyristir
} = require('../src/tarayici-aktar');
const { Store } = require('../src/store');

let gecen = 0;
const hatalar = [];
function esit(ad, bulunan, beklenen) {
  if (Object.is(bulunan, beklenen)) {
    gecen++;
    return;
  }
  hatalar.push(ad + '\n    bulunan:  ' + JSON.stringify(bulunan) + '\n    beklenen: ' + JSON.stringify(beklenen));
}

// 1. Desteklenen tarayıcı kataloğu
esit('Katalog tanımlı', Array.isArray(TARAYICILAR) && TARAYICILAR.length >= 8, true);
const ids = TARAYICILAR.map(t => t.id);
esit('Chrome destekleniyor', ids.includes('chrome'), true);
esit('Brave destekleniyor', ids.includes('brave'), true);
esit('Supermium destekleniyor', ids.includes('supermium'), true);
esit('Vivaldi destekleniyor', ids.includes('vivaldi'), true);
esit('Floorp destekleniyor', ids.includes('floorp'), true);
esit('Firefox destekleniyor', ids.includes('firefox'), true);
esit('Opera One destekleniyor', ids.includes('opera'), true);
esit('Opera GX destekleniyor', ids.includes('opera-gx'), true);

// 2. Kurulu tarayıcı tespiti
const bulunanlar = kuruluTarayicilariBul();
esit('kuruluTarayicilariBul dizi döner', Array.isArray(bulunanlar), true);

// 3. Chromium Bookmarks JSON ayrıştırma
const mockChromiumBm = {
  roots: {
    bookmark_bar: {
      children: [
        {
          name: 'GitHub',
          type: 'url',
          url: 'https://github.com',
          date_added: '13300000000000000'
        },
        {
          name: 'Klasör',
          type: 'folder',
          children: [
            {
              name: 'Google',
              type: 'url',
              url: 'https://google.com'
            },
            {
              name: 'Tehlikeli',
              type: 'url',
              url: 'javascript:alert(1)' // elenmeli
            }
          ]
        }
      ]
    },
    other: {
      children: [
        {
          name: 'DuckDuckGo',
          type: 'url',
          url: 'https://duckduckgo.com'
        }
      ]
    }
  }
};

const ayrismisChromium = chromiumYerImleriAyristir(mockChromiumBm);
esit('Chromium yer imi sayısı doğru (güvenlik süzgeciyle)', ayrismisChromium.length, 3);
esit('Chromium ilk adres', ayrismisChromium[0].url, 'https://github.com');
esit('Chromium kök yer imi klasörü boş', ayrismisChromium[0].klasor, '');
esit('Chromium klasör içindeki adres', ayrismisChromium[1].url, 'https://google.com');
esit('Chromium klasör adı korundu', ayrismisChromium[1].klasor, 'Klasör');
esit('Chromium other klasörü korundu', ayrismisChromium[2].klasor, 'Diğer yer işaretleri');
esit('Bozuk JSON çökmez', chromiumYerImleriAyristir('bozuk json').length, 0);

// 4. Netscape HTML Bookmarks ayrıştırma
const mockHtml = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1600000000">Klasör</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1600000001">Example Domain</A>
        <DT><A HREF="https://mozilla.org" ADD_DATE="1600000002">Mozilla Foundation</A>
        <DT><A HREF="javascript:void(0)">Zararlı</A>
    </DL><p>
</DL><p>
`;

const ayrismisHtml = htmlYerImleriAyristir(mockHtml);
esit('HTML yer imi sayısı doğru', ayrismisHtml.length, 2);
esit('HTML ilk url', ayrismisHtml[0].url, 'https://example.com');
esit('HTML ilk baslik', ayrismisHtml[0].baslik, 'Example Domain');
esit('HTML klasör korundu', ayrismisHtml[0].klasor, 'Klasör');
esit('Boş HTML çökmez', htmlYerImleriAyristir('').length, 0);

// 4b. HTML dışa aktarma (mobil ile ortak Netscape biçimi) ve gidiş-dönüş
{
  const { htmlYerImleriUret } = require('../src/yerimi-html');
  const kaynak = [
    { url: 'https://a.example/?x=1&y=2', baslik: 'A & B <test> "q"', zaman: 1600000000000, klasor: '' },
    { url: 'https://b.example/', baslik: 'B', zaman: 1600000001000, klasor: 'İş' },
    { url: 'https://c.example/', baslik: 'C', zaman: 1600000002000, klasor: 'İş/Alt' },
    { url: 'javascript:alert(1)', baslik: 'kötü', klasor: '' },
    { url: 'https://d.example/', baslik: 'D', zaman: 1600000003000, klasor: 'Tek & Çift' }
  ];
  const { html, sayi } = htmlYerImleriUret(kaynak);
  esit('Dışa aktarma: yalnızca http(s) yazılır', sayi, 4);
  esit('Dışa aktarma: javascript adresi yok', html.includes('javascript:'), false);
  esit('Dışa aktarma: başlık kaçışlı', html.includes('A &amp; B &lt;test&gt; &quot;q&quot;'), true);
  const geri = htmlYerImleriAyristir(html);
  esit('Gidiş-dönüş: sayı', geri.length, 4);
  const al = (u) => geri.find((y) => y.url === u);
  esit('Gidiş-dönüş: url varlıkları çözülür', Boolean(al('https://a.example/?x=1&y=2')), true);
  esit('Gidiş-dönüş: başlık', al('https://a.example/?x=1&y=2').baslik, 'A & B <test> "q"');
  esit('Gidiş-dönüş: kök yer imi klasörsüz', al('https://a.example/?x=1&y=2').klasor, '');
  esit('Gidiş-dönüş: klasör', al('https://b.example/').klasor, 'İş');
  esit('Gidiş-dönüş: iç içe klasörde yaprak ad', al('https://c.example/').klasor, 'Alt');
  esit('Gidiş-dönüş: klasör adı varlığı', al('https://d.example/').klasor, 'Tek & Çift');
  esit('Boş liste çökmez', htmlYerImleriUret([]).sayi, 0);
}

// 5. Store toplu ekleme ve mükerrer kontrolü
const geciciStoreDosya = path.join(os.tmpdir(), `test_store_${Date.now()}.json`);
const store = new Store(geciciStoreDosya);

const eklenecekler = [
  { url: 'https://test1.com', baslik: 'Test 1', klasor: 'xxx' },
  { url: 'https://test2.com', baslik: 'Test 2', klasor: 'xxx' },
  { url: 'https://test1.com', baslik: 'Test 1 Mükerrer', klasor: 'xxx' }
];

const eklenenYerImi = store.topluYerImiEkle(eklenecekler);
esit('Mükerrer yer imi elendi', eklenenYerImi, 2);
esit('Yer imi var mı', store.yerImiVarMi('https://test1.com'), true);
esit('Klasörler listelendi', store.yerImiKlasorleri().includes('xxx'), true);

store.yerImiKlasorYenidenAdlandir('xxx', 'yyy');
esit('Klasör yeniden adlandırıldı', store.yerImiKlasorleri().includes('yyy'), true);
store.yerImiKlasorSil('yyy');
esit('Klasör silindi', store.yerImiKlasorleri().includes('yyy'), false);

const eklenenGecmis = store.topluGecmisEkle([
  { url: 'https://gecmis1.com', baslik: 'Geçmiş 1' },
  { url: 'https://gecmis2.com', baslik: 'Geçmiş 2' },
  { url: 'data:text/html,bad', baslik: 'Zararlı' }
]);
esit('Geçmiş güvenli ekleme sayısı', eklenenGecmis, 2);

// ---- Proton Pass (CSV / JSON) ----
{
  const { protonPassAyristir } = require('../src/tarayici-aktar');
  const csv = 'type,name,url,email,username,password,note,totp,createTime,modifyTime,vault\r\n'
    + 'login,GitHub,https://github.com/login,a@b.c,ali,"p,""q""w",,,1,2,Personal\r\n'
    + 'login,Bos,https://x.com,e@x.com,,sifre2,,,1,2,Personal\r\n'
    + 'note,Not,,,,,metin,,1,2,Personal\r\n'
    + 'login,Kotu,javascript:alert(1),,u,pw,,,1,2,Personal\r\n';
  const c = protonPassAyristir(csv);
  esit('Proton CSV: parola sayısı', c.parolalar.length, 2);
  esit('Proton CSV: tırnaklı parola', c.parolalar[0].parola, 'p,"q"w');
  esit('Proton CSV: kullanıcı yoksa e-posta', c.parolalar[1].kullaniciAdi, 'e@x.com');
  esit('Proton CSV: güvensiz URL atlanır', c.atlanan, 1);
  const j = protonPassAyristir(JSON.stringify({ encrypted: false, vaults: { v: { items: [
    { data: { type: 'login', content: { itemUsername: 'u', password: 'pw', urls: ['https://a.com'], passkeys: [{}, {}] } } },
    { data: { type: 'note', content: {} } }
  ] } } }));
  esit('Proton JSON: parola', j.parolalar.length, 1);
  esit('Proton JSON: çözülemeyen geçiş anahtarı atlanır', j.gecisAtlanan, 2);
  let sifreli = false;
  try { protonPassAyristir('{"encrypted":true}'); } catch { sifreli = true; }
  esit('Proton JSON: şifreli dosya reddedilir', sifreli, true);
}

try {
  fs.unlinkSync(geciciStoreDosya);
} catch {}

if (hatalar.length) {
  console.error('\nBAŞARISIZ (' + hatalar.length + '):\n');
  for (const h of hatalar) console.error('  ✗ ' + h + '\n');
  process.exit(1);
} else {
  console.log(`✓ ${gecen} aktarma testinin hepsi geçti.`);
}
