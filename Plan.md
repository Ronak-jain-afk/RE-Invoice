# 🧾 Ronak Electricals — Inventory & Invoice Desktop App
### AI Coding Agent Prompt

---

## 🎯 Project Overview

Build a **lightweight desktop application** for a small electrical goods shop called **"Ronak Electricals"**. The app has two core features:

1. **Inventory Management** — Store and manage items (name, price, brand)
2. **Invoice / Billing** — Search items, build an invoice cart, and print or export as PDF

This is a **local-first, offline-capable** application. All data is stored in a local SQLite database on the user's machine. There is no backend server, no cloud sync, no user authentication.

---

## 🛠️ Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Desktop shell | **Tauri v2** (Rust) | Lightweight (~10MB binary), uses OS native webview |
| Frontend | **React + Vite** | Fast dev cycle, component model suits tabbed UI |
| Database | **SQLite** via `rusqlite` in Rust | Embedded, zero-config, fast local queries |
| Styling | **CSS Modules** or plain CSS | No heavy UI libraries; keep it lean |
| PDF Export | **`@react-pdf/renderer`** (JS) | Client-side PDF generation, no extra binary |
| Print | Native browser `window.print()` | Tauri webview supports print dialogs natively |
| Date | `dayjs` + optional `worldtimeapi.org` fetch | Auto-detect date if online, fallback to system clock |
| Search | SQLite **FTS5** full-text search | Sub-millisecond search across thousands of items |

> **Do not use Electron.** Do not use heavy component libraries like MUI or Ant Design. Do not add an ORM. Keep dependencies minimal.

---

## 📁 Project Structure

```
ronak-electricals/
├── src/                          # React frontend
│   ├── main.jsx
│   ├── App.jsx                   # Tab router (Inventory | Billing)
│   ├── components/
│   │   ├── InventoryTab.jsx      # Add items + view inventory table
│   │   ├── BillingTab.jsx        # Search items, build cart, show totals
│   │   ├── InvoicePreview.jsx    # Formatted invoice for print/PDF
│   │   └── BrandManager.jsx      # Manage brand list (add/delete)
│   ├── hooks/
│   │   useItems.js               # Tauri invoke() wrappers for item CRUD
│   │   useCart.js                # In-memory cart state (useState)
│   │   useDate.js                # Auto date detection logic
│   └── styles/
│       └── *.css
├── src-tauri/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # Tauri app entry + command registration
│       └── db.rs                 # All SQLite logic (init, CRUD, FTS5 search)
├── package.json
└── tauri.conf.json
```

---

## 🗄️ Database Schema

Define and initialize all tables on first app launch inside `db.rs`.

### Tables

```sql
-- Brands (pre-inputted, chosen via dropdown)
CREATE TABLE IF NOT EXISTS brands (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

-- Items (inventory)
CREATE TABLE IF NOT EXISTS items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  price      REAL NOT NULL,
  brand_id   INTEGER REFERENCES brands(id) ON DELETE SET NULL
);

-- Full-Text Search virtual table for fast billing search
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  name,
  content='items',
  content_rowid='id'
);

-- Keep FTS in sync with items
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, name) VALUES (new.id, new.name);
END;

CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name) VALUES('delete', old.id, old.name);
END;

CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name) VALUES('delete', old.id, old.name);
  INSERT INTO items_fts(rowid, name) VALUES (new.id, new.name);
END;
```

---

## ⚙️ Tauri Commands (Rust → Frontend Bridge)

Expose these commands from `db.rs` and register them in `main.rs`:

```rust
// Brands
#[tauri::command] fn get_brands() -> Vec<Brand>
#[tauri::command] fn add_brand(name: String) -> Result<Brand, String>
#[tauri::command] fn delete_brand(id: i64) -> Result<(), String>

// Items
#[tauri::command] fn get_items() -> Vec<ItemWithBrand>   // JOIN with brands
#[tauri::command] fn add_item(name: String, price: f64, brand_id: Option<i64>) -> Result<Item, String>
#[tauri::command] fn delete_item(id: i64) -> Result<(), String>

// Search (used in Billing tab)
#[tauri::command] fn search_items(query: String) -> Vec<ItemWithBrand>
// Uses FTS5: SELECT items.*, brands.name as brand_name
//            FROM items_fts
//            JOIN items ON items.id = items_fts.rowid
//            LEFT JOIN brands ON items.brand_id = brands.id
//            WHERE items_fts MATCH ?1
//            LIMIT 20
```

All commands receive the `AppHandle` and access a `Mutex<Connection>` managed state.

---

## 🖥️ Feature Specifications

### Tab 1 — Inventory

**Add Item Form:**
- Input: Item Name (text)
- Input: Price (number, 2 decimal places)
- Dropdown: Brand (populated from `brands` table; includes "No Brand" option)
- Submit button → calls `add_item` Tauri command → refreshes list

**Inventory Table:**
- Columns: `#`, `Item Name`, `Brand`, `Price (₹)`, `Actions`
- Actions: Delete item (with confirmation)
- Load all items on mount via `get_items`
- No pagination needed unless item count exceeds ~500 (add lazy loading only if required)

