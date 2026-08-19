"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cartApi, wishlistApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { medicineToGuestSnapshot } from "@/lib/adapters";
import {
  readGuestCart,
  guestCartAdd,
  guestCartSetQuantity,
  guestCartRemove,
  clearGuestCart,
  type GuestCartItem,
} from "@/lib/guest-cart";
import type { ApiCartItem, CartSummary, Medicine } from "@/types";

interface StoreContextValue {
  cartItems: ApiCartItem[];
  summary: CartSummary | null;
  cartLoading: boolean;
  /**
   * true = ye cart abhi local (login se pehle) hai. GST/shipping/coupon
   * calculate nahi hote — login/checkout ke baad server ka `/orders/quote`
   * asli numbers deta hai. Cart page pe isse "estimated" note dikhao.
   */
  isGuestCart: boolean;
  addToCart: (medicine: Medicine, quantity?: number) => Promise<void>;
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

function guestItemToApiCartItem(g: GuestCartItem): ApiCartItem {
  const price = Number(g.snapshot.product_sp) || 0;
  const lineTotal = price * g.quantity;
  return {
    cart_id: g.product_id,
    product_id: g.product_id,
    product_quantity: g.quantity,
    product_name: g.snapshot.product_name,
    slug: g.snapshot.slug,
    image_1: g.snapshot.image_1,
    sku: g.snapshot.sku,
    product_sp: price,
    product_mrp: Number(g.snapshot.product_mrp) || price,
    presciption_required: g.snapshot.presciption_required,
    stock_quantity: g.snapshot.stock_quantity,
    line_subtotal: lineTotal,
    tax_amount: 0,
    line_total: lineTotal,
    in_stock: g.snapshot.in_stock,
    available_quantity: g.snapshot.stock_quantity,
  };
}

function computeGuestSummary(items: GuestCartItem[]): CartSummary {
  const subtotal = items.reduce((s, i) => s + (Number(i.snapshot.product_sp) || 0) * i.quantity, 0);
  return {
    item_count: items.length,
    total_quantity: items.reduce((s, i) => s + i.quantity, 0),
    subtotal,
    gst: 0,
    total: subtotal,
    requires_prescription: items.some((i) => i.snapshot.presciption_required === "Yes"),
    cod_allowed: true,
    has_out_of_stock: items.some((i) => !i.snapshot.in_stock),
    out_of_stock_items: items.filter((i) => !i.snapshot.in_stock).map((i) => i.snapshot.product_name),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();

  // -- Server cart (logged in) ---------------------------------------------
  const [serverCartItems, setServerCartItems] = useState<ApiCartItem[]>([]);
  const [serverSummary, setServerSummary] = useState<CartSummary | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  // -- Guest cart (localStorage) --------------------------------------------
  // SSR pe hamesha [] se shuru — localStorage sirf client pe hai. Mount ke
  // baad ek effect me asli value load hoti hai (hydration mismatch se bachne
  // ke liye).
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>([]);
  useEffect(() => {
    setGuestItems(readGuestCart());
  }, []);

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!isLoggedIn) return;
    setCartLoading(true);
    try {
      const data = await cartApi.get<{ items: ApiCartItem[]; summary: CartSummary }>();
      setServerCartItems(data?.items ?? []);
      setServerSummary(data?.summary ?? null);
    } catch {
      setServerCartItems([]);
      setServerSummary(null);
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

  // Login transition pe guest cart ko server pe merge karo. Logout pe server
  // state clear kar do (guest cart alag localStorage me hi rehta hai, isse
  // touch nahi karte — agli baar login karega to wahi merge hoga).
  const prevLoggedIn = useRef(isLoggedIn);
  useEffect(() => {
    const wasLoggedIn = prevLoggedIn.current;
    prevLoggedIn.current = isLoggedIn;

    if (!wasLoggedIn && isLoggedIn) {
      const guest = readGuestCart();
      const merge = guest.length
        ? cartApi
            .merge(guest.map((g) => ({ product_id: g.product_id, quantity: g.quantity })))
            .then(() => {
              clearGuestCart();
              setGuestItems([]);
            })
            .catch(() => {
              // Merge fail ho to bhi login successful hai — guest cart
              // localStorage me pada rahega, agli baar retry ho jayega.
            })
        : Promise.resolve();

      merge.finally(() => {
        refreshCart();
        refreshWishlist();
      });
    } else if (wasLoggedIn && !isLoggedIn) {
      setServerCartItems([]);
      setServerSummary(null);
      setWishlistIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      refreshCart();
      refreshWishlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Cart actions ---------------------------------------------------------

  const addToCart = useCallback(
    async (medicine: Medicine, quantity = 1) => {
      if (isLoggedIn) {
        try {
          const data = await cartApi.add<{ items: ApiCartItem[]; summary: CartSummary }>(medicine.id, quantity);
          if (data) {
            setServerCartItems(data.items ?? []);
            setServerSummary(data.summary ?? null);
          } else {
            await refreshCart();
          }
          showToast("Added to cart");
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : "Could not add to cart");
        }
        return;
      }

      // Guest — local cart, koi login wall nahi
      const items = guestCartAdd(medicineToGuestSnapshot(medicine), quantity);
      setGuestItems(items);
      showToast("Added to cart");
    },
    [isLoggedIn, refreshCart, showToast]
  );

  const updateQuantity = useCallback(
    async (cartId: string | number, quantity: number) => {
      if (isLoggedIn) {
        try {
          const data = await cartApi.updateQuantity<{ items: ApiCartItem[]; summary: CartSummary }>(cartId, quantity);
          if (data) {
            setServerCartItems(data.items ?? []);
            setServerSummary(data.summary ?? null);
          } else {
            await refreshCart();
          }
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : "Could not update cart");
        }
        return;
      }

      setGuestItems(guestCartSetQuantity(cartId, quantity));
    },
    [isLoggedIn, refreshCart, showToast]
  );

  const removeFromCart = useCallback(
    async (cartId: string | number) => {
      if (isLoggedIn) {
        try {
          const data = await cartApi.remove<{ items: ApiCartItem[]; summary: CartSummary }>(cartId);
          if (data) {
            setServerCartItems(data.items ?? []);
            setServerSummary(data.summary ?? null);
          } else {
            await refreshCart();
          }
        } catch (err) {
          showToast(err instanceof ApiError ? err.message : "Could not remove item");
        }
        return;
      }

      setGuestItems(guestCartRemove(cartId));
    },
    [isLoggedIn, refreshCart, showToast]
  );

  const clearCart = useCallback(async () => {
    if (isLoggedIn) {
      try {
        await cartApi.clear();
      } catch {
        /* ignore */
      }
      setServerCartItems([]);
      setServerSummary(null);
      return;
    }
    clearGuestCart();
    setGuestItems([]);
  }, [isLoggedIn]);

  // -- Wishlist actions -------------------------------------------------------
  // Wishlist DB-backed hai aur "save for later" hai, guest merge ki zaroorat
  // utni critical nahi jitni cart ki — login abhi bhi required rakha hai.

  const toggleWishlist = useCallback(
    async (productId: string | number) => {
      if (!isLoggedIn) {
        showToast("Wishlist ke liye login karo");
        return;
      }
      const id = String(productId);
      try {
        const data = await wishlistApi.toggle(productId);
        setWishlistIds((prev) => (data?.added ? [...prev, id] : prev.filter((x) => x !== id)));
        showToast(data?.added ? "Added to wishlist" : "Removed from wishlist");
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Could not update wishlist");
      }
    },
    [isLoggedIn, showToast]
  );

  const isWishlisted = useCallback((productId: string | number) => wishlistIds.includes(String(productId)), [wishlistIds]);

  // -- Unified cart (server ya guest, jo bhi applicable ho) ------------------

  const cartItems = useMemo(
    () => (isLoggedIn ? serverCartItems : guestItems.map(guestItemToApiCartItem)),
    [isLoggedIn, serverCartItems, guestItems]
  );

  const summary = useMemo(
    () => (isLoggedIn ? serverSummary : computeGuestSummary(guestItems)),
    [isLoggedIn, serverSummary, guestItems]
  );

  const cartCount = summary?.total_quantity ?? 0;
  const cartSubtotal = summary?.subtotal ?? 0;

  const value = useMemo<StoreContextValue>(
    () => ({
      cartItems,
      summary,
      cartLoading,
      isGuestCart: !isLoggedIn,
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
      isLoggedIn,
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
