"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { medicines } from "@/lib/data";
import type { CartItem } from "@/types";

interface StoreContextValue {
  cart: CartItem[];
  wishlist: string[];
  addToCart: (medicineId: string, quantity?: number) => void;
  removeFromCart: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (medicineId: string) => void;
  isWishlisted: (medicineId: string) => boolean;
  cartCount: number;
  cartSubtotal: number;
  toast: string | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const flashToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const addToCart = useCallback(
    (medicineId: string, quantity = 1) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.medicineId === medicineId);
        if (existing) {
          return prev.map((i) =>
            i.medicineId === medicineId
              ? { ...i, quantity: i.quantity + quantity }
              : i
          );
        }
        return [...prev, { medicineId, quantity }];
      });
      flashToast("Added to cart");
    },
    [flashToast]
  );

  const removeFromCart = useCallback((medicineId: string) => {
    setCart((prev) => prev.filter((i) => i.medicineId !== medicineId));
  }, []);

  const updateQuantity = useCallback((medicineId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.medicineId !== medicineId)
        : prev.map((i) => (i.medicineId === medicineId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback(
    (medicineId: string) => {
      setWishlist((prev) => {
        const exists = prev.includes(medicineId);
        flashToast(exists ? "Removed from wishlist" : "Added to wishlist");
        return exists ? prev.filter((id) => id !== medicineId) : [...prev, medicineId];
      });
    },
    [flashToast]
  );

  const isWishlisted = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  const cartCount = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const med = medicines.find((m) => m.id === i.medicineId);
        return sum + (med ? med.price * i.quantity : 0);
      }, 0),
    [cart]
  );

  const value: StoreContextValue = {
    cart,
    wishlist,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleWishlist,
    isWishlisted,
    cartCount,
    cartSubtotal,
    toast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
