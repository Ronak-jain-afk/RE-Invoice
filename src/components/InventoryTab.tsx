import { useState, useEffect } from "react";
import { useItems, Brand, BrandVariant, SubModelVariant } from "../hooks/useItems";
import { useToast } from "../hooks/useToast.tsx";

export default function InventoryTab() {
  const {
    getBrands,
    addBrand,
    deleteBrand,
    getBrandVariants,
    addBrandVariant,
    removeBrandVariant,
    addSubModel,
    updateSubModel,
    deleteSubModel,
  } = useItems();
  const { showToast } = useToast();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandVariants, setBrandVariants] = useState<BrandVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBrands, setShowBrands] = useState(false);

  // Add form state
  const [itemName, setItemName] = useState("");
  const [itemBrandId, setItemBrandId] = useState<number | null>(null);
  const [subModelName, setSubModelName] = useState("");
  const [subModelPrice, setSubModelPrice] = useState("");

  // Inline edit state
  const [editingSubModelId, setEditingSubModelId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPrice, setEditingPrice] = useState("");

  // Add brand form state
  const [newBrandName, setNewBrandName] = useState("");

  // Expanded state for products
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [b, bv] = await Promise.all([getBrands(), getBrandVariants()]);
      setBrands(b);
      setBrandVariants(bv);
    } catch (e) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      showToast("Item name required", "error");
      return;
    }
    if (!subModelName.trim()) {
      showToast("Sub-model name required", "error");
      return;
    }
    if (!subModelPrice || parseFloat(subModelPrice) <= 0) {
      showToast("Valid price required", "error");
      return;
    }

    try {
      // Step 1: Add/get brand variant
      const bv = await addBrandVariant(itemName.trim(), itemBrandId);

      // Step 2: Add sub-model to that brand variant
      await addSubModel(bv.id, subModelName.trim(), parseFloat(subModelPrice));

      // Reset form and reload
      setItemName("");
      setItemBrandId(null);
      setSubModelName("");
      setSubModelPrice("");
      const bv_list = await getBrandVariants();
      setBrandVariants(bv_list);
      showToast("Item added successfully");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleStartEdit = (sm: SubModelVariant) => {
    setEditingSubModelId(sm.id);
    setEditingName(sm.name);
    setEditingPrice(sm.price.toString());
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    if (!editingPrice || parseFloat(editingPrice) <= 0) {
      showToast("Valid price required", "error");
      return;
    }

    try {
      await updateSubModel(id, editingName.trim(), parseFloat(editingPrice));
      setEditingSubModelId(null);
      const bv_list = await getBrandVariants();
      setBrandVariants(bv_list);
      showToast("Updated");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleDeleteSubModel = async (id: number, name: string) => {
    if (!confirm(`Delete sub-model "${name}"?`)) return;
    try {
      await deleteSubModel(id);
      const bv_list = await getBrandVariants();
      setBrandVariants(bv_list);
      showToast("Deleted");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleRemoveBrand = async (id: number, name: string | null) => {
    const display = name || "(No Brand)";
    if (!confirm(`Remove brand "${display}" and all its sub-models?`)) return;
    try {
      await removeBrandVariant(id);
      const bv_list = await getBrandVariants();
      setBrandVariants(bv_list);
      showToast("Brand removed");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    try {
      await addBrand(newBrandName.trim());
      setNewBrandName("");
      const b = await getBrands();
      setBrands(b);
      showToast("Brand added");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleDeleteBrand = async (id: number, name: string) => {
    if (!confirm(`Delete brand "${name}"? Items will lose brand reference.`)) return;
    try {
      await deleteBrand(id);
      const b = await getBrands();
      setBrands(b);
      const bv_list = await getBrandVariants();
      setBrandVariants(bv_list);
      showToast("Brand deleted");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const toggleProduct = (baseId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(baseId)) {
      newExpanded.delete(baseId);
    } else {
      newExpanded.add(baseId);
    }
    setExpandedProducts(newExpanded);
  };

  // Group brand variants by product
  const productGroups = new Map<number, BrandVariant[]>();
  for (const bv of brandVariants) {
    if (!productGroups.has(bv.base_id)) {
      productGroups.set(bv.base_id, []);
    }
    productGroups.get(bv.base_id)!.push(bv);
  }

  if (loading) return <div style={loadingContainer}>Loading inventory...</div>;

  return (
    <div style={container}>
      {/* Top toolbar */}
      <div style={toolbar}>
        <h2 style={pageTitle}>Inventory Management</h2>
      </div>

      {/* Single-row add form */}
      <div style={formCard}>
        <form onSubmit={handleAddItem} style={addForm}>
          <div style={formField}>
            <label style={formLabel}>Item</label>
            <input
              type="text"
              placeholder="e.g. Wire 2.5mm"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              style={input}
            />
          </div>

          <div style={formField}>
            <label style={formLabel}>Brand</label>
            <select
              value={itemBrandId ?? ""}
              onChange={(e) => setItemBrandId(e.target.value ? Number(e.target.value) : null)}
              style={input}
            >
              <option value="">No Brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div style={formField}>
            <label style={formLabel}>Sub-model</label>
            <input
              type="text"
              placeholder="e.g. Standard"
              value={subModelName}
              onChange={(e) => setSubModelName(e.target.value)}
              style={input}
            />
          </div>

          <div style={formField}>
            <label style={formLabel}>Price</label>
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={subModelPrice}
              onChange={(e) => setSubModelPrice(e.target.value)}
              style={input}
            />
          </div>

          <button type="submit" style={primaryButton}>
            + Add
          </button>
        </form>
      </div>

      {/* Tree display */}
      <div style={treeCard}>
        <div style={treeHeader}>
          <h3 style={sectionTitle}>Products</h3>
          <span style={itemCount}>{Array.from(productGroups.keys()).length} products</span>
        </div>

        <div style={treeScrollArea}>
          {Array.from(productGroups.entries()).map(([baseId, bvList]) => {
            const isExpanded = expandedProducts.has(baseId);
            const productName = bvList[0]?.base_name || "Unknown";

            return (
              <div key={baseId} style={treeProductSection}>
                {/* Product header - clickable to expand */}
                <div
                  style={treeProductRow}
                  onClick={() => toggleProduct(baseId)}
                >
                  <span style={treeToggle}>{isExpanded ? "▼" : "▶"}</span>
                  <span style={treeProductName}>{productName}</span>
                  <span style={treeCount}>({bvList.length} brand{bvList.length !== 1 ? "s" : ""})</span>
                </div>

                {/* Brand variants - shown when product is expanded */}
                {isExpanded && (
                  <div style={treeBrandSection}>
                    {bvList.map((bv) => (
                      <div key={bv.id}>
                        {/* Brand row */}
                        <div style={treeBrandRow}>
                          <span style={treeBrandName}>
                            {bv.brand_name || "(No Brand)"}
                          </span>
                          <button
                            onClick={() => handleRemoveBrand(bv.id, bv.brand_name)}
                            style={treeBrandRemoveBtn}
                            title="Remove brand"
                          >
                            ×
                          </button>
                        </div>

                        {/* Sub-models under this brand */}
                        {bv.sub_models.length === 0 ? (
                          <div style={treeNoSubModels}>No sub-models yet</div>
                        ) : (
                          bv.sub_models.map((sm) => (
                            <div key={sm.id} style={treeSubModelRow}>
                              {editingSubModelId === sm.id ? (
                                // Inline edit mode
                                <div style={treeEditRow}>
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    style={treeEditInput}
                                    placeholder="Name"
                                  />
                                  <input
                                    type="number"
                                    value={editingPrice}
                                    onChange={(e) => setEditingPrice(e.target.value)}
                                    style={treeEditInput}
                                    step="0.01"
                                    min="0"
                                    placeholder="Price"
                                  />
                                  <button
                                    onClick={() => handleSaveEdit(sm.id)}
                                    style={treeSaveBtn}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setEditingSubModelId(null)}
                                    style={treeCancelBtn}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                // Display mode
                                <div style={treeDisplayRow}>
                                  <span style={treeSubModelName}>{sm.name}</span>
                                  <span style={treeSubModelPrice}>₹{sm.price.toFixed(2)}</span>
                                  <button
                                    onClick={() => handleStartEdit(sm)}
                                    style={treeEditBtn}
                                    title="Edit price"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubModel(sm.id, sm.name)}
                                    style={treeDeleteBtn}
                                    title="Delete sub-model"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {productGroups.size === 0 && (
            <div style={emptyState}>
              No products yet. Add your first product using the form above.
            </div>
          )}
        </div>
      </div>

      {/* Brand Manager */}
      <div style={brandCard}>
        <button onClick={() => setShowBrands(!showBrands)} style={brandToggle}>
          <span style={brandToggleIcon}>{showBrands ? "−" : "+"}</span> Manage Brands
        </button>
        {showBrands && (
          <div style={brandPanel}>
            <div style={brandList}>
              {brands.map((b) => (
                <div key={b.id} style={brandRow}>
                  <span style={brandName}>{b.name}</span>
                  <button onClick={() => handleDeleteBrand(b.id, b.name)} style={deleteLink}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddBrand} style={brandForm}>
              <input
                type="text"
                placeholder="New brand name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                style={brandInput}
              />
              <button type="submit" style={smallButton}>
                Add Brand
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const container: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  height: "100%",
};

const loadingContainer: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-lg)",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "var(--space-4)",
};

const pageTitle: React.CSSProperties = {
  fontSize: "var(--font-size-xl)",
  fontWeight: "600",
  color: "var(--color-text)",
};

const formCard: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
};

const addForm: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const formField: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  flex: "1 1 auto",
  minWidth: "140px",
};

const formLabel: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: "600",
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
};

const input: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const primaryButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  background: "var(--color-primary)",
  color: "white",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-sm)",
  whiteSpace: "nowrap",
};

const treeCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const treeHeader: React.CSSProperties = {
  padding: "var(--space-4)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-text)",
};

const itemCount: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg)",
  padding: "var(--space-1) var(--space-3)",
  borderRadius: "var(--radius-sm)",
};

const treeScrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--space-3)",
};

const treeProductSection: React.CSSProperties = {
  marginBottom: "var(--space-4)",
  borderRadius: "var(--radius-sm)",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
};

const treeProductRow: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-bg)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontWeight: "600",
  transition: "background 0.15s",
};

const treeToggle: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-sm)",
  minWidth: "16px",
};

const treeProductName: React.CSSProperties = {
  color: "var(--color-text)",
  flex: 1,
};

const treeCount: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-sm)",
  fontWeight: "400",
};

const treeBrandSection: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-surface)",
  borderTop: "1px solid var(--color-border)",
};

const treeBrandRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  marginBottom: "var(--space-2)",
  fontWeight: "500",
};

const treeBrandName: React.CSSProperties = {
  color: "var(--color-text)",
};

const treeBrandRemoveBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-error)",
  cursor: "pointer",
  fontSize: "var(--font-size-base)",
  padding: "0 var(--space-1)",
  lineHeight: 1,
};

const treeNoSubModels: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-sm)",
  fontStyle: "italic",
  marginBottom: "var(--space-2)",
};

const treeSubModelRow: React.CSSProperties = {
  marginBottom: "var(--space-2)",
  paddingLeft: "var(--space-4)",
};

const treeDisplayRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
};

const treeSubModelName: React.CSSProperties = {
  flex: 1,
  color: "var(--color-text)",
  fontSize: "var(--font-size-sm)",
};

const treeSubModelPrice: React.CSSProperties = {
  color: "var(--color-primary)",
  fontWeight: "600",
  minWidth: "80px",
  textAlign: "right",
};

const treeEditBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--font-size-base)",
  padding: "var(--space-1)",
};

const treeDeleteBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--font-size-base)",
  padding: "var(--space-1)",
};

const treeEditRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-bg)",
  border: "2px solid var(--color-primary)",
  borderRadius: "var(--radius-sm)",
};

const treeEditInput: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-1) var(--space-2)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const treeSaveBtn: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-2)",
  cursor: "pointer",
  fontSize: "var(--font-size-sm)",
  fontWeight: "600",
};

const treeCancelBtn: React.CSSProperties = {
  background: "var(--color-border)",
  color: "var(--color-text)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-2)",
  cursor: "pointer",
  fontSize: "var(--font-size-sm)",
};

const emptyState: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
};

const brandCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-4)",
};

const brandToggle: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-secondary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

const brandToggleIcon: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "20px",
  height: "20px",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-base)",
  fontWeight: "500",
};

const brandPanel: React.CSSProperties = {
  marginTop: "var(--space-4)",
  paddingTop: "var(--space-4)",
  borderTop: "1px solid var(--color-border)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const brandList: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-2)",
};

const brandRow: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
};

const brandName: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  fontWeight: "500",
};

const brandForm: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
};

const brandInput: React.CSSProperties = {
  ...input,
  flex: 1,
};

const smallButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  background: "var(--color-navy)",
  color: "white",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  fontWeight: "600",
};

const deleteLink: React.CSSProperties = {
  color: "var(--color-error)",
  fontSize: "var(--font-size-lg)",
  background: "none",
  border: "none",
  cursor: "pointer",
  lineHeight: 1,
};
