import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Truck, XCircle, CreditCard, Receipt, User, MapPin, Pill, Clock, PackageCheck, Printer,
  Check, Eye, FileText, Plus, ExternalLink, Pencil,
} from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl, isPdfUrl } from '@/lib/api';
import { PERMISSIONS as P, PAYMENT_STATUSES, toneOf, TONE_HEX } from '@/lib/constants';
import { inr, num, dateTime, date, orderRef } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, SourceTag, Code, Field, Input, Select, Textarea,
  PageLoader, EmptyState, cx,
} from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import ShippingPanel from './ShippingPanel';
import { ReviewModal, MedicinesModal } from '@/pages/prescriptions/Prescriptions';

export default function OrderDetail() {
  const { orderId } = useParams();
  const { can } = useAuth();
  const { data: order, loading, reload } = useResource(`/admin/orders/${orderId}`);

  const [statusOpen, setStatusOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const cancel = useMutation(
    (reason) => api.post(`/admin/orders/${orderId}/cancel`, { reason }),
    { success: 'Order cancelled', onSuccess: () => { setCancelOpen(false); reload(); } }
  );

  if (loading && !order) return <PageLoader />;
  if (!order) return <EmptyState icon={Receipt} title="Order not found" />;

  const canManage = can(P.ORDERS_MANAGE);
  const canCancel = can(P.ORDERS_CANCEL) && order.allowed_next_statuses?.length > 0;

  return (
    <>
      <PageHeader
        back="/orders"
        backLabel="Orders"
        title={
          <span className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono">{orderRef(order)}</span>
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

          <Card title="Timeline" subtitle="Every status change is recorded" dense>
            <Timeline history={order.history} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            title="Customer"
            dense
            action={canManage && (
              <Button size="xs" icon={Pencil} onClick={() => setContactOpen(true)}>Edit</Button>
            )}
          >
            <CustomerBlock order={order} />
          </Card>

          <Card
            title="Delivery address"
            dense
            action={canManage && (
              <Button size="xs" icon={Pencil} onClick={() => setContactOpen(true)}>Edit</Button>
            )}
          >
            <AddressBlock order={order} />
          </Card>

          <ShippingPanel order={order} onChanged={reload} />

          {order.prescription && (
            <PrescriptionBlock presc={order.prescription} order={order} onChanged={reload} />
          )}

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
      <ContactModal
        open={contactOpen} onClose={() => setContactOpen(false)}
        order={order} onDone={reload}
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
  if (!history.length) return <EmptyState icon={Clock} title="No history" />;

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

function PrescriptionBlock({ presc, order, onChanged }) {
  const { can } = useAuth();
  const canManage = can(P.PRESCRIPTIONS_MANAGE);

  // The order row only carries a few prescription columns. Pull the full record
  // so this card can show exactly what /prescriptions/:id shows — medicines,
  // notes, review trail — instead of a cut-down version.
  const { data: full, reload: reloadPresc } = useResource(
    `/admin/prescriptions/${presc.prescription_id}`
  );
  const rx = full || presc;

  const images = Array.isArray(rx.images) ? rx.images : [];
  const [viewer, setViewer] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);

  const refresh = () => { reloadPresc?.(); onChanged?.(); };

  // Quick one-click approve. The Review dialog is for anything more involved.
  const quickApprove = useMutation(
    () => api.patch(`/admin/orders/${order.order_id}/prescription`, { status: 'Approved' }),
    { success: 'Prescription approved', onSuccess: refresh }
  );

  return (
    <Card
      title="Prescription"
      action={<StatusPill status={rx.status} size="xs" />}
      dense
    >
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link to={`/prescriptions/${rx.prescription_id}`} className="inline-flex items-center gap-1.5">
            <Pill size={13} className="text-ink-300" />
            <Code className="hover:text-teal transition-colors">{rx.reference_code}</Code>
          </Link>
          <Link
            to={`/prescriptions/${rx.prescription_id}`}
            className="inline-flex items-center gap-1 text-2xs text-teal hover:underline shrink-0"
          >
            Full page <ExternalLink size={11} />
          </Link>
        </div>

        {/* Patient / doctor / hospital */}
        <dl className="space-y-1.5 text-[0.8125rem] mb-3">
          <PrescRow label="Patient" value={rx.patient_name || order.patient_name} />
          <PrescRow label="Doctor" value={rx.doctor_name || order.doctor_name} />
          <PrescRow label="Hospital" value={rx.hospital_name || order.hospital_name} />
          {rx.contact_number && <PrescRow label="Contact" value={rx.contact_number} />}
          <PrescRow label="Type" value={rx.direct_upload ? 'Direct upload' : 'With an order'} />
        </dl>

        {rx.rejection_reason && (
          <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-2.5 py-2 text-2xs text-rose-700">
            Rejected: {rx.rejection_reason}
          </p>
        )}

        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {images.slice(0, 6).map((img) => (
              isPdfUrl(img) ? (
                <a
                  key={img} href={mediaUrl(img)} target="_blank" rel="noreferrer"
                  className="relative aspect-square rounded border border-line overflow-hidden bg-paper-sunk hover:border-teal transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <FileText size={16} className="text-ink-300" />
                  <span className="text-2xs font-medium text-ink-500">PDF</span>
                </a>
              ) : (
                <button
                  key={img}
                  type="button"
                  onClick={() => setViewer(mediaUrl(img))}
                  className="relative aspect-square rounded border border-line overflow-hidden bg-paper-sunk hover:border-teal transition-colors group"
                >
                  <img src={mediaUrl(img)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                    <Eye size={16} className="text-white" />
                  </span>
                </button>
              )
            ))}
          </div>
        ) : (
          <p className="text-2xs text-ink-500">No image attached.</p>
        )}

        {/* Suggested medicines — same list as the prescriptions page */}
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-2xs font-medium text-ink-500 uppercase tracking-wide">
              Suggested medicines
            </p>
            {canManage && (
              <Button size="xs" icon={Plus} onClick={() => setMedOpen(true)}>Edit</Button>
            )}
          </div>

          {rx.medicines?.length ? (
            <ul className="divide-y divide-line rounded border border-line">
              {rx.medicines.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 px-2.5 py-2">
                  {m.image_1 && (
                    <img src={mediaUrl(m.image_1)} alt=""
                      className="w-8 h-8 rounded object-cover border border-line shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] text-ink truncate">{m.medicine_name}</p>
                    {m.product_id && <Code className="text-2xs">product #{m.product_id}</Code>}
                  </div>
                  <span className="text-2xs tabular-nums text-ink-500 shrink-0">×{m.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-ink-500">
              Nothing suggested yet — read the prescription and add the medicines.
            </p>
          )}
        </div>

        {rx.notes && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-1 text-2xs font-medium text-ink-500 uppercase tracking-wide">Notes</p>
            <p className="text-[0.8125rem] text-ink-700 whitespace-pre-wrap leading-relaxed">{rx.notes}</p>
          </div>
        )}

        {rx.reviewed_at && (
          <p className="mt-3 border-t border-line pt-3 text-2xs text-ink-500">
            Reviewed {dateTime(rx.reviewed_at)}
            {rx.reviewed_by ? ` by admin #${rx.reviewed_by}` : ''}
          </p>
        )}

        {canManage && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            <Button
              variant="primary"
              icon={Check}
              loading={quickApprove.loading}
              disabled={rx.status === 'Approved'}
              onClick={quickApprove.run}
            >
              Approve
            </Button>
            <Button icon={FileText} onClick={() => setReviewOpen(true)}>
              Review
            </Button>
            <p className="w-full text-2xs text-ink-500 pt-1">
              Any change here also shows on the Prescriptions page.
            </p>
          </div>
        )}
      </div>

      {/* Image viewer */}
      <Modal open={!!viewer} onClose={() => setViewer(null)} title="Prescription">
        {viewer && (
          <div className="p-2">
            <img src={viewer} alt="prescription" className="max-h-[70vh] w-full object-contain" />
            <div className="pt-3">
              <a href={viewer} target="_blank" rel="noreferrer"
                className="text-xs font-semibold text-teal">Open original in a new tab</a>
            </div>
          </div>
        )}
      </Modal>

      {/* The exact same Review + Suggest medicines dialogs as /prescriptions/:id */}
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        presc={rx}
        onDone={refresh}
      />
      <MedicinesModal
        key={rx.medicines?.length || 0}
        open={medOpen}
        onClose={() => setMedOpen(false)}
        presc={rx}
        onDone={refresh}
      />
    </Card>
  );
}

function PrescRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="text-ink-700 text-right">{value || '—'}</dd>
    </div>
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
    { success: 'Status updated', onSuccess: () => { onClose(); onDone(); setStatus(''); setNote(''); } }
  );

  const allowed = order.allowed_next_statuses || [];

  return (
    <Modal
      open={open} onClose={onClose} title="Move order status"
      subtitle={`Currently: ${order.status}`}
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
        <Field label="Next status" required hint="Only the options allowed from the current status">
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
            Cancelling restores the stock, gives back the coupon use, and for a paid order the
            Razorpay refund automatically start ho jaayega.
          </p>
        )}

        <Field label="Note" hint="Shown in the timeline">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional — what happened and why" />
        </Field>
      </div>
    </Modal>
  );
}

function ContactModal({ open, onClose, order, onDone }) {
  const [form, setForm] = useState({
    customer_phone: order.customer_phone || '',
    customer_address: order.customer_address || '',
    customer_shipping_name: order.customer_shipping_name || '',
    customer_shipping_phone: order.customer_shipping_phone || '',
    customer_shipping_address: order.customer_shipping_address || '',
    customer_shipping_city: order.customer_shipping_city || '',
    customer_shipping_state: order.customer_shipping_state || '',
    customer_shipping_pincode: order.customer_shipping_pincode || '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation(
    () => api.patch(`/admin/orders/${order.order_id}`, form),
    { success: 'Contact & address updated', onSuccess: () => { onClose(); onDone(); } }
  );

  return (
    <Modal
      open={open} onClose={onClose} title="Edit contact & address"
      subtitle="Correct the customer's mobile number or shipping address for this order"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="label">Customer</p>
          <Field label="Customer mobile number">
            <Input mono value={form.customer_phone} onChange={set('customer_phone')} />
          </Field>
          <Field label="Customer address" hint="Used on invoices; shipping address below is what the courier uses">
            <Textarea rows={2} value={form.customer_address} onChange={set('customer_address')} />
          </Field>
        </div>

        <div className="space-y-3 pt-3 border-t border-line">
          <p className="label">Shipping / delivery address</p>
          <Field label="Recipient name">
            <Input value={form.customer_shipping_name} onChange={set('customer_shipping_name')} />
          </Field>
          <Field label="Recipient mobile number">
            <Input mono value={form.customer_shipping_phone} onChange={set('customer_shipping_phone')} />
          </Field>
          <Field label="Address">
            <Textarea rows={2} value={form.customer_shipping_address} onChange={set('customer_shipping_address')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input value={form.customer_shipping_city} onChange={set('customer_shipping_city')} />
            </Field>
            <Field label="State">
              <Input value={form.customer_shipping_state} onChange={set('customer_shipping_state')} />
            </Field>
          </div>
          <Field label="Pincode">
            <Input mono value={form.customer_shipping_pincode} onChange={set('customer_shipping_pincode')} />
          </Field>
        </div>
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
    { success: 'Payment status updated', onSuccess: () => { onClose(); onDone(); } }
  );

  return (
    <Modal
      open={open} onClose={onClose} title="Payment status"
      subtitle="For marking a bank transfer or manual collection"
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
        <Field label="Transaction reference" hint="UTR, cheque number, or gateway payment ID">
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
      subtitle={orderRef(order)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Keep as is</Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} loading={loading}>Cancel order</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[0.8125rem] text-ink-700 space-y-1.5 bg-paper-sunk rounded p-3">
          <p className="font-medium text-ink">Cancelling will do the following:</p>
          <ul className="space-y-0.5 text-2xs">
            <li>· Stock for {order.items?.length || 0} item(s) will be restored</li>
            {order.coupon_code && <li>· The use of coupon {order.coupon_code} will be restored</li>}
            {order.payment_status === 'Paid'
              ? <li className="text-signal-warn">· {inr(order.amount)} ka Razorpay refund start ho jaayega</li>
              : <li>· No refund (no payment has been made yet)</li>}
          </ul>
        </div>

        <Field label="Cancellation reason" required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Customer requested / out of stock / duplicate order" />
        </Field>
      </div>
    </Modal>
  );
}
