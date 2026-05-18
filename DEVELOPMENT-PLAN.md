# 🧾 Ronak Electricals — Development Plan

> **Generated from:** `Plan.md`  
> **Total Tasks:** 62  
> **Milestones:** 8  

---

## Milestone 1: Project Scaffolding (Tauri v2 + React + Vite)

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 1.1 | Initialize Tauri v2 + React + Vite project | Run `npm create tauri-app@latest` with React/Vite template. Confirm directory structure matches spec. | None |
| 1.2 | Configure `tauri.conf.json` | Set window title to `"Ronak Electricals"`, default size 1024×720, min width 800px, resizable true. Set `devUrl` and `build` config for Vite. | 1.1 |
| 1.3 | Install frontend dependencies | `npm install react@18 react-dom@18 dayjs@1 @react-pdf/renderer@3` | 1.1 |
| 1.4 | Install dev dependencies | `npm install -D vite@5 @vitejs/plugin-react@4 @tauri-apps/cli@2` | 1.1 |
| 1.5 | Update Cargo.toml with Rust dependencies | Add `rusqlite = { version = "0.31", features = ["bundled"] }`, `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"` to `src-tauri/Cargo.toml`. | 1.1 |
| 1.6 | Verify dev server works | Run `npm run tauri dev` and confirm the blank Tauri window opens with hot reload. | 1.2–1.5 |
| 1.7 | Clean boilerplate | Remove default Tauri template code (counter example, old App.css). Replace `App.jsx` with a minimal placeholder. | 1.6 |

---

## Milestone 2: Database Layer (SQLite + FTS5 in Rust)

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 2.1 | Create `src-tauri/src/db.rs` | New module file for all SQLite logic. | 1.5 |
| 2.2 | Define `Database` struct | Wrap `rusqlite::Connection` in a struct. Implement `new(path: &str) -> Result<Self>`. Use `Mutex<Connection>` for thread-safe state. | 2.1 |
| 2.3 | Implement `init_schema()` | Create `brands` table (`id` INTEGER PK AUTOINCREMENT, `name` TEXT NOT NULL UNIQUE). Execute with `CREATE TABLE IF NOT EXISTS`. | 2.2 |
| 2.4 | Implement `init_items_table()` | Create `items` table (`id` INTEGER PK AUTOINCREMENT, `name` TEXT NOT NULL, `price` REAL NOT NULL, `brand_id` INTEGER FK → brands(id) ON DELETE SET NULL). | 2.3 |
| 2.5 | Implement `init_fts()` | Create `items_fts` virtual table using FTS5 on `name` column, with `content='items'` and `content_rowid='id'`. | 2.4 |
| 2.6 | Implement FTS triggers | Create three triggers: `items_ai` (AFTER INSERT → sync to FTS), `items_ad` (AFTER DELETE → delete from FTS), `items_au` (AFTER UPDATE → delete old + insert new). | 2.5 |
| 2.7 | Implement `get_connection()` | Public method to return the `MutexGuard<Connection>` for use in Tauri commands. | 2.2 |
| 2.8 | Implement `init_database()` | Single public function that calls all init methods in order. Return `Database` instance. | 2.3–2.7 |
| 2.9 | Wire DB init in `main.rs` | In `tauri::Builder::default().setup()`, call `init_database()` with the app's data dir path. Store the `Database` instance in Tauri managed state. | 2.8 |
| 2.10 | Install `tauri-plugin-shell` (if needed for path) | Add `tauri-plugin-shell` to Cargo.toml if `app.path()` requires it. Use `app.path().app_data_dir()` for DB path. | 1.5 |
| 2.11 | Verify DB creation | Add a temporary log/print in setup to confirm DB file is created at the correct path. Run `tauri dev` and check. | 2.9 |

---

