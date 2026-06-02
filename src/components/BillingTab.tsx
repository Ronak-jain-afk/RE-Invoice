import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useItems, BrandVariant, SearchResult } from "../hooks/useItems";
import { useCartContext, CartItem } from "../hooks/useCart";
import { useDate } from "../hooks/useDate";
import { useToast } from "../hooks/useToast.tsx";
import InvoicePreview from "./InvoicePreview";
import InvoicePreviewModal from "./InvoicePreviewModal";
import "../styles/InvoicePreview.css";
import { pdf } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const pdfStylesConst = StyleSheet.create({
  page: { padding: 20, fontFamily: "Helvetica", backgroundColor: "white", color: "#1a1a18" },
  topSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 6 },
  logoPlaceholder: { width: 24, height: 24, backgroundColor: "#1a3c5e", marginRight: 6 },
  brandNameContainer: { flexDirection: "column" },
  brandNameMain: { fontSize: 14, fontWeight: "bold", textTransform: "uppercase" },
  invoiceLabelLarge: { fontSize: 18, fontWeight: "bold", letterSpacing: 1 },

  metaSection: { borderTopWidth: 1, borderTopColor: "#dbe1e8", paddingTop: 8, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  customerInfo: { flexDirection: "column" },
  customerNameBold: { fontSize: 12, fontWeight: "bold", marginBottom: 1 },
  metaText: { fontSize: 9, color: "#6b6b68", marginBottom: 1 },
  idBlock: { textAlign: "right" },
  idValue: { fontSize: 14, fontWeight: "bold", letterSpacing: 1 },

  table: { marginBottom: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1a3c5e", padding: 6 },
  headerText: { fontSize: 8, fontWeight: "bold", color: "white", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e0db", padding: 6 },
  tableRowEven: { backgroundColor: "#f8f8f6" },
  cellText: { fontSize: 9 },
  cellSubText: { fontSize: 7, color: "#6b6b68", marginTop: 1 },

  totalsBlock: { width: 180, marginLeft: "auto" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  totalLabel: { fontSize: 9, color: "#6b6b68", textTransform: "uppercase" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, borderTopWidth: 1, borderTopColor: "#1a1a18", paddingTop: 4 },
  grandTotalText: { fontSize: 14, fontWeight: "bold" },

  footerText: { textAlign: "center", fontSize: 9, color: "#6b6b68", marginTop: "auto", paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e2e0db" },
});

export default function BillingTab() {
  const { searchItems, getProductDetails, claimInvoiceNumber } = useItems();
  const { cart, addToCart, removeFromCart, updateQuantity, updateDiscount, updatePrice, changeSubModel, globalDiscount, setGlobalDiscount, clearCart, grandTotal, getEffectiveDiscount } = useCartContext();
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

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  // Invoice numbering
  const [invoiceNumber, setInvoiceNumber] = useState<number | null>(null);

  // Configurable shop details (read once, never re-written from this tab)
  const [shopName] = useState(() => localStorage.getItem("shopName") || "" );
  const [shopPhone] = useState(() => localStorage.getItem("shopPhone") || "");
  const [shopAddress] = useState(() => localStorage.getItem("shopAddress") || "");

  // Refs for keyboard shortcuts (refs avoid stale closure over handlers)
  const discountRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<() => void>(() => {});
  const clearCartRef = useRef<() => void>(() => {});
  const cartLengthRef = useRef(cart.length);
  cartLengthRef.current = cart.length;

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

  const pdfStyles = pdfStylesConst;

  const generatePDF = async (size: "A4" | "A5") => {
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    setPdfLoading(true);
    try {
      const num = await claimInvoiceNumber();
      const invLabel = num ? String(num).padStart(6, "0") : "000000";

      const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
      const totalDiscount = cart.reduce((sum, c) => {
        const d = getEffectiveDiscount(c);
        return sum + (c.price * d / 100) * c.quantity;
      }, 0);
      const grandTotal = subtotal - totalDiscount;

      const InvoicePDF = () => (
        <Document>
          <Page size={size} style={pdfStyles.page}>
            {/* Header */}
            <View style={pdfStyles.topSection}>
              <View style={pdfStyles.brandBlock}>
                <View style={pdfStyles.logoPlaceholder} />
                <View style={pdfStyles.brandNameContainer}>
                  <Text style={pdfStyles.brandNameMain}>{shopName}</Text>
                  {shopPhone ? <Text style={{ fontSize: 8, color: "#6b6b68" }}>{shopPhone}</Text> : null}
                  {shopAddress ? <Text style={{ fontSize: 8, color: "#6b6b68" }}>{shopAddress}</Text> : null}
                </View>
              </View>
              <Text style={pdfStyles.invoiceLabelLarge}>INVOICE</Text>
            </View>

            {/* Meta */}
            <View style={pdfStyles.metaSection}>
              <View style={pdfStyles.customerInfo}>
                {customerName ? <Text style={pdfStyles.customerNameBold}>{customerName}</Text> : null}
                <Text style={pdfStyles.metaText}>Date: {date}</Text>
                {customerMobile && <Text style={pdfStyles.metaText}>Phone: +91 {customerMobile}</Text>}
              </View>
              {invoiceNumber && (
                <View style={pdfStyles.idBlock}>
                  <Text style={pdfStyles.idValue}>{invLabel}</Text>
                </View>
              )}
            </View>

            {/* Table */}
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.headerText, { width: "40%" }]}>Product</Text>
                <Text style={[pdfStyles.headerText, { width: "20%", textAlign: "center" }]}>Price</Text>
                <Text style={[pdfStyles.headerText, { width: "15%", textAlign: "center" }]}>Qty</Text>
                <Text style={[pdfStyles.headerText, { width: "25%", textAlign: "right" }]}>Total</Text>
              </View>
              {cart.map((c, idx) => {
                const discount = getEffectiveDiscount(c);
                const finalPrice = c.price * (1 - discount / 100);
                const total = finalPrice * c.quantity;
                return (
                  <View key={c.sub_model_id} style={[pdfStyles.tableRow, idx % 2 === 1 ? pdfStyles.tableRowEven : {}]}>
                    <View style={{ width: "40%" }}>
                      <Text style={[pdfStyles.cellText, { fontWeight: "bold" }]}>{c.base_name}</Text>
                      <Text style={pdfStyles.cellSubText}>{c.brand_name} / {c.sub_model_name}</Text>
                    </View>
                    <Text style={[pdfStyles.cellText, { width: "20%", textAlign: "center" }]}>Rs. {c.price.toFixed(2)}</Text>
                    <Text style={[pdfStyles.cellText, { width: "15%", textAlign: "center" }]}>{c.quantity}</Text>
                    <Text style={[pdfStyles.cellText, { width: "25%", textAlign: "right" }]}>Rs. {total.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Totals */}
            <View style={pdfStyles.totalsBlock}>
              <View style={pdfStyles.totalRow}>
                <Text style={pdfStyles.totalLabel}>Subtotal</Text>
                <Text style={pdfStyles.cellText}>Rs. {subtotal.toFixed(2)}</Text>
              </View>
              {totalDiscount > 0 && (
                <View style={pdfStyles.totalRow}>
                  <Text style={pdfStyles.totalLabel}>Discount</Text>
                  <Text style={pdfStyles.cellText}>- Rs. {totalDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={pdfStyles.grandTotalRow}>
                <Text style={[pdfStyles.totalLabel, { fontWeight: "bold", color: "#1a1a18" }]}>Total</Text>
                <Text style={pdfStyles.grandTotalText}>Rs. {grandTotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* Footer */}
            <Text style={pdfStyles.footerText}>Thank you for your purchase!</Text>
          </Page>
        </Document>
      );

      const blob = await pdf(<InvoicePDF />).toBlob();
      const filename = `Invoice-${size}-${invLabel}.pdf`;
      const saveDir = localStorage.getItem("pdfSavePath");

      if (saveDir && saveDir.trim().length > 0) {
        const buffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        try {
          const fullPath = await invoke<string>("save_pdf", {
            dir: saveDir.trim(),
            filename,
            bytes: Array.from(uint8Array),
          });
          setInvoiceNumber(num);
          showToast(`PDF saved to ${fullPath}`);
        } catch (e) {
          showToast(`Failed to save PDF: ${e}`, "error");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setInvoiceNumber(num);
        showToast(`PDF (${size}) downloaded`);
      }
    } catch (e) {
      showToast(`PDF generation failed: ${e}`, "error");
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
      original_price: selectedSM.price,
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
      original_price: newSM.price,
      quantity: currentItem.quantity,
      discount: currentItem.discount,
    };

    changeSubModel(changeSubModelId, newItem);
    showToast("Changed");
    setChangeBrandModal(false);
  };

  const handlePrint = async () => {
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    try {
      const num = await claimInvoiceNumber();
      flushSync(() => setInvoiceNumber(num));
    } catch {
      flushSync(() => setInvoiceNumber(null));
    }
    window.print();
    showToast("Invoice sent to printer");
  };
  printRef.current = handlePrint;

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Clear all items from cart?")) {
      clearCart();
      showToast("Cart cleared");
    }
  };
  clearCartRef.current = handleClearCart;

  // Keyboard shortcuts (uses refs to avoid stale closures)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowResults(false);
        setVariantPickerOpen(false);
        setChangeBrandModal(false);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "p":
            e.preventDefault();
            if (cartLengthRef.current > 0) printRef.current();
            break;
          case "n":
            e.preventDefault();
            if (cartLengthRef.current > 0) clearCartRef.current();
            break;
          case "f":
            e.preventDefault();
            searchRef.current?.focus();
            break;
          case "d":
            e.preventDefault();
            discountRef.current?.focus();
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
                ref={discountRef}
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
                            <div style={cartItemName}>{c.base_name}</div>
                            <div style={cartItemMeta}>
                              {c.brand_name || "-"} → {c.sub_model_name} · ₹{c.price.toFixed(2)}
                            </div>
                          </div>
                          <button onClick={() => removeFromCart(c.sub_model_id)} style={removeBtn} title="Remove item">
                            ×
                          </button>
                        </div>

                        {/* Quantity Control */}
                        <div style={cartItemRow}>
                          <label style={cartItemLabel}>Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={c.quantity}
                            onChange={(e) =>
                              updateQuantity(c.sub_model_id, Math.max(1, parseInt(e.target.value) || 1))
                            }
                            style={cartItemQtyField}
                          />
                          <button
                            onClick={() => handleOpenChangeBrand(c)}
                            style={changeButton}
                          >
                            Change Brand/Model
                          </button>
                        </div>

                        {/* Discount Override */}
                        <div style={cartItemRow}>
                          <label style={cartItemLabel}>Discount %</label>
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
                          {discount > 0 && <span style={{fontSize: '11px', color: 'var(--color-success)', fontWeight: '600'}}>({discount.toFixed(1)}% Applied)</span>}
                        </div>

                        {/* Price Override */}
                        <div style={cartItemRow}>
                          <label style={cartItemLabel}>Unit Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={c.price}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > 0) updatePrice(c.sub_model_id, v);
                            }}
                            style={cartItemQtyField}
                          />
                          {c.price !== c.original_price && (
                            <>
                              <span style={{fontSize: '11px', color: 'var(--color-text-secondary)', textDecoration: 'line-through', marginRight: '4px'}}>
                                ₹{c.original_price.toFixed(2)}
                              </span>
                              <button
                                onClick={() => updatePrice(c.sub_model_id, c.original_price)}
                                style={{...changeButton, marginLeft: 0}}
                              >
                                Reset
                              </button>
                            </>
                          )}
                        </div>

                        {/* Price Summary */}
                        <div style={cartItemPriceLine}>
                          <span style={cartItemPriceLabel}>
                            {c.quantity} × ₹{finalPrice.toFixed(2)}
                          </span>
                          ₹{total.toFixed(2)}
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
                  <button onClick={() => setPreviewOpen(true)} disabled={cart.length === 0} style={actionButtonSecondary}>
                    Preview
                  </button>
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

      <>
      {/* Invoice Preview Modal */}
      {previewOpen && (
        <InvoicePreviewModal
          cart={cart}
          date={date}
          customerName={customerName}
          customerMobile={customerMobile}
          globalDiscount={globalDiscount}
          getEffectiveDiscount={getEffectiveDiscount}
          invoiceNumber={invoiceNumber}
          shopName={shopName}
          shopPhone={shopPhone}
          shopAddress={shopAddress}
          onClose={() => setPreviewOpen(false)}
          onPrint={() => { setPreviewOpen(false); handlePrint(); }}
        />
      )}

      {/* Invoice Preview (hidden by CSS, visible during print) */}
      <InvoicePreview cart={cart} date={date} customerName={customerName} customerMobile={customerMobile} globalDiscount={globalDiscount} getEffectiveDiscount={getEffectiveDiscount} invoiceNumber={invoiceNumber} shopName={shopName} shopPhone={shopPhone} shopAddress={shopAddress} />
      </>
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
  gap: "var(--space-6)",
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
  gap: "var(--space-6)",
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
  padding: "var(--space-6)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  gap: "var(--space-4)",
  flexWrap: "wrap",
};

const searchCard: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-6)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
  position: "relative",
  flex: 1,
};

const cartCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
};

const cartHeader: React.CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "var(--color-surface)",
  borderTopLeftRadius: "var(--radius-md)",
  borderTopRightRadius: "var(--radius-md)",
};

const cartScrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--space-6)",
};

