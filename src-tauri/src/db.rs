use rusqlite::{Connection, Result as SqliteResult};
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> SqliteResult<Self> {
        let conn = Connection::open(path)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn init(&self) -> SqliteResult<()> {
        self.init_brands_table()?;
        self.init_item_bases_table()?;
        self.init_brand_variants_table()?;
        self.init_sub_model_variants_table()?;
        self.init_fts()?;
        self.migrate_old_items()?;
        Ok(())
    }

    fn init_brands_table(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )",
            [],
        )?;
        Ok(())
    }

    fn init_item_bases_table(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS item_bases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )",
            [],
        )?;
        Ok(())
    }

    fn init_brand_variants_table(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS brand_variants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                base_id INTEGER NOT NULL REFERENCES item_bases(id) ON DELETE CASCADE,
                brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
                UNIQUE(base_id, brand_id)
            )",
            [],
        )?;
        Ok(())
    }

    fn init_sub_model_variants_table(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sub_model_variants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_variant_id INTEGER NOT NULL REFERENCES brand_variants(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                price REAL NOT NULL
            )",
            [],
        )?;
        Ok(())
    }

    fn init_fts(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();

        // Create FTS table for item_bases
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS item_bases_fts USING fts5(
                name,
                content='item_bases',
                content_rowid='id'
            )",
            [],
        )?;

        // Rebuild FTS if needed (repopulate from item_bases)
        let _ = conn.execute("DELETE FROM item_bases_fts", []);

        let mut stmt = conn.prepare("SELECT id, name FROM item_bases")?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: i64 = row.get(0)?;
            let name: String = row.get(1)?;
            conn.execute(
                "INSERT INTO item_bases_fts(rowid, name) VALUES (?1, ?2)",
                rusqlite::params![id, name],
            )?;
        }
        drop(rows);
        drop(stmt);

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS item_bases_ai AFTER INSERT ON item_bases BEGIN
                INSERT INTO item_bases_fts(rowid, name) VALUES (new.id, new.name);
            END",
            [],
        )?;

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS item_bases_ad AFTER DELETE ON item_bases BEGIN
                INSERT INTO item_bases_fts(item_bases_fts, rowid, name) VALUES('delete', old.id, old.name);
            END",
            [],
        )?;

        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS item_bases_au AFTER UPDATE ON item_bases BEGIN
                INSERT INTO item_bases_fts(item_bases_fts, rowid, name) VALUES('delete', old.id, old.name);
                INSERT INTO item_bases_fts(rowid, name) VALUES (new.id, new.name);
            END",
            [],
        )?;

        Ok(())
    }

    fn migrate_old_items(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();

        // Check if old item_variants table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='item_variants'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !table_exists {
            return Ok(());
        }

        // Check if migration already happened (by checking if brand_variants has data)
        let bv_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM brand_variants", [], |row| row.get(0))
            .unwrap_or(0);

        if bv_count > 0 {
            // Already migrated
            return Ok(());
        }

        // Migrate: each item_variant becomes a brand_variant + sub_model_variant
        let mut stmt = conn.prepare(
            "SELECT id, base_id, brand_id, model, price FROM item_variants ORDER BY base_id, brand_id"
        )?;

        let items: Vec<(i64, i64, Option<i64>, Option<String>, f64)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        drop(stmt);

        for (_old_id, base_id, brand_id, model, price) in items {
            // Create or get brand_variant
            conn.execute(
                "INSERT OR IGNORE INTO brand_variants (base_id, brand_id) VALUES (?1, ?2)",
                rusqlite::params![base_id, brand_id],
            )?;

            let bv_id: i64 = conn.query_row(
                "SELECT id FROM brand_variants WHERE base_id = ?1 AND brand_id IS ?2",
                rusqlite::params![base_id, brand_id],
                |row| row.get(0),
            )?;

            // Create sub_model_variant
            let model_name = model.filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "Default".to_string());
            conn.execute(
                "INSERT INTO sub_model_variants (brand_variant_id, name, price) VALUES (?1, ?2, ?3)",
                rusqlite::params![bv_id, model_name, price],
            )?;
        }

        // Drop old item_variants table (after migration)
        let _ = conn.execute("DROP TABLE item_variants", []);

        Ok(())
    }
}