## Milestone 3: Tauri Commands (Rust → Frontend Bridge)

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 3.1 | Define `Brand` struct | `#[derive(Debug, Serialize, Deserialize)]` with `id: i64` and `name: String`. | 2.1 |
| 3.2 | Define `ItemWithBrand` struct | `#[derive(Debug, Serialize, Deserialize)]` with `id: i64`, `name: String`, `price: f64`, `brand_id: Option<i64>`, `brand_name: Option<String>`. | 2.1 |
| 3.3 | Implement `get_brands` command | `#[tauri::command]` — query `SELECT id, name FROM brands ORDER BY name`. Return `Vec<Brand>`. Use managed state to get connection. | 3.1 |
| 3.4 | Implement `add_brand` command | `#[tauri::command]` — INSERT into brands. Return `Result<Brand, String>`. Use `last_insert_rowid()` to return created brand. Handle UNIQUE constraint violation. | 3.1 |
| 3.5 | Implement `delete_brand` command | `#[tauri::command]` — DELETE from brands WHERE id = ?. Items referencing this brand will have `brand_id` set to NULL (via FK ON DELETE SET NULL). Return `Result<(), String>`. | 3.1 |
| 3.6 | Implement `get_items` command | `#[tauri::command]` — SELECT items.*, brands.name as brand_name FROM items LEFT JOIN brands ON items.brand_id = brands.id ORDER BY id DESC. Return `Vec<ItemWithBrand>`. | 3.2 |
| 3.7 | Implement `add_item` command | `#[tauri::command]` — INSERT INTO items (name, price, brand_id). Validate price > 0, name not empty. Return `Result<ItemWithBrand, String>`. | 3.2 |
| 3.8 | Implement `delete_item` command | `#[tauri::command]` — DELETE FROM items WHERE id = ?. Return `Result<(), String>`. | 3.2 |
| 3.9 | Implement `search_items` command | `#[tauri::command]` — Use FTS5: `SELECT items.*, brands.name as brand_name FROM items_fts JOIN items ON items.id = items_fts.rowid LEFT JOIN brands ON items.brand_id = brands.id WHERE items_fts MATCH ?1 LIMIT 20`. Sanitize query (escape special FTS5 chars). Return `Vec<ItemWithBrand>`. | 3.2, 2.5 |
| 3.10 | Register all commands in `main.rs` | Use `.invoke_handler(tauri::generate_handler![...])` to register all 7 commands. Update `main` function. | 3.3–3.9 |
| 3.11 | Test commands with dummy data | Insert 50+ test items in a temp test function or seed script. Invoke each command via Tauri `invoke()` in browser console or frontend test. Verify search returns correct results. | 3.10 |

---

## Milestone 4: Frontend Foundation & Design System

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 4.1 | Set up `src/styles/global.css` | CSS reset (box-sizing, margin/padding reset). Import IBM Plex Sans via `@font-face` from local `public/fonts/` (self-hosted). Set up `:root` CSS custom properties (see DESIGN-HANDOFF.md tokens). | 1.3 |
| 4.2 | Create `src/styles/tokens.css` | Define all design tokens: colors (`--color-primary: #e07b2a`, `--color-navy: #1a3c5e`, `--color-bg: #f8f8f6`, `--color-surface: #ffffff`, `--color-border: #e2e0db`, `--color-text: #1a1a18`, `--color-text-secondary: #6b6b68`), spacing scale (4px base: 4/8/12/16/24/32), font sizes (12/14/16/20/24/32px), border-radius (4px/6px), shadows (`0 1px 3px rgba(0,0,0,0.08)`). | 4.1 |
| 4.3 | Create `src/styles/App.module.css` | Top-level layout: full-height flex column. Header bar with wordmark and tabs. Content area flex-grow with padding. | 4.2 |
| 4.4 | Create `src/App.jsx` | Root component. Import global CSS and tokens. Render header with "Ronak Electricals" wordmark (navy color) and two tab buttons (Inventory | Billing). Use `useState` for active tab. Active tab gets orange underline/bottom-border. Render `InventoryTab` or `BillingTab` based on active tab. | 4.3 |
| 4.5 | Create `src/main.jsx` | ReactDOM.createRoot, render `<App />`. Import global.css. | 4.4 |
| 4.6 | Self-host IBM Plex Sans | Download IBM Plex Sans (Regular 400, Medium 500) from Google Fonts. Place WOFF2 files in `public/fonts/`. Create `@font-face` declarations in `global.css` with `font-display: swap`. | 4.1 |
| 4.7 | Verify tab switching | Launch `tauri dev`, confirm clicking Inventory/Billing switches the rendered component. Stub placeholder components. | 4.4, 4.5 |

---

