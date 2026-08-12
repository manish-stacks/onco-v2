import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Truck, XCircle, CreditCard, Receipt, User, MapPin, Pill, Clock, PackageCheck, Printer,
} from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P, PAYMENT_STATUSES, toneOf, TONE_HEX } from '@/lib/constants';
import { inr, num, dateTime, date } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, SourceTag, Code, Field, Input, Select, Textarea,
  PageLoader, EmptyState, cx,
} from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import ShippingPanel from './ShippingPanel';

export default function OrderDetail() {
  const { orderId } = useParams();
  const { can } = useAuth();
  const { data: order, loading, reload } = useResource(`/admin/orders/${orderId}`);

  const [statusOpen, setStatusOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const cancel = useMutation(
    (reason) => api.post(`/admin/orders/${orderId}/cancel`, { reason }),
    { success: 'Order cancel ho gaya', onSuccess: () => { setCancelOpen(false); reload(); } }
  );

  if (loading && !order) return <PageLoader />;
  if (!order) return <EmptyState icon={Receipt} title="Order nahi mila" />;

  const canManage = can(P.ORDERS_MANAGE);
  const canCancel = can(P.ORDERS_CANCEL) && order.allowed_next_statuses?.length > 0;

  return (
    <>
      <PageHeader
        back="/orders"
        backLabel="Orders"
        title={
          <span className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono">{order.databaseOrderID || `#${order.order_id}`}</span>
            <StatusPill status={order.status} />
            <SourceTag source={order.orderFrom} />
          </span>
        }
        subtitle={`${dateTime(order.order_date)} · ${order.items?.length || 0} items`}
        actions={
          <>
            <Button icon={Printer} onClick={() => window.open(`/orders/${orderId}/invoice`, '_blank')}>
              Invoice
            </Button>
            {canManage && order.allowed_next_statuses?.length > 0 && (
              <Button variant="primary" icon={PackageCheck} onClick={() => setStatusOpen(true)}>
                Move status
              </Button>
            )}
            {canManage && (
              <>
                <Button icon={CreditCard} onClick={() => setPayOpen(true)}>Payment</Button>
              </>
            )}
            {canCancel && (
              <Button variant="dangerGhost" icon={XCircle} onClick={() => setCancelOpen(true)}>Cancel</Button>
            )}
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Items" dense>
            <ItemsTable order={order} />
          </Card>

          <Card title="Timeline" subtitle="Har status change record hota hai" dense>
            <Timeline history={order.history} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Customer" dense>
            <CustomerBlock order={order} />
          </Card>

          <Card title="Delivery address" dense>
            <AddressBlock order={order} />
          </Card>

          <ShippingPanel order={order} onChanged={reload} />

          {order.prescription && <PrescriptionBlock presc={order.prescription} />}

          <Card title="Payment" dense>
            <PaymentBlock order={order} />
          </Card>
        </div>
      </div>

      <StatusModal
        open={statusOpen} onClose={() => setStatusOpen(false)}
        order={order} onDone={reload}
      />
      <PaymentModal
        open={payOpen} onClose={() => setPayOpen(false)}
        order={order} onDone={reload}
      />
      <CancelModal
        open={cancelOpen} onClose={() => setCancelOpen(false)}
        order={order} onConfirm={cancel.run} loading={cancel.loading}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
function ItemsTable({ order }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper">
              {['Product', 'Price', 'Qty', 'Tax', 'Total'].map((h, i) => (
                <th key={h} className={cx(
                  'text-2xs font-semibold uppercase tracking-wider text-ink-500 px-3 py-2',
                  i === 0 ? 'text-left' : 'text-right'
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(order.items || []).map((it) => (
              <tr key={it.item_id}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {it.product_image && (
                      <img
                        src={mediaUrl(it.product_image)} alt=""
                        className="w-9 h-9 rounded object-cover border border-line shrink-0 bg-paper-sunk"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] text-ink leading-snug">{it.product_name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        {it.sku && <Code className="text-2xs">{it.sku}</Code>}
                        {it.hsn_code && <span className="code-chip">HSN {it.hsn_code}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{inr(it.unit_price)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{num(it.unit_quantity)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-2xs text-ink-500">
                  {inr(it.tax_amount)}
                  {it.tax_percent > 0 && <span className="block">@{it.tax_percent}%</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">{inr(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line px-4 py-3 bg-paper">
        <dl className="ml-auto max-w-xs space-y-1.5 text-[0.8125rem]">
          <Row label="Subtotal" value={inr(order.subtotal)} />
          <Row label="GST" value={inr(order.order_gst)} />
          {Number(order.coupon_discount) > 0 && (
            <Row
              label={<>Discount {order.coupon_code && <Code className="text-2xs ml-1">{order.coupon_code}</Code>}</>}
              value={`− ${inr(order.coupon_discount)}`}
              tone="ok"
            />
          )}
          <Row label="Shipping" value={Number(order.shipping_charge) ? inr(order.shipping_charge) : 'Free'} />
          {Number(order.additional_charge) > 0 && <Row label="COD fee" value={inr(order.additional_charge)} />}
          <div className="pt-1.5 border-t border-line">
            <Row label="Total" value={inr(order.amount)} bold />
          </div>
          {Number(order.refund_amount) > 0 && (
            <Row label="Refunded" value={`− ${inr(order.refund_amount)}`} tone="danger" />
          )}
        </dl>
      </div>
    </>
  );
}

function Row({ label, value, bold, tone }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={cx('text-ink-500', bold && 'font-semibold text-ink')}>{label}</dt>
      <dd className={cx(
        'tabular-nums',
        bold ? 'text-base font-semibold text-ink' : 'text-ink-700',
        tone === 'ok' && 'text-signal-ok',
        tone === 'danger' && 'text-signal-danger'
      )}>
        {value}
      </dd>
    </div>
  );
}

function Timeline({ history = [] }) {
  if (!history.length) return <EmptyState icon={Clock} title="Koi history nahi" />;

  return (
    <ol className="p-4 space-y-0">
      {history.map((h, i) => (
        <li key={h.log_id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < history.length - 1 && (
            <span className="absolute left-[5px] top-3.5 bottom-0 w-px bg-line" aria-hidden />
          )}
          <span
            className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 ring-4 ring-paper-card"
            style={{ background: TONE_HEX[toneOf(h.new_status)] }}
          />
          <div className="min-w-0 flex-1 -mt-0.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <p className="text-[0.8125rem] font-medium text-ink">
                {h.old_status ? <>{h.old_status} → {h.new_status}</> : h.new_status}
              </p>
              <time className="text-2xs text-ink-500 tabular-nums">{dateTime(h.created_at)}</time>
            </div>
            {h.note && <p className="text-2xs text-ink-500 mt-0.5 leading-relaxed">{h.note}</p>}
            <Code className="text-2xs">{h.changed_by}</Code>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CustomerBlock({ order }) {
  return (
    <div className="p-4 space-y-2.5 text-[0.8125rem]">
      <div className="flex items-start gap-2.5">
        <User size={14} className="text-ink-300 mt-0.5 shrink-0" />
        <div className="min-w-0">
          {order.customer_id ? (
            <Link to={`/customers/${order.customer_id}`} className="font-medium text-ink hover:text-teal transition-colors">
              {order.customer_name}
            </Link>
          ) : <p className="font-medium text-ink">{order.customer_name}</p>}
          <Code className="block mt-0.5">{order.customer_phone}</Code>
          {order.customer_email && <p className="text-2xs text-ink-500 mt-0.5 break-all">{order.customer_email}</p>}
        </div>
      </div>

      {(order.patient_name || order.doctor_name || order.hospital_name) && (
        <div className="pt-2.5 border-t border-line space-y-1">
          {order.patient_name && <Meta label="Patient" value={order.patient_name} />}
          {order.doctor_name && <Meta label="Doctor" value={order.doctor_name} />}
          {order.hospital_name && <Meta label="Hospital" value={order.hospital_name} />}
        </div>
      )}

      {order.comment && (
        <div className="pt-2.5 border-t border-line">
          <p className="label mb-1">Customer note</p>
          <p className="text-2xs text-ink-700 leading-relaxed">{order.comment}</p>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="flex gap-2 text-2xs">
      <span className="text-ink-500 w-16 shrink-0">{label}</span>
      <span className="text-ink-700 min-w-0">{value}</span>
    </div>
  );
}

function AddressBlock({ order }) {
  return (
    <div className="p-4 text-[0.8125rem]">
      <div className="flex items-start gap-2.5">
        <MapPin size={14} className="text-ink-300 mt-0.5 shrink-0" />
        <div className="min-w-0 leading-relaxed">
          <p className="font-medium text-ink">{order.customer_shipping_name}</p>
          <Code className="block my-0.5">{order.customer_shipping_phone}</Code>
          <p className="text-ink-700">{order.customer_shipping_address}</p>
          <p className="text-ink-700">
            {[order.customer_shipping_city, order.customer_shipping_state].filter(Boolean).join(', ')}
          </p>
          {order.customer_shipping_pincode && (
            <Code className="block mt-0.5">{order.customer_shipping_pincode}</Code>
          )}
        </div>
      </div>

      {order.awb_number && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="label mb-1.5">Courier</p>
          <div className="flex items-center gap-2">
            <Truck size={13} className="text-ink-300" />
            <Code>{order.awb_number}</Code>
          </div>
          <p className="text-2xs text-ink-500 mt-1">
            {order.courier_name}
            {order.tracking_status && ` · ${order.tracking_status}`}
          </p>
        </div>
      )}
    </div>
  );
}

function PrescriptionBlock({ presc }) {
  const images = Array.isArray(presc.images) ? presc.images : [];
  return (
    <Card
      title="Prescription"
      action={<StatusPill status={presc.status} size="xs" />}
      dense
    >
      <div className="p-4">
        <Link to={`/prescriptions/${presc.prescription_id}`} className="inline-flex items-center gap-1.5 mb-2.5">
          <Pill size={13} className="text-ink-300" />
          <Code className="hover:text-teal transition-colors">{presc.reference_code}</Code>
        </Link>
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {images.slice(0, 6).map((img) => (
              <a key={img} href={mediaUrl(img)} target="_blank" rel="noreferrer"
                className="aspect-square rounded border border-line overflow-hidden bg-paper-sunk hover:border-teal transition-colors">
                <img src={mediaUrl(img)} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PaymentBlock({ order }) {
  return (
    <div className="p-4 space-y-2 text-[0.8125rem]">
      <div className="flex items-center justify-between">
        <span className="text-ink-500">Status</span>
        <StatusPill status={order.payment_status} size="xs" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-ink-500">Mode</span>
        <span className="text-ink-700 uppercase text-2xs font-semibold">{order.payment_mode || '—'}</span>
      </div>
      {order.transaction_number && (
        <div className="pt-2 border-t border-line">
          <p className="label mb-1">Transaction</p>
          <Code className="break-all text-2xs">{order.transaction_number}</Code>
        </div>
      )}
      {order.razorpayOrderID && (
        <div>
          <p className="label mb-1">Razorpay order</p>
          <Code className="break-all text-2xs">{order.razorpayOrderID}</Code>
        </div>
      )}
      {order.refund_reference && (
        <div>
          <p className="label mb-1">Refund ref</p>
          <Code className="break-all text-2xs">{order.refund_reference}</Code>
        </div>
      )}
      {order.invoice_number && (
        <div className="pt-2 border-t border-line">
          <p className="label mb-1">Invoice</p>
          <Code className="text-2xs">{order.invoice_number}</Code>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------
function StatusModal({ open, onClose, order, onDone }) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');

  const save = useMutation(
    () => api.patch(`/admin/orders/${order.order_id}/status`, { status, note }),
    { success: 'Status update ho gaya', onSuccess: () => { onClose(); onDone(); setStatus(''); setNote(''); } }
  );

  const allowed = order.allowed_next_statuses || [];

  return (
    <Modal
      open={open} onClose={onClose} title="Move order status"
      subtitle={`Abhi: ${order.status}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading} disabled={!status}>
            Update status
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Next status" required hint="Sirf wahi options jo current status se allowed hain">
          <div className="grid grid-cols-2 gap-2">
            {allowed.map((s) => (
              <button
                key={s} type="button" onClick={() => setStatus(s)}
                className={cx(
                  'px-3 py-2 rounded border text-[0.8125rem] text-left transition-colors',
                  status === s
                    ? 'border-teal bg-teal-light text-teal-dark font-medium'
                    : 'border-line hover:border-line-strong text-ink-700'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {status === 'Cancelled' && (
          <p className="text-2xs text-signal-warn bg-signal-warnBg border border-signal-warn/20 rounded px-3 py-2">
            Cancel karne pe stock wapas aa jaayega, coupon use wapas ho jaayega, aur paid order ka
            Razorpay refund automatically start ho jaayega.
          </p>
        )}

        <Field label="Note" hint="Timeline me dikhega">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional — kya hua, kyun" />
        </Field>
      </div>
    </Modal>
  );
}

function PaymentModal({ open, onClose, order, onDone }) {
  const [form, setForm] = useState({
    payment_status: order.payment_status,
    transaction_number: order.transaction_number || '',
  });

  const save = useMutation(
    () => api.patch(`/admin/orders/${order.order_id}/payment`, form),
    { success: 'Payment status update ho gaya', onSuccess: () => { onClose(); onDone(); } }
  );

  return (
    <Modal
      open={open} onClose={onClose} title="Payment status"
      subtitle="Bank transfer ya manual collection mark karne ke liye"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Payment status" required>
          <Select
            value={form.payment_status} options={PAYMENT_STATUSES}
            onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
          />
        </Field>
        <Field label="Transaction reference" hint="UTR, cheque number, ya gateway payment id">
          <Input mono value={form.transaction_number}
            onChange={(e) => setForm({ ...form, transaction_number: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function CancelModal({ open, onClose, order, onConfirm, loading }) {
  const [reason, setReason] = useState('');

  return (
    <Modal
      open={open} onClose={onClose} title="Cancel this order"
      subtitle={order.databaseOrderID}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Rakho as-is</Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} loading={loading}>Cancel order</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[0.8125rem] text-ink-700 space-y-1.5 bg-paper-sunk rounded p-3">
          <p className="font-medium text-ink">Cancel karne pe ye hoga:</p>
          <ul className="space-y-0.5 text-2xs">
            <li>· {order.items?.length || 0} items ka stock wapas add ho jaayega</li>
            {order.coupon_code && <li>· Coupon {order.coupon_code} ka use wapas mil jaayega</li>}
            {order.payment_status === 'Paid'
              ? <li className="text-signal-warn">· {inr(order.amount)} ka Razorpay refund start ho jaayega</li>
              : <li>· Koi refund nahi (payment abhi tak nahi hua)</li>}
          </ul>
        </div>

        <Field label="Cancellation reason" required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Customer ne maanga / stock nahi hai / duplicate order" />
        </Field>
      </div>
    </Modal>
  );
}
