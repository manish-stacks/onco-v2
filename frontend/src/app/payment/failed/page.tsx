"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle, RotateCcw, LifeBuoy, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

// The `reason` the backend sends is not customer-facing (e.g.
// "verification_failed", "server_error") — we map them to a friendly message.
const REASON_MESSAGES: Record<string, string> = {
  payment_cancelled: "You cancelled the payment before it could complete.",
  verification_failed: "We couldn't verify your payment. If money was deducted, it will be refunded automatically.",
  order_not_found: "We couldn't find the order for this payment.",
  server_error: "Something went wrong on our end while processing your payment.",
  failed: "Your payment could not be completed.",
};

function Inner() {
  const params = useSearchParams();
  const orderId = params.get("order_id");
  const reason = params.get("reason");
  const message = (reason && REASON_MESSAGES[reason]) || REASON_MESSAGES.failed;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF1EE] text-[var(--coral-500)]">
        <XCircle size={36} />
      </span>
      <h1 className="mb-2 font-display text-3xl font-bold text-[var(--ink)]">Payment Failed</h1>
      <p className="mb-8 max-w-sm text-[var(--ink-soft)]">
        {message} Don&apos;t worry — no amount has been deducted, or it will be refunded automatically.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {orderId ? (
          // <Button href={`/account/orders/${orderId}`} icon={<RotateCcw size={16} />}>Retry Payment</Button>
          <Button href={`/checkout`} icon={<RotateCcw size={16} />}>Retry Payment</Button>
        ) : (
          <Button href="/account/orders" icon={<ShoppingBag size={16} />}>View My Orders</Button>
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
