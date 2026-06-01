mod db;

use db::Database;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
    app_data_dir.join("ronak_electricals.db")
}

fn wsl_path(dir: &str) -> PathBuf {
    let dir = dir.trim();
    let bytes = dir.as_bytes();
    if bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
    {
        let drive = bytes[0].to_ascii_lowercase() as char;
        let rest = dir[2..].replace('\\', "/");
        PathBuf::from(format!("/mnt/{}{}", drive, rest))
    } else {
        PathBuf::from(dir)
    }
}

#[tauri::command]
fn save_pdf(dir: String, filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let normalized_dir = wsl_path(&dir);
    let path = normalized_dir.join(&filename);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = get_db_path(app.handle());
            let db = Database::new(db_path.to_str().unwrap()).expect("Failed to create database");
            db.init().expect("Failed to initialize database");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::get_brands,
            db::add_brand,
            db::delete_brand,
            db::get_brand_variants,
            db::add_brand_variant,
            db::remove_brand_variant,
            db::add_sub_model,
            db::update_sub_model,
            db::delete_sub_model,
            db::search_items,
            db::get_product_details,
            db::suggest_item_bases,
            db::claim_invoice_number,
            db::backup_database,
            db::restore_database,
            save_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
