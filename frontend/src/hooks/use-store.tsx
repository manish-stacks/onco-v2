"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cartApi, wishlistApi, ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types — backend cart response shape (flat array of cart line items)
// ---------------------------------------------------------------------------

export interface CartItem {
  cart_id: number;
  product_id: number;
  product_quantity: number;
  product_name: string;
  slug: string;
  image_1: string;
  sku?: string;
  product_sp: number;
  product_mrp: number;
  product_gst?: number;
  stock: string;
  stock_quantity: number;
  presciption_required: string; // "Yes" | "No"
  isCOD?: number;
  product_status?: string;
  line_subtotal: number;
  tax_amount?: number;
  line_total: number;
  in_stock: boolean;
  available_quantity: number;
}

interface StoreContextValue {
  cart: CartItem[];
  wishlist: (string | number)[];
  loadingCart: boolean;
  addToCart: (productId: string | number, quantity?: number) => Promise<void>;
  removeFromCart: (cartId: string | number) => Promise<void>;
  updateQuantity: (cartId: string | number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (productId: string | number) => Promise<void>;
  isWishlisted: (productId: string | number) => boolean;
  refreshCart: () => Promise<void>;
  cartCount: number;
  cartSubtotal: number;
  cartTax: number;
  cartTotal: number;
  needsPrescription: boolean;
  toast: string | null;
}

/**
 * Backend kabhi flat array bhejta hai, kabhi { items: [...] } ya
 * { cart: [...] } wrap karke. Jo bhi shape aaye, hamesha array nikaal do —
 * warna cart.reduce() crash karta hai.
 */
function normalizeCart(raw: unknown): CartItem[] {
  if (Array.isArray(raw)) return raw as CartItem[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["items", "cart", "cart_items", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as CartItem[];
    }
  }
  return [];
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<(string | number)[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const flashToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const flashError = useCallback(
    (error: unknown, fallback: string) => {
      const message = error instanceof ApiError ? error.message : fallback;
      flashToast(message);
    },
    [flashToast]
  );

  // -- Load cart + wishlist on mount ---------------------------------------

  const refreshCart = useCallback(async () => {
    try {
      const data = await cartApi.get<CartItem[]>();
      setCart(normalizeCart(data));
    } catch (error) {
      console.error("Failed to load cart:", error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingCart(true);
      try {
        const [cartData, wishlistData] = await Promise.all([
          cartApi.get<CartItem[]>().catch(() => null),
          wishlistApi.list<{ product_id: string | number }[]>().catch(() => null),
        ]);
        if (!mounted) return;
        setCart(normalizeCart(cartData));
        setWishlist((Array.isArray(wishlistData) ? wishlistData : []).map((w) => w.product_id));
      } finally {
        if (mounted) setLoadingCart(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // -- Cart actions ---------------------------------------------------------

  const addToCart = useCallback(
    async (productId: string | number, quantity = 1) => {
      try {
        const data = await cartApi.add<CartItem[]>(productId, quantity);
        setCart(normalizeCart(data));
        flashToast("Added to cart");
      } catch (error) {
        flashError(error, "Cart me add nahi ho paya");
      }
    },
    [flashToast, flashError]
  );

  const removeFromCart = useCallback(
    async (cartId: string | number) => {
      try {
        const data = await cartApi.remove<CartItem[]>(cartId);
        setCart(normalizeCart(data));
        flashToast("Removed from cart");
      } catch (error) {
        flashError(error, "Remove nahi ho paya");
      }
    },
    [flashToast, flashError]
  );

  const updateQuantity = useCallback(
    async (cartId: string | number, quantity: number) => {
      try {
        const data = await cartApi.updateQuantity<CartItem[]>(cartId, quantity);
        setCart(normalizeCart(data));
      } catch (error) {
        flashError(error, "Quantity update nahi ho paya");
      }
    },
    [flashError]
  );

  const clearCart = useCallback(async () => {
    try {
      await cartApi.clear();
      setCart([]);
    } catch (error) {
      flashError(error, "Cart clear nahi ho paya");
    }
  }, [flashError]);

  // -- Wishlist actions -------------------------------------------------------

  const toggleWishlist = useCallback(
    async (productId: string | number) => {
      // optimistic update
      const wasWishlisted = wishlist.includes(productId);
      setWishlist((prev) =>
        wasWishlisted ? prev.filter((id) => id !== productId) : [...prev, productId]
      );

      try {
        const res = await wishlistApi.toggle(productId);
        flashToast(res?.added ? "Added to wishlist" : "Removed from wishlist");
      } catch (error) {
        // revert on failure
        setWishlist((prev) =>
          wasWishlisted ? [...prev, productId] : prev.filter((id) => id !== productId)
        );
        flashError(error, "Wishlist update nahi ho paya");
      }
    },
    [wishlist, flashToast, flashError]
  );

  const isWishlisted = useCallback(
    (productId: string | number) => wishlist.includes(productId),
    [wishlist]
  );

  // -- Derived values ---------------------------------------------------------

  const safeCart = Array.isArray(cart) ? cart : [];

  const cartCount = useMemo(
    () => safeCart.reduce((sum, i) => sum + i.product_quantity, 0),
    [safeCart]
  );

  const cartSubtotal = useMemo(
    () => safeCart.reduce((sum, i) => sum + i.line_subtotal, 0),
    [safeCart]
  );

  const cartTax = useMemo(
    () => safeCart.reduce((sum, i) => sum + (i.tax_amount || 0), 0),
    [safeCart]
  );

  const cartTotal = useMemo(
    () => safeCart.reduce((sum, i) => sum + i.line_total, 0),
    [safeCart]
  );

  const needsPrescription = useMemo(
    () => safeCart.some((i) => i.presciption_required === "Yes"),
    [safeCart]
  );

  const value: StoreContextValue = {
    cart: safeCart,
    wishlist,
    loadingCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleWishlist,
    isWishlisted,
    refreshCart,
    cartCount,
    cartSubtotal,
    cartTax,
    cartTotal,
    needsPrescription,
    toast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}