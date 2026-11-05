'use strict';

/**
 * Eklenti uyumluluk katmanı: Electron'un uygulamadığı bazı chrome.* API'leri yüzünden
 * eklentilerin açılışta çökmesini ya da çalışmamasını önler.
 *
 *  - chrome.storage.sync  -> chrome.storage.local ile aynı depo (hesap eşitleme yok).
 *  - chrome.cookies ve chrome.downloads: GERÇEK uygulama. Çağrılar ana sürece
 *    (src/eklenti-api.js) gider; izin denetimi orada, çağıranın adresinden yapılır.
 *    Olaylar (cookies.onChanged, downloads.onCreated/onChanged/onErased) ana süreçten gelir.
 *  - chrome.identity (launchWebAuthFlow, getRedirectURL) ve chrome.permissions (isteğe bağlı
 *    izinler, kullanıcı onayıyla) da ana sürece gider.
 *  - chrome.history (Electron'da yok): olaylar boş çalışır, böylece
 *    `chrome.history.onVisited.addListener` gibi açılış satırları betiği öldürmez.
 *    İşlevler "desteklenmiyor" hatasıyla reddedilir: sessizce boş sonuç döndürmüyoruz.
 *
 * İki ortamda çalışır: eklentinin servis çalışanı ve eklenti sayfaları (açılır pencere,
 * seçenekler, arka plan sayfası). Önyükleme betiği yalıtılmış bir dünyada çalışır;
 * yama eklentinin kendi dünyasına contextBridge.executeInMainWorld ile konur.
 */

