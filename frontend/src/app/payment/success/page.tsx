"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

function Inner() {
  const params = useSearchParams();
  const orderId = params.get("order_id");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--mint-50)] text-[var(--mint-500)]">
        <CheckCircle2 size={36} />
      </span>
      <h1 className="mb-2 font-display text-3xl font-bold text-[var(--ink)]">Payment Successful!</h1>
      <p className="mb-8 text-[var(--ink-soft)]">Your payment has been confirmed and your order is being processed.</p>
      <Button href={orderId ? `/order-success/${orderId}` : "/account/orders"} icon={<Package size={16} />}>
        View Order
      </Button>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
