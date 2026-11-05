# CLAUDE.md — CVS Browser Architecture & Development Guide

This guide provides instructions and reference architecture for Claude when working on the **CVS Browser** repository.

---

## 🛠️ Common Developer Commands

```bash
# Install dependencies
npm install

# Start development browser (with hot reloads / dev flags)
npm run dev
# or standard start
npm start

# Run all test suites (unit, security, updates, contracts, importer, themes)
npm test

# Run individual test files
node test/dogrula.js       # Core logic, URL parser, adblocker tests
node test/guvenlik.js      # Security regression vectors (77 attack vectors)
node test/guncelleme.js    # Ed25519 signature & update manifest verification
node test/sozlesme.js      # Preload <-> Main IPC & 12-language contract validator
node test/aktar.js         # Browser data importer unit tests
node test/tema.js          # Theme and omni:// internal page tests
node test/eklenti.js       # Extension install/CRX/ZIP/update logic
node test/eklenti-api.js   # chrome.cookies/downloads/identity/permissions/tabCapture bridge
node test/varsayilan.js    # Windows "Default apps" registry layout

# Real-Electron / real-app tests (also run by `npm run test-electron`)
electron test/electron-eklenti.js
electron test/electron-eklenti-uyumluluk.js
node test/electron-eklenti-api.js
node test/electron-eklenti-kimlik.js
node test/electron-eklenti-ekran.js
node test/electron-eklenti-arayuz.js
node test/electron-indirme-klasoru.js

# Run 11-gate local CI pipeline
npm run boru-hatti
npm run boru-hatti -- --hizli    # Fast cheap gates only

# Package application (Windows / Linux / macOS)
npm run paket
npm run paket-dizin
```

---

## 🏗️ Architecture Overview

CVS Browser utilizes Electron's multi-process model:

1. **Main Process (`main.js`, `src/`)**:
   - Manages window lifecycle, tabs (`BrowserView` instances), session cookies, networking filters, and native menus.
   - Enforces security checks in `src/guvenlik.js`.
   - Handles IPC requests (`ipcMain.handle` / `ipcMain.on`) for bookmarks, history, settings, VPN, DPI, passwords, and browser imports.
   - Updates state via `durumGonder()` to keep the renderer synchronized.

2. **Preload Layer (`preload.js`)**:
   - Sandboxed context bridge. Uses `contextBridge.exposeInMainWorld('pusula', ...)`.
   - Safely exposes only explicit, validated IPC methods to the UI. Never exposes raw `ipcRenderer` or Node built-in modules.

3. **Renderer Process (`ui/`)**:
   - The browser shell UI is rendered in `ui/index.html` with logic in `ui/app.js` and styling in `ui/style.css`.
   - Internal tab pages are rendered through custom schemes or dedicated templates (`omni://history`, `omni://bookmarks`, `omni://downloads`, `omni://settings`, `omni://passwords`, `omni://extensions`, `omni://statistics`, `omni://speed-test`, `omni://import`, `omni://about`, `ui/newtab.html`, `ui/error.html`). Panel codes stay Turkish internally (`gecmis`, `yerImleri`, ...); `dahiliAdres()` in `src/urls.js` maps them to the English addresses and the old Turkish addresses are still parsed.

4. **Extensions (`src/eklentiler.js`, `src/eklenti-api.js`)**:
   - `EklentiYoneticisi` installs/loads/removes extensions via `session.extensions` (CRX2/CRX3 + ZIP are parsed in-house, no dependencies). State lives in `store.veri.eklentiler`.
   - `EklentiApi` is the main-process side of `chrome.cookies`, `chrome.downloads`, `chrome.tabCapture`, `chrome.identity` and `chrome.permissions`. The preload `src/eklenti-uyumluluk-onyukleme.js` (service-worker and frame preloads) patches the extension's own world through `contextBridge.executeInMainWorld`.
   - `src/eklenti-magaza-onyukleme.js` adds the Web Store install/remove button; `src/parola-onyukleme.js` drives saved-password suggestions; `src/varsayilan-windows.js` registers the browser in Windows Settings > Default apps.

---

## ⚠️ Critical Constraints & Invariants

### 1. Content Security Policy (CSP)
`ui/index.html` enforces:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data: pusula-favicon:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'">
```
- **Rule:** Never use relative `<img src="...">` paths or external image URLs in `ui/app.js`.
- **Solution:** Always use inline `<svg viewBox="...">...</svg>` or `data:image/svg+xml;...` URLs.

### 2. Contract Enforcement (`test/sozlesme.js`)
The repository includes a strict static contract validator that checks the code on every run:
- **IPC channels:** Any channel invoked in `preload.js` must have a corresponding listener in `main.js`.
- **12-Language Parity:** All keys added to `src/diller/tr.js` must be simultaneously added to:
  `az.js`, `en.js`, `de.js`, `fr.js`, `es.js`, `it.js`, `pt.js`, `ru.js`, `ar.js`, `zh.js`, `ja.js`.
- **CSS Classes:** Every class referenced via `classList.add(...)`, `className = ...`, or `querySelector('.class')` in `ui/app.js` must exist in `ui/style.css`.
- **DOM IDs:** Any `$('id')` lookup in `ui/app.js` must match an `id="id"` in `ui/index.html`.
- **Undefined constants:** Upper-case identifiers used in `main.js` must be defined there (accessing `module.KAYITLI_AD` as a bare name fails; export a function instead).

### 2b. Extension API Security Invariants
- The calling extension is derived from the sender (`senderFrame.url` for pages, `serviceWorker.scope` for workers), never from request data.
- Every API call is checked against the extension's manifest permissions (merged with user-approved optional permissions); cookie access additionally needs host access.
- Installs, permission-adding updates and `permissions.request` must go through the `katmanOnay` confirmation; nothing runs before approval.
- `webContents.send`/`ipcMain.on` handlers called with `sendSync` must set `event.returnValue` exactly once (the first assignment replies).

### 3. Bookmarks & Folder Hierarchy
- Bookmarks support folders (`klasor` field). Direct bookmarks have `klasor = ''`.
- When importing from Chrome, Supermium, Brave, Firefox, or HTML files, preserve folder names.
- Bookmarks bar renders folders as `📁 xxx ▾` buttons with custom dropdowns.
- `Ctrl+D` and the star icon `#btnYerImi` trigger the bookmark popover for saving and folder selection.

### 4. Zero Telemetry & Privacy
- Never send queries or metrics to external analytics endpoints.
- Filtering lists (`EasyList`, `EasyPrivacy`) are downloaded and parsed locally via `@gorhill/ubo-core`.
- Passwords and settings are stored locally in the Electron user-data folder (`%APPDATA%\CVS Browser\` on Windows).

---

## 🎨 Code Style & Conventions

- **JavaScript:** Modern CommonJS (`require` / `module.exports`), strict mode (`'use strict'`), standard Node.js built-ins (`node:fs`, `node:path`, `node:crypto`, `node:os`).
- **Async Pattern:** Async/await with proper error boundaries (`try / catch`).
- **CSS:** CSS variables for theming (`--zemin`, `--metin`, `--vurgu`, `--cizgi`), dark-theme native scrollbars (`scrollbar-width: thin;`), responsive layouts.
- **Paths:** Handle Windows backslashes and POSIX forward slashes safely; support home directory tildes (`~`) via `tildeCoz(p)`.
