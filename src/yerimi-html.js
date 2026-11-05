'use strict';

/*
 * Yer imlerini Netscape Bookmark HTML biçiminde dışa aktarır (tüm tarayıcıların içe aktardığı
 * ortak biçim; mobil CVS Browser da bunu kullanır). İçe aktarma tarafı
 * src/tarayici-aktar.js içindeki htmlYerImleriAyristir'dir.
 *
 * Klasörler `klasor` alanındaki yola ("a/b") göre iç içe yazılır. Yalnızca http(s) adresleri
 * yazılır (içe aktarma da yalnızca bunları kabul eder).
 */

function kacis(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function yeniDugum() {
  return { alt: new Map(), yerImleri: [] };
}

function htmlYerImleriUret(yerImleri) {
  const kok = yeniDugum();
  let sayi = 0;
  for (const y of Array.isArray(yerImleri) ? yerImleri : []) {
    if (!y || typeof y.url !== 'string' || !/^https?:\/\//i.test(y.url.trim())) continue;
    let dugum = kok;
    const yol = String(y.klasor || '').split('/').map((p) => p.trim()).filter(Boolean);
    for (const parca of yol) {
      if (!dugum.alt.has(parca)) dugum.alt.set(parca, yeniDugum());
      dugum = dugum.alt.get(parca);
    }
    dugum.yerImleri.push(y);
    sayi++;
  }

  const satirlar = [];
  const yaz = (dugum, girinti) => {
    const bosluk = '    '.repeat(girinti);
    for (const y of dugum.yerImleri) {
      const tarih = Math.floor((Number(y.zaman) || Date.now()) / 1000);
      const baslik = kacis((y.baslik || y.url).toString().trim() || y.url);
      satirlar.push(`${bosluk}<DT><A HREF="${kacis(y.url.trim())}" ADD_DATE="${tarih}">${baslik}</A>`);
    }
    for (const [ad, alt] of dugum.alt) {
      satirlar.push(`${bosluk}<DT><H3>${kacis(ad)}</H3>`);
      satirlar.push(`${bosluk}<DL><p>`);
      yaz(alt, girinti + 1);
      satirlar.push(`${bosluk}</DL><p>`);
    }
  };
  yaz(kok, 1);

  const html = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- Bu dosya CVS Browser tarafından oluşturuldu. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    ...satirlar,
    '</DL><p>',
    ''
  ].join('\n');
  return { html, sayi };
}

module.exports = { htmlYerImleriUret };