**Brand Manager (collapsible section or small modal):**
- List existing brands
- Add new brand (text input + button)
- Delete brand (with warning if items use it)

---

### Tab 2 — Billing / Invoice

**Invoice Header Inputs:**
- Date: Auto-populated (see Date Logic below), user-editable
- Customer Name: Optional text input
- Customer Mobile: Optional number input (10 digits)

**Item Search & Add to Cart:**
- Search bar (autofocus on tab open)
- Triggers `search_items` Tauri command on every keystroke with **100ms debounce**
- Shows dropdown results: `Item Name — Brand — ₹Price`
- Click result → opens a small quantity input (default: 1) → "Add" button
- Added items appear in the **Cart Table** below

**Cart Table:**
- Columns: `Item Name`, `Brand`, `Unit Price (₹)`, `Qty`, `Total (₹)`, `Remove`
- Quantity is editable inline (number input, min 1)
- Grand Total auto-calculated from all cart rows, shown prominently at bottom

**Invoice Actions:**
- `🖨️ Print Invoice` — opens `InvoicePreview` in a print window via `window.print()`
- `📄 Export PDF (A4)` — generates PDF using `@react-pdf/renderer`
- `📄 Export PDF (A5)` — same, with A5 page size
- `🗑️ Clear Cart` — resets cart state

---

### Invoice Preview / Print Format

The `InvoicePreview` component renders a clean, formatted invoice. It must include:

```
┌─────────────────────────────────────────┐
│           RONAK ELECTRICALS             │
│         [Address / Phone if any]        │
├─────────────────────────────────────────┤
│  Invoice Date: DD/MM/YYYY               │
│  Customer: [Name]   Mobile: [Number]    │
├────┬──────────────┬──────┬─────┬───────┤
│ #  │ Item         │ Brand│ Qty │ Total │
├────┼──────────────┼──────┼─────┼───────┤
│ 1  │ Item Name    │ X    │  2  │ ₹200  │
│ 2  │ ...          │ ...  │ ... │  ...  │
├────┴──────────────┴──────┴─────┴───────┤
│                       Grand Total: ₹XXX│
└─────────────────────────────────────────┘
         Thank you for your purchase!
```

- Use `@media print` CSS to hide all app UI and show only the invoice
- For PDF: use `@react-pdf/renderer` `<Document>`, `<Page>`, `<View>`, `<Text>` primitives
- A4 = 210×297mm, A5 = 148×210mm

---

## 📅 Date Auto-Detection Logic (`useDate.js`)

```js
// On billing tab mount:
// 1. Try fetching: https://worldtimeapi.org/api/ip
// 2. If success → use datetime field, format as DD/MM/YYYY
// 3. If fetch fails (offline/timeout after 2s) → use new Date() system clock
// 4. Store in state, allow user to manually override via date input
```

---

## 🎨 UI / UX Guidelines

- **Theme:** Clean, utilitarian, professional. Suitable for daily shop use.
- **Color palette:** White/light gray background, dark text, a single accent color (suggest deep blue `#1a3c5e` or warm orange `#e07b2a` for "Ronak Electricals" branding)
- **Font:** Use a clean, readable sans-serif. Avoid system fonts — use a Google Font loaded locally (e.g., `IBM Plex Sans` or `DM Sans`)
- **Tabs:** Persistent top tab bar, always visible. Active tab clearly highlighted.
- **Search results dropdown:** Appears inline below the search input, keyboard-navigable (ArrowUp/Down + Enter to select)
- **No unnecessary modals** — prefer inline confirmations or small toast notifications for actions like "Item added", "Brand deleted"
- **Responsive within window:** The app window should be resizable. Min width: 800px.

---

## ⚡ Performance Constraints

- **Only load what's needed:** Inventory tab loads items only when tab is active (or on mount). Billing tab does not preload all items — it queries only on search.
- **FTS5 search must feel instant** — debounce at 100ms, limit results to 20, no full-table scans.
- **Cart is in-memory only** — do not persist cart to DB. It resets on close (invoices are ephemeral).
- **No lazy loading unless item count > 500** — keep it simple first.

---

## 🚫 Explicit Constraints

- ❌ No Electron
- ❌ No heavy UI libraries (MUI, Ant Design, Chakra, etc.)
- ❌ No ORMs (Diesel, SeaORM)
- ❌ No backend server or cloud services
- ❌ No user authentication
- ❌ Do not store invoice history in DB (out of scope for v1)
- ❌ Do not store item quantities in inventory (this is not a stock tracker)
- ❌ No Redux or Zustand — use React's built-in state

---

## ✅ Implementation Order (Suggested Milestones)

1. **Scaffold** Tauri + React + Vite project, confirm hot reload works
2. **DB init** — create `db.rs`, initialize SQLite with schema + FTS5 on app start
3. **Tauri commands** — implement and test all Rust commands via `tauri-plugin-shell` or direct invoke
4. **Inventory Tab** — brands manager + add item form + items table
5. **Billing Tab** — date detection + customer inputs + search bar + cart
6. **Invoice Preview** — print layout + PDF export (A4 + A5)
7. **Polish** — keyboard navigation in search, toast notifications, error handling, loading states
8. **Build & test** — `tauri build`, verify binary size and cold start time

