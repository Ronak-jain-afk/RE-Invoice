import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useItems, BrandVariant, SearchResult } from "../hooks/useItems";
import { useCart, CartItem } from "../hooks/useCart";
import { useDate } from "../hooks/useDate";
import { useToast } from "../hooks/useToast.tsx";
import InvoicePreview from "./InvoicePreview";
import "../styles/InvoicePreview.css";
import { pdf } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export default function BillingTab() {
  const { searchItems, getProductDetails } = useItems();
  const { cart, addToCart, removeFromCart, updateQuantity, updateDiscount, changeSubModel, globalDiscount, setGlobalDiscount, clearCart, grandTotal, getEffectiveDiscount } = useCart();
  const { date, setDate } = useDate();
  const { showToast } = useToast();

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // PDF generation
  const [pdfLoading, setPdfLoading] = useState(false);

  // Variant picker modal state
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [productDetails, setProductDetails] = useState<BrandVariant[]>([]);
  const [selectedBrandVariantId, setSelectedBrandVariantId] = useState<number | null>(null);
  const [selectedSubModelId, setSelectedSubModelId] = useState<number | null>(null);
  const [pickerQty, setPickerQty] = useState(1);

  // Change brand modal state
  const [changeBrandModal, setChangeBrandModal] = useState(false);
  const [changeSubModelId, setChangeSubModelId] = useState<number | null>(null);
  const [changeProductDetails, setChangeProductDetails] = useState<BrandVariant[]>([]);
  const [changeBrandVariantId, setChangeBrandVariantId] = useState<number | null>(null);
  const [changeSubModelNewId, setChangeSubModelNewId] = useState<number | null>(null);

  const pdfStyles = StyleSheet.create({
    page: { padding: 24, fontFamily: "Helvetica" },
    header: { textAlign: "center", marginBottom: 12 },
    shopName: { fontSize: 26, color: "#0f172a", fontWeight: "bold" },
    subtitle: { fontSize: 10, color: "#64748b" },
    divider: { borderBottom: 2, borderColor: "#0f172a", marginVertical: 12 },
    meta: { flexDirection: "row", justifyContent: "space-between", fontSize: 10, marginBottom: 12 },
    table: { marginVertical: 15 },
    tableHeader: { background: "#f8fafc", padding: 10, fontWeight: "bold", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", borderBottom: 1, borderColor: "#e2e8f0" },
    tableCell: { padding: 10, fontSize: 10 },
    totalRow: { textAlign: "right", fontSize: 18, fontWeight: "bold", color: "#0f172a", paddingVertical: 12 },
    footer: { textAlign: "center", fontSize: 10, fontStyle: "italic", color: "#64748b", marginTop: 20 },
  });

  const generatePDF = async (size: "A4" | "A5") => {
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    setPdfLoading(true);
    try {
      const InvoicePDF = () => (
        <Document>
          <Page size={size} style={pdfStyles.page}>
            <View style={pdfStyles.header}>
              <Text style={pdfStyles.shopName}>RONAK ELECTRICALS</Text>
              <Text style={pdfStyles.subtitle}>Electrical Goods & Accessories</Text>
            </View>
            <View style={pdfStyles.divider} />
            <View style={pdfStyles.meta}>
              <Text>Invoice Date: {date}</Text>
              <Text>{customerName && `Customer: ${customerName}`}{customerMobile && ` | ${customerMobile}`}</Text>
            </View>
            <View style={pdfStyles.divider} />
            <View style={pdfStyles.table}>
              <View style={{ flexDirection: "row", ...pdfStyles.tableHeader }}>
                <Text style={[pdfStyles.tableCell, { width: "10%" }]}>#</Text>
                <Text style={[pdfStyles.tableCell, { width: "30%" }]}>Item</Text>
                <Text style={[pdfStyles.tableCell, { width: "15%" }]}>Brand</Text>
                <Text style={[pdfStyles.tableCell, { width: "10%" }]}>Qty</Text>
                <Text style={[pdfStyles.tableCell, { width: "12%", textAlign: "right" }]}>Unit</Text>
                <Text style={[pdfStyles.tableCell, { width: "23%", textAlign: "right" }]}>Total</Text>
              </View>
              {cart.map((c, idx) => {
                const discount = getEffectiveDiscount(c);
                const discountAmount = (c.price * discount) / 100;
                const finalPrice = c.price - discountAmount;
                const total = finalPrice * c.quantity;
                return (
                  <View key={c.sub_model_id} style={pdfStyles.tableRow}>
                    <Text style={[pdfStyles.tableCell, { width: "10%" }]}>{idx + 1}</Text>
                    <Text style={[pdfStyles.tableCell, { width: "30%" }]}>{c.base_name}</Text>
                    <Text style={[pdfStyles.tableCell, { width: "15%" }]}>{c.brand_name || "-"} / {c.sub_model_name}</Text>
                    <Text style={[pdfStyles.tableCell, { width: "10%" }]}>{c.quantity}</Text>
                    <Text style={[pdfStyles.tableCell, { width: "12%", textAlign: "right" }]}>Rs. {finalPrice.toFixed(2)}</Text>
                    <Text style={[pdfStyles.tableCell, { width: "23%", textAlign: "right" }]}>Rs. {total.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
            <View style={pdfStyles.divider} />
            <Text style={pdfStyles.totalRow}>Grand Total: Rs. {grandTotal.toFixed(2)}</Text>
            <Text style={pdfStyles.footer}>Thank you for your purchase!</Text>
          </Page>
        </Document>
      );

      const blob = await pdf(<InvoicePDF />).toBlob();
      const fileName = `Invoice-Ronak-Electricals-${size}-${Date.now()}.pdf`;
      const savePath = localStorage.getItem("pdfSavePath");

      if (savePath && savePath.trim().length > 0) {
        const buffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        let fullPath = savePath.trim();
        if (!fullPath.endsWith("\\") && !fullPath.endsWith("/")) {
          fullPath += "\\";
        }
        fullPath += fileName;

        try {
          await invoke("save_pdf", { path: fullPath, bytes: Array.from(uint8Array) });
          showToast(`PDF saved to ${fullPath}`);
        } catch (e) {
          showToast(`Failed to save PDF: ${e}`, "error");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`PDF (${size}) downloaded`);
      }
    } catch (e) {
      showToast("PDF generation failed", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchItems(query);
        setResults(r);
        setShowResults(true);
        setSelectedIdx(-1);
      } catch (e) {
        showToast("Search failed", "error");
      }
    }, 100);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      handleSelectProduct(results[selectedIdx]);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  const handleSelectProduct = async (product: SearchResult) => {
    try {
      const details = await getProductDetails(product.base_id);
      setSelectedProduct(product);
      setProductDetails(details);
      setVariantPickerOpen(true);
      setShowResults(false);
      setQuery("");
      setSelectedBrandVariantId(null);
      setSelectedSubModelId(null);
      setPickerQty(1);
    } catch (e) {
      showToast("Failed to load product details", "error");
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct || selectedBrandVariantId === null || selectedSubModelId === null) {
      showToast("Please select a brand and sub-model", "error");
      return;
    }

    // Find the selected variant
    const selectedBV = productDetails.find((bv) => bv.id === selectedBrandVariantId);
    const selectedSM = selectedBV?.sub_models.find((sm) => sm.id === selectedSubModelId);

    if (!selectedBV || !selectedSM) {
      showToast("Invalid selection", "error");
      return;
    }

    // Create cart item
    const cartItem: CartItem = {
      base_id: selectedProduct.base_id,
      base_name: selectedProduct.base_name,
      brand_variant_id: selectedBV.id,
      brand_name: selectedBV.brand_name,
      sub_model_id: selectedSM.id,
      sub_model_name: selectedSM.name,
      price: selectedSM.price,
      quantity: pickerQty,
      discount: 0,
    };

    addToCart(cartItem);
    showToast(`Added ${selectedProduct.base_name} to cart`);
    setVariantPickerOpen(false);
  };

  const handleOpenChangeBrand = async (cartItem: CartItem) => {
    try {
      const details = await getProductDetails(cartItem.base_id);
      setChangeSubModelId(cartItem.sub_model_id);
      setChangeProductDetails(details);
      setChangeBrandVariantId(cartItem.brand_variant_id);
      setChangeSubModelNewId(cartItem.sub_model_id);
      setChangeBrandModal(true);
    } catch (e) {
      showToast("Failed to load options", "error");
    }
  };

  const handleConfirmChangeBrand = () => {
    if (!changeSubModelId || changeBrandVariantId === null || changeSubModelNewId === null) {
      showToast("Invalid selection", "error");
      return;
    }

    // Find the current cart item and the new variant
    const currentItem = cart.find((c) => c.sub_model_id === changeSubModelId);
    const newBV = changeProductDetails.find((bv) => bv.id === changeBrandVariantId);
    const newSM = newBV?.sub_models.find((sm) => sm.id === changeSubModelNewId);

    if (!currentItem || !newBV || !newSM) {
      showToast("Invalid selection", "error");
      return;
    }

    const newItem: CartItem = {
      base_id: currentItem.base_id,
      base_name: currentItem.base_name,
      brand_variant_id: newBV.id,
      brand_name: newBV.brand_name,
      sub_model_id: newSM.id,
      sub_model_name: newSM.name,
      price: newSM.price,
      quantity: currentItem.quantity,
      discount: currentItem.discount,
    };

    changeSubModel(changeSubModelId, newItem);
    showToast("Changed");
    setChangeBrandModal(false);
  };

  const handlePrint = () => {
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    window.print();
    showToast("Invoice sent to printer");
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Clear all items from cart?")) {
      clearCart();
      showToast("Cart cleared");
    }
  };

  return (
    <div style={container}>
      <div style={splitLayout}>
        {/* Left Column: Search & Add */}
        <div style={leftColumn}>
          {/* Header inputs */}
          <div style={headerCard}>
            <div style={inputGroup}>
              <label style={label}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={input}
              />
            </div>
            <div style={inputGroup}>
              <label style={label}>Customer Name</label>
              <input
                type="text"
                placeholder="Optional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={input}
              />
            </div>
            <div style={inputGroup}>
              <label style={label}>Mobile</label>
              <input
                type="text"
                placeholder="10 digits"
                maxLength={10}
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                style={input}
              />
            </div>
          </div>

          {/* Search */}
          <div style={searchCard}>
            <h3 style={sectionTitle}>Find Items</h3>
            <div style={searchSection}>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search items by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setShowResults(true)}
                style={searchInput}
              />
              {showResults && results.length > 0 && (
                <div style={resultsDropdown}>
                  {results.map((item, idx) => (
                    <div
                      key={item.base_id}
                      style={{
                        ...resultRow,
                        background: idx === selectedIdx ? "var(--color-primary)" : undefined,
                        color: idx === selectedIdx ? "white" : undefined,
                      }}
                      onClick={() => handleSelectProduct(item)}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={resultName}>{item.base_name}</span>
                        <span style={{...resultMeta, color: idx === selectedIdx ? "rgba(255,255,255,0.8)" : undefined}}>
                          {item.brand_count} brand{item.brand_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Variant Picker Modal */}
        {variantPickerOpen && selectedProduct && (
          <div style={modalOverlay} onClick={() => setVariantPickerOpen(false)}>
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={modalTitle}>Select Variant: {selectedProduct.base_name}</h3>

              <div style={variantPickerContainer}>
                {productDetails.map((bv) => (
                  <div key={bv.id} style={brandSection}>
                    <div style={brandSectionTitle}>{bv.brand_name || "(No Brand)"}</div>
                    <div style={subModelsContainer}>
                      {bv.sub_models.map((sm) => (
                        <label key={sm.id} style={radioLabel}>
                          <input
                            type="radio"
                            name="submodel"
                            checked={selectedSubModelId === sm.id}
                            onChange={() => {
                              setSelectedBrandVariantId(bv.id);
                              setSelectedSubModelId(sm.id);
                            }}
                            style={radioInput}
                          />
                          <span style={radioText}>
                            {sm.name} <span style={subModelPrice}>₹{sm.price.toFixed(2)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quantity control */}
              <div style={qtySection}>
                <label style={qtyLabel}>Quantity</label>
                <div style={qtyControl}>
                  <button onClick={() => setPickerQty(Math.max(1, pickerQty - 1))} style={qtyBtn}>
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={pickerQty}
                    onChange={(e) => setPickerQty(Math.max(1, parseInt(e.target.value) || 1))}
                    style={qtyInput}
                  />
                  <button onClick={() => setPickerQty(pickerQty + 1)} style={qtyBtn}>
                    +
                  </button>
                </div>
              </div>

              {/* Price display */}
              {selectedSubModelId !== null && (
                <div style={priceDisplay}>
                  {(() => {
                    const bv = productDetails.find((b) => b.id === selectedBrandVariantId);
                    const sm = bv?.sub_models.find((s) => s.id === selectedSubModelId);
                    return sm ? `₹${sm.price.toFixed(2)} × ${pickerQty} = ₹${(sm.price * pickerQty).toFixed(2)}` : "";
                  })()}
                </div>
              )}

              <div style={modalButtons}>
                <button onClick={() => setVariantPickerOpen(false)} style={cancelButton}>
                  Cancel
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={selectedBrandVariantId === null || selectedSubModelId === null}
                  style={addButton}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Brand Modal */}
        {changeBrandModal && (
          <div style={modalOverlay} onClick={() => setChangeBrandModal(false)}>
            <div style={modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={modalTitle}>Change Brand/Model</h3>

              <div style={variantPickerContainer}>
                {changeProductDetails.map((bv) => (
                  <div key={bv.id} style={brandSection}>
                    <div style={brandSectionTitle}>{bv.brand_name || "(No Brand)"}</div>
                    <div style={subModelsContainer}>
                      {bv.sub_models.map((sm) => (
                        <label key={sm.id} style={radioLabel}>
                          <input
                            type="radio"
                            name="submodel_change"
                            checked={changeSubModelNewId === sm.id && changeBrandVariantId === bv.id}
                            onChange={() => {
                              setChangeBrandVariantId(bv.id);
                              setChangeSubModelNewId(sm.id);
                            }}
                            style={radioInput}
                          />
                          <span style={radioText}>
                            {sm.name} <span style={subModelPrice}>₹{sm.price.toFixed(2)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={modalButtons}>
                <button onClick={() => setChangeBrandModal(false)} style={cancelButton}>
                  Cancel
                </button>
                <button onClick={handleConfirmChangeBrand} style={addButton}>
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Cart & Checkout */}
        <div style={rightColumn}>
          <div style={cartCard}>
            <div style={cartHeader}>
              <h3 style={sectionTitle}>Current Bill</h3>
              <button onClick={handleClearCart} disabled={cart.length === 0} style={clearButton}>
                Clear All
              </button>
            </div>

            {/* Global Discount */}
            <div style={discountSection}>
              <label style={discountLabel}>Global Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                style={discountInput}
              />
            </div>

            <div style={cartScrollArea}>
              {cart.length > 0 ? (
                <div>
                  {cart.map((c) => {
                    const discount = getEffectiveDiscount(c);
                    const discountAmount = (c.price * discount) / 100;
                    const finalPrice = c.price - discountAmount;
                    const total = finalPrice * c.quantity;

                    return (
                      <div key={c.sub_model_id} style={cartItemCard}>
                        <div style={cartItemHeader}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.base_name}</div>
                            <div style={cartItemMeta}>
                              {c.brand_name || "-"} → {c.sub_model_name} · ₹{c.price.toFixed(2)}
                            </div>
                          </div>
                          <button onClick={() => removeFromCart(c.sub_model_id)} style={removeBtn}>
                            ×
                          </button>
                        </div>

                        {/* Quantity Control */}
                        <div style={cartItemRow}>
                          <label style={cartItemLabel}>Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={c.quantity}
                            onChange={(e) =>
                              updateQuantity(c.sub_model_id, Math.max(1, parseInt(e.target.value) || 1))
                            }
                            style={cartItemQtyField}
                          />
                        </div>

                        {/* Discount Override */}
                        <div style={cartItemRow}>
                          <label style={cartItemLabel}>Discount % {discount > 0 && `(${discount.toFixed(1)}%)`}</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder={globalDiscount.toFixed(1)}
                            value={c.discount}
                            onChange={(e) =>
                              updateDiscount(
                                c.sub_model_id,
                                Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                              )
                            }
                            style={cartItemDiscountField}
                          />
                        </div>

                        {/* Change Brand Button */}
                        <div style={cartItemRow}>
                          <button
                            onClick={() => handleOpenChangeBrand(c)}
                            style={changeButton}
                          >
                            Change Brand/Model
                          </button>
                        </div>

                        {/* Price Summary */}
                        <div style={cartItemPriceLine}>
                          <span style={cartItemPriceLabel}>
                            {c.quantity} × ₹{finalPrice.toFixed(2)} = ₹{total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={emptyCart}>No items in cart. Search and add items from the left.</div>
              )}
            </div>

            <div style={cartFooter}>
              <div style={totalRow}>
                <span style={totalLabel}>Grand Total:</span>
                <span style={totalAmount}>₹{grandTotal.toFixed(2)}</span>
              </div>

              <div style={actionsGrid}>
                <button onClick={handlePrint} disabled={cart.length === 0} style={{...actionButton, flex: "1 1 100%"}}>
                  Print Invoice
                </button>
                <div style={actionsRow}>
                  <button onClick={() => generatePDF("A4")} disabled={cart.length === 0 || pdfLoading} style={actionButtonSecondary}>
                    {pdfLoading ? "Wait..." : "PDF (A4)"}
                  </button>
                  <button onClick={() => generatePDF("A5")} disabled={cart.length === 0 || pdfLoading} style={actionButtonSecondary}>
                    PDF (A5)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Preview (hidden, visible during print) */}
      <div style={{ display: "none" }}>
        <InvoicePreview cart={cart} date={date} customerName={customerName} customerMobile={customerMobile} globalDiscount={globalDiscount} getEffectiveDiscount={getEffectiveDiscount} />
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
  height: "100%",
  gap: "var(--space-4)",
};

const splitLayout: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-6)",
  flex: 1,
  minHeight: 0,
};

const leftColumn: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  minWidth: 0,
};

const rightColumn: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const headerCard: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  gap: "var(--space-4)",
  flexWrap: "wrap",
};

const searchCard: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  position: "relative",
  flex: 1,
};

const cartCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
};

const cartHeader: React.CSSProperties = {
  padding: "var(--space-4)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const cartScrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--space-4)",
};

const cartFooter: React.CSSProperties = {
  borderTop: "1px solid var(--color-border)",
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-text)",
  marginBottom: "var(--space-3)",
};

const inputGroup: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  flex: 1,
  minWidth: "150px",
};

const label: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  fontWeight: "500",
};

const input: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const searchSection: React.CSSProperties = {
  position: "relative",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-base)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const resultsDropdown: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "var(--shadow-md)",
  maxHeight: "300px",
  overflowY: "auto",
  zIndex: 100,
};

const resultRow: React.CSSProperties = {
  padding: "var(--space-3)",
  cursor: "pointer",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "space-between",
};

const resultName: React.CSSProperties = {
  fontWeight: "500",
};

const resultMeta: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-sm)",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
};

const modal: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-6)",
  borderRadius: "var(--radius-md)",
  minWidth: "500px",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "var(--shadow-lg)",
};

const modalTitle: React.CSSProperties = {
  marginBottom: "var(--space-4)",
  fontSize: "var(--font-size-lg)",
  fontWeight: "600",
};

const variantPickerContainer: React.CSSProperties = {
  marginBottom: "var(--space-4)",
  maxHeight: "300px",
  overflowY: "auto",
};

const brandSection: React.CSSProperties = {
  marginBottom: "var(--space-4)",
};

const brandSectionTitle: React.CSSProperties = {
  fontWeight: "600",
  marginBottom: "var(--space-2)",
  fontSize: "var(--font-size-sm)",
  textTransform: "uppercase",
  color: "var(--color-primary)",
};

const subModelsContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  marginLeft: "var(--space-3)",
};

const radioLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  cursor: "pointer",
  padding: "var(--space-2)",
  borderRadius: "var(--radius-sm)",
  transition: "background 0.15s",
};

const radioInput: React.CSSProperties = {
  cursor: "pointer",
  accentColor: "var(--color-primary)",
};

const radioText: React.CSSProperties = {
  flex: 1,
  fontSize: "var(--font-size-sm)",
};

const subModelPrice: React.CSSProperties = {
  color: "var(--color-primary)",
  fontWeight: "600",
  marginLeft: "var(--space-2)",
};

const qtySection: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  marginBottom: "var(--space-3)",
  padding: "var(--space-3) 0",
  borderTop: "1px solid var(--color-border)",
};

const qtyLabel: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  fontWeight: "500",
  minWidth: "80px",
};

const qtyControl: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

const qtyBtn: React.CSSProperties = {
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-lg)",
  fontWeight: "600",
  cursor: "pointer",
};

const qtyInput: React.CSSProperties = {
  width: "80px",
  padding: "var(--space-2)",
  fontSize: "var(--font-size-xl)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  color: "var(--color-text)",
  background: "var(--color-surface)",
};

const priceDisplay: React.CSSProperties = {
  textAlign: "center",
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-primary)",
  marginBottom: "var(--space-3)",
};

const modalButtons: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  justifyContent: "flex-end",
  paddingTop: "var(--space-3)",
  borderTop: "1px solid var(--color-border)",
};

const cancelButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "500",
  cursor: "pointer",
};

const addButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  background: "var(--color-primary)",
  color: "white",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  cursor: "pointer",
};

const removeBtn: React.CSSProperties = {
  color: "var(--color-error)",
  fontSize: "var(--font-size-xl)",
  background: "none",
  border: "none",
  cursor: "pointer",
  lineHeight: 1,
  padding: "0 var(--space-1)",
};

const emptyCart: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  color: "var(--color-text-secondary)",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-sm)",
};

const totalRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-3) 0",
};

const totalLabel: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "500",
  color: "var(--color-text-secondary)",
};

const totalAmount: React.CSSProperties = {
  fontSize: "var(--font-size-2xl)",
  fontWeight: "600",
  color: "var(--color-primary)",
};

const actionsGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
};

