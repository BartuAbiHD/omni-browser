'use strict';

/*
 * omni://flags - deneysel Chromium ozellikleri (chrome://flags benzeri).
 *
 * Saf modul: Electron yok. Katalog + "kullanici durumu -> komut satiri
 * anahtarlari" cevirisi. Anahtarlar uygulama HAZIR OLMADAN verilmek zorunda,
 * bu yuzden main.js ayar dosyasini dogrudan okuyup buraya veriyor; degisiklik
 * yeniden baslatinca gecerli olur.
 *
 * Adlar/aciklamalar chrome://flags gibi teknik ve Ingilizce; arayuz metinleri
 * (baslik, uyari, dugmeler) ise 12 dilde.
 *
 * KATALOGDA YALNIZ GERCEKTEN ETKISI OLAN BAYRAKLAR VAR. Her `ozellik` adi
 * Electron'un Chromium ikilisinde dogrulandi (dize olarak mevcut). Bunun
 * disinda bir ad "calisiyor gibi" gorunup hicbir sey yapmazdi.
 *
 * Kyber/ML-KEM: TLS tarafi (X25519MLKEM768) bu Chromium surumunde artik bir
 * base::Feature DEGIL, yalnizca kurumsal ilkeyle (PostQuantumKeyAgreementEnabled)
 * degisiyor; Electron bunu acmiyor. Degistirilebilen kisim WebRTC DTLS
 * post-kuantum anlasmasi (WebRtcPostQuantumKeyAgreement).
 */

const BAYRAKLAR = [
  {
    id: 'webrtc-pq',
    ad: 'WebRTC post-quantum key agreement (Kyber / ML-KEM)',
    aciklama: 'Hybrid post-quantum key exchange for WebRTC (DTLS). Larger handshakes can break some calls and peers. Off by default.',
    ozellik: 'WebRtcPostQuantumKeyAgreement',
    varsayilan: false
  },
  {
    id: 'quic',
    ad: 'QUIC protocol (HTTP/3)',
    aciklama: 'Lets sites use HTTP/3 over UDP. Turn off if a network or middlebox drops UDP.',
    anahtarKapaliyken: 'disable-quic',
    varsayilan: true
  },
  {
    id: 'webrtc-mdns',
    ad: 'WebRTC local IP hiding (mDNS)',
    aciklama: 'Hides local network addresses in WebRTC with random .local names. Turning it off exposes the LAN IP to sites.',
    ozellik: 'WebRtcHideLocalIpsWithMdns',
    varsayilan: true
  },
  {
    id: 'parallel-downloading',
    ad: 'Parallel downloading',
    aciklama: 'Splits large downloads into parallel range requests.',
    ozellik: 'ParallelDownloading',
    varsayilan: true
  },
  {
    id: 'smooth-scrolling',
    ad: 'Smooth scrolling',
    aciklama: 'Animates mouse-wheel and keyboard scrolling.',
    ozellik: 'SmoothScrolling',
    varsayilan: true
  },
  {
    id: 'gpu',
    ad: 'Hardware acceleration',
    aciklama: 'Use the GPU for rendering and video. Turn off if you see black screens or driver crashes.',
    donanim: true,
    varsayilan: true
  }
];

const KIMLIKLER = new Set(BAYRAKLAR.map((b) => b.id));

/** Kullanici durumu: { [id]: 'etkin' | 'kapali' } ; baska her sey atilir. */
function durumuTemizle(ham) {
  const cikti = {};
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return cikti;
  for (const id of Object.keys(ham)) {
    if (KIMLIKLER.has(id) && (ham[id] === 'etkin' || ham[id] === 'kapali')) cikti[id] = ham[id];
  }
  return cikti;
}

function gecerliMi(ham) {
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return false;
  return Object.keys(ham).every((id) => KIMLIKLER.has(id) && (ham[id] === 'etkin' || ham[id] === 'kapali'));
}

function etkinMi(bayrak, durum) {
  const d = durum && durum[bayrak.id];
  if (d === 'etkin') return true;
  if (d === 'kapali') return false;
  return bayrak.varsayilan;
}

/**
 * @returns {{enable: string[], disable: string[], anahtarlar: string[], donanimKapali: boolean}}
 */
function uygula(ham) {
  const durum = durumuTemizle(ham);
  const enable = [];
  const disable = [];
  const anahtarlar = [];
  let donanimKapali = false;
  for (const b of BAYRAKLAR) {
    const acik = etkinMi(b, durum);
    if (b.ozellik) (acik ? enable : disable).push(b.ozellik);
    if (b.anahtarKapaliyken && !acik) anahtarlar.push(b.anahtarKapaliyken);
    if (b.donanim && !acik) donanimKapali = true;
  }
  return { enable, disable, anahtarlar, donanimKapali };
}

/** Arayuze giden liste: katalog + etkin kullanici durumu. */
function liste(ham) {
  const durum = durumuTemizle(ham);
  return BAYRAKLAR.map((b) => ({
    id: b.id,
    ad: b.ad,
    aciklama: b.aciklama,
    varsayilan: b.varsayilan,
    durum: durum[b.id] || 'varsayilan'
  }));
}

module.exports = { BAYRAKLAR, durumuTemizle, gecerliMi, uygula, liste };
