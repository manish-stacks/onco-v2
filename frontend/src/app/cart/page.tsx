"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingBag, FileWarning, Tag, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaUrl, cartApi, ApiError } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";

export default function CartPage() {
  const { isLoggedIn } = useAuth();
  const { cartItems, summary, cartLoading, updateQuantity, removeFromCart, refreshCart } = useStore();
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setApplying(true);
    setCouponMsg(null);
    try {
      await cartApi.applyCoupon(coupon.trim());
      setCouponMsg(`Coupon "${coupon.trim()}" applied`);
      await refreshCart();
    } catch (err) {
      setCouponMsg(err instanceof ApiError ? err.message : "Could not apply coupon");
    } finally {
      setApplying(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <ShoppingBag size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Login to see your cart</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">Your cart is saved to your account, so sign in to view and manage it.</p>
        <Button href="/login" icon={<ArrowRight size={16} />}>Login</Button>
      </div>
    );
  }

  if (cartLoading && cartItems.length === 0) {
    return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-[var(--ink-soft)]">Loading your cart…</div>;
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <ShoppingBag size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your cart is empty</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">Looks like you haven&apos;t added any medicines yet. Explore our catalogue to get started.</p>
        <Button href="/search" icon={<ArrowRight size={16} />}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Your Cart</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {summary?.requires_prescription && (
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[#FCE1B8] bg-[#FFF8EC] p-4 text-sm text-[#8A5A0C]">
              <FileWarning size={18} className="mt-0.5 shrink-0" />
              <p>
                Your cart contains prescription medicines. You&apos;ll need to upload a valid prescription at checkout.{" "}
                <Link href="/prescription-upload" className="font-semibold underline">Upload now</Link>
              </p>
            </div>
          )}
          {summary?.has_out_of_stock && (
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[#FCC7BE] bg-[#FFF1EE] p-4 text-sm text-[var(--coral-500)]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>Some items in your cart don&apos;t have enough stock: {summary.out_of_stock_items?.join(", ")}. Please update quantities before checkout.</p>
            </div>
          )}
          <AnimatePresence>
            {cartItems.map((item) => (
              <motion.div
                key={item.cart_id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4"
              >
                <Link href={`/medicines/${item.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
                  <Image src={mediaUrl(item.image_1)} alt={item.product_name} fill className="object-cover" />
                </Link>
                <div className="flex-1">
                  <Link href={`/medicines/${item.slug}`} className="font-semibold text-[var(--ink)] hover:underline">
                    {item.product_name}
                  </Link>
                  {!item.in_stock && (
                    <p className="mt-1 text-xs font-medium text-[var(--coral-500)]">
                      Only {item.available_quantity ?? 0} available
                    </p>
                  )}
                  <div className="mt-3 flex items-center rounded-full border border-[var(--line)] w-fit">
                    <button onClick={() => updateQuantity(item.cart_id, item.product_quantity - 1)} className="flex h-8 w-8 items-center justify-center">
                      <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold font-mono-nums">{item.product_quantity}</span>
                    <button onClick={() => updateQuantity(item.cart_id, item.product_quantity + 1)} className="flex h-8 w-8 items-center justify-center">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between">
                  <button onClick={() => removeFromCart(item.cart_id)} className="text-[var(--ink-soft)] hover:text-[var(--coral-500)]">
                    <Trash2 size={17} />
                  </button>
                  <p className="font-mono-nums font-bold text-[var(--ink)]">{formatINR(item.line_total)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="h-fit rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <h2 className="mb-4 font-semibold text-[var(--ink)]">Order Summary</h2>

          <div className="mb-4 flex gap-2">
            <div className="flex h-11 flex-1 items-center gap-2 rounded-full border border-[var(--line)] px-4">
              <Tag size={15} className="text-[var(--ink-soft)]" />
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Coupon code"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              onClick={applyCoupon}
              disabled={applying}
              className="rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          {couponMsg && <p className="mb-4 text-xs font-medium text-[var(--mint-600)]">{couponMsg}</p>}

          <div className="space-y-2 border-t border-[var(--line)] pt-4 text-sm font-mono-nums">
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Subtotal</span>
              <span>{formatINR(summary?.subtotal ?? 0)}</span>
            </div>
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>GST</span>
              <span>{formatINR(summary?.gst ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]">
              <span>Total</span>
              <span>{formatINR(summary?.total ?? 0)}</span>
            </div>
            <p className="pt-1 text-xs text-[var(--ink-soft)]">Final shipping &amp; COD fee shown at checkout.</p>
          </div>

          <Button href="/checkout" size="lg" className="mt-6 w-full" icon={<ArrowRight size={16} />}>
            Proceed to Checkout
          </Button>
          <Button href="/search" variant="outline" size="md" className="mt-3 w-full">
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