const cartFooter: React.CSSProperties = {
  borderTop: "1px solid var(--color-border)",
  padding: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  background: "var(--color-surface)",
  borderBottomLeftRadius: "var(--radius-md)",
  borderBottomRightRadius: "var(--radius-md)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-text)",
  marginBottom: "var(--space-4)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const inputGroup: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  flex: 1,
  minWidth: "180px",
};

const label: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
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

const searchSection: React.CSSProperties = {
  position: "relative",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-3) var(--space-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-base)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
};

const resultsDropdown: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)",
  maxHeight: "350px",
  overflowY: "auto",
  zIndex: 100,
};

const resultRow: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  cursor: "pointer",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  transition: "all 0.15s",
};

const resultName: React.CSSProperties = {
  fontWeight: "600",
  fontSize: "var(--font-size-base)",
};

const resultMeta: React.CSSProperties = {
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-xs)",
  marginTop: "2px",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
};

const modal: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-8)",
  borderRadius: "var(--radius-lg)",
  width: "600px",
  maxHeight: "85vh",
  overflowY: "auto",
  boxShadow: "var(--shadow-lg)",
};

const modalTitle: React.CSSProperties = {
  marginBottom: "var(--space-6)",
  fontSize: "var(--font-size-xl)",
  fontWeight: "600",
  color: "var(--color-text)",
  borderBottom: "1px solid var(--color-border)",
  paddingBottom: "var(--space-4)",
};

