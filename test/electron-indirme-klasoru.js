'use strict';

/*
 * İNDİRME KLASÖRÜ AYARI GERÇEK UYGULAMADA ÇALIŞIYOR MU?
 *
 * Ayar doluyken bir dosya indirilince kaydetme penceresi çıkmadan o klasöre
 * yazılmalı.
 */

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const KOK = path.join(__dirname, '..');
const PORT = 9435;
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-indirme-'));
const hedef = path.join(profil, 'indirilenler-hedef');
fs.mkdirSync(hedef);
fs.writeFileSync(path.join(profil, 'pusula-veri.json'), JSON.stringify({ ayarlar: { indirmeKlasoru: hedef } }), 'utf8');

let istek = 0;
const sunucu = http.createServer((q, r) => {
  if (q.url === '/dosya') {
    istek++;
    r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="deneme.txt"' });
    r.end('icerik ' + istek);
    return;
  }
  r.writeHead(200, { 'Content-Type': 'text/html' });
  r.end('<!doctype html><title>t</title><a id="a" href="/dosya" download>x</a>');
});

const sonuc = [];
let hata = 0;
function bak(ad, bulunan, beklenen) {
  const tamam = JSON.stringify(bulunan) === JSON.stringify(beklenen);
  if (!tamam) hata++;
  sonuc.push((tamam ? '  ok   ' : '  HATA ') + ad + (tamam ? '' : '\n         bulunan: ' + JSON.stringify(bulunan) + '\n         beklenen: ' + JSON.stringify(beklenen)));
}

(async () => {
  await new Promise((c) => sunucu.listen(PORT, '127.0.0.1', c));
  const electron = require('electron');
  const cocuk = spawn(electron, ['.', 'http://127.0.0.1:' + PORT + '/dosya', '--user-data-dir=' + profil], { cwd: KOK, stdio: 'ignore' });
  for (let i = 0; i < 40 && !fs.existsSync(path.join(hedef, 'deneme.txt')); i++) await bekle(500);
  bak('ilk indirme ayarlı klasöre yazıldı', fs.existsSync(path.join(hedef, 'deneme.txt')), true);
  bak('içerik doğru', fs.existsSync(path.join(hedef, 'deneme.txt')) && fs.readFileSync(path.join(hedef, 'deneme.txt'), 'utf8'), 'icerik 1');
  cocuk.kill();
  await bekle(800);
  sunucu.close();

  console.log(sonuc.join('\n'));
  console.log(hata ? '\n' + hata + ' indirme klasörü testi başarısız.' : '\n✓ indirme klasörü testlerinin hepsi geçti.');
  try { fs.rmSync(profil, { recursive: true, force: true }); } catch { /* Windows kilidi */ }
  process.exit(hata ? 1 : 0);
})();
