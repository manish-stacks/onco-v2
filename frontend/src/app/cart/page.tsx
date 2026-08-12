"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  FileWarning,
  Tag,
  ArrowRight,
  Loader2,
  ChevronRight,
  BadgeCheck,
  Truck,
  Lock,
  Headphones,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { cartApi, ApiError, publicApi } from "@/lib/api";
import { readStoredCoupon, writeStoredCoupon } from "@/lib/coupon-storage";

type Settings = {
  organization?: string;
  shipping_charge?: number | string;
  shipping_threshold?: number | string;
  cod_fee?: number | string;
  is_cod?: number | string | boolean;
};

export default function CartPage() {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    cartSubtotal,
    cartTax,
    cartTotal,
    needsPrescription,
    loadingCart,
  } = useStore();

  const [settings, setSettings] = useState<Settings>({});
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<number | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await publicApi.settings();
        setSettings(data);
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    };
    fetchSettings();

    // if a coupon was applied earlier (this session or from checkout), restore it
    const stored = readStoredCoupon();
    if (stored) {
      setCoupon(stored.code);
      setApplied(stored.code);
      setCouponDiscount(stored.discount);
    }
  }, []);

  // live values from settings, with sane fallbacks if settings hasn't loaded yet
  const shippingThreshold = Number(settings.shipping_threshold) || 499;
  const shippingCharge = Number(settings.shipping_charge) || 49;

  const deliveryFee =
    cartSubtotal === 0 || cartSubtotal >= shippingThreshold ? 0 : shippingCharge;
  const grandTotal = cartTotal - couponDiscount + deliveryFee;

  const totalSavings = cart.reduce(
    (sum, item) =>
      sum + Math.max(item.product_mrp - item.product_sp, 0) * item.product_quantity,
    0
  );

  const handleApplyCoupon = async () => {
    if (!coupon.trim()) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await cartApi.applyCoupon<{ discount?: number }>(coupon.trim());
      const discount = res?.discount || 0;
      setApplied(coupon.trim());
      setCouponDiscount(discount);
      // so checkout picks this up automatically — no re-entering the code there
      writeStoredCoupon({ code: coupon.trim(), discount });
    } catch (error) {
      setCouponError(error instanceof ApiError ? error.message : "Coupon apply nahi hua");
      setApplied(null);
      setCouponDiscount(0);
      writeStoredCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon("");
    setApplied(null);
    setCouponDiscount(0);
    setCouponError(null);
    writeStoredCoupon(null);
  };

  const handleQuantityChange = async (cartId: number, quantity: number) => {
    setBusyRowId(cartId);
    await updateQuantity(cartId, quantity);
    setBusyRowId(null);
  };

  const handleRemove = async (cartId: number) => {
    setBusyRowId(cartId);
    await removeFromCart(cartId);
    setBusyRowId(null);
  };

  if (loadingCart) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <Loader2 size={28} className="animate-spin text-[var(--blue-500)]" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <ShoppingBag size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your cart is empty</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">
          Looks like you haven&apos;t added any medicines yet. Explore our catalogue to get started.
        </p>
        <Button href="/category/health-essentials" icon={<ArrowRight size={16} />}>
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* breadcrumb */}
      <nav className="mb-2 flex items-center gap-1.5 text-sm text-[var(--ink-soft)]">
        <Link href="/" className="hover:text-[var(--ink)]">
          Home
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-[var(--blue-500)]">Cart</span>
      </nav>

      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Your Cart</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {needsPrescription && (
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[#FCE1B8] bg-[#FFF8EC] p-4 text-sm text-[#8A5A0C]">
              <FileWarning size={18} className="mt-0.5 shrink-0" />
              <p>
                Your cart contains prescription medicines. You&apos;ll need to upload a valid prescription at
                checkout.{" "}
                <Link href="/prescription-upload" className="font-semibold underline">
                  Upload now
                </Link>
              </p>
            </div>
          )}

          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
            <AnimatePresence>
              {cart.map((item, idx) => {
                const isBusy = busyRowId === item.cart_id;
                const outOfStock = !item.in_stock;

                return (
                  <motion.div
                    key={item.cart_id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isBusy ? 0.5 : 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`flex gap-4 py-4 ${
                      idx !== 0 ? "border-t border-[var(--line)]" : ""
                    }`}
                  >
                    <Link
                      href={`/medicines/${item.slug}`}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]"
                    >
                      {item.image_1 ? (
                        <Image src={item.image_1} alt={item.product_name} fill className="object-cover" />
                      ) : null}
                    </Link>

                    <div className="flex-1">
                      <Link
                        href={`/medicines/${item.slug}`}
                        className="font-semibold text-[var(--ink)] hover:underline"
                      >
                        {item.product_name}
                      </Link>
                      <div className="mb-3 mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
                        {item.presciption_required === "Yes" && (
                          <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 font-semibold uppercase text-[var(--blue-500)]">
                            Rx
                          </span>
                        )}
                        {outOfStock ? (
                          <span className="font-semibold text-[var(--coral-500)]">Out of stock</span>
                        ) : (
                          <span>{item.available_quantity} available</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-full border border-[var(--line)] w-fit">
                          <button
                            onClick={() => handleQuantityChange(item.cart_id, item.product_quantity - 1)}
                            disabled={isBusy}
                            className="flex h-8 w-8 items-center justify-center disabled:opacity-40"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold font-mono-nums">
                            {item.product_quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.cart_id, item.product_quantity + 1)}
                            disabled={isBusy || item.product_quantity >= item.available_quantity}
                            className="flex h-8 w-8 items-center justify-center disabled:opacity-40"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        {isBusy && <Loader2 size={14} className="animate-spin text-[var(--ink-soft)]" />}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end justify-between">
                      <button
                        onClick={() => handleRemove(item.cart_id)}
                        disabled={isBusy}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--coral-500)] disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="text-right">
                        <p className="font-mono-nums font-bold text-[var(--ink)]">{formatINR(item.line_total)}</p>
                        {item.product_mrp > item.product_sp && (
                          <p className="font-mono-nums text-xs text-[var(--ink-soft)] line-through">
                            {formatINR(item.product_mrp * item.product_quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* trust bar */}
          <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--blue-50)]/40 p-6 sm:grid-cols-4">
            {[
              { icon: BadgeCheck, label: "100% Genuine Medicines" },
              { icon: Truck, label: `Free Delivery Above ${formatINR(shippingThreshold)}` },
              { icon: Lock, label: "Secure Payments" },
              { icon: Headphones, label: "24x7 Customer Support" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mint-600)]/10 text-[var(--mint-600)]">
                  <Icon size={18} />
                </span>
                <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
              </div>
            ))}
          </div>

          {/* why we need a prescription */}
          <div className="flex flex-col items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--blue-50)] bg-[var(--blue-50)]/30 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-500)] text-white">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="font-semibold text-[var(--ink)]">Why do we need a prescription?</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  Some medicines require a prescription to ensure they are safe and suitable for you.
                </p>
              </div>
            </div>
            <Button href="/prescription-info" variant="outline" size="sm" className="shrink-0">
              Learn more
            </Button>
          </div>
        </div>

        <div className="h-fit rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <h2 className="mb-4 font-semibold text-[var(--ink)]">Order Summary</h2>

          <div className="mb-1 flex gap-2">
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
              onClick={handleApplyCoupon}
              disabled={applyingCoupon || !coupon.trim()}
              className="rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {applyingCoupon ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
            </button>
          </div>
          {couponError && <p className="mb-4 text-xs font-medium text-[var(--coral-500)]">{couponError}</p>}
          {applied && !couponError && (
            <p className="mb-4 flex items-center justify-between text-xs font-medium text-[var(--mint-600)]">
              <span>
                Coupon &quot;{applied}&quot; applied — {formatINR(couponDiscount)} off
              </span>
              <button onClick={handleRemoveCoupon} className="font-semibold text-[var(--ink-soft)] hover:text-[var(--coral-500)]">
                Remove
              </button>
            </p>
          )}

          <div className="space-y-2 border-t border-[var(--line)] pt-4 text-sm font-mono-nums">
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Subtotal</span>
              <span>{formatINR(cartSubtotal)}</span>
            </div>
            {cartTax > 0 && (
              <div className="flex justify-between text-[var(--ink-soft)]">
                <span>GST</span>
                <span>{formatINR(cartTax)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-[var(--mint-600)]">
                <span>Discount</span>
                <span>-{formatINR(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Delivery</span>
              <span>{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]">
              <span>Total</span>
              <span>{formatINR(grandTotal)}</span>
            </div>
          </div>

          {totalSavings > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--mint-600)]/10 px-4 py-3 text-sm font-medium text-[var(--mint-600)]">
              <Sparkles size={15} />
              You&apos;re saving {formatINR(totalSavings)} on this order
            </div>
          )}

          <Button href="/checkout" size="lg" className="mt-6 w-full" icon={<ArrowRight size={16} />}>
            Proceed to Checkout
          </Button>
          <Button href="/category/health-essentials" variant="outline" size="md" className="mt-3 w-full">
            Continue Shopping
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--ink-soft)]">
            <Lock size={12} />
            SSL Secured &middot; 100% Safe Checkout
          </p>
        </div>
      </div>
    </div>
  );
}