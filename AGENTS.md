# AGENTS.md — CVS Browser Autonomous Development Guide

Welcome to the **CVS Browser** codebase. This document defines the engineering standards, team roles, architectural invariants, and verification protocols for AI agents and autonomous engineering systems working on this repository.

---

## 1. Project Overview & Philosophy

**CVS Browser** is an open-source, privacy-first desktop web browser built on top of **Electron / Chromium** with custom native orchestration written in Node.js.

### Core Tenets:
- **Zero Remote Telemetry:** No user data, navigation logs, or browsing habits are ever uploaded to third-party servers.
- **Offline-First & Local Engine:** Tracking protection, EasyList/EasyPrivacy filtering, bookmarks, history, passwords, and custom DPI circumvention run locally on the client.
- **Strict Cryptographic Integrity:** All application updates are signed via Ed25519 manifests and verified before installation.
- **12-Language First-Class Localization:** Every single user-facing string is localized across 12 languages: Türkçe (`tr`), Azərbaycanca (`az`), English (`en`), Deutsch (`de`), Français (`fr`), Español (`es`), Italiano (`it`), Português (`pt`), Русский (`ru`), العربية (`ar` - RTL), 简体中文 (`zh`), and 日本語 (`ja`).

---

## 2. Autonomous Development Team Roles

When collaborating on issues or tickets, adopt the relevant agent persona:

### 🎯 The Product Manager (@pm)
- **Responsibility:** Translates user requests into precise technical architectures and specifications.
- **Rule:** Never writes application code directly; focuses on system boundaries, edge cases, UX flows, and explicit user alignments.

### 💻 The Full-Stack Engineer (@engineer)
- **Responsibility:** Implements features cleanly across Node.js (`main.js`, `src/`), the preload sandbox (`preload.js`), and frontend web technologies (`ui/`).
- **Rule:** Writes clean, modular, DRY, and well-documented JavaScript/CSS. Respects architectural boundaries and maintains 100% test contract compliance.

### 🔍 The QA Engineer (@qa)
- **Responsibility:** Audits code for security vulnerabilities, race conditions, memory leaks, unhandled promises, and contract breaches.
- **Rule:** Runs and expands unit, integration, and security test suites (`npm test`). Enforces zero-tolerance for failing tests.

### 🚀 The DevOps Master (@devops)
- **Responsibility:** Manages builds, packaging (`electron-builder`), release signing (`scripts/manifest-imzala.js`), and CI/CD pipelines (`npm run boru-hatti`).
- **Rule:** Guarantees repeatable local and cloud builds without environment pollution.

---

## 3. Directory Layout

```
.
├── main.js                  # Electron main process (lifecycle, windows, session, IPC handlers)
├── preload.js               # Sandboxed contextBridge bridge exposing window.pusula
├── src/
│   ├── blocker.js           # Network request blocker & tracking filter engine
│   ├── blocklist.js         # Built-in lightweight tracking domain blocklist
│   ├── diller/              # 12 localization dictionary files (tr.js is reference)
│   ├── dpi.js               # ByeDPI local anti-censorship packet fragmentation engine
│   ├── eklentiler.js        # Extension manager (Web Store/CRX/folder install, update check, pin/enable/remove)
│   ├── eklenti-api.js       # chrome.cookies/downloads/tabCapture/identity/permissions bridge (permission-checked)
│   ├── eklenti-uyumluluk-onyukleme.js  # Preload that patches chrome.*/browser.* inside extension contexts
│   ├── eklenti-magaza-onyukleme.js     # Web Store "Add to / Remove from CVS Browser" button
│   ├── faviconlar.js        # Cached favicon store & pusula-favicon:// scheme handler
│   ├── flowmusic.js         # Background audio / radio engine
│   ├── guncelleme.js        # Auto-update manager
│   ├── guncelleme-dogrula.js# Ed25519 signature & SHA-512 manifest validation
│   ├── guncelleme-anahtar.js# Embedded public key & update feed configuration
│   ├── guvenlik.js          # Security guard (URI schemes, filename sanitization, internal pages)
│   ├── listeler.js          # Adblock filter lists manager (EasyList, EasyPrivacy)
│   ├── parola-onyukleme.js  # Saved-password suggestions (page-side preload)
│   ├── speedtest.js         # Speedtest engine (ping, jitter, download, upload)
│   ├── store.js             # Local JSON persistence store (settings, bookmarks, history, vault)
│   ├── tarayici-aktar.js    # Browser data import engine (Chromium, Gecko, HTML)
│   ├── urls.js              # Omnibox query / URL resolver & search engine dispatcher
│   ├── varsayilan-windows.js# Windows "Default apps" browser registration (HKCU, no admin)
│   └── vpn.js               # Encrypted browser proxy / VPN integration
├── ui/
│   ├── app.js               # Main browser UI logic (tabs, omnibox, bookmarks bar, modals)
│   ├── index.html           # Main browser chrome shell
│   ├── style.css            # Modern dark/light theme, RTL styles, responsive controls
│   ├── newtab.html / .js    # New tab page
│   ├── error.html / .js     # Internal network & load error page
│   └── simgeler/            # Official vector SVG icon assets (tarayicilar, etc.)
├── yapi-kaynaklari/         # Packaging resources (icons, installer.nsh uninstall cleanup)
├── scripts/                 # Development, key generation, and release signing scripts
└── test/                    # Comprehensive automated test suites
```

