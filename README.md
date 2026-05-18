# Ronak Electricals

A local-first desktop application for inventory management, billing, and invoice generation — built for **Ronak Electricals**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 18 + Vite 5 + TypeScript |
| Database | SQLite via rusqlite (Rust) |
| Styling | CSS Modules |
| PDF | @react-pdf/renderer |
| Date | dayjs |

## Features

- **Inventory Management** — Hierarchical product management: Product → Brand Variant → Sub-model with inline price editing
- **Billing** — Search products, select brand/sub-model variants, apply global or per-item discounts
- **Brand Switching** — Change a cart item's brand/sub-model while preserving quantity and discount
- **Invoice & PDF Export** — Generate A4/A5 PDF invoices or print directly
- **Dark Mode** — Built-in theme toggle
- **Offline-first** — No backend, no cloud, fully local

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run tauri dev

# Build production binary
npm run tauri build
```

## Database

SQLite database is auto-created at the app data directory. Schema is initialized on every launch with `CREATE TABLE IF NOT EXISTS`. Existing data is automatically migrated when schema changes.

## Architecture

- All database access goes through Rust Tauri commands (`#[tauri::command]`)
- Cart state is in-memory only (no persistence to DB)
- No external backend, no cloud services, no authentication
