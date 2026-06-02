import { CartItem } from "../hooks/useCart";

interface InvoicePreviewProps {
  cart: CartItem[];
  date: string;
  customerName: string;
  customerMobile: string;
  globalDiscount?: number;
  getEffectiveDiscount?: (item: CartItem) => number;
  invoiceNumber?: number | null;
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
}

export default function InvoicePreview({
  cart,
  date,
  customerName,
  customerMobile,
  globalDiscount = 0,
  getEffectiveDiscount,
  invoiceNumber,
  shopName,
  shopPhone,
  shopAddress,
}: InvoicePreviewProps) {
  const calculateSubtotal = () => {
    return cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  };

  const calculateTotalDiscount = () => {
    return cart.reduce((sum, c) => {
      const discount = getEffectiveDiscount ? getEffectiveDiscount(c) : globalDiscount;
      const discountAmount = (c.price * discount) / 100;
      return sum + discountAmount * c.quantity;
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const totalDiscount = calculateTotalDiscount();
  const grandTotal = subtotal - totalDiscount;

  const formatDate = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };

  const invLabel = invoiceNumber ? String(invoiceNumber).padStart(6, "0") : "000000";

  return (
    <div className="invoice-preview">
      {/* Top Header */}
      <div className="invoice-top-section">
        <div className="brand-block">
          <div className="brand-logo-placeholder" />
          <div className="brand-name-container">
            <span className="brand-name-main">{shopName || ""}</span>
            {shopPhone && <span className="brand-detail">📞 {shopPhone}</span>}
            {shopAddress && <span className="brand-detail">📍 {shopAddress}</span>}
          </div>
        </div>
        <div className="invoice-label-large">INVOICE</div>
      </div>

      {/* Meta Information */}
      <div className="invoice-meta-section">
        <div className="customer-info-block">
          {customerName && <div className="customer-name-bold">{customerName}</div>}
          <div className="meta-detail-text">Date: {formatDate(date)}</div>
          {customerMobile && <div className="meta-detail-text">Phone: +91 {customerMobile}</div>}
        </div>
        {invoiceNumber && (
          <div className="invoice-id-block">
            <div className="id-value">{invLabel}</div>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Product</th>
            <th style={{ width: "20%" }}>Price</th>
            <th style={{ width: "15%" }}>Qty</th>
            <th style={{ width: "25%" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((c) => {
            const discount = getEffectiveDiscount ? getEffectiveDiscount(c) : globalDiscount;
            const discountAmount = (c.price * discount) / 100;
            const finalPrice = c.price - discountAmount;
            const total = finalPrice * c.quantity;

            return (
              <tr key={c.sub_model_id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{c.base_name}</div>
                  <div style={{ fontSize: "8px", color: "#5e5e5e" }}>
                    {c.brand_name} / {c.sub_model_name}
                  </div>
                </td>
                <td>₹{c.price.toFixed(2)}</td>
                <td>{c.quantity}</td>
                <td>₹{total.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="invoice-totals">
        <div className="total-row-item">
          <span className="label">Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="total-row-item">
            <span className="label">Discount</span>
            <span>- ₹{totalDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="total-row-item grand">
          <span className="label">Total</span>
          <span>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="invoice-footer-text">
        Thank you for your purchase!
      </div>
    </div>
  );
}