/* global chrome */
function uyumlulukKodu(cagri) {
  var OLAYLAR = {};

  // "chrome" VE "browser" ad alanlarını yamala. Electron eklenti bağlamlarında "browser" de
  // tanımlı (runtime'ı var); eklentiler buna bakıp Firefox sanıyor ve browser.identity gibi
  // alanları bekliyor, bu yüzden ikisi de aynı yamayı almalı.
  ['chrome', 'browser'].forEach(function (ad) {
    var o;
    try { o = globalThis[ad]; } catch (e) { o = undefined; }
    if (o) { yamala(o); return; }
    // Henüz tanımlı değil: tanımlandığı anda yamala.
    if (globalThis['__cvsBekle_' + ad]) return;
    var gercek;
    try {
      Object.defineProperty(globalThis, ad, {
        configurable: true,
        get: function () { return gercek; },
        set: function (v) { gercek = v; try { yamala(v); } catch (e) { /* geç */ } }
      });
      globalThis['__cvsBekle_' + ad] = true;
    } catch (e) { /* tanımlanamıyor */ }
  });

  // Ana süreçten gelen olayları dinleyicilere ulaştırır.
  globalThis.__cvsOlayYolla = function (ns, ad, veri) {
    var o = OLAYLAR[ns + '.' + ad];
    if (o) o.yolla(veri);
  };

  function olayKuklasi() {
    return {
      addListener: function () {}, removeListener: function () {},
      hasListener: function () { return false; }, hasListeners: function () { return false; },
      addRules: function () {}, removeRules: function () {}, getRules: function () {}
    };
  }

  function olayNesnesi(anahtar) {
    if (OLAYLAR[anahtar]) return OLAYLAR[anahtar];
    var dinleyiciler = [];
    var o = {
      addListener: function (f) { if (typeof f === 'function' && dinleyiciler.indexOf(f) < 0) dinleyiciler.push(f); },
      removeListener: function (f) { var i = dinleyiciler.indexOf(f); if (i >= 0) dinleyiciler.splice(i, 1); },
      hasListener: function (f) { return dinleyiciler.indexOf(f) >= 0; },
      hasListeners: function () { return dinleyiciler.length > 0; },
      bekleyen: [],
      bekletir: false,
      bosalt: function () {
        var o = this;
        if (!o.bekleyen.length) return;
        setTimeout(function () { var b = o.bekleyen.splice(0); b.forEach(function (v) { o.yolla(v); }); }, 30);
      },
      yolla: function (veri) {
        if (this.bekletir && dinleyiciler.length === 0) { this.bekleyen.push(veri); return; }
        // { __args: [...] } birden çok bağımsız değişkenli olaylar içindir (ör. contextMenus.onClicked).
        var a = veri && veri.__args ? veri.__args : [veri];
        dinleyiciler.slice().forEach(function (f) { try { f.apply(null, a); } catch (e) { console.error(e); } });
      }
    };
    OLAYLAR[anahtar] = o;
    return o;
  }

  function hataBildir(mesaj, cb) {
    // callback tarzında chrome.runtime.lastError'ı geçici olarak doldurmayı dener.
    var rt = chrome.runtime;
    var tanimlandi = false;
    try {
      Object.defineProperty(rt, 'lastError', { configurable: true, get: function () { return { message: mesaj }; } });
      tanimlandi = true;
    } catch (e) { console.warn(mesaj); }
    try { cb(); } finally {
      if (tanimlandi) { try { delete rt.lastError; } catch (e) { /* geç */ } }
    }
  }

  // Hem callback hem Promise tarzı çağrı.
  function cagrili(ns, yontem, args) {
    var cb = args.length && typeof args[args.length - 1] === 'function' ? args.pop() : null;
    var p = Promise.resolve(cagri(ns, yontem, args));
    if (!cb) return p;
    p.then(function (v) { cb(v); }, function (e) {
      hataBildir(String(e && e.message ? e.message : e), function () { cb(); });
    });
    return undefined;
  }

  function kopru(ns, olaylar) {
    return new Proxy({}, {
      get: function (_h, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        if (/^on[A-Z]/.test(prop)) return olaylar.indexOf(prop) >= 0 ? olayNesnesi(ns + '.' + prop) : olayKuklasi();
        return function () { return cagrili(ns, prop, Array.prototype.slice.call(arguments)); };
      }
    });
  }

  // Etkin sekmenin sesini MediaStream olarak verir. Ana süreç tek kullanımlık onay açar; akışı
  // eklenti sayfası getDisplayMedia ile alır (ana süreç yalnızca o sayfaya, etkin sekmenin
  // çerçevesini verir). Chrome gibi sekme yakalama sırasında sekmenin kendi sesi susar;
  // eklenti sesi kendisi çalar.
  function sekmeAkisi(secenek) {
    var ses = !!(secenek && secenek.audio);
    var goruntu = !!(secenek && secenek.video);
    return Promise.resolve(cagri('tabCapture', 'capture', []))
      .then(function () { return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); })
      .then(function (akis) {
        if (!goruntu) akis.getVideoTracks().forEach(function (t) { akis.removeTrack(t); t.stop(); });
        if (!ses) akis.getAudioTracks().forEach(function (t) { akis.removeTrack(t); t.stop(); });
        return akis;
      });
  }

  function tabCaptureKopru() {
    var o = {
      capture: function (secenek, cb) {
        var p = sekmeAkisi(secenek);
        if (typeof cb !== 'function') return p;
        p.then(function (akis) { cb(akis); }, function (e) { hataBildir(String(e && e.message ? e.message : e), function () { cb(null); }); });
        return undefined;
      },
      getMediaStreamId: function (secenek, cb) {
        var p = Promise.resolve(cagri('tabCapture', 'getMediaStreamId', []));
        if (typeof secenek === 'function') { cb = secenek; }
        if (typeof cb !== 'function') return p;
        p.then(function (id) { cb(id); }, function (e) { hataBildir(String(e && e.message ? e.message : e), function () { cb(''); }); });
        return undefined;
      },
      getCapturedTabs: function (cb) { var l = []; if (typeof cb === 'function') { cb(l); return undefined; } return Promise.resolve(l); },
      onStatusChanged: olayKuklasi()
    };
    // MV3'te getMediaStreamId + getUserMedia({chromeMediaSource:'tab'}) yolu da aynı akışa gider.
    try {
      var asil = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function (k) {
        var m = k && ((k.audio && k.audio.mandatory) || (k.video && k.video.mandatory));
        if (m && m.chromeMediaSource === 'tab') return sekmeAkisi({ audio: !!k.audio, video: !!k.video });
        return asil(k);
      };
    } catch (e) { /* değiştirilemiyor */ }
    return o;
  }

  function desteklenmeyenAd(ad) {
    return new Proxy({}, {
      get: function (_h, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        if (/^on[A-Z]/.test(prop)) return olayKuklasi();
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var hata = new Error('chrome.' + ad + '.' + prop + ' bu tarayıcıda desteklenmiyor (CVS Browser)');
          var cb = args.length && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
          if (cb) { setTimeout(function () { hataBildir(hata.message, function () { cb(); }); }, 0); return undefined; }
          return Promise.reject(hata);
        };
      }
    });
  }

  function yamala(c) {
    if (!c || c.__cvsYamali) return;
    try { Object.defineProperty(c, '__cvsYamali', { value: true }); } catch (e) { c.__cvsYamali = true; }

    // storage.sync -> storage.local
    try {
      if (c.storage && c.storage.local) {
        var yerel = c.storage.local;
        try { Object.defineProperty(c.storage, 'sync', { configurable: true, enumerable: true, get: function () { return yerel; } }); }
        catch (e) { c.storage.sync = yerel; }
      }
    } catch (e) { /* geç */ }

    var tanimla = function (ad, deger) {
      try {
        if (!c[ad]) Object.defineProperty(c, ad, { configurable: true, enumerable: true, value: deger });
      } catch (e) { /* geç */ }
    };

    // Gerçek uygulamalar (ana süreç köprüsü varsa)
    if (typeof cagri === 'function') {
      tanimla('cookies', kopru('cookies', ['onChanged']));
      tanimla('downloads', kopru('downloads', ['onCreated', 'onChanged', 'onErased']));


      // contextMenus: kayıt ana süreçte; create kimliği eşzamanlı döndürür (Chrome gibi).
      var menuKopru = kopru('contextMenus', ['onClicked']);
      var menuSayac = 0;
      tanimla('contextMenus', new Proxy(menuKopru, {
        get: function (hedef, prop) {
          if (prop === 'create') {
            return function (p, cb) {
              p = Object.assign({}, p || {});
              if (p.id === undefined) p.id = 'cvs-' + (++menuSayac) + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              var s = cagrili('contextMenus', 'create', cb ? [p, cb] : [p]);
              if (s) s.catch(function () { /* hata lastError ile bildirilir; sessiz */ });
              return p.id;
            };
          }
          if (prop === 'ACTION_MENU_TOP_LEVEL_LIMIT') return 6;
          return hedef[prop];
        }
      }));
      if (c.contextMenus) { try { c.menus = c.menus || c.contextMenus; } catch (e) { /* geç */ } }

      // notifications
      tanimla('notifications', kopru('notifications', ['onClicked', 'onClosed', 'onButtonClicked']));

      // windows: tek pencere
      var pencere = function () { return { id: 1, focused: true, incognito: false, type: 'normal', state: 'normal', alwaysOnTop: false, top: 0, left: 0, width: 1280, height: 800 }; };
      var donus = function (v, cb) { if (typeof cb === 'function') { cb(v); return undefined; } return Promise.resolve(v); };
      tanimla('windows', {
        WINDOW_ID_NONE: -1, WINDOW_ID_CURRENT: -2,
        getCurrent: function (a, cb) { return donus(pencere(), typeof a === 'function' ? a : cb); },
        getLastFocused: function (a, cb) { return donus(pencere(), typeof a === 'function' ? a : cb); },
        get: function (id, a, cb) { return donus(pencere(), typeof a === 'function' ? a : cb); },
        getAll: function (a, cb) { return donus([pencere()], typeof a === 'function' ? a : cb); },
        create: function (d, cb) {
          var u = d && d.url; u = Array.isArray(u) ? u[0] : u;
          var p = u && c.tabs ? c.tabs.create({ url: u }).then(function () { return pencere(); }) : Promise.resolve(pencere());
          if (typeof cb === 'function') { p.then(cb); return undefined; } return p;
        },
        update: function (id, d, cb) { return donus(pencere(), cb); },
        remove: function (id, cb) { return donus(undefined, cb); },
        onCreated: olayKuklasi(), onRemoved: olayKuklasi(), onFocusChanged: olayKuklasi(), onBoundsChanged: olayKuklasi()
      });

      // commands: kısayol yönetimi yok; olaylar sessiz
      tanimla('commands', {
        getAll: function (cb) { return donus([], cb); },
        onCommand: olayKuklasi(), onChanged: olayKuklasi()
      });

      // sidePanel: yan panel yok; çağrılar hatasız tamamlanır
      var yutan = function () { var a = Array.prototype.slice.call(arguments); return donus(undefined, typeof a[a.length - 1] === 'function' ? a[a.length - 1] : undefined); };
      tanimla('sidePanel', { setOptions: yutan, setPanelBehavior: yutan, open: yutan, getOptions: function (o, cb) { return donus({ enabled: false }, cb); }, getPanelBehavior: function (cb) { return donus({ openPanelOnActionClick: false }, cb); } });

      // userScripts: Electron'da yok; Chrome'da "Kullanıcı betiklerine izin ver" açıkken vardır
      // (PreMiD gibi eklentiler getScripts() çağrısının hata vermemesine bakarak özelliği açar).
      // Betikler burada kayıtlı tutulur ve chrome.scripting ile ISOLATED dünyada içerik betiği olarak
      // kaydedilir (dosya tabanlı betikler; "code" betikleri yalnızca listelenir). Betiklerin eval'i
      // eklenti CSP'since engellenir; bunu sekme önyüklemesi çözer (src/eklenti-eval-onyukleme.js).
      var betikler = {};
      var betikDunyasi = {};
      var betikIstek = function (a) { var cb = typeof a[a.length - 1] === 'function' ? a.pop() : null; return { cb: cb, a: a }; };
      var betikSonuc = function (p, cb) {
        if (!cb) return p;
        p.then(function (v) { cb(v); }, function (e) { hataBildir(String(e && e.message ? e.message : e), function () { cb(); }); });
        return undefined;
      };
      var betikKaydi = function (b) {
        var js = (b.js || []).map(function (j) { return j && j.file; }).filter(function (f) { return typeof f === 'string'; });
        var o = { id: b.id, matches: b.matches || [], js: js, runAt: b.runAt || 'document_idle', allFrames: !!b.allFrames, world: 'ISOLATED' };
        if (b.excludeMatches) o.excludeMatches = b.excludeMatches;
        return o;
      };
      var betikIsle = function (liste, yeni) {
        if (!Array.isArray(liste)) return Promise.reject(new Error('Geçersiz betik listesi'));
        for (var i = 0; i < liste.length; i++) {
          var b = liste[i];
          if (!b || typeof b.id !== 'string' || !b.id || b.id[0] === '_') return Promise.reject(new Error('Geçersiz betik kimliği'));
          if (!Array.isArray(b.js) || !b.js.length) return Promise.reject(new Error('Betikte "js" gerekli'));
          if (yeni && betikler[b.id]) return Promise.reject(new Error("Betik kimliği '" + b.id + "' zaten kayıtlı"));
          if (!yeni && !betikler[b.id]) return Promise.reject(new Error("Betik kimliği '" + b.id + "' kayıtlı değil"));
        }
        var is = liste.map(function (b) {
          var tam = Object.assign({}, yeni ? {} : betikler[b.id], b);
          betikler[b.id] = tam;
          var kayit = betikKaydi(tam);
          var s = c.scripting;
          if (!s || !kayit.js.length) return Promise.resolve();
          var yaz = function () { return yeni ? s.registerContentScripts([kayit]) : s.updateContentScripts([kayit]); };
          return Promise.resolve(yaz()).catch(function (e) {
            // Aynı kimlik zaten kayıtlıysa (yeniden başlatma) güncelle; olmazsa hatayı göster.
            if (yeni && s.updateContentScripts) return Promise.resolve(s.updateContentScripts([kayit])).catch(function (e2) { console.warn('[userScripts] kayıt başarısız:', e2 && e2.message); });
            console.warn('[userScripts] kayıt başarısız:', e && e.message);
          });
        });
        return Promise.all(is).then(function () { return undefined; });
      };
      tanimla('userScripts', {
        configureWorld: function () { var r = betikIstek(Array.prototype.slice.call(arguments)); betikDunyasi = Object.assign({}, r.a[0] || {}); return betikSonuc(Promise.resolve(), r.cb); },
        getWorldConfigurations: function () { var r = betikIstek(Array.prototype.slice.call(arguments)); return betikSonuc(Promise.resolve([Object.assign({}, betikDunyasi)]), r.cb); },
        resetWorldConfiguration: function () { var r = betikIstek(Array.prototype.slice.call(arguments)); betikDunyasi = {}; return betikSonuc(Promise.resolve(), r.cb); },
        getScripts: function () {
          var r = betikIstek(Array.prototype.slice.call(arguments));
          var ids = r.a[0] && Array.isArray(r.a[0].ids) ? r.a[0].ids : null;
          var sonuc = Object.keys(betikler).filter(function (k) { return !ids || ids.indexOf(k) >= 0; })
            .map(function (k) { var b = betikler[k]; return Object.assign({}, b, { world: b.world || 'USER_SCRIPT' }); });
          return betikSonuc(Promise.resolve(sonuc), r.cb);
        },
        register: function () { var r = betikIstek(Array.prototype.slice.call(arguments)); return betikSonuc(betikIsle(r.a[0], true), r.cb); },
        update: function () { var r = betikIstek(Array.prototype.slice.call(arguments)); return betikSonuc(betikIsle(r.a[0], false), r.cb); },
        unregister: function () {
          var r = betikIstek(Array.prototype.slice.call(arguments));
          var ids = r.a[0] && Array.isArray(r.a[0].ids) ? r.a[0].ids : Object.keys(betikler);
          ids = ids.filter(function (k) { return betikler[k]; });
          ids.forEach(function (k) { delete betikler[k]; });
          var s = c.scripting;
          var p = s && ids.length ? Promise.resolve(s.unregisterContentScripts({ ids: ids })).catch(function () { return null; }) : Promise.resolve();
          return betikSonuc(p.then(function () { return undefined; }), r.cb);
        }
      });

      // webNavigation: olaylar ana süreçten; getFrame/getAllFrames gerçek çerçeve ağacından.
      tanimla('webNavigation', new Proxy({}, {
        get: function (_h, prop) {
          if (typeof prop !== 'string' || prop === 'then') return undefined;
          if (/^on[A-Z]/.test(prop)) return olayNesnesi('webNavigation.' + prop);
          return function () { return cagrili('webNavigation', prop, Array.prototype.slice.call(arguments)); };
        }
      }));

      // storage.session (Electron'da yok): ana süreçte, tüm bağlamlar (servis çalışanı + sayfalar) paylaşır.
      try {
        if (c.storage && !c.storage.session) {
          var oturum = new Proxy(kopru('storageSession', ['onChanged']), {
            get: function (hedef, prop) {
              if (prop === 'QUOTA_BYTES') return 10485760;
              return hedef[prop];
            }
          });
          try { Object.defineProperty(c.storage, 'session', { configurable: true, enumerable: true, value: oturum }); }
          catch (e) { c.storage.session = oturum; }
          // storage.onChanged dinleyicileri 'session' alanındaki değişiklikleri de alsın.
          var asilOlay = c.storage.onChanged;
          if (asilOlay && typeof asilOlay.addListener === 'function') {
            var sarmalar = [];
            var olay = {
              addListener: function (f) {
                if (typeof f !== 'function') return;
                asilOlay.addListener(f);
                var s = function (ch) { f(ch, 'session'); };
                sarmalar.push({ f: f, s: s });
                olayNesnesi('storageSession.onChanged').addListener(s);
              },
              removeListener: function (f) {
                asilOlay.removeListener(f);
                for (var i = 0; i < sarmalar.length; i++) {
                  if (sarmalar[i].f === f) { olayNesnesi('storageSession.onChanged').removeListener(sarmalar[i].s); sarmalar.splice(i, 1); break; }
                }
              },
              hasListener: function (f) { return asilOlay.hasListener(f); },
              hasListeners: function () { return asilOlay.hasListeners(); }
            };
            try { Object.defineProperty(c.storage, 'onChanged', { configurable: true, enumerable: true, value: olay }); } catch (e) { /* değiştirilemiyor */ }
          }
        }
        // storage.managed: yönetici ilkesi yok; boş depo (Chrome'daki ilkesiz davranış).
        if (c.storage && !c.storage.managed) {
          var bos = function () { var a = Array.prototype.slice.call(arguments); var cb = typeof a[a.length - 1] === 'function' ? a.pop() : null; var v = {}; if (cb) { cb(v); return undefined; } return Promise.resolve(v); };
          var yaz = function () { var a = Array.prototype.slice.call(arguments); var h = new Error('This is a read-only store.'); var cb = typeof a[a.length - 1] === 'function' ? a.pop() : null; if (cb) { setTimeout(function () { hataBildir(h.message, function () { cb(); }); }, 0); return undefined; } return Promise.reject(h); };
          var yonetilen = { get: bos, getBytesInUse: function () { return Promise.resolve(0); }, set: yaz, remove: yaz, clear: yaz, onChanged: olayKuklasi() };
          try { Object.defineProperty(c.storage, 'managed', { configurable: true, enumerable: true, value: yonetilen }); } catch (e) { /* geç */ }
        }
      } catch (e) { /* storage kullanılamıyor */ }

      // tabs: sekme listesi/etkin sekme/adres görünürlüğü bizim sekmelerimizden (Electron her WebContents'i sekme sayıyor).
      try {
        if (c.tabs) {
          ['query', 'get', 'getCurrent', 'create', 'update', 'remove', 'duplicate'].forEach(function (ad) {
            var f = function () { return cagrili('tabs', ad, Array.prototype.slice.call(arguments)); };
            try { Object.defineProperty(c.tabs, ad, { configurable: true, writable: true, enumerable: true, value: f }); }
            catch (e) { try { c.tabs[ad] = f; } catch (e2) { /* değiştirilemiyor */ } }
          });
          ['onCreated', 'onRemoved', 'onActivated', 'onUpdated'].forEach(function (ad) {
            var olay = olayNesnesi('tabs.' + ad);
            try { Object.defineProperty(c.tabs, ad, { configurable: true, enumerable: true, value: olay }); }
            catch (e) { try { c.tabs[ad] = olay; } catch (e2) { /* değiştirilemiyor */ } }
          });
        }
      } catch (e) { /* tabs kullanılamıyor */ }

      // runtime.onInstalled / onStartup: Electron tetiklemiyor; ana süreç tetikler (main.js eklentiYasamOlaylari).
      // Servis çalışanında dinleyici henüz kaydolmadan gelen olay bekletilir.
      try {
        var sw = typeof document === 'undefined';
        ['onInstalled', 'onStartup'].forEach(function (ad) {
          var rt = c.runtime;
          if (!rt) return;
          var asil = rt[ad];
          var olay = olayNesnesi('runtime.' + ad);
          olay.bekletir = sw;
          var sarma = {
            addListener: function (f) {
              if (typeof f !== 'function') return;
              try { if (asil && asil.addListener) asil.addListener(f); } catch (e) { /* geç */ }
              olay.addListener(f);
              olay.bosalt();
            },
            removeListener: function (f) {
              try { if (asil && asil.removeListener) asil.removeListener(f); } catch (e) { /* geç */ }
              olay.removeListener(f);
            },
            hasListener: function (f) { return olay.hasListener(f); },
            hasListeners: function () { return olay.hasListeners(); }
          };
          try { Object.defineProperty(rt, ad, { configurable: true, enumerable: true, value: sarma }); } catch (e) { /* değiştirilemiyor */ }
        });
      } catch (e) { /* runtime kullanılamıyor */ }

      // Tarayıcı verisi API'leri: ana süreçte (src/eklenti-veri.js), izin orada denetlenir.
      tanimla('bookmarks', kopru('bookmarks', ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportBegan', 'onImportEnded']));
      tanimla('history', kopru('history', ['onVisited', 'onVisitRemoved']));
      tanimla('topSites', kopru('topSites', []));
      tanimla('browsingData', kopru('browsingData', []));
      tanimla('sessions', Object.assign(kopru('sessions', ['onChanged']), { MAX_SESSION_RESULTS: 25 }));
      tanimla('search', kopru('search', []));
      tanimla('tts', kopru('tts', ['onVoicesChanged']));
      tanimla('fontSettings', kopru('fontSettings', ['onFontChanged', 'onDefaultFontSizeChanged', 'onDefaultFixedFontSizeChanged', 'onMinimumFontSizeChanged']));
      tanimla('favicon', kopru('favicon', []));
      tanimla('declarativeContent', {
        onPageChanged: olayKuklasi(),
        PageStateMatcher: function (o) { return o; }, ShowAction: function () {}, ShowPageAction: function () {}, SetIcon: function () {}, RequestContentScript: function () {}
      });
      // Ayar nesneleri (ChromeSetting): get/set/clear + onChange. Gizlilik ayarlarını eklenti değiştiremez.
      var ayarCagri = function (ns, ilk, y) {
        return function () {
          var a = Array.prototype.slice.call(arguments);
          var cb = typeof a[a.length - 1] === 'function' ? a.pop() : null;
          var args = [ilk, a[0] || {}];
          if (cb) args.push(cb);
          return cagrili(ns, y, args);
        };
      };
      var ayarNesnesi = function (ns, yol) {
        return { get: ayarCagri(ns, yol, 'get'), set: ayarCagri(ns, yol, 'set'), clear: ayarCagri(ns, yol, 'clear'), onChange: olayKuklasi() };
      };
      var grup = function (ns, onek, adlar) {
        var o = {}; adlar.forEach(function (a) { o[a] = ayarNesnesi(ns, onek + a); }); return o;
      };
      tanimla('privacy', {
        network: grup('privacy', 'network.', ['networkPredictionEnabled', 'webRTCIPHandlingPolicy', 'webRTCMultipleRoutesEnabled', 'webRTCNonProxiedUdpEnabled']),
        services: grup('privacy', 'services.', ['alternateErrorPagesEnabled', 'autofillAddressEnabled', 'autofillCreditCardEnabled', 'autofillEnabled', 'passwordSavingEnabled', 'safeBrowsingEnabled', 'safeBrowsingExtendedReportingEnabled', 'searchSuggestEnabled', 'spellingServiceEnabled', 'translationServiceEnabled']),
        websites: grup('privacy', 'websites.', ['doNotTrackEnabled', 'hyperlinkAuditingEnabled', 'referrersEnabled', 'protectedContentEnabled', 'thirdPartyCookiesAllowed', 'privacySandboxEnabled', 'adMeasurementEnabled', 'fledgeEnabled', 'topicsEnabled', 'relatedWebsiteSetsEnabled'])
      });
      tanimla('contentSettings', new Proxy({}, {
        get: function (_h, prop) {
          if (typeof prop !== 'string' || prop === 'then') return undefined;
          return {
            get: ayarCagri('contentSettings', prop, 'get'),
            set: ayarCagri('contentSettings', prop, 'set'),
            clear: ayarCagri('contentSettings', prop, 'clear'),
            getResourceIdentifiers: ayarCagri('contentSettings', prop, 'getResourceIdentifiers')
          };
        }
      }));

      // identity: getRedirectURL eşzamanlı olduğu için burada hesaplanır; gerisi ana sürece gider.
      var kimlikKopru = kopru('identity', ['onSignInChanged']);
      tanimla('identity', new Proxy(kimlikKopru, {
        get: function (hedef, prop) {
          if (prop === 'getRedirectURL') {
            return function (yol) { return 'https://' + c.runtime.id + '.chromiumapp.org/' + String(yol || '').replace(/^\//, ''); };
          }
          return hedef[prop];
        }
      }));

      // permissions: Electron'un kısmi uygulaması yerine kullanıcı onaylı isteğe bağlı izinler.
      try {
        Object.defineProperty(c, 'permissions', {
          configurable: true, enumerable: true, value: kopru('permissions', ['onAdded', 'onRemoved'])
        });
      } catch (e) { /* değiştirilemiyor */ }
    }
    // tabCapture: yalnızca sayfa bağlamlarında (MediaStream için DOM gerekir).
    if (typeof cagri === 'function' && typeof navigator !== 'undefined' && navigator.mediaDevices
      && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      tanimla('tabCapture', tabCaptureKopru());
    }
    // Hiç tanımlı olmayanlar: boş olay + reddeden işlev
    ['history', 'cookies', 'downloads', 'identity'].forEach(function (ad) { tanimla(ad, desteklenmeyenAd(ad)); });
  }
}

let electron = null;
try { electron = require('electron'); } catch { /* electron modülü yok */ }

/*
 * Önyükleme betiği hem sayfada hem servis çalışanında YALITILMIŞ bir dünyada çalışır
 * (ölçüldü: servis çalışanında chrome/self/location tanımsız). Yama eklentinin kendi
 * dünyasına contextBridge.executeInMainWorld ile konur; chrome henüz tanımlı değilse
 * işlev kendini erteleyip tanımlandığı anda yamıyor.
 */
const eklentiBaglami = typeof location === 'undefined' /* servis çalışanı */
  || location.protocol === 'chrome-extension:';

if (electron && electron.contextBridge && eklentiBaglami) {
  const { contextBridge, ipcRenderer } = electron;

  // Ana sürece çağrı. Hata zarfı ana süreçte kuruluyor: { deger } ya da { hata }.
  const cagri = async (ns, yontem, args) => {
    const r = await ipcRenderer.invoke('eklenti:api', String(ns), String(yontem), args);
    if (r && r.hata) throw new Error(r.hata);
    return r ? r.deger : undefined;
  };

  try { contextBridge.executeInMainWorld({ func: uyumlulukKodu, args: [cagri] }); } catch { /* bağlam kapanmış */ }

  // Ana süreçten gelen olaylar (cookies.onChanged, downloads.*)
  try {
    ipcRenderer.on('eklenti:olay', (_e, ns, ad, veri) => {
      try {
        contextBridge.executeInMainWorld({
          func: (n, a, v) => { if (globalThis.__cvsOlayYolla) globalThis.__cvsOlayYolla(n, a, v); },
          args: [ns, ad, veri]
        });
      } catch { /* bağlam kapanmış */ }
    });
  } catch { /* ipcRenderer.on yok */ }
}
