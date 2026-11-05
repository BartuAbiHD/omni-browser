'use strict';

/**
 * Geçiş anahtarı (WebAuthn) sayfa tarafı. Sandbox preload'ı: yalnızca electron'a
 * dayanır. navigator.credentials.create/get çağrılarını yakalar, ikili alanları
 * base64url'e çevirip ana sürece iletir; imzalama ve onay ana süreçte yapılır.
 * Sayfaya özel anahtar hiç verilmez, köken ana süreçte gönderen çerçeveden alınır.
 */

/* Aşağıdaki işlev sayfanın ANA dünyasında çalışır; dış değişkenlere erişemez. */
function sayfaYamasi(cagri, kilitle) {
  if (!navigator.credentials || window.__cvsGecisAnahtari) return;
  window.__cvsGecisAnahtari = true;

  const tabloyaB64u = (kaynak) => {
    const u8 = kaynak instanceof ArrayBuffer ? new Uint8Array(kaynak)
      : new Uint8Array(kaynak.buffer, kaynak.byteOffset, kaynak.byteLength);
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64uAyir = (s) => {
    const d = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
    const u8 = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) u8[i] = d.charCodeAt(i);
    return u8.buffer;
  };
  const kimlikler = (liste) => (liste || []).map((c) => ({ id: tabloyaB64u(c.id), type: c.type }));
  const hata = (ad, ileti) => new DOMException(ileti || ad, ad);

  const tanimla = (nesne, alanlar) => {
    for (const [ad, deger] of Object.entries(alanlar)) {
      Object.defineProperty(nesne, ad, { value: deger, enumerable: true, configurable: true });
    }
    return nesne;
  };
  const ornek = (yapici) => Object.create(yapici && yapici.prototype ? yapici.prototype : Object.prototype);

  function kimlikBilgisi(r, olusturma) {
    const yanit = tanimla(ornek(olusturma ? window.AuthenticatorAttestationResponse : window.AuthenticatorAssertionResponse),
      olusturma ? {
        clientDataJSON: b64uAyir(r.clientDataJSON),
        attestationObject: b64uAyir(r.attestationObject),
        getTransports: () => r.transports.slice(),
        getAuthenticatorData: () => b64uAyir(r.authenticatorData),
        getPublicKey: () => b64uAyir(r.publicKey),
        getPublicKeyAlgorithm: () => r.publicKeyAlgorithm
      } : {
        clientDataJSON: b64uAyir(r.clientDataJSON),
        authenticatorData: b64uAyir(r.authenticatorData),
        signature: b64uAyir(r.signature),
        userHandle: r.userHandle ? b64uAyir(r.userHandle) : null
      });
    const json = olusturma ? {
      id: r.id, rawId: r.id, type: 'public-key', authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: r.clientDataJSON, attestationObject: r.attestationObject,
        transports: r.transports, authenticatorData: r.authenticatorData,
        publicKey: r.publicKey, publicKeyAlgorithm: r.publicKeyAlgorithm
      }, clientExtensionResults: {}
    } : {
      id: r.id, rawId: r.id, type: 'public-key', authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: r.clientDataJSON, authenticatorData: r.authenticatorData,
        signature: r.signature, userHandle: r.userHandle || undefined
      }, clientExtensionResults: {}
    };
    return tanimla(ornek(window.PublicKeyCredential), {
      id: r.id, rawId: b64uAyir(r.id), type: 'public-key', response: yanit,
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () => ({}),
      toJSON: () => json
    });
  }

  function bekle(vaat, signal) {
    if (!signal) return vaat;
    if (signal.aborted) return Promise.reject(signal.reason || hata('AbortError'));
    return new Promise((coz, red) => {
      signal.addEventListener('abort', () => red(signal.reason || hata('AbortError')), { once: true });
      vaat.then(coz, red);
    });
  }

  async function yonlendir(tur, pk) {
    const r = await cagri(tur, pk);
    if (r && r.hata) throw hata(r.hata);
    return r;
  }

  const orijinal = {
    create: navigator.credentials.create.bind(navigator.credentials),
    get: navigator.credentials.get.bind(navigator.credentials)
  };

  navigator.credentials.create = function create(o) {
    const pk = o && o.publicKey;
    if (!pk) return orijinal.create(o);
    return bekle((async () => {
      const r = await yonlendir('olustur', {
        rp: { id: pk.rp && pk.rp.id, name: pk.rp && pk.rp.name },
        user: { id: tabloyaB64u(pk.user.id), name: pk.user.name, displayName: pk.user.displayName },
        challenge: tabloyaB64u(pk.challenge),
        pubKeyCredParams: (pk.pubKeyCredParams || []).map((p) => ({ type: p.type, alg: p.alg })),
        excludeCredentials: kimlikler(pk.excludeCredentials)
      });
      return kimlikBilgisi(r, true);
    })(), o.signal);
  };

  navigator.credentials.get = function get(o) {
    const pk = o && o.publicKey;
    if (!pk) return orijinal.get(o);
    if (o.mediation === 'conditional') return Promise.reject(hata('NotAllowedError'));
    return bekle((async () => {
      const r = await yonlendir('al', {
        rpId: pk.rpId,
        challenge: tabloyaB64u(pk.challenge),
        allowCredentials: kimlikler(pk.allowCredentials)
      });
      return kimlikBilgisi(r, false);
    })(), o.signal);
  };

  // Tarayıcı yönetiyorsa eklentiler (Proton Pass vb.) bu işlevleri değiştiremesin.
  if (kilitle) {
    for (const ad of ['create', 'get']) {
      try {
        Object.defineProperty(navigator.credentials, ad,
          { value: navigator.credentials[ad], writable: false, configurable: false, enumerable: true });
      } catch { /* zaten kilitli */ }
    }
  }

  if (window.PublicKeyCredential) {
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true;
    window.PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  }
}

let electron = null;
try { electron = require('electron'); } catch { /* electron yok (test) */ }

if (electron && electron.contextBridge && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
  const { contextBridge, ipcRenderer } = electron;
  const cagri = (tur, veri) => ipcRenderer.invoke('gecisanahtari:' + (tur === 'olustur' ? 'olustur' : 'al'), veri);
  let kilitle = true;
  try { kilitle = ipcRenderer.sendSync('gecisanahtari:ayar') !== false; } catch { /* varsayılan: kilitle */ }
  try { contextBridge.executeInMainWorld({ func: sayfaYamasi, args: [cagri, kilitle] }); } catch { /* bağlam kapanmış */ }
}