---

## 4. Architectural Invariants & Non-Negotiable Rules

### 4.1. Security & Process Isolation
1. **Context Isolation:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` are mandatory for all web views and UI windows.
2. **Preload Surface:** Never expose raw Node.js or Electron modules to the renderer. Only expose explicitly defined methods on `window.pusula`.
3. **Content Security Policy (CSP):**
   `ui/index.html` strictly enforces:
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'none'; img-src data: pusula-favicon:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'">
   ```
   *Never use external HTTP/HTTPS images or relative `<img src="...">` paths that violate CSP.* All icons in the UI must be inline `<svg>` elements or `data:` URLs.

### 4.2. IPC & Contract Testing (`test/sozlesme.js`)
Any changes to IPC or UI code are enforced by `test/sozlesme.js`:
- Every `ipcRenderer.send('channel')` in `preload.js` must have a corresponding `ipcMain.on('channel')` in `main.js`.
- Every `ipcRenderer.invoke('channel')` in `preload.js` must have a corresponding `ipcMain.handle('channel')` in `main.js`.
- Every `window.pusula.<method>` call in `ui/app.js` must be exported by `preload.js`.
- Every DOM element accessed via `$('id')` in `ui/app.js` must exist in `ui/index.html`.
- Every CSS class used dynamically in `ui/app.js` must be defined in `ui/style.css`.
- Every `cev('key')` call in `ui/app.js` or `main.js` must exist in `src/diller/tr.js`.
- Every key in `src/diller/tr.js` must be mirrored across **all other 11 language files** (`az`, `en`, `de`, `fr`, `es`, `it`, `pt`, `ru`, `ar`, `zh`, `ja`).

### 4.3. Extension Security
- The calling extension is derived from the sender (`senderFrame.url` / `serviceWorker.scope`), never from request data.
- All `chrome.*` bridge calls are checked against the manifest permissions (plus user-approved optional ones); cookies also need host access.
- Installs, updates that add permissions, and optional-permission requests require the `katmanOnay` confirmation.
- Synchronous IPC replies (`event.returnValue`) must be assigned exactly once.

### 4.4. Bookmarks & Folder Hierarchy
- Imported bookmarks from other browsers (Chrome, Edge, Brave, Supermium, Firefox, Floorp, Opera, HTML) must retain their folder hierarchy in `y.klasor`.
- In `ui/app.js`, root bookmarks (`klasor === ''`) render directly on the bookmarks bar, while categorized bookmarks render under folder dropdown buttons (`📁 Folder ▾`).
- Adding/editing bookmarks (`Ctrl+D` / `#btnYerImi`) opens the bookmark popover with live folder selection and "+ New Folder" inline creation.

---

## 5. Verification Commands

Run these commands before committing any change:

```bash
# 1. Run full test suite (unit, security, update, extension, and contract tests)
npm test

# 1b. Real-Electron / real-app suites (extensions, downloads folder)
npm run test-electron

# 2. Run static contract & IPC verification only
node test/sozlesme.js

# 3. Run browser import engine and extension tests
node test/aktar.js
node test/eklenti.js && node test/eklenti-api.js

# 4. Run full local 11-gate release pipeline
npm run boru-hatti -- --hizli

# 5. Launch development instance
npm run dev
```
