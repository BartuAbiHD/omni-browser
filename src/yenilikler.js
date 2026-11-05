'use strict';

/*
 * "Yenilikler" penceresinin verisi: güncelleme sonrası ilk açılışta gösterilen
 * sürüm notları. Notlar CHANGELOG.md'nin YALNIZCA ilgili sürüm bölümünden gelir;
 * diğer sürümler çekilse bile gösterilmez.
 *
 * Çeviri: yalnızca herkese açık sürüm notu metni gönderilir (kullanıcı verisi
 * yok) ve yalnızca kullanıcı İngilizce dışında bir dil seçince. Çeviri
 * başarısız olursa İngilizce metin gösterilir.
 */

const CHANGELOG_URL = 'https://raw.githubusercontent.com/BartuAbiHD/omni-browser/refs/heads/main/CHANGELOG.md';
const CEVIRI_URL = 'https://translate.googleapis.com/translate_a/single';
const AZAMI_BOYUT = 2 * 1024 * 1024;

// Arayüz dil kodu -> çeviri servisinin hedef kodu.
const HEDEF_KOD = { zh: 'zh-CN' };

// "2026.11.05" ile "2026.11.5" aynı sürümdür (npm/semver baştaki sıfıra izin vermez).
function surumNormalle(s) {
  return String(s || '').trim().replace(/^v/i, '').split('.')
    .map((p) => (/^\d+$/.test(p) ? String(parseInt(p, 10)) : p)).join('.');
}

/**
 * Markdown içinden tek sürümün bölümünü ayıklar.
 * "## [x.y.z] - tarih" başlığından sonraki "## " başlığına ya da "---" çizgisine kadar.
 * @returns {{surum:string, tarih:string, govde:string}|null}
 */
function surumBolumuAyikla(markdown, surum) {
  const hedef = surumNormalle(surum);
  const satirlar = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let basla = -1;
  let tarih = '';
  let ad = '';
  for (let i = 0; i < satirlar.length; i++) {
    const m = /^##\s+\[?([^\]\s]+)\]?(?:\s*[-–—]\s*(\S.*))?\s*$/.exec(satirlar[i]);
    if (m && surumNormalle(m[1]) === hedef) { basla = i; ad = m[1]; tarih = (m[2] || '').trim(); break; }
  }
  if (basla < 0) return null;
  const govde = [];
  for (let i = basla + 1; i < satirlar.length; i++) {
    if (/^##\s/.test(satirlar[i]) || /^-{3,}\s*$/.test(satirlar[i])) break;
    govde.push(satirlar[i]);
  }
  const metin = govde.join('\n').trim();
  return metin ? { surum: ad, tarih, govde: metin } : null;
}

async function yenilikleriGetir(getir, surum) {
  const ham = await getir(CHANGELOG_URL);
  if (typeof ham !== 'string' || !ham || ham.length > AZAMI_BOYUT) return null;
  return surumBolumuAyikla(ham, surum);
}

/* ---------------- çeviri ---------------- */

function sarkiliKoru(satir) {
  // Kod, adres ve yol parçaları çevrilmez: yer tutucuya alınır.
  const parcalar = [];
  const metin = satir.replace(/`[^`]*`|https?:\/\/[^\s)]+|omni:\/\/[^\s)]+/g, (p) => {
    parcalar.push(p);
    return 'QQ' + (parcalar.length - 1) + 'QQ';
  });
  return { metin, parcalar };
}

async function satirCevir(satir, hedef, getir) {
  const m = /^(\s*(?:[-*+]\s+|\d+\.\s+)?)(.*)$/.exec(satir);
  const onek = m[1];
  const icerik = m[2];
  if (!/[A-Za-z]{2}/.test(icerik)) return satir;

  const { metin, parcalar } = sarkiliKoru(icerik);
  const url = CEVIRI_URL + '?client=gtx&sl=en&dt=t&tl=' + encodeURIComponent(HEDEF_KOD[hedef] || hedef)
    + '&q=' + encodeURIComponent(metin);
  let yanit;
  try { yanit = JSON.parse(await getir(url)); } catch { return null; }
  if (!Array.isArray(yanit) || !Array.isArray(yanit[0])) return null;
  let sonuc = yanit[0].map((p) => (Array.isArray(p) ? p[0] || '' : '')).join('');
  if (!sonuc) return null;

  // Yer tutucular eksiksiz geri gelmediyse satırı bozmamak için özgün metin.
  for (let i = 0; i < parcalar.length; i++) {
    const re = new RegExp('QQ\\s*' + i + '\\s*QQ');
    if (!re.test(sonuc)) return satir;
    sonuc = sonuc.replace(re, () => parcalar[i]);
  }
  sonuc = sonuc.replace(/\*\*\s*([^*]+?)\s*\*\*/g, '**$1**');
  return onek + sonuc.trim();
}

/**
 * Bölüm gövdesini hedef dile çevirir; yapı (başlıklar, madde işaretleri,
 * girintiler) korunur. Çeviri hiç alınamazsa null döner.
 */
async function govdeyiCevir(govde, hedef, getir) {
  const satirlar = govde.split('\n');
  const sonuc = new Array(satirlar.length);
  let basarili = 0;
  let sira = 0;
  const isci = async () => {
    while (sira < satirlar.length) {
      const i = sira++;
      const s = satirlar[i];
      if (!s.trim() || /^#{1,6}\s/.test(s)) { sonuc[i] = s; continue; }
      const c = await satirCevir(s, hedef, getir);
      if (c === null) sonuc[i] = s;
      else { sonuc[i] = c; basarili++; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, isci));
  return basarili > 0 ? sonuc.join('\n') : null;
}

module.exports = { CHANGELOG_URL, surumNormalle, surumBolumuAyikla, yenilikleriGetir, govdeyiCevir };