const variantPickerContainer: React.CSSProperties = {
  marginBottom: "var(--space-6)",
  maxHeight: "400px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const brandSection: React.CSSProperties = {
  background: "var(--color-bg)",
  padding: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
};

const brandSectionTitle: React.CSSProperties = {
  fontWeight: "700",
  marginBottom: "var(--space-3)",
  fontSize: "var(--font-size-xs)",
  textTransform: "uppercase",
  color: "var(--color-primary)",
  letterSpacing: "0.05em",
};

const subModelsContainer: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: "var(--space-2)",
};

const radioLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  cursor: "pointer",
  padding: "var(--space-3)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  transition: "all 0.2s",
};

const radioInput: React.CSSProperties = {
  cursor: "pointer",
  width: "18px",
  height: "18px",
  accentColor: "var(--color-primary)",
};

const radioText: React.CSSProperties = {
  flex: 1,
  fontSize: "var(--font-size-sm)",
  fontWeight: "500",
};

const subModelPrice: React.CSSProperties = {
  color: "var(--color-primary)",
  fontWeight: "700",
  marginLeft: "auto",
};

const qtySection: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-4)",
  margin: "var(--space-6) 0",
  padding: "var(--space-6) 0",
  borderTop: "1px solid var(--color-border)",
  borderBottom: "1px solid var(--color-border)",
};

