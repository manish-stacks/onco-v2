"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Truck,
  CreditCard,
  Wallet,
  Landmark,
  CheckCircle2,
  ChevronLeft,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { medicines } from "@/lib/data";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";

const STEPS = ["Address", "Delivery", "Payment", "Review"];
const SLOTS = ["Today, 6 PM – 9 PM", "Tomorrow, 9 AM – 12 PM", "Tomorrow, 2 PM – 5 PM"];
const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Wallet },
  { id: "cod", label: "Cash on Delivery", icon: Landmark },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartSubtotal, clearCart } = useStore();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState({ name: "", phone: "", line1: "", city: "", pincode: "" });
  const [slot, setSlot] = useState(SLOTS[0]);
  const [payment, setPayment] = useState("card");

  const items = cart
    .map((i) => ({ item: i, medicine: medicines.find((m) => m.id === i.medicineId) }))
    .filter((x) => x.medicine);
  const needsRx = items.some((x) => x.medicine!.prescriptionRequired);
  const total = cartSubtotal + (cartSubtotal > 499 ? 0 : 49);

  const addressValid = address.name && address.phone.length >= 10 && address.line1 && address.city && address.pincode.length === 6;

  function placeOrder() {
    clearCart();
    router.push("/checkout/success");
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-[var(--ink-soft)]">Your cart is empty. Add some products before checking out.</p>
        <Button href="/category/health-essentials" className="mt-6">Browse Medicines</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Checkout</h1>

      <div className="mb-10 flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                  i < step ? "bg-[var(--mint-500)] text-white" : i === step ? "bg-[var(--blue-500)] text-white" : "bg-black/5 text-[var(--ink-soft)]"
                )}
              >
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className="hidden text-xs font-medium text-[var(--ink-soft)] sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={cn("h-0.5 w-8 sm:w-16", i < step ? "bg-[var(--mint-500)]" : "bg-black/10")} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="mb-5 flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <MapPin size={17} className="text-[var(--blue-500)]" /> Delivery Address
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full Name" value={address.name} onChange={(v) => setAddress({ ...address, name: v })} />
                  <Field label="Phone Number" value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} />
                  <Field label="Address Line" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} className="sm:col-span-2" />
                  <Field label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} />
                  <Field label="Pincode" value={address.pincode} onChange={(v) => setAddress({ ...address, pincode: v })} />
                </div>
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="delivery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="mb-5 flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <Truck size={17} className="text-[var(--mint-500)]" /> Choose a Delivery Slot
                </p>
                <div className="space-y-3">
                  {SLOTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-5 py-4 text-left text-sm",
                        slot === s ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"
                      )}
                    >
                      {s}
                      {slot === s && <CheckCircle2 size={16} className="text-[var(--blue-500)]" />}
                    </button>
                  ))}
                </div>
                {needsRx && (
                  <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[#FCE1B8] bg-[#FFF8EC] p-4 text-sm text-[#8A5A0C]">
                    <FileWarning size={17} className="mt-0.5 shrink-0" />
                    Your order contains prescription items — our pharmacist may call to confirm before dispatch.
                  </div>
                )}
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="mb-5 flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <CreditCard size={17} className="text-[var(--coral-500)]" /> Payment Method
                </p>
                <div className="space-y-3">
                  {PAYMENT_METHODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPayment(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-5 py-4 text-left text-sm font-medium",
                        payment === p.id ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"
                      )}
                    >
                      <p.icon size={17} />
                      {p.label}
                      {payment === p.id && <CheckCircle2 size={16} className="ml-auto text-[var(--blue-500)]" />}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--ink-soft)]">This is a frontend demo — no real payment will be processed.</p>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="mb-5 font-semibold text-[var(--ink)]">Review Your Order</p>
                <div className="mb-5 space-y-3 text-sm">
                  <SummaryRow label="Deliver to" value={`${address.name}, ${address.line1}, ${address.city} - ${address.pincode}`} />
                  <SummaryRow label="Phone" value={address.phone} />
                  <SummaryRow label="Delivery slot" value={slot} />
                  <SummaryRow label="Payment method" value={PAYMENT_METHODS.find((p) => p.id === payment)?.label ?? ""} />
                </div>
                <div className="divide-y divide-[var(--line)] rounded-[var(--radius-sm)] border border-[var(--line)]">
                  {items.map(({ item, medicine }) => (
                    <div key={item.medicineId} className="flex justify-between px-4 py-3 text-sm">
                      <span>{medicine!.name} × {item.quantity}</span>
                      <span className="font-mono-nums">{formatINR(medicine!.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm font-medium text-[var(--ink-soft)]">
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button disabled={step === 0 && !addressValid} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : (
              <Button variant="mint" onClick={placeOrder}>
                Place Order
              </Button>
            )}
          </div>
        </div>

        <div className="h-fit rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <p className="mb-4 font-semibold text-[var(--ink)]">Order Summary</p>
          <div className="space-y-2 text-sm font-mono-nums">
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Subtotal</span>
              <span>{formatINR(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Delivery</span>
              <span>{cartSubtotal > 499 ? "Free" : formatINR(49)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none focus:border-[var(--blue-500)]"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-[var(--ink-soft)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{value}</span>
    </div>
  );
}
