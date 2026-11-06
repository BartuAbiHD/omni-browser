# Changelog

All notable changes to the **CVS Browser** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2026.11.9] - 2026-11-06

### Added
- **Discord Rich Presence**: when the Discord desktop app is running and the active tab is on a supported site, the browser shows what you are doing (watching, listening) as your Discord activity. Supported sites: Anivesta, Video Vitrini, YouTube, YouTube Music, Apple Music, Spotify, Netflix, Twitch and Kick. Presence logic is ported from the PreMiD activities and uses their application IDs and assets.
  - Talks to Discord over its local IPC pipe/socket (`src/discord-rpc.js`), connecting to every reachable Discord pipe; reconnects automatically.
  - Playing state, elapsed/remaining time and "Duraklatıldı" (paused) are shown; players inside same-site iframes (Anivesta) are read from the main process.
  - Netflix titles are fetched from netflix.com's own metadata endpoint; Twitch and Kick show live streams, VODs and clips.
  - Two new privacy settings: **Discord status** and **Discord buttons**, both on by default.
- Tests: `test/discord.js` (added to `npm test`) covers the IPC framing/handshake, site matching (including look-alike hosts) and every site adapter.

### Security
- Nothing is published from private tabs or private windows. All page text is treated as untrusted (trimmed, control characters stripped), image URLs must be HTTPS, and button URLs must be on the site's own host. Search queries on YouTube are never shown.

---

## [2026.11.8] - 2026-11-06

### Changed
- **Reduced Chrome version in the User-Agent**: the User-Agent now reports `Chrome/152.0.0.0` instead of the full `Chrome/152.0.7977.76`, the same reduced format real Chrome sends. The major version is unchanged, so it still matches `Sec-CH-UA` and `navigator.userAgentData`. Nothing else in the string is touched (`Electron/x` and `CVSBrowser/x` stay).
- Contract test (`test/sozlesme.js`) now allows exactly this one `app.userAgentFallback` assignment; any other manual User-Agent change is still rejected.

---

## [2026.11.7] - 2026-11-06

### Added
- **`chrome.userScripts` for extensions**: extensions that declare the `userScripts` permission (such as PreMiD) can now register user scripts (`register`, `update`, `unregister`, `getScripts`, `configureWorld` and related calls). Scripts are registered as content scripts through `chrome.scripting`. PreMiD's "Service Developer" switch, which was locked with "Requires User Scripts permission to be enabled", can now be turned on, and activities that are not bundled with the extension (for example Anivesta and Video Vitrini) are no longer listed as unavailable.
- **`eval` bridge for user-script extensions**: Electron has no separate user-script world, and an extension's content-script world refuses `eval` because of the extension's Content Security Policy. A new tab preload (`src/eklenti-eval-onyukleme.js`) finds the world of an extension that holds the `userScripts` permission and routes its `eval` through Electron's CSP-exempt `executeJavaScriptInIsolatedWorld`, which is synchronous. Only extensions with that permission are affected, the bridge channel is a random per-frame name that the page itself cannot guess or trigger, and with no such extension installed the preload does nothing. It patches as soon as the document element exists, using a per-process world hint, and falls back to scanning after the page has loaded.
- **Extension console diagnostics**: setting the `CVS_EKLENTI_LOG` environment variable to a file path writes the console output of extension service workers and of extension content scripts in tabs to that file. It is off by default.
- Tests: `test/electron-eklenti-eval.js` (added to `npm run test-electron`) checks that a permitted extension's `eval` works, that other extensions' `eval` stays blocked, that the page cannot trigger the bridge, and that the bridge does nothing when the permitted list is empty.

### Known limitations
- Content scripts of user-script extensions run in the extension's normal content-script world, not in a separate user-script world as in Chrome.
- If an extension's first `eval` runs before the bridge has patched the world, that attempt is blocked and some extensions do not retry. Probing a world before the browser has initialised it would break other extensions' `chrome.*` APIs in that page, so the bridge only touches a world once it is known to exist.

---

