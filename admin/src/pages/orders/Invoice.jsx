import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, ChevronLeft, Receipt } from 'lucide-react';
import { useResource } from '@/hooks/useApi';
import { mediaUrl } from '@/lib/api';
import { inr, num, date } from '@/lib/format';
import { Button, PageLoader, EmptyState, cx } from '@/components/ui';

/**
 * /orders/:orderId/invoice
 *
 * Browser ka apna print-to-PDF use karta hai — koi PDF library nahi.
 * Ctrl+P ya "Print invoice" button se A4 pe saaf output aata hai
 * (print styles index.css me hain).
 */
export default function Invoice() {
  const { orderId } = useParams();
  const { data, loading } = useResource(`/admin/orders/${orderId}/invoice`);

  // page khulte hi title set — print pe filename isi se banta hai
  useEffect(() => {
    if (!data) return undefined;
    const prev = document.title;
    document.title = `Invoice ${data.invoice_number || orderId}`;
    return () => { document.title = prev; };
  }, [data, orderId]);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState icon={Receipt} title="Invoice nahi bana" description="Order shayad exist nahi karta." />;

  const { seller, buyer, items = [], totals = {}, payment = {} } = data;

  // GST ko HSN/rate wise group karo — accountant ko yahi chahiye
  const taxGroups = items.reduce((acc, it) => {
    const key = `${it.hsn_code || '—'}|${it.tax_percent || 0}`;
    if (!acc[key]) {
      acc[key] = { hsn: it.hsn_code || '—', rate: it.tax_percent || 0, taxable: 0, tax: 0 };
    }
    acc[key].taxable += Number(it.line_subtotal || 0);
    acc[key].tax += Number(it.tax_amount || 0);
    return acc;
  }, {});

  return (
    <>
      {/* Screen-only toolbar — print pe gayab */}
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <Link
          to={`/orders/${orderId}`}
          className="inline-flex items-center gap-1 text-2xs font-medium text-ink-500 hover:text-teal transition-colors"
        >
          <ChevronLeft size={13} /> Back to order
        </Link>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          Print invoice
        </Button>
      </div>

      <div className="print-sheet card max-w-4xl mx-auto p-8 sm:p-10 bg-white">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 pb-5 border-b-2 border-ink">
          <div className="min-w-0">
            {seller?.logo && (
              <img src={mediaUrl(seller.logo)} alt="" className="h-9 mb-2.5 object-contain" />
            )}
            <h1 className="text-base font-semibold text-ink leading-tight">
              {seller?.name || 'oncohealthmart'}
            </h1>
            {seller?.address && (
              <p className="text-2xs text-ink-500 leading-relaxed mt-1 max-w-xs whitespace-pre-line">
                {seller.address}
              </p>
            )}
            <p className="text-2xs text-ink-500 mt-1">
              {[seller?.phone, seller?.email].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-2xs font-semibold uppercase tracking-widest text-ink-500">Tax Invoice</p>
            <p className="font-mono text-sm font-semibold text-ink mt-1">{data.invoice_number}</p>
            <p className="text-2xs text-ink-500 mt-1.5 tabular-nums">{date(data.invoice_date)}</p>
          </div>
        </header>

        {/* Parties */}
        <section className="grid sm:grid-cols-2 gap-8 py-5 border-b border-line print-break">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Bill to</p>
            <p className="text-[0.8125rem] font-medium text-ink">{buyer?.name}</p>
            <p className="font-mono text-2xs text-ink-700 mt-0.5">{buyer?.phone}</p>
            {buyer?.email && <p className="text-2xs text-ink-500 mt-0.5">{buyer.email}</p>}
            <p className="text-2xs text-ink-700 leading-relaxed mt-1.5">{buyer?.billing_address}</p>
            <p className="text-2xs text-ink-700">
              {[buyer?.city, buyer?.state].filter(Boolean).join(', ')}
              {buyer?.pincode ? ` — ${buyer.pincode}` : ''}
            </p>
          </div>

          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Ship to</p>
            <p className="text-2xs text-ink-700 leading-relaxed">
              {buyer?.shipping_address || buyer?.billing_address}
            </p>
            <p className="text-2xs text-ink-700">
              {[buyer?.city, buyer?.state].filter(Boolean).join(', ')}
              {buyer?.pincode ? ` — ${buyer.pincode}` : ''}
            </p>

            <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-2 text-2xs">
              <div>
                <span className="text-ink-500">Payment</span>
                <p className="text-ink-700 uppercase font-medium">{payment.mode || '—'}</p>
              </div>
              <div>
                <span className="text-ink-500">Status</span>
                <p className={cx('font-medium',
                  payment.status === 'Paid' ? 'text-signal-ok' : 'text-signal-warn')}>
                  {payment.status}
                </p>
              </div>
              {payment.transaction && (
                <div className="col-span-2">
                  <span className="text-ink-500">Transaction</span>
                  <p className="font-mono text-ink-700 break-all">{payment.transaction}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Line items */}
        <table className="w-full text-2xs mt-5">
          <thead>
            <tr className="border-b border-ink-100">
              <th className="text-left font-semibold uppercase tracking-wider text-ink-500 pb-2 w-8">#</th>
              <th className="text-left font-semibold uppercase tracking-wider text-ink-500 pb-2">Item</th>
              <th className="text-right font-semibold uppercase tracking-wider text-ink-500 pb-2">Rate</th>
              <th className="text-right font-semibold uppercase tracking-wider text-ink-500 pb-2">Qty</th>
              <th className="text-right font-semibold uppercase tracking-wider text-ink-500 pb-2">Taxable</th>
              <th className="text-right font-semibold uppercase tracking-wider text-ink-500 pb-2">GST</th>
              <th className="text-right font-semibold uppercase tracking-wider text-ink-500 pb-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((it, i) => (
              <tr key={it.item_id} className="print-break">
                <td className="py-2 text-ink-500 tabular-nums align-top">{i + 1}</td>
                <td className="py-2 align-top pr-3">
                  <p className="text-ink leading-snug">{it.product_name}</p>
                  <p className="font-mono text-[0.625rem] text-ink-500 mt-0.5">
                    {[it.sku && `SKU ${it.sku}`, it.hsn_code && `HSN ${it.hsn_code}`]
                      .filter(Boolean).join('  ·  ')}
                  </p>
                </td>
                <td className="py-2 text-right tabular-nums text-ink-700 align-top">{inr(it.unit_price)}</td>
                <td className="py-2 text-right tabular-nums text-ink-700 align-top">{num(it.unit_quantity)}</td>
                <td className="py-2 text-right tabular-nums text-ink-700 align-top">{inr(it.line_subtotal)}</td>
                <td className="py-2 text-right tabular-nums text-ink-500 align-top">
                  {inr(it.tax_amount)}
                  {it.tax_percent > 0 && (
                    <span className="block text-[0.625rem]">@{it.tax_percent}%</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-ink align-top">{inr(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + tax summary */}
        <section className="flex flex-col sm:flex-row justify-between gap-8 mt-5 pt-4 border-t-2 border-ink print-break">
          <div className="sm:max-w-xs w-full">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Tax summary</p>
            <table className="w-full text-[0.625rem]">
              <thead>
                <tr className="text-ink-500">
                  <th className="text-left font-medium pb-1">HSN</th>
                  <th className="text-right font-medium pb-1">Rate</th>
                  <th className="text-right font-medium pb-1">Taxable</th>
                  <th className="text-right font-medium pb-1">Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {Object.values(taxGroups).map((g) => (
                  <tr key={`${g.hsn}-${g.rate}`}>
                    <td className="py-1 font-mono text-ink-700">{g.hsn}</td>
                    <td className="py-1 text-right tabular-nums text-ink-700">{g.rate}%</td>
                    <td className="py-1 text-right tabular-nums text-ink-700">{inr(g.taxable)}</td>
                    <td className="py-1 text-right tabular-nums text-ink">{inr(g.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="sm:w-64 w-full space-y-1.5 text-2xs">
            <TotalRow label="Subtotal" value={inr(totals.subtotal)} />
            <TotalRow label="GST" value={inr(totals.gst)} />
            {Number(totals.discount) > 0 && (
              <TotalRow label="Discount" value={`− ${inr(totals.discount)}`} tone="ok" />
            )}
            <TotalRow label="Shipping" value={Number(totals.shipping) ? inr(totals.shipping) : 'Free'} />
            {Number(totals.additional) > 0 && <TotalRow label="COD fee" value={inr(totals.additional)} />}
            <div className="pt-2 mt-1 border-t-2 border-ink">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[0.8125rem] font-semibold text-ink">Total</dt>
                <dd className="text-base font-semibold tabular-nums text-ink">{inr(totals.total)}</dd>
              </div>
            </div>
          </dl>
        </section>

        <footer className="mt-8 pt-4 border-t border-line text-[0.625rem] text-ink-500 leading-relaxed">
          <p>
            Ye computer-generated invoice hai, signature ki zaroorat nahi.
            Medicines wapas nahi hoti — kharab ya galat item mile to 48 ghante ke andar batayein.
          </p>
          {seller?.email && <p className="mt-1">Kisi bhi sawaal ke liye: {seller.email}</p>}
        </footer>
      </div>
    </>
  );
}

function TotalRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className={cx('tabular-nums', tone === 'ok' ? 'text-signal-ok' : 'text-ink-700')}>{value}</dd>
    </div>
  );
}
