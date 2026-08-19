"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Loader2 } from "lucide-react";
import { orderApi } from "@/lib/api";
import { formatINR, cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import type { Order } from "@/types";

const STATUS_FILTERS = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

export default function OrdersListPage() {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

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
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold capitalize",
              status === s ? "bg-[var(--ink)] text-white" : "bg-black/[0.04] text-[var(--ink-soft)]"
            )}
          >
            {s}
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
            <Link
              key={o.order_id}
              href={`/account/orders/${o.order_id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-4 hover:border-[var(--blue-500)]"
            >
              <div>
                <p className="font-semibold text-[var(--ink)]">{o.invoice_number || `#${o.order_id}`}</p>
                <p className="text-xs text-[var(--ink-soft)]">{new Date(o.order_date).toLocaleDateString()}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  o.status?.toLowerCase() === "delivered" ? "bg-[var(--mint-50)] text-[var(--mint-600)]" : o.status?.toLowerCase() === "cancelled" ? "bg-[#FFEDEA] text-[var(--coral-500)]" : "bg-[var(--blue-50)] text-[var(--blue-600)]"
                )}
              >
                {o.status}
              </span>
              <p className="font-mono-nums font-semibold text-[var(--ink)]">{formatINR(o.amount)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
