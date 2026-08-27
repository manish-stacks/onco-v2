"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package, Truck, CheckCircle2, XCircle, Search, Loader2, MapPin, Clock,
  ChevronRight, LogIn, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderApi, ApiError, type PublicTrackResult } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { formatINR, cn, orderRef } from "@/lib/utils";
import type { Order } from "@/types";

const STATUS_TONE: Record<string, string> = {
  Completed: "bg-[var(--mint-50)] text-[var(--mint-600)]",
  Cancelled: "bg-[#FFEDEA] text-[var(--coral-500)]",
  "Delivery Failed": "bg-[#FFEDEA] text-[var(--coral-500)]",
};

function statusBadgeClass(status: string) {
  return STATUS_TONE[status] || "bg-[var(--blue-50)] text-[var(--blue-600)]";
}

export default function TrackPage() {
  const { isLoggedIn } = useAuth();

  const [orderRefInput, setOrderRefInput] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicTrackResult | null>(null);

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setRecentLoading(true);
    orderApi
      .list<Order[]>({ limit: 5 })
      .then((res) => setRecentOrders(res?.data ?? []))
      .catch(() => setRecentOrders([]))
      .finally(() => setRecentLoading(false));
  }, [isLoggedIn]);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    // if (!orderRefInput.trim() || phone.replace(/\D/g, "").length !== 10) {
    //   setError("Enter a valid Order ID / AWB and 10-digit mobile number.");
    //   return;
    // }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const data = await orderApi.trackPublic(orderRefInput.trim(), phone);
      if (!data) throw new ApiError("Order not found", 404);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not find this order. Check the details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        {/* <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <Truck size={26} />
        </span> */}
        <h1 className="font-display text-3xl font-bold text-[var(--ink)]">Track Your Order</h1>
        <p className="mt-2 text-[var(--ink-soft)]">Real-time updates on your medicine delivery</p>
      </div>

      {/* Logged-in: quick pick from recent orders */}
      {/* {isLoggedIn ? (
        recentOrders.length > 0 && (
          <div className="mb-8 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Your Recent Orders</p>
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <Link
                  key={o.order_id}
                  href={`/account/orders/${o.order_id}`}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm transition-colors hover:border-[var(--blue-500)]"
                >
                  <div className="flex items-center gap-3">
                    <Package size={16} className="text-[var(--blue-500)]" />
                    <div>
                      <p className="font-medium text-[var(--ink)]">{orderRef(o)}</p>
                      <p className="text-xs text-[var(--ink-soft)]">{new Date(o.order_date).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusBadgeClass(o.status))}>{o.status}</span>
                    <ChevronRight size={15} className="text-[var(--ink-soft)]" />
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/account/orders" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--blue-600)]">
              View all orders <ChevronRight size={12} />
            </Link>
          </div>
        )
      ) : (
        <div className="mb-8 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 p-4 text-sm">
          <p className="text-[var(--blue-700)]">Have an account? Login to see your full order history.</p>
          <Button href="/login?redirect=/account/orders" size="sm" variant="outline" icon={<LogIn size={14} />}>Login</Button>
        </div>
      )} */}

      {/* Guest / manual tracking */}
      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
        <p className="mb-1 font-semibold text-[var(--ink)]">Track without logging in</p>
        <p className="mb-4 text-xs text-[var(--ink-soft)]">
          Enter your Order ID (e.g. ORD/2026/036154) or AWB number.
        </p>

        {error && (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
            {error}
          </div>
        )}

        <form onSubmit={handleTrack} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={orderRefInput}
            onChange={(e) => setOrderRefInput(e.target.value)}
            placeholder="Order ID or AWB number"
            className="h-12 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none"
          />
          {/* <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile number"
            className="h-12 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none"
          /> */}
          <Button type="submit" size="lg" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {loading ? "Searching…" : "Track Order"}
          </Button>
        </form>
      </div>

      {/* Result */}
      {result && <TrackingResult data={result} />}
    </div>
  );
}

function TrackingResult({ data }: { data: PublicTrackResult }) {
  const isCancelled = data.status === "Cancelled" || data.status === "Delivery Failed";

  return (
    <div className="mt-8 space-y-6">
      {/* Header card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-5">
        <div className="flex items-center gap-3">
          <span className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            isCancelled ? "bg-[#FFEDEA] text-[var(--coral-500)]" : "bg-[var(--blue-50)] text-[var(--blue-500)]"
          )}>
            {isCancelled ? <XCircle size={20} /> : <Package size={20} />}
          </span>
          <div>
            <p className="font-semibold text-[var(--ink)]">Order {orderRef(data)}</p>
            <p className="text-xs text-[var(--ink-soft)]">Placed on {new Date(data.order_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", statusBadgeClass(data.status))}>{data.status}</span>
          <span className="font-mono-nums text-lg font-bold text-[var(--ink)]">{formatINR(data.amount)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Timeline */}
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <p className="mb-5 flex items-center gap-2 font-semibold text-[var(--ink)]">
            <Clock size={16} className="text-[var(--blue-500)]" /> Order Timeline
          </p>
          {data.history.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No status updates yet.</p>
          ) : (
            <ol className="space-y-0">
              {data.history.map((h, i) => {
                const isLast = i === data.history.length - 1;
                const failed = h.new_status === "Cancelled" || h.new_status === "Delivery Failed";
                return (
                  <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                    {!isLast && <span className="absolute left-[13px] top-7 h-full w-px bg-[var(--line)]" />}
                    <span className={cn(
                      "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      failed ? "bg-[var(--coral-500)] text-white" : isLast ? "bg-[var(--blue-500)] text-white" : "bg-[var(--mint-500)] text-white"
                    )}>
                      <CheckCircle2 size={14} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">{h.new_status}</p>
                      {h.note && <p className="text-xs text-[var(--ink-soft)]">{h.note}</p>}
                      <p className="text-xs text-[var(--ink-soft)]">
                        {new Date(h.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {data.awb_number && (
            <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--blue-50)]/30 p-4">
              <MapPin size={18} className="shrink-0 text-[var(--blue-500)]" />
              <div className="text-sm">
                <p className="font-medium text-[var(--ink)]">{data.courier_name || "Courier"} · AWB {data.awb_number}</p>
                {data.tracking_status && (
                  <p className="text-xs text-[var(--ink-soft)]">
                    {data.tracking_status}{data.tracking_location ? ` — ${data.tracking_location}` : ""}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="h-fit rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <p className="mb-4 font-semibold text-[var(--ink)]">Order Summary</p>
          <div className="mb-4 space-y-2 text-sm">
            {data.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-[var(--ink-soft)]">{it.product_name} × {it.unit_quantity}</span>
                <span className="font-mono-nums font-medium text-[var(--ink)]">{formatINR(it.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-[var(--line)] pt-3 text-sm">
            <div className="flex justify-between text-[var(--ink-soft)]">
              <span>Payment</span>
              <span className="font-medium text-[var(--ink)]">{data.payment_mode === "cod" ? "Cash on Delivery" : "Online"} · {data.payment_status}</span>
            </div>
            {(data.customer_city || data.customer_state) && (
              <div className="flex justify-between text-[var(--ink-soft)]">
                <span>Delivering to</span>
                <span className="font-medium text-[var(--ink)]">{[data.customer_city, data.customer_state].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
            <ShieldCheck size={13} /> Your order details are shown securely
          </div>
        </div>
      </div>
    </div>
  );
}