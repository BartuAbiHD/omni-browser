'use strict';
// Eklenti modülü: kimlik çözümleme, CRX2/3, güvenli ZIP açma, yönetici akışı (sahte oturum).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const E = require('../src/eklentiler');
const { zipYap, crx3 } = require('./yardimci-crx');

let hata = 0, gecen = 0;
function esit(ad, bulunan, beklenen) {
  if (JSON.stringify(bulunan) === JSON.stringify(beklenen)) { gecen++; return; }
  hata++;
  console.error('✗ ' + ad + '\n   bulunan:  ' + JSON.stringify(bulunan) + '\n   beklenen: ' + JSON.stringify(beklenen));
}
function firlatir(ad, fn, parca) {
  try { fn(); } catch (e) {
    if (!parca || e.message.includes(parca)) { gecen++; return; }
    hata++; console.error('✗ ' + ad + ' yanlış hata: ' + e.message); return;
  }
  hata++; console.error('✗ ' + ad + ' hata fırlatmadı');
}

const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = publicKey.export({ type: 'spki', format: 'der' });
const KIMLIK = E.acikAnahtardanKimlik(der);
esit('kimlik 32 harf a-p', /^[a-p]{32}$/.test(KIMLIK), true);

// kimlik çözümleme
esit('düz kimlik', E.magazaIdCoz(KIMLIK), KIMLIK);
esit('yeni mağaza adresi', E.magazaIdCoz('https://chromewebstore.google.com/detail/ublock/' + KIMLIK + '?hl=tr'), KIMLIK);
esit('eski mağaza adresi', E.magazaIdCoz('https://chrome.google.com/webstore/detail/x/' + KIMLIK), KIMLIK);
esit('http reddedilir', E.magazaIdCoz('http://chromewebstore.google.com/detail/x/' + KIMLIK), null);
esit('yabancı alan adı reddedilir', E.magazaIdCoz('https://evil.example/detail/x/' + KIMLIK), null);
esit('geçersiz kimlik', E.magazaIdCoz('abc'), null);
esit('büyük harfli kimlik reddedilir', E.magazaIdCoz(KIMLIK.toUpperCase()), null);
esit('indirme adresi', E.magazaIndirmeAdresi(KIMLIK, '140.0.1.2').includes('x=id%3D' + KIMLIK), true);

// CRX
const manifest = {
  manifest_version: 3, name: '__MSG_ad__', version: '1.2.3', default_locale: 'en',
  action: { default_popup: 'p.html', default_icon: { 48: 'i.png' } },
  permissions: ['storage', 'tabs'], host_permissions: ['https://*/*'], options_page: 'o.html'
};
const zip = zipYap({
  'manifest.json': JSON.stringify(manifest), 'p.html': '<p>x</p>', 'o.html': '<p>o</p>',
  '_locales/en/messages.json': JSON.stringify({ ad: { message: 'Deneme Eklenti' } }),
  'i.png': '\x89PNG\r\n\x1a\n',
  '_metadata/verified_contents.json': '{}', 'js/a.js': 'var a=1;'
});
const c3 = E.crxCoz(crx3(zip, der));
esit('crx3 anahtar', E.acikAnahtardanKimlik(c3.anahtar), KIMLIK);
esit('crx3 zip gövdesi', c3.zip.equals(zip), true);
esit('düz zip', E.crxCoz(zip).anahtar, null);
firlatir('bozuk crx', () => E.crxCoz(Buffer.from('Cr24xxxxxxxxxxxxxxxx')), '');
firlatir('rastgele veri', () => E.crxCoz(Buffer.from('merhaba dünya')), 'Geçersiz');
const v2 = (() => {
  const u = Buffer.alloc(16);
  u.write('Cr24', 0, 'latin1'); u.writeUInt32LE(2, 4); u.writeUInt32LE(der.length, 8); u.writeUInt32LE(4, 12);
  return Buffer.concat([u, der, Buffer.alloc(4), zip]);
})();
const c2 = E.crxCoz(v2);
esit('crx2 anahtar', E.acikAnahtardanKimlik(c2.anahtar), KIMLIK);
esit('crx2 zip', c2.zip.equals(zip), true);

