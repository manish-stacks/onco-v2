"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { orderApi, ApiError, mediaUrl } from "@/lib/api";
import { formatINR } from "@/lib/utils";

interface InvoiceItem { product_name?: string; unit_quantity?: number; quantity?: number; unit_price?: number; line_total?: number; }
interface Invoice {
  invoice_number: string;
  invoice_date: string;
  reference?: string;
  status?: string;
  seller?: { name?: string; address?: string; phone?: string; email?: string; logo?: string } | null;
  buyer?: { name?: string; phone?: string; email?: string; shipping_address?: string; city?: string; state?: string; pincode?: string };
  items?: InvoiceItem[];
  totals?: { subtotal?: number; gst?: number; discount?: number; shipping?: number; additional?: number; total?: number };
  payment?: { mode?: string; status?: string; transaction?: string };
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApi
      .invoice<Invoice>(id)
      .then((d) => setInv(d))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the invoice"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--blue-500)]" /></div>;
  }
  if (error || !inv) {
    return <div className="mx-auto max-w-2xl p-8 text-center text-[var(--ink-soft)]">{error || "Invoice not found."}</div>;
  }

  const t = inv.totals || {};
  const qtyOf = (it: InvoiceItem) => it.unit_quantity ?? it.quantity ?? 0;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      {/* Toolbar — hidden when printing */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full bg-[var(--blue-500)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--blue-600)]">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div className="flex items-center gap-3">
            {inv.seller?.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(inv.seller.logo)} alt="logo" className="h-12 w-auto object-contain" />
            )}
            <div>
              <p className="font-display text-lg font-bold text-[var(--ink)]">{inv.seller?.name || "OncoHealthMart"}</p>
              {inv.seller?.address && <p className="text-xs text-[var(--ink-soft)]">{inv.seller.address}</p>}
              <p className="text-xs text-[var(--ink-soft)]">{[inv.seller?.phone, inv.seller?.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-[var(--ink)]">INVOICE</p>
            <p className="text-sm font-semibold text-[var(--ink)]">{inv.invoice_number}</p>
            <p className="text-xs text-[var(--ink-soft)]">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : ""}</p>
            {inv.status && <p className="mt-1 text-xs text-[var(--ink-soft)]">Status: {inv.status}</p>}
          </div>
        </div>

        {/* Bill to */}
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase text-[var(--ink-soft)]">Bill to</p>
          <p className="text-sm font-semibold text-[var(--ink)]">{inv.buyer?.name}</p>
          {inv.buyer?.shipping_address && (
            <p className="text-sm text-[var(--ink-soft)]">
              {[inv.buyer.shipping_address, inv.buyer.city, inv.buyer.state, inv.buyer.pincode].filter(Boolean).join(", ")}
            </p>
          )}
          <p className="text-sm text-[var(--ink-soft)]">{[inv.buyer?.phone, inv.buyer?.email].filter(Boolean).join(" · ")}</p>
        </div>

        {/* Items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase text-[var(--ink-soft)]">
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((it, i) => (
              <tr key={i} className="border-b border-[var(--line)]">
                <td className="py-2 text-[var(--ink)]">{it.product_name}</td>
                <td className="py-2 text-center tabular-nums">{qtyOf(it)}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(it.unit_price ?? 0)}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(it.line_total ?? (it.unit_price ?? 0) * qtyOf(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <Row label="Subtotal" value={formatINR(t.subtotal ?? 0)} />
          {!!t.gst && <Row label="GST" value={formatINR(t.gst)} />}
          {!!t.discount && <Row label="Discount" value={`- ${formatINR(t.discount)}`} />}
          {!!t.shipping && <Row label="Shipping" value={formatINR(t.shipping)} />}
          {!!t.additional && <Row label="COD / other" value={formatINR(t.additional)} />}
          <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]">
            <span>Total</span><span className="tabular-nums">{formatINR(t.total ?? 0)}</span>
          </div>
        </div>

        {inv.payment && (
          <p className="mt-6 text-xs text-[var(--ink-soft)]">
            Payment: {inv.payment.mode === "cod" ? "Cash on Delivery" : "Online"} · {inv.payment.status}
            {inv.payment.transaction ? ` · Txn ${inv.payment.transaction}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[var(--ink-soft)]">
      <span>{label}</span><span className="tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}