## Milestone 5: Inventory Tab

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 5.1 | Create `src/hooks/useItems.js` | Custom hook wrapping Tauri `invoke()` calls: `getItems()`, `addItem(name, price, brandId)`, `deleteItem(id)`. Each returns promise. Use `import { invoke } from '@tauri-apps/api/core'`. | 3.10, 4.5 |
| 5.2 | Create `src/components/InventoryTab.jsx` | Main Inventory tab container. Imports `useItems`. Renders AddItemForm, ItemsTable, BrandManager in vertical stack. Fetches items list on mount via `useEffect`. | 5.1 |
| 5.3 | Create `src/styles/InventoryTab.module.css` | Styles for inventory tab: compact form layout using flexbox/grid, table styles with sticky header, brand manager collapsible section. | 5.2 |
| 5.4 | Create `src/components/BrandManager.jsx` | Collapsible section ("Manage Brands"). Toggle expand/collapse via local state. When expanded: list existing brands (each with a delete × button and warning if items reference it), "Add Brand" text input + button at bottom. Calls `add_brand`/`delete_brand` via `useItems`. | 5.1 |
| 5.5 | Create `src/styles/BrandManager.module.css` | Compact list layout, delete button subtle (muted red/gray), expand/collapse indicator arrow, spacing consistent with rest of UI. | 5.4 |
| 5.6 | Implement Add Item form (inline in InventoryTab) | Three inputs in a horizontal row: Item Name (text), Price (number, step 0.01), Brand dropdown (populated from `useItems` brands list; includes "No Brand" option with value empty). Orange "Add Item" button. Form validation: name required, price > 0. On submit call `addItem`, on success reset form and refresh item list. | 5.2 |
| 5.7 | Implement Items Table (inline in InventoryTab) | Full-width table: columns `#` (row index), `Item Name`, `Brand`, `Price (₹)` (formatted with 2 decimals, ₹ prefix), `Actions` (small text "Delete" link). Load items via `getItems()` on mount. Delete shows confirmation (window.confirm or inline). Empty state message if no items. | 5.2 |
| 5.8 | Add toast notification for actions | Show "Item added", "Item deleted", "Brand added", "Brand deleted" toast messages. Create lightweight toast component (fixed bottom-right, auto-dismiss 2s, green left border for success, red for error). | 5.6, 5.7 |
| 5.9 | Test full inventory workflow | Add 5+ items with various brands, delete some items, delete a brand, verify table updates and FTS sync stays consistent. | 5.8 |

---

## Milestone 6: Billing Tab

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 6.1 | Create `src/hooks/useDate.js` | On mount: try `fetch('https://worldtimeapi.org/api/ip')` with 2s AbortController timeout. If success, parse `datetime` field and format with dayjs as DD/MM/YYYY. If fail, use `dayjs(new Date()).format('DD/MM/YYYY')`. Return `{ date, setDate, isLoading, error }`. | 1.3 |
| 6.2 | Create `src/hooks/useCart.js` | In-memory cart state using `useState([])`. Return: `cart` (array of `{ item: ItemWithBrand, quantity: number }`), `addToCart(item, qty)`, `removeFromCart(itemId)`, `updateQuantity(itemId, qty)`, `clearCart()`, `totalItems`, `grandTotal`. Prevent duplicate items (update qty instead). No persistence. | 3.2 |
| 6.3 | Create `src/components/BillingTab.jsx` | Main Billing tab container. Imports `useDate`, `useCart`, `searchItems`. Top row: date input + customer name + customer mobile. Next: search bar + results dropdown. Next: cart table. Bottom: grand total + action buttons. | 6.1, 6.2 |
| 6.4 | Create `src/styles/BillingTab.module.css` | Compact header inputs row, full-width search bar with icon, floating dropdown results, cart table styles with editable quantity column, totals section, action button row. | 6.3 |
| 6.5 | Implement `useSearch` local hook | Custom hook with debounced search: query state, `debouncedQuery` (100ms debounce via `setTimeout`/`clearTimeout`), calls `searchItems(query)` from Tauri invoke. Returns `{ query, setQuery, results, isSearching }`. Limit results display to 20. Clear results when query empty. | 3.9, 6.3 |
| 6.6 | Implement invoice header inputs | Three inline inputs: Date (type date or text, pre-filled from `useDate`, user-editable), Customer Name (optional text), Customer Mobile (optional, max 10 digits, type text with pattern). | 6.1, 6.3 |
| 6.7 | Implement search bar with results dropdown | Search input with autofocus on tab mount, subtle search icon (SVG). Below: absolutely-positioned dropdown showing search results. Each result row: Item Name (medium weight), Brand + ₹Price (secondary text). On click → show quantity popover/inline input (default 1) + "Add" button. Keyboard navigable (ArrowUp/Down + Enter to select). | 6.5, 6.3 |
| 6.8 | Implement Cart Table | Columns: Item Name, Brand, Unit Price (₹), Qty (inline number input, min 1, compact width), Total (₹) (auto-calculated = unit price × qty), Remove (× icon). Editable quantity triggers `updateQuantity`. Remove triggers `removeFromCart`. Empty cart state: "No items added yet." text. | 6.2, 6.3 |
| 6.9 | Implement Grand Total display | At bottom of cart: "Grand Total: ₹XXX.XX" in large bold text, right-aligned. Uses `grandTotal` from `useCart`. | 6.2, 6.3 |
| 6.10 | Implement action buttons | Four buttons in a row: "🖨 Print Invoice" (orange, primary), "📄 Export PDF (A4)" (orange, primary), "📄 Export PDF (A5)" (outline/secondary), "🗑 Clear Cart" (muted destructive). Disabled when cart is empty. Print → opens `InvoicePreview` component. PDF → uses `@react-pdf/renderer`. Clear → confirms then resets. | 6.3 |
| 6.11 | Add toast notifications for billing actions | "Item added to cart", "Item removed", "Cart cleared", "Invoice printed" toast messages. | 6.3 |

