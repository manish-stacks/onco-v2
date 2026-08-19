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
import { useRouter } from "next/navigation";
import { cartApi, wishlistApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import type { ApiCartItem, CartSummary } from "@/types";

interface StoreContextValue {
  cartItems: ApiCartItem[];
  summary: CartSummary | null;
  cartLoading: boolean;
  addToCart: (productId: string | number, quantity?: number) => Promise<void>;
  updateQuantity: (cartId: string | number, quantity: number) => Promise<void>;
  removeFromCart: (cartId: string | number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  cartCount: number;
  cartSubtotal: number;

  wishlistIds: string[];
  wishlistLoading: boolean;
  toggleWishlist: (productId: string | number) => Promise<void>;
  isWishlisted: (productId: string | number) => boolean;
  refreshWishlist: () => Promise<void>;

  toast: string | null;
  showToast: (message: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  const [cartItems, setCartItems] = useState<ApiCartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const requireLogin = useCallback(() => {
    showToast("Please login to continue");
    router.push("/login");
  }, [router, showToast]);

  const refreshCart = useCallback(async () => {
    if (!isLoggedIn) {
      setCartItems([]);
      setSummary(null);
      return;
    }
    setCartLoading(true);
    try {
      const data = await cartApi.get<{ items: ApiCartItem[]; summary: CartSummary }>();
      setCartItems(data?.items ?? []);
      setSummary(data?.summary ?? null);
    } catch {
      setCartItems([]);
      setSummary(null);
    } finally {
      setCartLoading(false);
    }
  }, [isLoggedIn]);

  const refreshWishlist = useCallback(async () => {
    if (!isLoggedIn) {
      setWishlistIds([]);
      return;
    }
    setWishlistLoading(true);
    try {
      const data = await wishlistApi.list<{ product_id: string | number }[]>();
      setWishlistIds((data ?? []).map((w) => String(w.product_id)));
    } catch {
      setWishlistIds([]);
    } finally {
      setWishlistLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    refreshCart();
    refreshWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const addToCart = useCallback(
    async (productId: string | number, quantity = 1) => {
      if (!isLoggedIn) return requireLogin();
      try {
        const data = await cartApi.add<{ items: ApiCartItem[]; summary: CartSummary }>(productId, quantity);
        if (data) {
          setCartItems(data.items ?? []);
          setSummary(data.summary ?? null);
        } else {
          await refreshCart();
        }
        showToast("Added to cart");
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Could not add to cart");
      }
    },
    [isLoggedIn, refreshCart, requireLogin, showToast]
  );

  const updateQuantity = useCallback(
    async (cartId: string | number, quantity: number) => {
      try {
        const data = await cartApi.updateQuantity<{ items: ApiCartItem[]; summary: CartSummary }>(cartId, quantity);
        if (data) {
          setCartItems(data.items ?? []);
          setSummary(data.summary ?? null);
        } else {
          await refreshCart();
        }
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Could not update cart");
      }
    },
    [refreshCart, showToast]
  );

  const removeFromCart = useCallback(
    async (cartId: string | number) => {
      try {
        const data = await cartApi.remove<{ items: ApiCartItem[]; summary: CartSummary }>(cartId);
        if (data) {
          setCartItems(data.items ?? []);
          setSummary(data.summary ?? null);
        } else {
          await refreshCart();
        }
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Could not remove item");
      }
    },
    [refreshCart, showToast]
  );

  const clearCart = useCallback(async () => {
    try {
      await cartApi.clear();
      setCartItems([]);
      setSummary(null);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleWishlist = useCallback(
    async (productId: string | number) => {
      if (!isLoggedIn) return requireLogin();
      const id = String(productId);
      try {
        const data = await wishlistApi.toggle(productId);
        setWishlistIds((prev) => (data?.added ? [...prev, id] : prev.filter((x) => x !== id)));
        showToast(data?.added ? "Added to wishlist" : "Removed from wishlist");
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Could not update wishlist");
      }
    },
    [isLoggedIn, requireLogin, showToast]
  );

  const isWishlisted = useCallback((productId: string | number) => wishlistIds.includes(String(productId)), [wishlistIds]);

  const cartCount = summary?.total_quantity ?? 0;
  const cartSubtotal = summary?.subtotal ?? 0;

  const value = useMemo<StoreContextValue>(
    () => ({
      cartItems,
      summary,
      cartLoading,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      refreshCart,
      cartCount,
      cartSubtotal,
      wishlistIds,
      wishlistLoading,
      toggleWishlist,
      isWishlisted,
      refreshWishlist,
      toast,
      showToast,
    }),
    [
      cartItems,
      summary,
      cartLoading,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      refreshCart,
      cartCount,
      cartSubtotal,
      wishlistIds,
      wishlistLoading,
      toggleWishlist,
      isWishlisted,
      refreshWishlist,
      toast,
      showToast,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