const actionButton: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-primary)",
  color: "white",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-base)",
  cursor: "pointer",
};

const actionButtonSecondary: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-navy)",
  color: "white",
  borderRadius: "var(--radius-sm)",
  fontWeight: "500",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
};

const clearButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  background: "transparent",
  color: "var(--color-error)",
  border: "1px solid var(--color-error)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-xs)",
  fontWeight: "500",
  cursor: "pointer",
};

const discountSection: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

const discountLabel: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: "600",
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  minWidth: "140px",
};

const discountInput: React.CSSProperties = {
  width: "70px",
  padding: "var(--space-2)",
  fontSize: "var(--font-size-sm)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  background: "var(--color-surface)",
};

const cartItemCard: React.CSSProperties = {
  padding: "var(--space-3)",
  marginBottom: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-bg)",
};

const cartItemHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "var(--space-2)",
};

const cartItemMeta: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
};

const cartItemRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  alignItems: "center",
  marginBottom: "var(--space-2)",
};

const cartItemLabel: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  fontWeight: "500",
  minWidth: "100px",
};

const cartItemQtyField: React.CSSProperties = {
  width: "50px",
  padding: "var(--space-1)",
  fontSize: "var(--font-size-sm)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  background: "var(--color-surface)",
};

const cartItemDiscountField: React.CSSProperties = {
  width: "50px",
  padding: "var(--space-1)",
  fontSize: "var(--font-size-sm)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  background: "var(--color-surface)",
};

const changeButton: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-2)",
  fontSize: "var(--font-size-sm)",
  background: "var(--color-navy)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontWeight: "500",
};

const cartItemPriceLine: React.CSSProperties = {
  padding: "var(--space-2)",
  background: "var(--color-surface)",
  borderRadius: "var(--radius-sm)",
  textAlign: "right",
  fontWeight: "600",
  color: "var(--color-primary)",
};

const cartItemPriceLabel: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
};
