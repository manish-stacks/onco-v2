import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartApi, wishlistApi } from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const EMPTY = {
  items: [],
  summary: {
    item_count: 0,
    total_quantity: 0,
    subtotal: 0,
    gst: 0,
    total: 0,
    requires_prescription: false,
    cod_allowed: true,
    has_out_of_stock: false,
    out_of_stock_items: [],
  },
};

export function CartProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState(null); // { code, discount }

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setCart(EMPTY);
      setWishlist([]);
      setCoupon(null);
      return;
    }
    setLoading(true);
    try {
      const data = await cartApi.get();
      setCart(data && data.items ? data : EMPTY);
    } catch {
      setCart(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  const refreshWishlist = useCallback(async () => {
    if (!isLoggedIn) {
      setWishlist([]);
      return;
    }
    try {
      setWishlist((await wishlistApi.list()) || []);
    } catch {
      setWishlist([]);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    refresh();
    refreshWishlist();
  }, [refresh, refreshWishlist]);

  const add = useCallback(async (productId, quantity = 1) => {
    const data = await cartApi.add(productId, quantity);
    if (data && data.items) setCart(data);
    return data;
  }, []);

  const updateQty = useCallback(async (cartId, quantity) => {
    const data = await cartApi.update(cartId, quantity);
    if (data && data.items) setCart(data);
    return data;
  }, []);

  const remove = useCallback(async (cartId) => {
    const data = await cartApi.remove(cartId);
    if (data && data.items) setCart(data);
    return data;
  }, []);

  const clear = useCallback(async () => {
    await cartApi.clear();
    setCart(EMPTY);
    setCoupon(null);
  }, []);

  const toggleWishlist = useCallback(
    async (productId) => {
      const res = await wishlistApi.toggle(productId);
      await refreshWishlist();
      return res;
    },
    [refreshWishlist]
  );

  const isWishlisted = useCallback(
    (productId) => wishlist.some((w) => String(w.product_id) === String(productId)),
    [wishlist]
  );

  const findLine = useCallback(
    (productId) => cart.items.find((i) => String(i.product_id) === String(productId)) || null,
    [cart.items]
  );

  const value = useMemo(
    () => ({
      cart,
      wishlist,
      loading,
      coupon,
      setCoupon,
      count: cart.summary?.total_quantity || 0,
      refresh,
      refreshWishlist,
      add,
      updateQty,
      remove,
      clear,
      toggleWishlist,
      isWishlisted,
      findLine,
    }),
    [
      cart,
      wishlist,
      loading,
      coupon,
      refresh,
      refreshWishlist,
      add,
      updateQty,
      remove,
      clear,
      toggleWishlist,
      isWishlisted,
      findLine,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
