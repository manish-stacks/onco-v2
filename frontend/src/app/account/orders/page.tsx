"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Loader2, FileText, RotateCcw, Truck } from "lucide-react";
import { orderApi, ApiError } from "@/lib/api";
import { formatINR, cn, orderRef } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import type { Order } from "@/types";

// The backend's real order.status values — there is no "delivered",
// "Completed" is the final state. The wrong filter = always 0 results.
const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "Pending" },
  { label: "Processing", value: "Processing" },
  { label: "Shipped", value: "Shipped" },
  { label: "Completed", value: "Completed" },
  { label: "Cancelled", value: "Cancelled" },
];

export default function OrdersListPage() {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [reorderBusy, setReorderBusy] = useState<string | number | null>(null);

  async function handleReorder(e: React.MouseEvent, id: string | number) {
    e.preventDefault();
    e.stopPropagation();
    setReorderBusy(id);
    try {
      // 1) Preview current stock so we can warn before touching the cart.
      const preview = await orderApi.reorder<{ items: { name: string; available: boolean; reason?: string }[]; any_out_of_stock: boolean; all_out_of_stock: boolean }>(id, false);
      if (preview.all_out_of_stock) {
        alert("None of the items in this order are in stock right now.");
        return;
      }
      if (preview.any_out_of_stock) {
        const oos = preview.items.filter((i) => !i.available).map((i) => `• ${i.name}${i.reason ? ` — ${i.reason}` : ""}`).join("\n");
        const proceed = window.confirm(`Some items are out of stock and will be skipped:\n\n${oos}\n\nAdd the available items to your cart?`);
        if (!proceed) return;
      }
      // 2) Confirmed — add the in-stock items and go to the cart.
      const res = await orderApi.reorder<{ added_count: number }>(id, true);
      if (res.added_count > 0) router.push("/cart");
      else alert("None of these items are in stock right now.");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not reorder this order.");
    } finally {
      setReorderBusy(null);
    }
  }

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.push("/login?redirect=/account/orders");
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    orderApi
      .list<Order[]>({ limit: 30, status: status === "all" ? undefined : status })
      .then((res) => setOrders(res?.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn, status]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-3xl font-bold text-[var(--ink)]">My Orders</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold",
              status === f.value ? "bg-[var(--ink)] text-white" : "bg-black/[0.04] text-[var(--ink-soft)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading || authLoading ? (
        <div className="flex justify-center py-16 text-[var(--ink-soft)]"><Loader2 className="animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] py-16 text-center">
          <Package size={28} className="mb-3 text-[var(--ink-soft)]" />
          <p className="text-[var(--ink-soft)]">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.order_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-4 hover:border-[var(--blue-500)]"
            >
              <Link href={`/account/orders/${o.order_id}`} className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--ink)]">{orderRef(o)}</p>
                <p className="text-xs text-[var(--ink-soft)]">{new Date(o.order_date).toLocaleDateString()}</p>
              </Link>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  o.status?.toLowerCase() === "completed" ? "bg-[var(--mint-50)] text-[var(--mint-600)]" : o.status?.toLowerCase() === "cancelled" || o.status?.toLowerCase() === "delivery failed" ? "bg-[#FFEDEA] text-[var(--coral-500)]" : "bg-[var(--blue-50)] text-[var(--blue-600)]"
                )}
              >
                {o.status}
              </span>
              <p className="font-mono-nums font-semibold text-[var(--ink)]">{formatINR(o.amount)}</p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/account/orders/${o.order_id}#tracking`}
                  className="flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                >
                  <Truck size={13} /> Track
                </Link>
                <Link
                  href={`/account/orders/${o.order_id}/invoice`}
                  className="flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                >
                  <FileText size={13} /> Invoice
                </Link>
                <button
                  type="button"
                  onClick={(e) => handleReorder(e, o.order_id)}
                  disabled={reorderBusy === o.order_id}
                  className="flex items-center gap-1 rounded-full bg-[var(--blue-500)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--blue-600)] disabled:opacity-50"
                >
                  {reorderBusy === o.order_id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reorder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