// ZIP açma
const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-ekl-'));
E.zipAc(zip, path.join(gecici, 'a'));
esit('manifest açıldı', fs.existsSync(path.join(gecici, 'a', 'manifest.json')), true);
esit('iç dizin açıldı', fs.readFileSync(path.join(gecici, 'a', 'js', 'a.js'), 'utf8'), 'var a=1;');
esit('_metadata atlandı', fs.existsSync(path.join(gecici, 'a', '_metadata')), false);
firlatir('zip-slip (..)', () => E.zipAc(zipYap({ '../evil.txt': 'x' }), path.join(gecici, 'b')), 'Güvensiz');
firlatir('zip-slip (iç ..)', () => E.zipAc(zipYap({ 'a/../../evil.txt': 'x' }), path.join(gecici, 'b')), 'Güvensiz');
firlatir('mutlak yol', () => E.zipAc(zipYap({ '/etc/evil': 'x' }), path.join(gecici, 'b')), 'Güvensiz');
firlatir('sürücü harfi', () => E.zipAc(zipYap({ 'C:/evil': 'x' }), path.join(gecici, 'b')), 'Güvensiz');
esit('kaçış dosyası yazılmadı', fs.existsSync(path.join(gecici, 'evil.txt')), false);
firlatir('bozuk zip', () => E.zipAc(Buffer.from('PK nope'), path.join(gecici, 'c')), '');

// manifest yardımcıları
esit('mesajCoz', E.mesajCoz('__MSG_ad__', path.join(gecici, 'a'), manifest, 'tr'), 'Deneme Eklenti');
esit('düz metin', E.mesajCoz('Düz', path.join(gecici, 'a'), manifest, 'tr'), 'Düz');
esit('eylem', E.eylemBilgisi(manifest).popup, 'p.html');
esit('seçenekler', E.secenekSayfasi(manifest), 'o.html');
esit('izinler', E.izinOzeti(manifest).izinler, ['storage', 'tabs']);
esit('siteler', E.izinOzeti(manifest).siteler, ['https://*/*']);
esit('simge data url', (E.simgeVeriUrl(path.join(gecici, 'a'), manifest) || '').startsWith('data:image/png;base64,'), true);

