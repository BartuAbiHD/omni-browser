'use strict';
// Yenilikler penceresi: sürüm bölümü ayıklama ve çeviri yapısı (ağa çıkmadan).
const Y = require('../src/yenilikler');

let hata = 0, gecen = 0;
function esit(ad, bulunan, beklenen) {
  if (JSON.stringify(bulunan) === JSON.stringify(beklenen)) { gecen++; return; }
  hata++;
  console.error('✗ ' + ad + '\n   bulunan:  ' + JSON.stringify(bulunan) + '\n   beklenen: ' + JSON.stringify(beklenen));
}

const md = [
  '# Changelog', '', '---', '',
  '## [2026.11.05] - 2026-11-05', '', '### Added', '- Yeni **pencere** (`omni://x`)', '  - alt madde', '',
  '---', '',
  '## [1.0.0] - 2026-11-04', '', '### Fixed', '- eski hata', ''
].join('\n');

const b = Y.surumBolumuAyikla(md, '2026.11.5');
esit('baştaki sıfır yok sayılır', b && b.surum, '2026.11.05');
esit('tarih', b && b.tarih, '2026-11-05');
esit('yalnızca ilgili sürüm', b && b.govde, '### Added\n- Yeni **pencere** (`omni://x`)\n  - alt madde');
esit('diğer sürüm ayrı', Y.surumBolumuAyikla(md, '1.0.0').govde, '### Fixed\n- eski hata');
esit('olmayan sürüm', Y.surumBolumuAyikla(md, '9.9.9'), null);

(async () => {
  // Sahte çevirmen: metni büyük harfe çevirir, yer tutucuları aynen korur.
  const getir = async (url) => {
    const q = decodeURIComponent(/[?&]q=([^&]*)/.exec(url)[1]);
    return JSON.stringify([[[q.toUpperCase(), q, null, null]]]);
  };
  const c = await Y.govdeyiCevir(b.govde, 'de', getir);
  esit('yapı korunur, kod parçası çevrilmez', c, '### Added\n- YENI **PENCERE** (`omni://x`)\n  - ALT MADDE');
  esit('çeviri başarısızsa null', await Y.govdeyiCevir(b.govde, 'de', async () => 'bozuk'), null);

  if (hata) { console.error('✗ ' + hata + ' yenilikler testi başarısız'); process.exit(1); }
  console.log('✓ ' + gecen + ' yenilikler testinin hepsi geçti.');
})();