## [2026.11.6] - 2026-11-05

### Added
- **Secure DNS (DNS-over-HTTPS)** in Settings > Privacy, like other Chromium browsers. **Off by default**; while it is off, domain lookups go only to the operating system's DNS and the provider list is hidden. When on, choose a provider: operating system default (when available), OpenDNS, CleanBrowsing (Family Filter), Cloudflare (1.1.1.1), Google (Public DNS), or a custom `https://` address (invalid addresses are rejected). A chosen provider is used exclusively and does not fall back to plain DNS; the system default falls back when it has no secure DNS. Applies immediately, no restart. All 12 languages are covered.
- **`omni://flags`** (also `chrome://flags`): experimental Chromium features with search, a Default / Enabled / Disabled choice per flag, "Reset all" and a "Restart" bar (changes apply after a restart). Flags: WebRTC post-quantum key agreement (Kyber / ML-KEM, **disabled by default**), QUIC (HTTP/3), WebRTC local IP hiding, parallel downloading, smooth scrolling and hardware acceleration. TLS ML-KEM is not listed because this Chromium build no longer exposes it as a feature. All 12 languages are covered.
- **Middle-click closes the window on the last tab**: middle-clicking a tab when it is the only open tab now closes the browser, exactly like Ctrl+W. The tab's × button is unchanged and still opens a new tab instead.

