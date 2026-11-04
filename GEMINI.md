# GEMINI.md — CVS Browser Engineering Rules & Operating Guidelines

## §0 — Core Operational Rules

### §0.1 — Tool & Verification Discipline
- **Allowed Tools:** `read_file`, `write_file`, `edit_file`, `run_command`, `search_web` (only when explicit research is requested).
- **Anti-Hallucination on Disk:** After editing or generating files, always verify on disk. Never claim a file was written, modified, or tested without corresponding tool execution.
- **Thinking Trace:** Operational status only. Use imperative action verbs: *"Read file. Edit module. Run test suite. Verify contract."* No reflective prose or banned words.

### §0.2 — Output Scope
- Deliver complete, production-ready code with no placeholders or cutoffs.
- Write files directly to disk using `write_file` / `edit_file`. Keep chat responses concise with direct pointers and clear status.
- Never delete or modify unrelated user files.

---

## §1 — Project Specifications

### §1.1 — Tech Stack & Environment
- **Runtime:** Node.js 22+ & Electron 44 (`package.json`: `^44.2.0`)
- **Rendering Engine:** Chromium (sandboxed multi-process model)
- **Primary Modules:**
  - `main.js`: Main process orchestration and IPC routing
  - `preload.js`: Sandboxed contextBridge API (`window.pusula`)
  - `src/store.js`: Local JSON database (settings, history, bookmarks, passwords)
  - `src/tarayici-aktar.js`: Multi-browser import engine (Chromium, Gecko, HTML)
  - `src/dpi.js`: In-browser ByeDPI anti-censorship packet fragmentation
  - `src/vpn.js`: Encrypted SOCKS5 / HTTP proxy integration
  - `src/speedtest.js`: Cloudflare & Speedtest.net measurement engine
  - `src/eklentiler.js` / `src/eklenti-api.js`: Chromium extension manager and the permission-checked `chrome.*` API bridge (cookies, downloads, tabCapture, identity, permissions)
  - `src/eklenti-uyumluluk-onyukleme.js`, `src/eklenti-magaza-onyukleme.js`, `src/parola-onyukleme.js`: preloads for extension compatibility, the Web Store button, and password suggestions
  - `src/varsayilan-windows.js`: Windows Default apps registration
  - `ui/app.js` & `ui/style.css`: Browser chrome UI, bookmarks bar, and omni:// internal views

---

## §2 — Invariants & Quality Standards

### §2.1 — 12-Language Mirroring
All UI strings must be resolved using `cev('key')`. Every translation key defined in `src/diller/tr.js` must exist across all 12 localization files:
`tr`, `az`, `en`, `de`, `fr`, `es`, `it`, `pt`, `ru`, `ar`, `zh`, `ja`.
Never add a key to `tr.js` without updating the other 11 language files.

### §2.2 — CSS & DOM Contract
- Every CSS class dynamically added or queried in `ui/app.js` must be declared in `ui/style.css`.
- Every DOM element accessed via `$('elementId')` in `ui/app.js` must exist in `ui/index.html`.
- Any IPC channel registered in `preload.js` must have a matching handler in `main.js`.
- Always verify with `node test/sozlesme.js` before completing any turn.

### §2.3 — Content Security Policy (CSP)
`ui/index.html` enforces:
`default-src 'none'; img-src data: pusula-favicon:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'`
- Never use `<img src="relative/path">` or external HTTP/HTTPS images in the UI.
- All icons must be inline SVG strings (`<svg viewBox="...">...</svg>`) or `data:image/svg+xml;...` URLs.

---

## §3 — Verification Checklist

1. `npm test` passes with 0 failures across all 775+ tests.
2. `node test/sozlesme.js` passes with zero contract or missing key errors.
3. `node test/aktar.js` passes all browser import and bookmark folder tests.
4. `node test/eklenti.js` and `node test/eklenti-api.js` pass; `npm run test-electron` passes when touching extensions, downloads, or the app shell.
5. No console errors, CSP violations, or broken images in the renderer.
