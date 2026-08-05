"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingBag, FileWarning, Tag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { medicines } from "@/lib/data";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, cartSubtotal } = useStore();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  const items = cart
    .map((i) => ({ item: i, medicine: medicines.find((m) => m.id === i.medicineId) }))
    .filter((x) => x.medicine);

  const needsRx = items.some((x) => x.medicine!.prescriptionRequired);
  const discount = applied ? Math.round(cartSubtotal * 0.1) : 0;
  const deliveryFee = cartSubtotal > 499 || cartSubtotal === 0 ? 0 : 49;
  const total = cartSubtotal - discount + deliveryFee;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <ShoppingBag size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your cart is empty</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">Looks like you haven&apos;t added any medicines yet. Explore our catalogue to get started.</p>
        <Button href="/category/health-essentials" icon={<ArrowRight size={16} />}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Your Cart</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {needsRx && (
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[#FCE1B8] bg-[#FFF8EC] p-4 text-sm text-[#8A5A0C]">
              <FileWarning size={18} className="mt-0.5 shrink-0" />
              <p>
                Your cart contains prescription medicines. You&apos;ll need to upload a valid prescription at checkout.{" "}
                <Link href="/prescription-upload" className="font-semibold underline">Upload now</Link>
              </p>
            </div>
          )}
          <AnimatePresence>
            {items.map(({ item, medicine }) => (
              <motion.div
                key={item.medicineId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4"
              >
                <Link href={`/medicines/${medicine!.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
                  <Image src={medicine!.image} alt={medicine!.name} fill className="object-cover" />
                </Link>
                <div className="flex-1">
                  <Link href={`/medicines/${medicine!.slug}`} className="font-semibold text-[var(--ink)] hover:underline">
                    {medicine!.name}
                  </Link>
                  <p className="mb-3 text-xs text-[var(--ink-soft)]">{medicine!.manufacturer} · {medicine!.packSize}</p>
                  <div className="flex items-center rounded-full border border-[var(--line)] w-fit">
                    <button onClick={() => updateQuantity(item.medicineId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center">
                      <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold font-mono-nums">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.medicineId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between">
                  <button onClick={() => removeFromCart(item.medicineId)} className="text-[var(--ink-soft)] hover:text-[var(--coral-500)]">
                    <Trash2 size={17} />
                  </button>
                  <p className="font-mono-nums font-bold text-[var(--ink)]">{formatINR(medicine!.price * item.quantity)}</p>
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
              onClick={() => setApplied(coupon || "FIRST25")}
              className="rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
          {applied && <p className="mb-4 text-xs font-medium text-[var(--mint-600)]">Coupon &quot;{applied}&quot; applied — 10% off</p>}

          <div className="space-y-2 border-t border-[var(--line)] pt-4 text-sm font-mono-nums">
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Subtotal</span>
              <span>{formatINR(cartSubtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[var(--mint-600)]">
                <span>Discount</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Delivery</span>
              <span>{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          <Button href="/checkout" size="lg" className="mt-6 w-full" icon={<ArrowRight size={16} />}>
            Proceed to Checkout
          </Button>
          <Button href="/category/health-essentials" variant="outline" size="md" className="mt-3 w-full">
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
