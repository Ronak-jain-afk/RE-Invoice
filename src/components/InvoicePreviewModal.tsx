import { CartItem } from "../hooks/useCart";
import InvoicePreview from "./InvoicePreview";

interface InvoicePreviewModalProps {
  cart: CartItem[];
  date: string;
  customerName: string;
  customerMobile: string;
  globalDiscount: number;
  getEffectiveDiscount: (item: CartItem) => number;
  invoiceNumber?: number | null;
  onClose: () => void;
  onPrint: () => void;
}

export default function InvoicePreviewModal({
  cart,
  date,
  customerName,
  customerMobile,
  globalDiscount,
  getEffectiveDiscount,
  invoiceNumber,
  onClose,
  onPrint,
}: InvoicePreviewModalProps) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h3 style={title}>Invoice Preview</h3>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        <div style={scrollArea}>
          <div className="preview-modal-wrapper">
            <InvoicePreview
              cart={cart}
              date={date}
              customerName={customerName}
              customerMobile={customerMobile}
              globalDiscount={globalDiscount}
              getEffectiveDiscount={getEffectiveDiscount}
              invoiceNumber={invoiceNumber}
            />
          </div>
        </div>

        <div style={footer}>
          <button onClick={onClose} style={secondaryBtn}>Close</button>
          <button onClick={onPrint} disabled={cart.length === 0} style={primaryBtn}>
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
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
  borderRadius: "var(--radius-md)",
  width: "720px",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-4) var(--space-6)",
  borderBottom: "1px solid var(--color-border)",
};

const title: React.CSSProperties = {
  fontSize: "var(--font-size-lg)",
  fontWeight: "600",
  color: "var(--color-text)",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "24px",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  lineHeight: 1,
  padding: "4px",
};

const scrollArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--space-6)",
};

const footer: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  justifyContent: "flex-end",
  padding: "var(--space-4) var(--space-6)",
  borderTop: "1px solid var(--color-border)",
  background: "#fcfcfc",
};

const secondaryBtn: React.CSSProperties = {
  padding: "var(--space-2) var(--space-6)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontWeight: "600",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
  color: "var(--color-text-secondary)",
};

const primaryBtn: React.CSSProperties = {
  padding: "var(--space-2) var(--space-8)",
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontWeight: "700",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.2)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};
