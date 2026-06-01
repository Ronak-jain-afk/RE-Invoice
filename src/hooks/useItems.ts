import { invoke } from "@tauri-apps/api/core";

export interface Brand {
  id: number;
  name: string;
}

export interface SubModelVariant {
  id: number;
  brand_variant_id: number;
  name: string;
  price: number;
}

export interface BrandVariant {
  id: number;
  base_id: number;
  base_name: string;
  brand_id: number | null;
  brand_name: string | null;
  sub_models: SubModelVariant[];
}

export interface SearchResult {
  base_id: number;
  base_name: string;
  brand_count: number;
}

export function useItems() {
  const getBrands = () => invoke<Brand[]>("get_brands");

  const addBrand = (name: string) => invoke<Brand>("add_brand", { name });

  const deleteBrand = (id: number) => invoke<void>("delete_brand", { id });

  // Get all brand variants with sub-models (for InventoryTab tree)
  const getBrandVariants = () => invoke<BrandVariant[]>("get_brand_variants");

  // Add a brand to a product (creates product if needed)
  const addBrandVariant = (baseName: string, brandId: number | null) =>
    invoke<BrandVariant>("add_brand_variant", { baseName, brandId });

  // Remove a brand from a product
  const removeBrandVariant = (id: number) => invoke<void>("remove_brand_variant", { id });

  // Add a sub-model to a brand variant
  const addSubModel = (brandVariantId: number, name: string, price: number) =>
    invoke<SubModelVariant>("add_sub_model", { brandVariantId, name, price });

  // Update a sub-model (name and/or price)
  const updateSubModel = (id: number, name: string, price: number) =>
    invoke<SubModelVariant>("update_sub_model", { id, name, price });

  // Delete a sub-model
  const deleteSubModel = (id: number) => invoke<void>("delete_sub_model", { id });

  // Search for products (returns product names with brand count)
  const searchItems = (query: string) =>
    invoke<SearchResult[]>("search_items", { query });

  // Get all brand variants for a specific product (for brand switching in cart)
  const getProductDetails = (baseId: number) =>
    invoke<BrandVariant[]>("get_product_details", { baseId });

  const suggestItemBases = (query: string) =>
    invoke<Brand[]>("suggest_item_bases", { query });

  const claimInvoiceNumber = () => invoke<number>("claim_invoice_number");
  const backupDatabase = (destPath: string) => invoke<void>("backup_database", { destPath });
  const restoreDatabase = (srcPath: string) => invoke<void>("restore_database", { srcPath });

  return {
    getBrands,
    addBrand,
    deleteBrand,
    getBrandVariants,
    addBrandVariant,
    removeBrandVariant,
    addSubModel,
    updateSubModel,
    deleteSubModel,
    searchItems,
    getProductDetails,
    suggestItemBases,
    claimInvoiceNumber,
    backupDatabase,
    restoreDatabase,
  };
}
