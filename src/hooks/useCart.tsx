import { useState, useMemo, useCallback, useEffect, useRef, createContext, useContext, ReactNode } from "react";

const CART_STORAGE_KEY = "ronak_cart_snapshot";

export interface CartItem {
  base_id: number;
  base_name: string;
  brand_variant_id: number;
  brand_name: string | null;
  sub_model_id: number;
  sub_model_name: string;
  price: number;
  original_price: number;
  quantity: number;
  discount: number;
}

interface CartSnapshot {
  cart: CartItem[];
  globalDiscount: number;
}

interface CartContextType {
  cart: CartItem[];
  globalDiscount: number;
  setGlobalDiscount: (v: number) => void;
  clearGlobalDiscount: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (subModelId: number) => void;
  updateQuantity: (subModelId: number, quantity: number) => void;
  changeSubModel: (subModelId: number, newItem: CartItem) => void;
  updateDiscount: (subModelId: number, discount: number) => void;
  updatePrice: (subModelId: number, price: number) => void;
  getEffectiveDiscount: (item: CartItem) => number;
  clearCart: () => void;
  grandTotal: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | null>(null);

function loadSnapshot(): CartSnapshot | null {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return null;
    const snapshot = JSON.parse(saved) as CartSnapshot;
    // Migrate old snapshots that lack original_price
    snapshot.cart = snapshot.cart.map((c) => ({
      ...c,
      original_price: c.original_price ?? c.price,
    }));
    return snapshot;
  } catch {
    return null;
  }
}

function saveSnapshot(cart: CartItem[], globalDiscount: number) {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ cart, globalDiscount } satisfies CartSnapshot)
    );
  } catch {
    // storage full or unavailable — silently ignore
  }
}

function clearSnapshot() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // silently ignore
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => loadSnapshot()?.cart ?? []);
  const [globalDiscount, setGlobalDiscount] = useState<number>(
    () => loadSnapshot()?.globalDiscount ?? 0
  );
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveSnapshot(cart, globalDiscount);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [cart, globalDiscount]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.sub_model_id === item.sub_model_id);
      if (existing) {
        return prev.map((c) =>
          c.sub_model_id === item.sub_model_id
            ? { ...c, quantity: c.quantity + item.quantity }
            : c
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((subModelId: number) => {
    setCart((prev) => prev.filter((c) => c.sub_model_id !== subModelId));
  }, []);

  const updateQuantity = useCallback((subModelId: number, quantity: number) => {
    if (quantity < 1) return;
    setCart((prev) =>
      prev.map((c) => (c.sub_model_id === subModelId ? { ...c, quantity } : c))
    );
  }, []);

  const changeSubModel = useCallback((subModelId: number, newItem: CartItem) => {
    setCart((prev) =>
      prev.map((c) =>
        c.sub_model_id === subModelId
          ? { ...newItem, quantity: c.quantity, discount: c.discount }
          : c
      )
    );
  }, []);

  const updateDiscount = useCallback((subModelId: number, discount: number) => {
    if (discount < 0 || discount > 100) return;
    setCart((prev) =>
      prev.map((c) => (c.sub_model_id === subModelId ? { ...c, discount } : c))
    );
  }, []);

  const updatePrice = useCallback((subModelId: number, price: number) => {
    if (price <= 0) return;
    setCart((prev) =>
      prev.map((c) => (c.sub_model_id === subModelId ? { ...c, price } : c))
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscount(0);
    clearSnapshot();
  }, []);

  const clearGlobalDiscount = useCallback(() => setGlobalDiscount(0), []);

  const getEffectiveDiscount = useCallback(
    (item: CartItem): number =>
      item.discount > 0 ? item.discount : globalDiscount,
    [globalDiscount]
  );

  const grandTotal = useMemo(
    () =>
      cart.reduce((sum, c) => {
        const discount = getEffectiveDiscount(c);
        const discountAmount = (c.price * discount) / 100;
        const finalPrice = c.price - discountAmount;
        return sum + finalPrice * c.quantity;
      }, 0),
    [cart, getEffectiveDiscount]
  );

  const totalItems = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        globalDiscount,
        setGlobalDiscount,
        clearGlobalDiscount,
        addToCart,
        removeFromCart,
        updateQuantity,
        changeSubModel,
        updateDiscount,
        updatePrice,
        getEffectiveDiscount,
        clearCart,
        grandTotal,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCartContext must be used within CartProvider");
  return context;
}