---

## 📦 Key Dependencies

```toml
# Cargo.toml (Rust)
[dependencies]
tauri = { version = "2", features = [] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```json
// package.json (JS)
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@react-pdf/renderer": "^3",
    "dayjs": "^1"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "@tauri-apps/cli": "^2"
  }
}
```

---


**Design a desktop application UI for "Ronak Electricals" — a local inventory and billing app for a small electrical goods shop.**

**Application context:**
This is a Tauri v2 desktop app (React frontend, min width 800px, resizable window). It is used daily by a shop owner for inventory management and invoice generation. The UI must feel fast, utilitarian, and professional — not consumer-facing, not a SaaS dashboard. Think of the aesthetic register of tools like Linear or Cobalt — clean, dense enough to be efficient, never cluttered.

**Design system:**
- Primary accent: warm orange `#e07b2a` for the brand, CTAs, and active tab indicator
- Supporting neutral: deep navy `#1a3c5e` for the app header/wordmark
- Background: `#f8f8f6` (off-white), surface cards: pure white `#ffffff`
- Borders: 1px `#e2e0db`
- Text: `#1a1a18` primary, `#6b6b68` secondary
- Font: IBM Plex Sans — Regular 400 for body, Medium 500 for labels and headings
- No shadows heavier than `0 1px 3px rgba(0,0,0,0.08)`. No rounded corners larger than 6px. No gradients.

**Layout structure:**
The app has a persistent top bar with the wordmark "Ronak Electricals" on the left and two tab buttons — "Inventory" and "Billing" — on the right of the header. Active tab is underlined or filled with the orange accent. Below the top bar is the full content area for whichever tab is active.

**Screen 1 — Inventory tab (design this screen first):**
Top section is a compact horizontal "Add Item" form: three inputs inline — Item Name (text), Price in ₹ (number), Brand (dropdown showing brand names with a "No Brand" option) — followed by an "Add Item" button in orange. Below the form, a full-width table with columns: `#`, `Item Name`, `Brand`, `Price (₹)`, `Actions`. The delete action in the Actions column is a small text link or icon, not a full button. At the bottom of the inventory section, a collapsible "Manage Brands" panel — when expanded, it shows a list of existing brands each with a delete icon, and an inline "Add brand" input + button at the bottom of the list.

**Screen 2 — Billing tab:**
Top row: three compact inputs — Date (pre-filled, editable), Customer Name (optional), Customer Mobile (optional, 10 digits). Below that, a full-width search bar with placeholder "Search items by name…" and a subtle search icon. Below the search bar, a dropdown results list (shown when search has results) — each result row shows: Item Name in medium weight, then Brand and ₹Price in secondary text, all on one line. Below the search area, a cart table with columns: `Item Name`, `Brand`, `Unit Price (₹)`, `Qty` (inline editable number input, compact), `Total (₹)`, and a remove icon. At the bottom of the cart: Grand Total displayed prominently right-aligned in large type, and a row of four action buttons: "Print Invoice", "Export PDF (A4)", "Export PDF (A5)", "Clear Cart" — the first two in orange, the last in a muted destructive style.

**Screen 3 — Invoice preview (print layout):**
A centered A4-proportioned white card on a light gray background. At the top: "RONAK ELECTRICALS" in large navy bold text, address/phone below it in small secondary text. A divider line. Then invoice metadata: Date left-aligned, Customer name and mobile right-aligned on the same row. Another divider. Then a bordered table: columns `#`, `Item`, `Brand`, `Qty`, `Total (₹)`. A final row spanning all columns: "Grand Total: ₹XXXX" right-aligned in bold. Footer: "Thank you for your purchase!" centered in small italic text.

**Interaction states to show:**
- One search result row in hover state (light orange tint background)
- One cart row with the quantity input focused
- The "Add Item" button in default and hover state
- A small toast notification in the bottom-right: "Item added successfully" with a subtle green left border

**Deliverable:**
Produce the three screens as responsive HTML prototypes using only plain CSS — no Tailwind, no component libraries. The CSS must be written as CSS Modules-compatible (class names scoped, no global element selectors except resets). Export a `DESIGN-HANDOFF.md` listing all color tokens, spacing scale, and typography scale used, so the OpenCode agent can implement the design accurately.


## 🧠 Agent Instructions

1. **Plan before you code.** Read all sections of this prompt. Identify the full dependency graph before writing any file.
2. **Start with the Rust layer.** Get the DB and Tauri commands working and tested first. The frontend depends on them.
3. **Use `tauri::command` + `invoke()` pattern consistently.** All DB access goes through Rust — never use a JS SQLite library in the browser layer.
4. **Test FTS5 search** with at least 50 dummy items before building the UI on top of it.
5. **The invoice layout is critical** — it must look professional when printed. Use `@media print` carefully.
6. **Do not over-engineer.** This is a v1 for a single shop. Simplicity > scalability.

