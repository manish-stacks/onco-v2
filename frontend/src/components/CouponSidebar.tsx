"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Tag, X, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";

export interface CouponOption {
  coupon_code: string;
  discount_type?: string;
  discount_percentage?: number;
  discount_amount?: number;
  max_discount_amount?: number;
  minimum_amount?: number;
}

interface CouponSidebarProps {
  open: boolean;
  onClose: () => void;
  couponInput: string;
  setCouponInput: (v: string) => void;
  onApply: (code?: string) => void;
  applying: boolean;
  appliedCode: string | null;
  onRemove: () => void;
  message: string | null;
  messageError: boolean;
  coupons: CouponOption[];
  couponsLoading: boolean;
}

/** Slide-in-from-the-right coupon panel, used on both /cart and /checkout so
 * "apply a coupon" feels the same everywhere instead of an inline dropdown. */
export function CouponSidebar({
  open, onClose, couponInput, setCouponInput, onApply, applying,
  appliedCode, onRemove, message, messageError, coupons, couponsLoading,
}: CouponSidebarProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] p-5">
              <p className="font-semibold text-[var(--ink)]">Apply Coupon</p>
              <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {appliedCode ? (
                <div className="flex h-11 items-center justify-between gap-2 rounded-full border border-[var(--mint-600)] bg-[var(--mint-600)]/5 px-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--mint-600)]">
                    <Tag size={15} /> {appliedCode} applied
                  </span>
                  <button type="button" onClick={onRemove} className="flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--coral-500)]">
                    <X size={14} /> Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="h-11 flex-1 rounded-full border border-[var(--line)] px-4 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onApply()}
                    disabled={applying || !couponInput.trim()}
                    className="rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {applying ? "Checking…" : "Apply"}
                  </button>
                </div>
              )}
              {message && (
                <p className={`mt-2 text-xs font-medium ${messageError ? "text-[var(--coral-500)]" : "text-[var(--mint-600)]"}`}>
                  {message}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Available coupons</p>
              {couponsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--ink-soft)]">
                  <Loader2 size={15} className="animate-spin" /> Loading coupons…
                </div>
              ) : coupons.length ? (
                <div className="space-y-2">
                  {coupons.map((c) => (
                    <div key={c.coupon_code} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] p-3">
                      <div>
                        <p className="font-mono text-sm font-bold text-[var(--ink)]">{c.coupon_code}</p>
                        <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                          {c.discount_type === "Percentage"
                            ? `${c.discount_percentage}% off${c.max_discount_amount ? `, up to ${formatINR(c.max_discount_amount)}` : ""}`
                            : `${formatINR(c.discount_amount || 0)} off`}
                          {c.minimum_amount ? ` on orders above ${formatINR(c.minimum_amount)}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onApply(c.coupon_code)}
                        disabled={applying}
                        className="shrink-0 rounded-full border border-[var(--blue-500)] px-4 py-1.5 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-50)] disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[var(--ink-soft)]">No coupons available right now.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
