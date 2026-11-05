'use strict';
// Test yardımcısı: bellekte ZIP ve CRX3 üretir (eklenti testleri için).
const zlib = require('node:zlib');
const crypto = require('node:crypto');

function crc32(b) {
  let c, crc = ~0;
  for (let i = 0; i < b.length; i++) {
    c = (crc ^ b[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}

function zipYap(dosyalar) {
  const parcalar = [], merkez = [];
  let konum = 0;
  for (const [ad, icerik] of Object.entries(dosyalar)) {
    const adB = Buffer.from(ad), veri = Buffer.isBuffer(icerik) ? icerik : Buffer.from(icerik, 'latin1'), sik = zlib.deflateRawSync(veri);
    const yerel = Buffer.alloc(30);
    yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(20, 4); yerel.writeUInt16LE(8, 8);
    yerel.writeUInt32LE(crc32(veri), 14); yerel.writeUInt32LE(sik.length, 18);
    yerel.writeUInt32LE(veri.length, 22); yerel.writeUInt16LE(adB.length, 26);
    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(8, 10);
    m.writeUInt32LE(crc32(veri), 16); m.writeUInt32LE(sik.length, 20); m.writeUInt32LE(veri.length, 24);
    m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(konum, 42);
    parcalar.push(yerel, adB, sik); merkez.push(m, adB);
    konum += 30 + adB.length + sik.length;
  }
  const mb = Buffer.concat(merkez);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(Object.keys(dosyalar).length, 8); son.writeUInt16LE(Object.keys(dosyalar).length, 10);
  son.writeUInt32LE(mb.length, 12); son.writeUInt32LE(konum, 16);
  return Buffer.concat([...parcalar, mb, son]);
}

const vi = (n) => { const o = []; while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128); } o.push(n); return Buffer.from(o); };
const alan = (no, b) => Buffer.concat([vi(no * 8 + 2), vi(b.length), b]);

function crx3(zip, anahtarDer) {
  const crxId = crypto.createHash('sha256').update(anahtarDer).digest().subarray(0, 16);
  const baslik = Buffer.concat([
    alan(2, Buffer.concat([alan(1, anahtarDer), alan(2, Buffer.alloc(8))])),
    alan(10000, alan(1, crxId))
  ]);
  const ust = Buffer.alloc(12);
  ust.write('Cr24', 0, 'latin1'); ust.writeUInt32LE(3, 4); ust.writeUInt32LE(baslik.length, 8);
  return Buffer.concat([ust, baslik, zip]);
}

module.exports = { zipYap, crx3 };
