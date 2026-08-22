"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Package, Truck, CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderApi, mediaUrl, ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { formatINR, cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import type { Order } from "@/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.push(`/login?redirect=/account/orders/${id}`);
  }, [authLoading, isLoggedIn, router, id]);

  useEffect(() => {
    if (!isLoggedIn || !id) return;
    setLoading(true);
    orderApi
      .detail<Order>(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [isLoggedIn, id]);

  async function handleCancel() {
    if (!order) return;
    const reason = window.prompt("Please tell us why you're cancelling this order:");
    if (!reason) return;
    setCancelling(true);
    setError(null);
    try {
      await orderApi.cancel(order.order_id, reason);
      const refreshed = await orderApi.detail<Order>(id);
      setOrder(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel order");
    } finally {
      setCancelling(false);
    }
  }

  async function handleRetryPayment() {
    if (!order) return;
    setError(null);
    setRetrying(true);
    try {
      const data = await orderApi.retryPayment(order.order_id);
      if (!data?.razorpay) {
        // The order was created via PayU — the backend currently supports retry
        // . Direct the customer to support.
        setError("To retry the payment for this order, please contact support.");
        return;
      }
      await openRazorpayCheckout({
        session: data.razorpay,
        description: `Order #${order.databaseOrderID || order.order_id}`,
        onSuccess: async (response) => {
          try {
            await orderApi.verifyPayment(response);
            const refreshed = await orderApi.detail<Order>(id);
            setOrder(refreshed);
          } catch {
            setError("The payment could not be verified. Please contact support.");
          }
        },
        onDismiss: () => setError("The payment was cancelled."),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retry payment");
    } finally {
      setRetrying(false);
    }
  }

  if (loading || authLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-[var(--ink-soft)]"><Loader2 className="animate-spin" /></div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <p className="mb-4 text-[var(--ink-soft)]">Order not found.</p>
        <Button href="/account/orders">Back to Orders</Button>
      </div>
    );
  }

  const CANCELLABLE = ["pending", "prescription pending", "new", "processing"];
  const canCancel = CANCELLABLE.includes(order.status?.toLowerCase());
  const paymentFailed = order.payment_status?.toLowerCase() === "failed" || order.payment_status?.toLowerCase() === "unpaid";
  const canRetryPayment = order.payment_mode === "online" && paymentFailed && order.status?.toLowerCase() !== "cancelled";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/account/orders" className="mb-6 flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <ArrowLeft size={15} /> Back to Orders
      </Link>

      {error && (
        <div className="mb-6 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">{error}</div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
        <div>
          <p className="font-display text-xl font-bold text-[var(--ink)]">{order.invoice_number || `Order #${order.order_id}`}</p>
          <p className="text-sm text-[var(--ink-soft)]">Placed on {new Date(order.order_date).toLocaleDateString()}</p>
        </div>
        <span className={cn("rounded-full px-4 py-1.5 text-sm font-semibold capitalize", order.status?.toLowerCase() === "completed" ? "bg-[var(--mint-50)] text-[var(--mint-600)]" : order.status?.toLowerCase() === "cancelled" || order.status?.toLowerCase() === "delivery failed" ? "bg-[#FFEDEA] text-[var(--coral-500)]" : "bg-[var(--blue-50)] text-[var(--blue-600)]")}>
          {order.status}
        </span>
      </div>

      {canRetryPayment && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[#FCC7BE] bg-[#FFF1EE] p-4 text-sm text-[var(--coral-500)]">
          <span>Payment for this order failed or is incomplete.</span>
          <Button size="sm" onClick={handleRetryPayment} disabled={retrying} icon={retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}>
            {retrying ? "Opening…" : "Retry Payment"}
          </Button>
        </div>
      )}

      {/* Tracking timeline */}
      {order.history && order.history.length > 0 && (
        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
            <Truck size={17} className="text-[var(--blue-500)]" /> Order Tracking
          </p>
          <div className="space-y-4">
            {order.history.map((h, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--mint-50)] text-[var(--mint-500)]">
                  <CheckCircle2 size={14} />
                </span>
                <div>
                  <p className="text-sm font-medium capitalize text-[var(--ink)]">{h.new_status}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{new Date(h.created_at).toLocaleString()}{h.note ? ` — ${h.note}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
          {order.awb_number && (
            <p className="mt-4 text-xs text-[var(--ink-soft)]">
              AWB: <span className="font-mono-nums font-semibold text-[var(--ink)]">{order.awb_number}</span>
              {order.courier_name ? ` · ${order.courier_name}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Items */}
      <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
        <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
          <Package size={17} className="text-[var(--blue-500)]" /> Items
        </p>
        <div className="space-y-3">
          {(order.items ?? []).map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
                <Image src={mediaUrl(item.product_image)} alt={item.product_name} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-[var(--ink)]">{item.product_name}</p>
                <p className="text-xs text-[var(--ink-soft)]">Qty {item.unit_quantity} × {formatINR(item.unit_price)}</p>
              </div>
              <p className="font-mono-nums font-semibold">{formatINR(item.line_total)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-4 text-sm font-mono-nums">
          <div className="flex justify-between text-[var(--ink-soft)]"><span>Subtotal</span><span>{formatINR(order.subtotal ?? 0)}</span></div>
          <div className="flex justify-between text-[var(--ink-soft)]"><span>GST</span><span>{formatINR(order.order_gst ?? 0)}</span></div>
          {!!order.shipping_charge && <div className="flex justify-between text-[var(--ink-soft)]"><span>Shipping</span><span>{formatINR(order.shipping_charge)}</span></div>}
          <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]"><span>Total</span><span>{formatINR(order.amount)}</span></div>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
        <p className="mb-2 font-semibold text-[var(--ink)]">Delivery Address</p>
        <p className="text-sm text-[var(--ink-soft)]">
          {order.customer_name} · {order.customer_phone}<br />
          {order.customer_address}, {order.customer_city}, {order.customer_state} - {order.customer_pincode}
        </p>
      </div>

      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-[var(--coral-500)] disabled:opacity-50"
        >
          <XCircle size={15} /> {cancelling ? "Cancelling…" : "Cancel Order"}
        </button>
      )}
    </div>
  );
}
