import { useState, useEffect, useRef, useMemo } from "react";
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
    suggestItemBases,
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

  // Item suggestions state
  const [suggestions, setSuggestions] = useState<Brand[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const suggestionDebounceRef = useRef<number | null>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Expanded state for products
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    if (!itemName.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestionDebounceRef.current = setTimeout(async () => {
      try {
        const results = await suggestItemBases(itemName);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedSuggestionIdx(-1);
      } catch {
        // silently fail
      }
    }, 200);
  }, [itemName]);

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

  const handleSuggestionKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && selectedSuggestionIdx >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedSuggestionIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: Brand) => {
    setItemName(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
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

  // Group brand variants by product (memoized)
  const productGroups = useMemo(() => {
    const groups = new Map<number, BrandVariant[]>();
    for (const bv of brandVariants) {
      if (!groups.has(bv.base_id)) {
        groups.set(bv.base_id, []);
      }
      groups.get(bv.base_id)!.push(bv);
    }
    return groups;
  }, [brandVariants]);

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
          <div style={{ ...formField, position: "relative" as const }}>
            <label style={formLabel}>Item</label>
            <input
              ref={itemInputRef}
              type="text"
              placeholder="e.g. Wire 2.5mm"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onKeyDown={handleSuggestionKeyDown}
              style={input}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={suggestionsDropdown}>
                {suggestions.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      ...suggestionRow,
                      background: idx === selectedSuggestionIdx ? "var(--color-primary)" : undefined,
                      color: idx === selectedSuggestionIdx ? "white" : undefined,
                    }}
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
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
  gap: "var(--space-6)",
  height: "100%",
};

const loadingContainer: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-lg)",
  fontWeight: "500",
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
  fontWeight: "700",
  color: "var(--color-text)",
  letterSpacing: "-0.01em",
};

const formCard: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-6)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
};

const addForm: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-4)",
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const formField: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  flex: "1 1 auto",
  minWidth: "160px",
};

const formLabel: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: "700",
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const input: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  transition: "border-color 0.2s",
};

const primaryButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-6)",
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontWeight: "700",
  fontSize: "var(--font-size-sm)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.2)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const treeCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const treeHeader: React.CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "var(--color-surface)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-text)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const itemCount: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg)",
  padding: "var(--space-1) var(--space-3)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  border: "1px solid var(--color-border)",
};

const treeScrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--space-6)",
};

const treeProductSection: React.CSSProperties = {
  marginBottom: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
};

const treeProductRow: React.CSSProperties = {
  padding: "var(--space-4) var(--space-4)",
  background: "var(--color-surface)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  fontWeight: "700",
  transition: "all 0.15s",
  color: "var(--color-text)",
};

const treeToggle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-xs)",
  minWidth: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const treeProductName: React.CSSProperties = {
  color: "var(--color-text)",
  flex: 1,
  fontSize: "var(--font-size-base)",
};

const treeCount: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-xs)",
  fontWeight: "500",
  background: "var(--color-bg)",
  padding: "2px 8px",
  borderRadius: "10px",
};

const treeBrandSection: React.CSSProperties = {
  padding: "var(--space-4)",
  background: "var(--color-surface)",
  borderTop: "1px solid var(--color-border)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const treeBrandRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-surface)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "700",
  fontSize: "var(--font-size-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-primary)",
  border: "1px solid var(--color-border)",
};

const treeBrandName: React.CSSProperties = {
  color: "var(--color-primary)",
};

const treeBrandRemoveBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  fontSize: "var(--font-size-xl)",
  padding: "0 var(--space-1)",
  lineHeight: 1,
};

const treeNoSubModels: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-xs)",
  fontStyle: "italic",
};

const treeSubModelRow: React.CSSProperties = {
  paddingLeft: "var(--space-4)",
};

const treeDisplayRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  transition: "all 0.15s",
};

const treeSubModelName: React.CSSProperties = {
  flex: 1,
  color: "var(--color-text)",
  fontSize: "var(--font-size-sm)",
  fontWeight: "500",
};

const treeSubModelPrice: React.CSSProperties = {
  color: "var(--color-text)",
  fontWeight: "700",
  minWidth: "80px",
  textAlign: "right",
  fontSize: "var(--font-size-sm)",
};

const treeEditBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-muted)",
};

const treeDeleteBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-muted)",
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
  fontWeight: "600",
};

const treeSaveBtn: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-3)",
  cursor: "pointer",
  fontSize: "var(--font-size-xs)",
  fontWeight: "700",
  textTransform: "uppercase",
};

const treeCancelBtn: React.CSSProperties = {
  background: "var(--color-surface)",
  color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-3)",
  cursor: "pointer",
  fontSize: "var(--font-size-xs)",
  fontWeight: "700",
  textTransform: "uppercase",
};

const emptyState: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  color: "var(--color-text-muted)",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--font-size-sm)",
  border: "1px dashed var(--color-border)",
};

const brandCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-6)",
};

const brandToggle: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-secondary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const brandToggleIcon: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-lg)",
  fontWeight: "600",
  color: "var(--color-primary)",
};

const brandPanel: React.CSSProperties = {
  marginTop: "var(--space-6)",
  paddingTop: "var(--space-6)",
  borderTop: "1px solid var(--color-border)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
};

const brandList: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-3)",
};

const brandRow: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-3)",
  padding: "var(--space-2) var(--space-4)",
  background: "var(--color-surface)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
};

const brandName: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  fontWeight: "600",
  color: "var(--color-text)",
};

const brandForm: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  background: "var(--color-surface)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
};

const brandInput: React.CSSProperties = {
  ...input,
  flex: 1,
};

const smallButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-6)",
  background: "var(--color-navy)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-xs)",
  fontWeight: "700",
  textTransform: "uppercase",
  cursor: "pointer",
};

const deleteLink: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-xl)",
  background: "none",
  border: "none",
  cursor: "pointer",
  lineHeight: 1,
  padding: "0",
};

const suggestionsDropdown: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)",
  maxHeight: "250px",
  overflowY: "auto",
  zIndex: 100,
};

const suggestionRow: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  cursor: "pointer",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "var(--font-size-sm)",
  fontWeight: "500",
  transition: "all 0.15s",
};