// Yönetici akışı (sahte oturum)
(async () => {
  const yuklenen = new Map();
  const ses = {
    extensions: {
      async loadExtension(yol) { yuklenen.set(KIMLIK, yol); return { id: KIMLIK }; },
      removeExtension(id) { yuklenen.delete(id); }
    }
  };
  const store = { veri: { eklentiler: {} }, kaydet() {} };
  const kok = path.join(gecici, 'kok');
  fs.mkdirSync(kok);
  const y = new E.EklentiYoneticisi({ ses, store, dizin: kok, indir: async () => crx3(zip, der), chromeSurumu: '140.0.0.0', dil: 'tr' });

  const hazir = await y.hazirlaMagaza(KIMLIK);
  esit('hazır ad', hazir.ad, 'Deneme Eklenti');
  esit('hazır kimlik', hazir.kimlik, KIMLIK);
  esit('hazırken yüklenmedi', yuklenen.size, 0);
  const man = JSON.parse(fs.readFileSync(path.join(hazir.gecici, 'manifest.json'), 'utf8'));
  esit('manifest.key yazıldı', man.key, der.toString('base64'));

  const id = await y.tamamla(hazir, 'magaza');
  esit('kuruldu', id, KIMLIK);
  esit('yüklendi', yuklenen.has(KIMLIK), true);
  esit('kurulu mu', y.kurulu(KIMLIK), true);
  esit('varsayılan sabit', y.liste()[0].sabit, true);
  esit('liste adı', y.liste()[0].ad, 'Deneme Eklenti');
  const s0 = y.surum;
  y.sabitle(KIMLIK, false);
  esit('sabit kalktı', y.liste()[0].sabit, false);
  esit('sürüm arttı', y.surum > s0, true);
  await y.etkinYap(KIMLIK, false);
  esit('pasif: boşaltıldı', yuklenen.has(KIMLIK), false);
  esit('pasif işareti', y.liste()[0].etkin, false);
  await y.etkinYap(KIMLIK, true);
  esit('tekrar yüklendi', yuklenen.has(KIMLIK), true);

  // yeniden başlatma
  yuklenen.clear();
  const y2 = new E.EklentiYoneticisi({ ses, store, dizin: kok, indir: async () => { throw new Error('ağ yok'); }, dil: 'tr' });
  await y2.baslat();
  esit('başlangıçta yüklendi', yuklenen.has(KIMLIK), true);

  let uyusmadi = false;
  try {
    await new E.EklentiYoneticisi({ ses, store, dizin: kok, indir: async () => crx3(zip, der), dil: 'tr' }).hazirlaMagaza('a'.repeat(32));
  } catch (e) { uyusmadi = /eşleşmiyor/.test(e.message); }
  esit('yanlış kimlikli indirme reddedildi', uyusmadi, true);
  esit('geçici dizin temiz', fs.readdirSync(kok).filter((d) => d.startsWith('.kur-')).length, 0);

  await y2.kaldir(KIMLIK);
  esit('kaldırıldı', y2.kurulu(KIMLIK), false);
  esit('dizin silindi', fs.existsSync(path.join(kok, KIMLIK)), false);
  esit('boşaltıldı', yuklenen.has(KIMLIK), false);

  // --- güncelleme protokolü (update2) ---
  esit('guncellemeYaniti ok', E.guncellemeYaniti('<gupdate><app appid="x"><updatecheck codebase="https://clients2.googleusercontent.com/crx/a.crx" status="ok" version="4.2.0"/></app></gupdate>'),
    { durum: 'ok', surum: '4.2.0', codebase: 'https://clients2.googleusercontent.com/crx/a.crx' });
  esit('guncellemeYaniti noupdate', E.guncellemeYaniti('<gupdate><app><updatecheck status="noupdate"/></app></gupdate>').durum, 'noupdate');
  esit('guncellemeYaniti anlaşılmaz', E.guncellemeYaniti('<html>hata</html>'), null);
  esit('sürüm 1.2.10 > 1.2.9', E.surumKarsilastir('1.2.10', '1.2.9'), 1);
  esit('sürüm eşit', E.surumKarsilastir('4.1.5', '4.1.5.0'), 0);
  esit('sürüm küçük', E.surumKarsilastir('1.0', '1.0.1'), -1);
  esit('güvenli adres: googleusercontent', E.guncellemeAdresiGuvenli('https://clients2.googleusercontent.com/crx/a.crx'), true);
  esit('güvenli adres: benzer alan adı', E.guncellemeAdresiGuvenli('https://evilgoogle.com/a.crx'), false);
  esit('güvenli adres: http', E.guncellemeAdresiGuvenli('http://clients2.google.com/a.crx'), false);
  esit('güncelleme adresi kimliği içerir', E.guncellemeAdresi(KIMLIK, '1.0', '140.0.0.0').includes('id%3D' + KIMLIK + '%26v%3D1.0'), true);
  esit('izin artışı yok', E.izinArtti({ permissions: ['storage'] }, { izinler: ['storage'], siteler: [] }), false);
  esit('izin artışı var', E.izinArtti({ permissions: ['storage'] }, { izinler: ['storage', 'cookies'], siteler: [] }), true);
  esit('site artışı var', E.izinArtti({ permissions: ['storage'] }, { izinler: ['storage'], siteler: ['<all_urls>'] }), true);

  // güncelleme akışı: sessiz güncelleme, izin artışında onay, güvensiz adres
  {
    const mf = (surum, izinler) => JSON.stringify({ manifest_version: 3, name: 'Gunc', version: surum, permissions: izinler });
    const crxYap = (surum, izinler) => crx3(zipYap({ 'manifest.json': mf(surum, izinler) }), der);
    const sesG = { extensions: { async loadExtension() { return { id: KIMLIK }; }, removeExtension() {} } };
    const depoG = { veri: { eklentiler: {} }, kaydet() {} };
    const kokG = path.join(gecici, 'kokG');
    fs.mkdirSync(kokG);
    let senaryo = 'sessiz';
    const indirG = async (adres) => {
      if (adres.includes('updatecheck')) {
        const kod = senaryo === 'guvensiz' ? 'https://evil.example/x.crx' : 'https://clients2.googleusercontent.com/crx/x.crx';
        return Buffer.from(senaryo === 'guncel'
          ? '<gupdate><app><updatecheck status="noupdate"/></app></gupdate>'
          : '<gupdate><app><updatecheck codebase="' + kod + '" status="ok" version="2.0"/></app></gupdate>');
      }
      return senaryo === 'izinli' ? crxYap('2.0', ['storage', 'cookies']) : crxYap('2.0', ['storage']);
    };
    const yG = new E.EklentiYoneticisi({ ses: sesG, store: depoG, dizin: kokG, indir: indirG, chromeSurumu: '140.0.0.0', dil: 'tr' });
    // 1.0 sürümünü Web Store kaynaklı kur
    const ilk = yG._hazirla(crxYap('1.0', ['storage']), KIMLIK);
    await yG.tamamla(ilk, 'magaza');
    esit('kaynak magaza kaydedildi', yG.liste()[0].kaynak, 'magaza');

    senaryo = 'guncel';
    let s = await yG.guncellemeKontrol();
    esit('güncel eklenti: değişmedi', [s.guncel, s.guncellenen.length, s.onayGereken.length], [1, 0, 0]);

    senaryo = 'guvensiz';
    s = await yG.guncellemeKontrol();
    esit('güvensiz adres: hata sayıldı, güncellenmedi', [s.hata, s.guncellenen.length, yG.liste()[0].surum], [1, 0, '1.0']);

    senaryo = 'izinli';
    s = await yG.guncellemeKontrol();
    esit('izin artışı: onay bekliyor, sessiz kurulmadı', [s.onayGereken.length, yG.liste()[0].surum], [1, '1.0']);
    yG.iptal(s.onayGereken[0].hazir);
    esit('iptal sonrası geçici dizin temiz', fs.readdirSync(kokG).filter((d) => d.startsWith('.kur-')).length, 0);

    senaryo = 'sessiz';
    yG.sabitle(KIMLIK, false);
    s = await yG.guncellemeKontrol();
    esit('izin artmazsa sessiz güncelleme', [s.guncellenen.length, s.guncellenen[0] && s.guncellenen[0].yeni, yG.liste()[0].surum], [1, '2.0', '2.0']);
    esit('güncelleme sabit tercihini korudu', yG.liste()[0].sabit, false);

    // pasif eklenti güncellenince pasif kalır
    await yG.etkinYap(KIMLIK, false);
    const m = JSON.parse(fs.readFileSync(path.join(yG.dizinOf(KIMLIK), 'manifest.json'), 'utf8'));
    m.version = '1.5';
    fs.writeFileSync(path.join(yG.dizinOf(KIMLIK), 'manifest.json'), JSON.stringify(m));
    s = await yG.guncellemeKontrol();
    esit('pasif eklenti güncellenince pasif kaldı', [s.guncellenen.length, yG.liste()[0].etkin, yG.liste()[0].surum], [1, false, '2.0']);

    // ayrıntı ve dosya erişimi
    await yG.etkinYap(KIMLIK, true);
    const d = yG.detay(KIMLIK);
    esit('detay kaynak', d.kaynak, 'magaza');
    esit('detay mağaza adresi', d.magazaUrl, 'https://chromewebstore.google.com/detail/' + KIMLIK);
    esit('detay boyut > 0', d.boyut > 0, true);
    await yG.dosyaErisimi(KIMLIK, true);
    esit('dosya erişimi kaydedildi', yG.detay(KIMLIK).dosyaErisimi, true);
  }

  fs.rmSync(gecici, { recursive: true, force: true });
  if (hata) { console.error('\n' + hata + ' eklenti testi başarısız.'); process.exit(1); }
  console.log('✓ ' + gecen + ' eklenti testinin hepsi geçti.');
})();
