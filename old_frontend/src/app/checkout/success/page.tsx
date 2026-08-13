"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Package, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  const orderId = `MC${Math.floor(100000 + Math.random() * 900000)}`;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--mint-50)] text-[var(--mint-500)]"
      >
        <CheckCircle2 size={36} />
      </motion.span>
      <h1 className="mb-2 font-display text-3xl font-bold text-[var(--ink)]">Order Placed!</h1>
      <p className="mb-1 text-[var(--ink-soft)]">Your order <span className="font-semibold text-[var(--ink)]">#{orderId}</span> has been confirmed.</p>
      <p className="mb-8 text-sm text-[var(--ink-soft)]">This is a frontend demo — no real order was created or charged.</p>
      <div className="flex gap-3">
        <Button href="/profile" variant="outline" icon={<Package size={16} />}>Track Order</Button>
        <Button href="/" icon={<Home size={16} />}>Back to Home</Button>
      </div>
    </div>
  );
}