const qtyLabel: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
};

const qtyControl: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-1)",
  background: "var(--color-bg)",
  padding: "4px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
};

const qtyBtn: React.CSSProperties = {
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-lg)",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "var(--shadow-sm)",
};

const qtyInput: React.CSSProperties = {
  width: "60px",
  padding: "var(--space-1)",
  fontSize: "var(--font-size-lg)",
  textAlign: "center",
  border: "none",
  background: "transparent",
  fontWeight: "700",
  color: "var(--color-text)",
};

const priceDisplay: React.CSSProperties = {
  textAlign: "right",
  fontSize: "var(--font-size-lg)",
  fontWeight: "700",
  color: "var(--color-primary)",
  marginBottom: "var(--space-6)",
};

const modalButtons: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  justifyContent: "flex-end",
};

const cancelButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-6)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
  color: "var(--color-text-secondary)",
};

const addButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-8)",
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.2)",
};

const removeBtn: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-xl)",
  background: "none",
  border: "none",
  cursor: "pointer",
  lineHeight: 1,
  padding: "var(--space-1)",
  transition: "color 0.2s",
};

const emptyCart: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  color: "var(--color-text-muted)",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--font-size-sm)",
  border: "1px dashed var(--color-border)",
};

const totalRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "var(--space-2) 0",
};

