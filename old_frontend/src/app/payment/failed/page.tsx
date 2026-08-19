"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, RotateCcw, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

function Inner() {
  const params = useSearchParams();
  const orderId = params.get("order_id");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF1EE] text-[var(--coral-500)]">
        <XCircle size={36} />
      </span>
      <h1 className="mb-2 font-display text-3xl font-bold text-[var(--ink)]">Payment Failed</h1>
      <p className="mb-8 max-w-sm text-[var(--ink-soft)]">
        Your payment couldn&apos;t be completed. Don&apos;t worry — no amount has been deducted, or it will be refunded automatically.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {orderId && (
          <Button href={`/account/orders/${orderId}`} icon={<RotateCcw size={16} />}>Retry Payment</Button>
        )}
        <Button href="/contact" variant="outline" icon={<LifeBuoy size={16} />}>Contact Support</Button>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
