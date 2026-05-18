# AGENTS.md — Ronak Electricals

> Greenfield project. Full spec: `Plan.md`. Task breakdown: `DEVELOPMENT-PLAN.md`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | **Tauri v2** (Rust) |
| Frontend | **React 18 + Vite 5** |
| DB | **SQLite** via `rusqlite` (Rust) with **FTS5** |
| Styling | **CSS Modules** (no Tailwind, no MUI/Ant/Chakra) |
| PDF | `@react-pdf/renderer` (JS, client-side) |
| Print | `window.print()` (native webview) |
| Date | `dayjs` + `worldtimeapi.org` fetch with 2s timeout fallback |

## Build & Dev Commands

```bash
npm run tauri dev      # dev server with hot reload
npm run tauri build    # production binary
```

## Architecture — Critical Rules

1. **All DB access goes through Rust.** Never use a JS SQLite library. Pattern: Rust `#[tauri::command]` → frontend `invoke()`.
2. **SQLite state** is stored as Tauri managed state (`Mutex<Connection>`). Initialized in `tauri::Builder::default().setup()` using `app.path().app_data_dir()`.
3. **Cart is in-memory only** (`useState`). No cart persistence to DB. Invoices are ephemeral.
4. **No Redux/Zustand** — only React built-in state (`useState`, `useReducer`).
5. **No ORM** (Diesel, SeaORM). Raw `rusqlite` queries only.

## Database (src-tauri/src/db.rs)

- `brands`: `id INTEGER PK, name TEXT UNIQUE`
- `items`: `id INTEGER PK, name TEXT, price REAL, brand_id FK → brands(id) ON DELETE SET NULL`
- `items_fts`: FTS5 virtual table on `name`, synced via three triggers (INSERT/DELETE/UPDATE)
- Schema initialized with `CREATE TABLE IF NOT EXISTS` on every launch

## Tauri Commands (rust → JS bridge)

7 commands in total: `get_brands`, `add_brand`, `delete_brand`, `get_items`, `add_item`, `delete_item`, `search_items`.

Search uses FTS5: `SELECT ... FROM items_fts JOIN items ... LEFT JOIN brands ... WHERE items_fts MATCH ?1 LIMIT 20`.

## Design Tokens

| Token | Value |
|-------|-------|
| Primary accent | `#e07b2a` (orange) |
| Navy | `#1a3c5e` (header/wordmark) |
| Background | `#f8f8f6` |
| Surface | `#ffffff` |
| Border | `#e2e0db` |
| Text primary | `#1a1a18` |
| Text secondary | `#6b6b68` |
| Font | IBM Plex Sans (Regular 400, Medium 500) |
| Shadows | ≤ `0 1px 3px rgba(0,0,0,0.08)` |
| Radii | ≤ `6px` |
| Min window | `800px` |

## ✅ Implementation Order

1. Scaffold Tauri + React + Vite → 2. DB init (`db.rs`) → 3. All Tauri commands → 4. Frontend foundation (App, tabs, CSS) → 5. Inventory tab → 6. Billing tab → 7. Invoice preview + PDF → 8. Polish → 9. Build

## Explicit Constraints (do not violate)

- ❌ No Electron
- ❌ No MUI, Ant Design, Chakra, Tailwind
- ❌ No ORMs
- ❌ No backend server or cloud services
- ❌ No user authentication
- ❌ No invoice history in DB (v1 scope)
- ❌ No stock/quantity tracking in inventory
- ❌ No cart persistence to DB
- ❌ No lazy loading unless item count > 500

## Search UX Requirements

- 100ms debounce on keystroke
- Results limited to 20
- Keyboard navigable (ArrowUp/Down + Enter + Escape)
- Only queries on search (no preload of all items)

## Key Dependencies

**Rust (Cargo.toml):** `tauri 2`, `rusqlite 0.31` (bundled), `serde 1` (derive), `serde_json 1`

**JS (package.json):** `react 18`, `react-dom 18`, `@react-pdf/renderer 3`, `dayjs 1`; devDeps: `vite 5`, `@vitejs/plugin-react 4`, `@tauri-apps/cli 2`
