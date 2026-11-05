# Changelog

All notable changes to the **CVS Browser** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2026.11.5] - 2026-11-05

### Added
- **What's New window**: after the browser is updated, the first launch shows the release notes of the new version only. The notes are read from the project's `CHANGELOG.md` on GitHub and rendered as formatted text (headings, lists, **bold**, `code`) instead of raw Markdown.
- **Language selector in the What's New window**: choosing a language other than English shows the release notes translated into that language (12 languages supported; falls back to English if the translation is unavailable). Only the public release-notes text is sent for translation, and only when a non-English language is selected.
- **Private window search engine**: new setting under Settings > Search and startup to choose the search engine used in private tabs and windows (address bar, new tab page, home button, paste-and-go, "Search in private window"). Defaults to Startpage; normal tabs keep using the regular search engine setting.
- **Search target picker on the new tab page**: choose Google, DuckDuckGo, Yandex, Bing, Startpage, Wikipedia, GitHub, YouTube or Video Vitrini under the search box; the query is searched on the selected site and your choice is remembered.
- **`@username` shortcuts**: with YouTube selected, typing a space-free `@username` opens `https://yton.tr/@username`; with Video Vitrini selected it opens `https://videovitrini.com/@username`.

### Changed
- Application version scheme switched to date-based versions.
- **About page update check** (`omni://about`): "Check for updates" now reports the real result instead of always claiming the browser is up to date. When a new version exists it shows the found version and offers Download, then Install and restart, with live download progress and error reasons, the same as Settings > Updates. "Up to date" is shown only after a check confirms it.
- **Updated browser logos in the import list**: Supermium, Vivaldi, Opera, Firefox, Floorp and Opera GX now use new official vector icons (still embedded as inline `<svg>`, CSP-compliant; gradient IDs are prefixed so logos never clash).

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