### Fixed
- **PreMiD Discord sign-in**: after Discord approval the browser opened `login.premid.app`, which has no DNS records on purpose; the extension redirects that tab to its own `oauth2.html`, but the redirect never happened. Three causes fixed:
  - a tab showing an error page now reports the address that failed to load (as Chrome does) instead of the internal error page, so extensions can recognise it;
  - an extension may now navigate a tab to its own `chrome-extension://` pages with `chrome.tabs.update` (other extensions' pages and other schemes stay blocked);
  - a sleeping Manifest V3 extension service worker is now woken by a page-load event like in Chrome, instead of the event being dropped.

---

## [2026.11.5] - 2026-11-05

### Added
- **What's New window**: after the browser is updated, the first launch shows the release notes of the new version only. The notes are read from the project's `CHANGELOG.md` on GitHub and rendered as formatted text (headings, lists, **bold**, `code`) instead of raw Markdown.
- **Language selector in the What's New window**: choosing a language other than English shows the release notes translated into that language (12 languages supported; falls back to English if the translation is unavailable). Only the public release-notes text is sent for translation, and only when a non-English language is selected.
- **Private window search engine**: new setting under Settings > Search and startup to choose the search engine used in private tabs and windows (address bar, new tab page, home button, paste-and-go, "Search in private window"). Defaults to Startpage; normal tabs keep using the regular search engine setting.
- **Search target picker on the new tab page**: choose Google, DuckDuckGo, Yandex, Bing, Startpage, Wikipedia, GitHub, YouTube or Video Vitrini under the search box; the query is searched on the selected site and your choice is remembered.
- **`@username` shortcuts**: with YouTube selected, typing a space-free `@username` opens `https://yton.tr/@username`; with Video Vitrini selected it opens `https://videovitrini.com/@username`.

- **Live download progress and controls**: the Downloads box (toolbar button) and the Downloads page now update live and show the transfer speed, downloaded / total size and the estimated time remaining (e.g. `1.2 MB/s · 45.0 MB / 120.0 MB · 1 min 5 s left`), like other browsers. Running downloads can be **paused**, **resumed** (also after an interruption when resumable) and **cancelled**; finished, cancelled or failed ones can be **removed from the list**, and the Downloads page has a **Clear list** button. Paused downloads show a muted progress bar. All 12 languages are covered.
- **Progress bar for every download**: downloads whose total size is unknown (the server sends no length) now show an animated indeterminate bar instead of no bar at all; it stops and dims when paused and respects the reduced-motion setting. Known-size downloads keep the exact percentage bar.
- **Extension context-menu items (`chrome.contextMenus`)**: extensions can add items to the page right-click menu, like Chromium browsers. Items follow the context rules (page, selection, link, image, editable), support submenus, checkboxes, radio buttons, `%s` and URL patterns. An extension with one item shows it directly with its icon; with several items it shows a submenu named after the extension. Clicks are delivered to the extension through `contextMenus.onClicked`.
- **Translate selection**: right-clicking selected text now offers "Translate selection to <language>" (for example "Seçimi Türkçe diline çevir"), opening Google Translate in a new tab only when you click it. All 12 languages are covered.
- **More Chrome extension APIs**: `chrome.bookmarks`, `history`, `topSites`, `browsingData`, `sessions`, `search`, `tts`, `fontSettings`, `contentSettings`, `privacy`, `windows`, `notifications`, `commands`, `sidePanel` and `webNavigation` (real navigation events and the real frame tree), `storage.session` and `storage.managed`. Extensions cannot delete saved passwords through `browsingData`, and `privacy` settings stay read-only.
- **Extension lifecycle events**: `runtime.onInstalled` (`install` / `update` with `previousVersion`) and `runtime.onStartup` are now fired, so extensions that create their defaults on install (such as DeepL) start correctly.
- **Pressed toolbar button**: the toolbar button of an extension whose popup is open is highlighted, like in Chrome.
- **Passkeys (WebAuthn)**: the browser can now create and use passkeys itself. When a site asks to register a passkey you confirm it in a browser dialog; signing in asks for confirmation again (a chooser appears when several accounts exist). Passkeys use ES256 (P-256) and are stored locally on this device; they are not saved in private windows. The site is taken from the requesting frame, never from the page's own data, and the relying-party ID must match that site. Conditional autofill and external or synced authenticators are not supported.
- **"Let the browser manage passkeys" setting** (Settings > Privacy, on by default): when on, passkey requests are handled by CVS Browser and extensions such as Proton Pass cannot intercept them; when off, an extension may take over and the browser dialog is used only if it hands the request back. Applies to newly opened pages.
- **Passkeys section in the password manager**: `omni://passwords` lists saved passkeys (site, account, last used) with a delete button; the search box filters passwords and passkeys together. Private keys are never sent to the page UI. The last-used date follows the operating system's regional format.
- **Import from Proton Pass**: the import page has a new "Proton Pass" source that reads an unencrypted export file. JSON imports passwords and passkeys, CSV imports passwords only (CSV has no passkey data). Bookmarks, history and downloads options are hidden for this source, existing entries are not duplicated, encrypted (PGP) exports are rejected with a clear message, and passkeys that are unsupported or damaged are skipped and reported. Passkeys of other browsers (Chrome, Edge, ...) cannot be imported because they are not stored in readable local files. All 12 languages are covered.

### Changed
- Application version scheme switched to date-based versions.
- **"Passwords" is now "Password Manager"** in the menu and the panel title (all 12 languages), and the page is split into Passwords and Passkeys sections.
- **Proton Pass and similar extensions now work**: the extension state, the popup, autofill suggestions in login fields and the passkey script load correctly. Root causes fixed: missing `chrome.storage.session`, empty `webNavigation.getFrame/getAllFrames`, and `chrome.tabs` reporting the wrong "active" tab (every WebContents counted as a tab). `chrome.tabs` now reflects the real browser tabs, the active tab, address visibility (`tabs`, host or `activeTab` permission) and tab events.
- **Extension popup size**: popups are sized to their content like in Chrome (up to 800x600) instead of staying small and scrolling; a measuring script bug was fixed and sizes are re-measured while the content loads.
- **About page update check** (`omni://about`): "Check for updates" now reports the real result instead of always claiming the browser is up to date. When a new version exists it shows the found version and offers Download, then Install and restart, with live download progress and error reasons, the same as Settings > Updates. "Up to date" is shown only after a check confirms it.
- **Updated browser logos in the import list**: Supermium, Vivaldi, Opera, Firefox, Floorp and Opera GX now use new official vector icons (still embedded as inline `<svg>`, CSP-compliant; gradient IDs are prefixed so logos never clash).

### Fixed
- Opening an extension popup no longer fails (and leaves a blank view behind) when a tab view was already destroyed.

---

## [1.0.0] - 2026-11-04

### Added
- **Multi-Browser Data Import Engine (`src/tarayici-aktar.js`)**:
  - One-click import for bookmarks and browsing history from Google Chrome, Brave Browser, Microsoft Edge, Supermium, Mozilla Firefox, Floorp, Opera One, Opera GX, and Netscape HTML bookmark files.
  - Automatic profile directory discovery on Windows, macOS, and Linux.
  - In-browser SQLite and JSON parsing with duplicate entry prevention.
- **Bookmark Folder Hierarchy & Management**:
  - Full support for nested bookmark folders (`klasor` attribute) during import and manual creation.
  - Interactive Star / `Ctrl+D` popover dialog for editing bookmark titles, selecting folders, and creating new folders inline.
  - Bookmarks bar folder dropdown buttons (`📁 Folder ▾`) with custom dark popup menus, right-click actions, and middle-click tab opening.
  - Bookmarks Manager (`omni://yerimleri`) with folder groupings, item counters, folder renaming, and folder deletion tools.
- **Official SVGL Vector Icons**:
  - High-resolution vector logos from the `svgl.app` library for all supported browsers (Chrome, Brave, Edge, Supermium, Firefox, Floorp, Opera, Opera GX, Vivaldi, HTML5).
  - Embedded as pure inline DOM `<svg>` elements to guarantee 100% Content Security Policy (CSP) compliance and zero broken image placeholders.
- **ByeDPI Anti-Censorship Engine (`src/dpi.js`)**:
  - In-browser local SOCKS5 proxy with client-side TCP/TLS packet fragmentation.
  - Multiple fragmentation strategies: Split 1, Split 2, Split SNI, and Fake Split to bypass Deep Packet Inspection without modifying system-wide network configuration.
- **Internal Browser Schemes (`omni://`)**:
  - Dedicated internal tabs with English addresses: `omni://history`, `omni://bookmarks`, `omni://downloads`, `omni://settings`, `omni://passwords`, `omni://extensions`, `omni://statistics`, `omni://speed-test`, `omni://import`, and `omni://about`. The previous Turkish addresses are still accepted.
  - The address bar shows the real internal address instead of `about:blank`.
  - Granular single-entry deletion in the browsing history view.
- **Password Vault (`src/store.js`)**:
  - Secure local credential vault protected by Master Password encryption.
  - In-browser search, credential reveal, clipboard copy, and entry management.
- **In-Browser Speed Test (`src/speedtest.js`)**:
  - Real-time latency, jitter, download, and upload bandwidth measurements powered by Cloudflare and Speedtest.net API endpoints.
- **Theming & Wallpaper Customization**:
  - Custom background image upload for new tab pages and browser shell.
  - 6 color themes: Default, Night Blue, Purple Nebula, Emerald, Sunset, and Pure Dark (OLED).
- **12-Language First-Class Localization**:
  - Full localization parity across all UI strings for Turkish, Azerbaijani, English, German, French, Spanish, Italian, Portuguese, Russian, Arabic (RTL), Simplified Chinese, and Japanese.

- **Chromium Extensions (`src/eklentiler.js`, `src/eklenti-api.js`)**:
  - Install from the Chrome Web Store (an "Add to CVS Browser" / "Remove from CVS Browser" button replaces the store's own button), from a Web Store URL or extension ID, from a `.crx` file, or from an unpacked folder. Extensions keep their Web Store ID (the CRX public key is written to `manifest.key`); archives are unpacked with path-traversal protection.
  - Every install, update that adds permissions, and optional-permission request goes through an on-theme confirmation dialog (`katmanOnay`) that lists the extension's permissions and site access.
  - Chrome-style Extensions page (`omni://extensions`): search, card grid, per-extension details page, Developer mode, pin to toolbar, enable/disable, remove, and a manual **Update** check against the Chrome Web Store update service (silent when no new permissions are needed).
  - Toolbar pinning with popups, a puzzle-menu, and options pages.
  - Extension API bridge: `chrome.cookies`, `chrome.downloads`, `chrome.tabCapture` (tab audio, e.g. Shazam), `chrome.identity.launchWebAuthFlow`/`getRedirectURL`, and `chrome.permissions` (optional permissions). The caller is identified from the sending context's URL, never from the request, and every call is checked against the manifest (and host access for cookies).
  - Compatibility layer (`src/eklenti-uyumluluk-onyukleme.js`): `chrome.storage.sync` backed by local storage, `browser.*` patched alongside `chrome.*`, and no-op events for APIs Electron lacks (`chrome.history`).
- **Browser Import Extras**: downloads and saved passwords from Chromium-based browsers (passwords decrypted locally with Windows DPAPI; app-bound v20 passwords are skipped and counted).
- **Saved Password Suggestions (`src/parola-onyukleme.js`)**: a native menu lists the site's saved logins when a username/password field is clicked; only the chosen entry is sent to the page.
- **Downloads**: configurable downloads folder, persistent downloads list (including imported entries) and date/time on every entry.
- **Windows Default Apps Registration (`src/varsayilan-windows.js`)**: the browser registers itself (per-user, no admin rights) so it appears in Settings > Default apps; the uninstaller removes the keys.
- **Keyboard & Tabs**: `Ctrl+F5` hard reload, `Ctrl+W` on the last tab closes the window, per-tab address bar drafts that are discarded on navigation or reload.

### Changed
- Redesigned tab close button (always visible on the active tab, on hover for others).
- Refined dropdown styling with custom thin dark scrollbars (`scrollbar-width: thin;`) eliminating Windows default white scrollbars.
- Prevented scroll jumps when opening dropdown menus using `{ preventScroll: true }` and `scrollTop = 0` resets.
- Modernized bookmark bar item rendering and drag-and-drop ordering.

### Fixed
- Fixed CSP violation where relative `<img src="...">` was blocked by `img-src data: pusula-favicon:;`.
- Fixed duplicate method definitions in `Store` class.
- Fixed history import returning 0 records from Chromium-based browsers (timestamps overflowed JavaScript's safe integer range).
- Fixed the Statistics button opening a blank page when the active tab was not an empty new tab.
- Fixed the password copy button not copying to the clipboard, and the bookmark star button failing on click.
- Fixed tilde (`~`) home directory expansion in deployment scripts on Windows PowerShell.

---

## [0.5.13] - 2026-10-30

### Security
- Capped concurrent VPN proxy connections and token limits by network prefix (anti-DoS protection).
- Restricted proxy from routing to internal / private RFC 1918 addresses (anti-SSRF protection).

---

## [0.5.12] - 2026-10-25

### Changed
- Refined Chromium SUID sandbox configuration and Linux packaging scripts.
- Enhanced Electron diagnostic reporting during automated testing runs.

---

## [0.5.11] - 2026-10-20

### Added
- Comprehensive 11-gate quality assurance pipeline (`npm run boru-hatti`): Commit, Lint, Static, Race, Unit, Integration, CVE/SCA, Build, E2E, Smoke, and Load checks.
- Ed25519 cryptographic update signing and SHA-512 manifest verification (`scripts/manifest-imzala.js`).

---

## [0.5.0] - 2026-10-01

### Added
- Integrated uBlock Origin engine (`@gorhill/ubo-core`) for local request interception and cosmetic filtering.
- Automated updates for EasyList and EasyPrivacy rule sets.
- Built-in local domain blocklist for zero-day privacy protection.

---

## [0.4.0] - 2026-09-15

### Added
- Core tab management: multi-tab browsing, tab dragging, middle-click close, and audio indicators.
- Smart Omnibox with instant search engine switching (DuckDuckGo, Google, Bing, Brave, Yandex, Startpage).
- Local site favicon caching with custom `pusula-favicon://` protocol.
- Secure preload isolation layer using Electron `contextBridge`.
