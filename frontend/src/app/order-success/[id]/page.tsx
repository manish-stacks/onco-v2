import Link from "next/link";
import { CheckCircle2, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--mint-50)] text-[var(--mint-500)]">
        <CheckCircle2 size={36} />
      </span>
      <h1 className="mb-2 font-display text-3xl font-bold text-[var(--ink)]">Order Placed!</h1>
      <p className="mb-1 text-[var(--ink-soft)]">Thank you for shopping with Onco Health Mart.</p>
      <p className="mb-8 font-mono-nums text-sm text-[var(--ink-soft)]">
        Order ID: <span className="font-semibold text-[var(--ink)]">#{id}</span>
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button href={`/account/orders/${id}`} icon={<Package size={16} />}>Track this order</Button>
        <Button href="/search" variant="outline" icon={<ArrowRight size={16} />}>Continue Shopping</Button>
      </div>
      <p className="mt-8 text-xs text-[var(--ink-soft)]">
        You can view all your orders anytime in{" "}
        <Link href="/account/orders" className="font-semibold text-[var(--blue-600)]">My Orders</Link>.
      </p>
    </div>
  );
}