---

## Milestone 7: Invoice Preview & Print / PDF Export

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 7.1 | Create `src/components/InvoicePreview.jsx` | Print-only component (wrapped in `@media print`). Accepts `cart`, `customerName`, `customerMobile`, `date` as props. Renders A4-proportioned white card: "RONAK ELECTRICALS" navy header + subtitle, divider, metadata row (date left, customer right), divider, bordered table (#, Item, Brand, Qty, Total), grand total row, "Thank you" footer. | 6.2 |
| 7.2 | Create `src/styles/InvoicePreview.module.css` | Print-optimized styles: hide everything except `.invoice-preview` when printing (`@media print { body * { visibility: hidden; } .invoice-preview, .invoice-preview * { visibility: visible; } }`). Centered card, professional typography, clean borders. | 7.1 |
| 7.3 | Implement print handler | `window.print()` call wrapped in a small utility. Opens invoice in print dialog. Confirm that only the invoice content is visible (not the app shell). | 7.1, 7.2 |
| 7.4 | Create `src/components/InvoicePDF.jsx` | `@react-pdf/renderer` document: `<Document><Page size="A4" style={styles}><View>...</View></Page></Document>`. Replicate same layout as InvoicePreview using PDF primitives (`Text`, `View`, `StyleSheet`). | 1.3, 6.2 |
| 7.5 | Create `src/styles/InvoicePDF.js` | Separate styles file for react-pdf `StyleSheet.create()`: fonts, colors, spacing, table borders matching the print layout. Use IBM Plex Sans if embeddable, otherwise fall back to Helvetica (built-in). | 7.4 |
| 7.6 | Implement A4 PDF export handler | Use `pdf()` from `@react-pdf/renderer` to generate blob, then use `URL.createObjectURL` + `<a download>` trick to trigger download as "Invoice-Ronak-Electricals.pdf". | 7.4 |
| 7.7 | Implement A5 PDF export handler | Same as A4 but `<Page size="A5">`. A5 = 148×210mm. Adjust layout to fit narrower width (single column, smaller fonts). | 7.5, 7.6 |
| 7.8 | Test print output | Add test items to cart, open print dialog, verify invoice renders correctly, no app chrome visible. Test with `window.print()` preview. | 7.3 |
| 7.9 | Test PDF output | Download A4 and A5 PDFs, open in viewer, verify layout is correct and professional. | 7.6, 7.7 |
| 7.10 | Add loading/error states for PDF generation | Show "Generating PDF..." loading state while PDF blob is being created. Handle and display errors if PDF generation fails. | 7.6 |

---

## Milestone 8: Polish & UX Refinements

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 8.1 | Keyboard navigation for search dropdown | Implement full keyboard navigation in search results: ArrowDown moves selection down (wraps), ArrowUp moves up, Enter selects highlighted item, Escape closes dropdown. Use `onKeyDown` handler with `useRef` for item refs. | 6.7 |
| 8.2 | Toast notification system | Create reusable `ToastContainer` + `useToast` hook. Support success (green border), error (red border), info (blue/gray border). Auto-dismiss after 2.5s. Queue multiple toasts. Fixed bottom-right position, above all content. | 5.8, 6.11 |
| 8.3 | Error handling in all Tauri commands | Wrap all `invoke()` calls in try/catch. Display error messages via toast. Handle specific errors: DB errors, validation errors, network errors (date fetch). | 5.1, 6.2, 6.5 |
| 8.4 | Loading states | Show loading spinners/skeleton for: inventory table loading, search loading (subtle), PDF generation. Use `isLoading` states from hooks. | 5.1, 6.5, 7.6 |
| 8.5 | Empty states | Inventory: "No items added yet. Add your first item above." Cart: "No items in cart. Search and add items above." Search: "Type to search items…" with no results yet, "No items found" when query yields nothing. | 5.2, 6.3 |
| 8.6 | Form validation feedback | Inline validation messages: Price must be > 0, Name required, Mobile must be 10 digits. Show on blur or submit. Highlight invalid fields with red border. | 5.6, 6.6 |
| 8.7 | Confirm dialogs for destructive actions | Delete item: window.confirm "Delete [item name]?" or inline confirmation. Delete brand: warning if items reference it. Clear cart: confirm before clearing. | 5.7, 5.4, 6.10 |
| 8.8 | Responsive window behavior | Test at min width 800px. Ensure tables don't break layout. Use `overflow-x: auto` for tables if needed. Cart table should shrink gracefully. | 4.3 |
| 8.9 | Seed script for testing | Create a small dev-only function/button to insert 50+ dummy items with various brand names to test FTS5 search and verify performance. | 3.9 |
| 8.10 | Font preloading optimization | Ensure IBM Plex Sans is preloaded via `<link rel="preload">` in `index.html` to avoid FOUT (flash of unstyled text). | 4.6 |
| 8.11 | Accessibility basics | `label` elements for all form inputs, `aria-label` for icon-only buttons (remove, delete), `role="listbox"` for search results, focus management for search dropdown. | 6.7, 5.6, 6.6 |

---

## Milestone 9: Build, Package & Verification

| # | Task | Description | Dependencies |
|---|------|-------------|--------------|
| 9.1 | Run `tauri build` | Execute `npm run tauri build`. Confirm binary is produced. | 8.11 |
| 9.2 | Verify binary size | Check output binary size in `src-tauri/target/release/`. Should be ~10MB. | 9.1 |
| 9.3 | Verify cold start performance | Launch built binary, measure time from click to UI being interactive. Should be under 2s. | 9.1 |
| 9.4 | Verify offline behavior | Disconnect network, launch app. Confirm date detection falls back to system clock. All DB operations work offline. | 9.1 |
| 9.5 | Verify default window size | Confirm app opens at 1024×720 or larger. Confirm window is resizable and min 800px works. | 9.1 |
| 9.6 | Final review of all features | Walk through each feature specified in Plan.md. Confirm no gaps or missing functionality. | 9.1 |

---

## Dependency Graph Summary

```
Milestone 1 (Scaffold)
    ↓
Milestone 2 (DB Layer)
    ↓
Milestone 3 (Tauri Commands)
    ↓
Milestone 4 (Frontend Foundation)
    ↓
    ├──→ Milestone 5 (Inventory Tab)
    │         ↓
    └──→ Milestone 6 (Billing Tab)
              ↓
         Milestone 7 (Invoice/PDF)
              ↓
         Milestone 8 (Polish)
              ↓
         Milestone 9 (Build & Verify)
```

## Design Tokens Reference

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#e07b2a` | CTAs, active tab, accents |
| `--color-navy` | `#1a3c5e` | Header wordmark, headings |
| `--color-bg` | `#f8f8f6` | Page background |
| `--color-surface` | `#ffffff` | Cards, tables, forms |
| `--color-border` | `#e2e0db` | Borders, dividers |
| `--color-text` | `#1a1a18` | Primary body text |
| `--color-text-secondary` | `#6b6b68` | Labels, secondary info |
| `--color-success` | `#2e7d32` | Success toasts |
| `--color-error` | `#d32f2f` | Error toasts, destructive |

### Typography
| Token | Value | Usage |
|-------|-------|-------|
| `--font-family` | `'IBM Plex Sans', sans-serif` | All text |
| `--font-size-xs` | `12px` | Helper text |
| `--font-size-sm` | `14px` | Table cells, inputs |
| `--font-size-base` | `16px` | Body text |
| `--font-size-lg` | `20px` | Section headings |
| `--font-size-xl` | `24px` | Grand total display |
| `--font-size-2xl` | `32px` | Wordmark |

### Spacing
| Token | Value |
|-------|-------|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |

### Borders & Shadows
| Token | Value |
|-------|-------|
| `--radius-sm` | `4px` |
| `--radius-md` | `6px` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` |
| `--border-width` | `1px` |
