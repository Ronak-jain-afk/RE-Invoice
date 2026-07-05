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
            db::restore_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
