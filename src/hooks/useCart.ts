import { useState, useMemo, useCallback } from "react";

export interface CartItem {
  base_id: number;
  base_name: string;
  brand_variant_id: number;
  brand_name: string | null;
  sub_model_id: number;
  sub_model_name: string;
  price: number;
  quantity: number;
  discount: number; // Per-item discount override (0 = use global)
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0); // Global discount percentage

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      // Key by sub_model_id since that uniquely identifies a variant
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

  // Change sub-model (switch brand/sub-model variant) for a cart item
  const changeSubModel = useCallback((subModelId: number, newItem: CartItem) => {
    setCart((prev) =>
      prev.map((c) =>
        c.sub_model_id === subModelId
          ? { ...newItem, quantity: c.quantity, discount: c.discount }
          : c
      )
    );
  }, []);

  // Update per-item discount override
  const updateDiscount = useCallback((subModelId: number, discount: number) => {
    if (discount < 0 || discount > 100) return;
    setCart((prev) =>
      prev.map((c) => (c.sub_model_id === subModelId ? { ...c, discount } : c))
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const clearGlobalDiscount = useCallback(() => setGlobalDiscount(0), []);

  // Calculate effective discount for a cart item
  const getEffectiveDiscount = useCallback((item: CartItem): number => {
    return item.discount > 0 ? item.discount : globalDiscount;
  }, [globalDiscount]);

  const grandTotal = useMemo(() => {
    return cart.reduce((sum, c) => {
      const effectiveDiscount = getEffectiveDiscount(c);
      const discountAmount = (c.price * effectiveDiscount) / 100;
      const finalPrice = c.price - discountAmount;
      return sum + finalPrice * c.quantity;
    }, 0);
  }, [cart, getEffectiveDiscount]);

  const totalItems = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  return {
    cart,
    globalDiscount,
    setGlobalDiscount,
    clearGlobalDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    changeSubModel,
    updateDiscount,
    getEffectiveDiscount,
    clearCart,
    grandTotal,
    totalItems,
  };
}
