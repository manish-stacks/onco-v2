"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingCart, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { wishlistApi } from "@/lib/api";

interface WishlistItem {
  product_id: number;
  product_name: string;
  slug: string;
  image_1: string;
  brand_name?: string;
  product_sp: number;
  product_mrp: number;
  stock?: string;
  stock_quantity?: number;
  presciption_required?: string;
}

export default function WishlistPage() {
  const { addToCart, toggleWishlist } = useStore();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await wishlistApi.list<WishlistItem[]>();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load wishlist:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleMoveToCart = async (item: WishlistItem) => {
    setBusyId(item.product_id);
    await addToCart(item.product_id);
    await toggleWishlist(item.product_id);
    setItems((prev) => prev.filter((i) => i.product_id !== item.product_id));
    setBusyId(null);
  };

  const handleRemove = async (item: WishlistItem) => {
    setBusyId(item.product_id);
    await toggleWishlist(item.product_id);
    setItems((prev) => prev.filter((i) => i.product_id !== item.product_id));
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <Loader2 size={28} className="animate-spin text-[var(--blue-500)]" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFEDEA] text-[var(--coral-500)]">
          <Heart size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your wishlist is empty</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">
          Save medicines you care about here so you can order them later.
        </p>
        <Button href="/category/health-essentials">Browse Medicines</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Your Wishlist</h1>
      <div className="space-y-4">
        <AnimatePresence>
          {items.map((m) => {
            const isBusy = busyId === m.product_id;
            const outOfStock = m.stock !== "In Stock" || (m.stock_quantity ?? 0) <= 0;

            return (
              <motion.div
                key={m.product_id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: isBusy ? 0.5 : 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 sm:flex-row sm:items-center"
              >
                <Link
                  href={`/medicines/${m.slug}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]"
                >
                  {m.image_1 ? (
                    <Image src={m.image_1} alt={m.product_name} fill className="object-cover" />
                  ) : null}
                </Link>

                <div className="flex-1">
                  <Link href={`/medicines/${m.slug}`} className="font-semibold text-[var(--ink)] hover:underline">
                    {m.product_name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
                    {m.brand_name && <span>{m.brand_name}</span>}
                    {m.presciption_required === "Yes" && (
                      <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 font-semibold uppercase text-[var(--blue-500)]">
                        Rx
                      </span>
                    )}
                    {outOfStock && <span className="font-semibold text-[var(--coral-500)]">Out of stock</span>}
                  </div>
                </div>

                <div className="flex items-baseline gap-2 font-mono-nums">
                  <span className="font-bold text-[var(--ink)]">{formatINR(m.product_sp)}</span>
                  {m.product_mrp > m.product_sp && (
                    <span className="text-xs text-[var(--ink-soft)] line-through">{formatINR(m.product_mrp)}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleMoveToCart(m)}
                    disabled={isBusy || outOfStock}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--blue-50)] px-4 py-2.5 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-500)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                    Move to Cart
                  </button>
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={isBusy}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--coral-500)] disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}