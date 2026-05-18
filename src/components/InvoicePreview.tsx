import { CartItem } from "../hooks/useCart";

interface InvoicePreviewProps {
  cart: CartItem[];
  date: string;
  customerName: string;
  customerMobile: string;
  globalDiscount?: number;
  getEffectiveDiscount?: (item: CartItem) => number;
}

export default function InvoicePreview({ cart, date, customerName, customerMobile, globalDiscount = 0, getEffectiveDiscount }: InvoicePreviewProps) {
  const calculateGrandTotal = () => {
    return cart.reduce((sum, c) => {
      const discount = getEffectiveDiscount ? getEffectiveDiscount(c) : globalDiscount;
      const discountAmount = (c.price * discount) / 100;
      const finalPrice = c.price - discountAmount;
      return sum + finalPrice * c.quantity;
    }, 0);
  };

  const grandTotal = calculateGrandTotal();

  const formatDate = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };

  return (
    <div className="invoice-preview">
      <div className="invoice-header">
        <h1 className="shop-name">RONAK ELECTRICALS</h1>
        <p className="shop-subtitle">Electrical Goods & Accessories</p>
      </div>

      <div className="invoice-divider" />

      <div className="invoice-meta">
        <span className="invoice-date">Invoice Date: {formatDate(date)}</span>
        <span className="invoice-customer">
          {customerName && `Customer: ${customerName}`}
          {customerMobile && ` | Mobile: ${customerMobile}`}
        </span>
      </div>

      <div className="invoice-divider" />

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Brand</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((c, idx) => {
            const discount = getEffectiveDiscount ? getEffectiveDiscount(c) : globalDiscount;
            const discountAmount = (c.price * discount) / 100;
            const finalPrice = c.price - discountAmount;
            const total = finalPrice * c.quantity;
            
            return (
              <tr key={c.sub_model_id}>
                <td>{idx + 1}</td>
                <td>{c.base_name}</td>
                <td>{c.brand_name || "-"} / {c.sub_model_name}</td>
                <td>{c.quantity}</td>
                <td>₹{finalPrice.toFixed(2)}</td>
                <td>₹{total.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="invoice-divider" />

      <div className="invoice-total">
        <span>Grand Total: ₹{grandTotal.toFixed(2)}</span>
      </div>

      <div className="invoice-footer">
        Thank you for your purchase!
      </div>
    </div>
  );
}