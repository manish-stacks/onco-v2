import { useState } from 'react';
import {
  Truck, Package, Printer, RefreshCw, XCircle, MapPin, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, tokenStore } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { dateTime, inr } from '@/lib/format';
import {
  Card, Button, Field, Input, Select, Code, StatusPill, EmptyState, cx,
} from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

const BASE = import.meta.env.VITE_API_BASE || '';

const SHIPMENT_TONE = {
  Booked: 'info',
  'In Transit': 'info',
  'Out for Delivery': 'warn',
  Delivered: 'ok',
  Failed: 'danger',
  Cancelled: 'danger',
  RTO: 'danger',
};

/**
 * Order detail page ka shipping block.
 * Book / label / track / cancel — sab yahin se.
 */
export default function ShippingPanel({ order, onChanged }) {
  const { can } = useAuth();
  const [bookOpen, setBookOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [scans, setScans] = useState(null);

  const { data: config } = useResource('/admin/shipping/config');

  const track = useMutation(
    () => api.get(`/admin/orders/${order.order_id}/tracking`),
    {
      success: 'Tracking update ho gayi',
      onSuccess: (res) => { setScans(res.data?.scans || []); onChanged?.(); },
    }
  );

  const cancel = useMutation(
    () => api.del(`/admin/orders/${order.order_id}/ship`),
    { success: 'Booking cancel ho gayi', onSuccess: () => { setCancelOpen(false); onChanged?.(); } }
  );

  const canManage = can(P.SHIPPING_MANAGE);
  const booked = !!order.awb_number;

  /**
   * Label PDF ko naye tab me kholna hai, lekin request me auth header chahiye.
   * window.open header nahi bhej sakti, isliye blob laa ke object URL banate hain.
   */
  const openLabel = async () => {
    const res = await fetch(`${BASE}/api/admin/shipments/${order.awb_number}/label`, {
      headers: { Authorization: `Bearer ${tokenStore.get()}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <Card
      title="Shipping"
      subtitle={config?.configured
        ? `DTDC · ${config.mode} mode`
        : 'DTDC credentials .env me set nahi hain'}
      action={booked && (
        <StatusPill status={order.tracking_status || 'Booked'} size="xs" />
      )}
      dense
    >
      {!booked ? (
        <div className="p-4">
          {config?.configured ? (
            <EmptyState
              icon={Truck}
              title="Abhi ship nahi hua"
              description="DTDC pe book karo — AWB milega aur customer ko WhatsApp pe tracking chali jayegi."
              action={canManage && (
                <Button variant="primary" icon={Package} onClick={() => setBookOpen(true)}>
                  Book with DTDC
                </Button>
              )}
            />
          ) : (
            <div className="flex items-start gap-2.5 text-2xs text-signal-warn bg-signal-warnBg border border-signal-warn/20 rounded p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                DTDC configure nahi hai. <Code className="text-2xs">DTDC_API_KEY</Code> aur{' '}
                <Code className="text-2xs">DTDC_CUSTOMER_CODE</Code> backend ki .env me daalo.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Truck size={14} className="text-ink-300 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Code className="text-[0.8125rem] font-semibold">{order.awb_number}</Code>
                <p className="text-2xs text-ink-500 mt-0.5">
                  {order.courier_name || 'DTDC'}
                  {order.tracking_datetime && ` · ${dateTime(order.tracking_datetime)}`}
                </p>
              </div>
            </div>

            {order.tracking_status && (
              <div className="bg-paper-sunk rounded p-2.5">
                <p className="text-[0.8125rem] text-ink">{order.tracking_status}</p>
                {order.tracking_location && (
                  <p className="text-2xs text-ink-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} /> {order.tracking_location}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" icon={Printer} onClick={openLabel}>Label</Button>
              <Button size="sm" icon={RefreshCw} onClick={track.run} loading={track.loading}>
                Refresh tracking
              </Button>
              {canManage && order.status !== 'Completed' && (
                <Button size="sm" variant="dangerGhost" icon={XCircle} onClick={() => setCancelOpen(true)}>
                  Cancel booking
                </Button>
              )}
            </div>
          </div>

          {scans?.length > 0 && (
            <div className="border-t border-line">
              <p className="px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-500 bg-paper">
                Scan history
              </p>
              <ol className="divide-y divide-line max-h-64 overflow-y-auto">
                {[...scans].reverse().map((s, i) => (
                  <li key={i} className="px-4 py-2.5 flex gap-2.5">
                    <CheckCircle2 size={13} className="text-signal-ok mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs text-ink">{s.description}</p>
                      <p className="text-2xs text-ink-500 mt-0.5">
                        {[s.origin, s.destination].filter(Boolean).join(' → ')}
                        {s.scan_at && ` · ${dateTime(s.scan_at)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <BookModal
        open={bookOpen} onClose={() => setBookOpen(false)}
        order={order} config={config} onDone={onChanged}
      />
      <ConfirmDialog
        open={cancelOpen} onClose={() => setCancelOpen(false)}
        onConfirm={cancel.run} loading={cancel.loading}
        title="Cancel DTDC booking" confirmLabel="Cancel booking"
        message={`AWB ${order.awb_number} DTDC pe cancel ho jayega aur order wapas Processing me chala jayega. Order khud cancel nahi hoga.`}
      />
    </Card>
  );
}

function BookModal({ open, onClose, order, config, onDone }) {
  const [form, setForm] = useState({
    service_type: '2',
    weight: '0.5',
    length: '10',
    width: '15',
    height: '15',
    num_pieces: '1',
  });

  const book = useMutation(
    () => api.post(`/admin/orders/${order.order_id}/ship`, form),
    {
      success: (res) => `Book ho gaya — AWB ${res.data.awb}`,
      onSuccess: () => { onClose(); onDone?.(); },
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isCod = String(order.payment_mode).toLowerCase() === 'cod' && order.payment_status !== 'Paid';

  return (
    <Modal
      open={open} onClose={onClose}
      title="Book with DTDC" subtitle={order.databaseOrderID}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Package} onClick={book.run} loading={book.loading}>
            Book shipment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="bg-paper-sunk rounded p-3 text-2xs space-y-1">
          <p className="font-medium text-ink mb-1.5">Deliver to</p>
          <p className="text-ink-700">{order.customer_shipping_name || order.customer_name}</p>
          <Code className="text-2xs">{order.customer_shipping_phone || order.customer_phone}</Code>
          <p className="text-ink-700 leading-relaxed">
            {order.customer_shipping_address || order.customer_address}
          </p>
          <p className="text-ink-700">
            {[order.customer_shipping_city, order.customer_shipping_state].filter(Boolean).join(', ')}
            {' — '}
            <Code className="text-2xs">{order.customer_shipping_pincode || order.customer_pincode}</Code>
          </p>
          {isCod && (
            <p className="text-signal-warn font-medium pt-1.5 mt-1.5 border-t border-line">
              COD — courier {inr(order.amount)} collect karega
            </p>
          )}
        </div>

        <Field label="Service type" required>
          <Select
            value={form.service_type} onChange={(e) => set('service_type', e.target.value)}
            options={config?.service_types || [
              { value: '1', label: 'B2C Priority' },
              { value: '2', label: 'B2C Premium' },
            ]}
          />
        </Field>

        <div className="grid grid-cols-4 gap-2">
          <Field label="Weight (kg)">
            <Input type="number" step="0.1" value={form.weight} onChange={(e) => set('weight', e.target.value)} />
          </Field>
          <Field label="L (cm)">
            <Input type="number" value={form.length} onChange={(e) => set('length', e.target.value)} />
          </Field>
          <Field label="W (cm)">
            <Input type="number" value={form.width} onChange={(e) => set('width', e.target.value)} />
          </Field>
          <Field label="H (cm)">
            <Input type="number" value={form.height} onChange={(e) => set('height', e.target.value)} />
          </Field>
        </div>

        <Field label="Pieces">
          <Input type="number" min="1" value={form.num_pieces} onChange={(e) => set('num_pieces', e.target.value)} />
        </Field>

        <p className="text-2xs text-ink-500">
          Book hote hi order Shipped ho jayega aur customer ko WhatsApp pe AWB + tracking link chala jayega.
        </p>
      </div>
    </Modal>
  );
}