// ============================================================================
// Structs
// ============================================================================

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Brand {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct SubModelVariant {
    pub id: i64,
    pub brand_variant_id: i64,
    pub name: String,
    pub price: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct BrandVariant {
    pub id: i64,
    pub base_id: i64,
    pub base_name: String,
    pub brand_id: Option<i64>,
    pub brand_name: Option<String>,
    pub sub_models: Vec<SubModelVariant>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub base_id: i64,
    pub base_name: String,
    pub brand_count: usize,
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub fn get_brands(db: tauri::State<Database>) -> Result<Vec<Brand>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM brands ORDER BY name")
        .map_err(|e| e.to_string())?;

    let brands = stmt
        .query_map([], |row| {
            Ok(Brand {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(brands)
}

#[tauri::command]
pub fn add_brand(db: tauri::State<Database>, name: String) -> Result<Brand, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO brands (name) VALUES (?1)", [&name])
        .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Brand { id, name })
}

#[tauri::command]
pub fn delete_brand(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM brands WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Get all brand variants with their sub-models (for InventoryTab)
#[tauri::command]
pub fn get_brand_variants(db: tauri::State<Database>) -> Result<Vec<BrandVariant>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get all brand variants
    let mut stmt = conn
        .prepare(
            "SELECT bv.id, bv.base_id, ib.name, bv.brand_id, b.name
             FROM brand_variants bv
             JOIN item_bases ib ON bv.base_id = ib.id
             LEFT JOIN brands b ON bv.brand_id = b.id
             ORDER BY ib.name, b.name",
        )
        .map_err(|e| e.to_string())?;

    let brand_variants: Vec<BrandVariant> = stmt
        .query_map([], |row| {
            Ok(BrandVariant {
                id: row.get(0)?,
                base_id: row.get(1)?,
                base_name: row.get(2)?,
                brand_id: row.get(3)?,
                brand_name: row.get(4)?,
                sub_models: vec![],
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    // For each brand_variant, fetch sub-models
    let mut result = Vec::new();
    for mut bv in brand_variants {
        let mut sub_stmt = conn
            .prepare("SELECT id, brand_variant_id, name, price FROM sub_model_variants WHERE brand_variant_id = ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let sub_models: Vec<SubModelVariant> = sub_stmt
            .query_map([bv.id], |row| {
                Ok(SubModelVariant {
                    id: row.get(0)?,
                    brand_variant_id: row.get(1)?,
                    name: row.get(2)?,
                    price: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        bv.sub_models = sub_models;
        result.push(bv);
    }

    Ok(result)
}

// Add a brand to a product (creates product if needed)
#[tauri::command]
pub fn add_brand_variant(
    db: tauri::State<Database>,
    baseName: String,
    brandId: Option<i64>,
) -> Result<BrandVariant, String> {
    if baseName.trim().is_empty() {
        return Err("Item name cannot be empty".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Create or get item_base
    conn.execute(
        "INSERT OR IGNORE INTO item_bases (name) VALUES (?1)",
        rusqlite::params![&baseName],
    )
    .map_err(|e| e.to_string())?;

    let base_id: i64 = conn
        .query_row(
            "SELECT id FROM item_bases WHERE name = ?1",
            rusqlite::params![&baseName],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Create or get brand_variant
    conn.execute(
        "INSERT OR IGNORE INTO brand_variants (base_id, brand_id) VALUES (?1, ?2)",
        rusqlite::params![base_id, brandId],
    )
    .map_err(|e| e.to_string())?;

    let bv_id: i64 = conn
        .query_row(
            "SELECT id FROM brand_variants WHERE base_id = ?1 AND brand_id IS ?2",
            rusqlite::params![base_id, brandId],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Get brand name
    let brand_name = if let Some(bid) = brandId {
        let mut stmt = conn
            .prepare("SELECT name FROM brands WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row([bid], |row| row.get(0)).ok()
    } else {
        None
    };

    Ok(BrandVariant {
        id: bv_id,
        base_id,
        base_name: baseName,
        brand_id: brandId,
        brand_name,
        sub_models: vec![],
    })
}

// Remove a brand (and all its sub-models)
#[tauri::command]
pub fn remove_brand_variant(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM brand_variants WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Add a sub-model to a brand variant
#[tauri::command]
pub fn add_sub_model(
    db: tauri::State<Database>,
    brandVariantId: i64,
    name: String,
    price: f64,
) -> Result<SubModelVariant, String> {
    if name.trim().is_empty() {
        return Err("Sub-model name cannot be empty".to_string());
    }
    if price <= 0.0 {
        return Err("Price must be greater than 0".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO sub_model_variants (brand_variant_id, name, price) VALUES (?1, ?2, ?3)",
        rusqlite::params![brandVariantId, &name, price],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(SubModelVariant {
        id,
        brand_variant_id: brandVariantId,
        name,
        price,
    })
}

// Update a sub-model (name and/or price)
#[tauri::command]
pub fn update_sub_model(
    db: tauri::State<Database>,
    id: i64,
    name: String,
    price: f64,
) -> Result<SubModelVariant, String> {
    if name.trim().is_empty() {
        return Err("Sub-model name cannot be empty".to_string());
    }
    if price <= 0.0 {
        return Err("Price must be greater than 0".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE sub_model_variants SET name = ?1, price = ?2 WHERE id = ?3",
        rusqlite::params![&name, price, id],
    )
    .map_err(|e| e.to_string())?;

    // Fetch and return the updated record
    let mut stmt = conn
        .prepare("SELECT id, brand_variant_id, name, price FROM sub_model_variants WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    stmt.query_row([id], |row| {
        Ok(SubModelVariant {
            id: row.get(0)?,
            brand_variant_id: row.get(1)?,
            name: row.get(2)?,
            price: row.get(3)?,
        })
    })
    .map_err(|e| e.to_string())
}

// Delete a sub-model
#[tauri::command]
pub fn delete_sub_model(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sub_model_variants WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Search for products (returns product names with brand count)
#[tauri::command]
pub fn search_items(db: tauri::State<Database>, query: String) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let search_query = format!("{}*", query.replace('"', "\"\""));

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT ib.id, ib.name, COUNT(DISTINCT bv.id) as brand_count
             FROM item_bases_fts
             JOIN item_bases ib ON ib.id = item_bases_fts.rowid
             LEFT JOIN brand_variants bv ON bv.base_id = ib.id
             WHERE item_bases_fts MATCH ?1
             GROUP BY ib.id, ib.name
             ORDER BY ib.name
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&search_query], |row| {
            Ok(SearchResult {
                base_id: row.get(0)?,
                base_name: row.get(1)?,
                brand_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

// Get all brand variants for a specific product (for brand switching)
#[tauri::command]
pub fn get_product_details(
    db: tauri::State<Database>,
    baseId: i64,
) -> Result<Vec<BrandVariant>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get all brand variants for this base
    let mut stmt = conn
        .prepare(
            "SELECT bv.id, bv.base_id, ib.name, bv.brand_id, b.name
             FROM brand_variants bv
             JOIN item_bases ib ON bv.base_id = ib.id
             LEFT JOIN brands b ON bv.brand_id = b.id
             WHERE bv.base_id = ?1
             ORDER BY b.name",
        )
        .map_err(|e| e.to_string())?;

    let brand_variants: Vec<BrandVariant> = stmt
        .query_map([baseId], |row| {
            Ok(BrandVariant {
                id: row.get(0)?,
                base_id: row.get(1)?,
                base_name: row.get(2)?,
                brand_id: row.get(3)?,
                brand_name: row.get(4)?,
                sub_models: vec![],
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    // For each brand_variant, fetch sub-models
    let mut result = Vec::new();
    for mut bv in brand_variants {
        let mut sub_stmt = conn
            .prepare("SELECT id, brand_variant_id, name, price FROM sub_model_variants WHERE brand_variant_id = ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let sub_models: Vec<SubModelVariant> = sub_stmt
            .query_map([bv.id], |row| {
                Ok(SubModelVariant {
                    id: row.get(0)?,
                    brand_variant_id: row.get(1)?,
                    name: row.get(2)?,
                    price: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        bv.sub_models = sub_models;
        result.push(bv);
    }

    Ok(result)
}