const totalLabel: React.CSSProperties = {
  fontSize: "var(--font-size-base)",
  fontWeight: "600",
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const totalAmount: React.CSSProperties = {
  fontSize: "var(--font-size-2xl)",
  fontWeight: "700",
  color: "var(--color-primary)",
};

const actionsGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  marginTop: "var(--space-2)",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
};

const actionButton: React.CSSProperties = {
  padding: "var(--space-4)",
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontWeight: "700",
  fontSize: "var(--font-size-base)",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.2)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const actionButtonSecondary: React.CSSProperties = {
  flex: 1,
  padding: "var(--space-3)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
  transition: "all 0.2s",
};

const clearButton: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  background: "transparent",
  color: "var(--color-error)",
  border: "1px solid var(--color-error)",
  borderRadius: "var(--radius-sm)",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase",
  cursor: "pointer",
};

const discountSection: React.CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  background: "var(--color-surface)",
};

const discountLabel: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: "700",
  color: "var(--color-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  flex: 1,
};

const discountInput: React.CSSProperties = {
  width: "80px",
  padding: "var(--space-2)",
  fontSize: "var(--font-size-sm)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  background: "var(--color-surface)",
  fontWeight: "600",
};

const cartItemCard: React.CSSProperties = {
  padding: "var(--space-4)",
  marginBottom: "var(--space-4)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const cartItemHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const cartItemName: React.CSSProperties = {
  fontWeight: "700",
  fontSize: "var(--font-size-base)",
  color: "var(--color-text)",
};

const cartItemMeta: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  marginTop: "2px",
  fontWeight: "500",
};

const cartItemRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-4)",
  alignItems: "center",
};

const cartItemLabel: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  fontWeight: "600",
  textTransform: "uppercase",
  minWidth: "80px",
};

const cartItemQtyField: React.CSSProperties = {
  width: "60px",
  padding: "var(--space-1) var(--space-2)",
  fontSize: "var(--font-size-sm)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  background: "var(--color-surface)",
  fontWeight: "600",
};

const cartItemDiscountField: React.CSSProperties = {
  width: "60px",
  padding: "var(--space-1) var(--space-2)",
  fontSize: "var(--font-size-sm)",
  textAlign: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  background: "var(--color-surface)",
  fontWeight: "600",
};

const changeButton: React.CSSProperties = {
  fontSize: "11px",
  background: "var(--color-bg)",
  color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-3)",
  cursor: "pointer",
  fontWeight: "600",
  textTransform: "uppercase",
};

const cartItemPriceLine: React.CSSProperties = {
  textAlign: "right",
  fontWeight: "700",
  color: "var(--color-primary)",
  fontSize: "var(--font-size-base)",
};

const cartItemPriceLabel: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-secondary)",
  fontWeight: "500",
  marginRight: "var(--space-2)",
};

