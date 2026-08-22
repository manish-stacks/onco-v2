import { useState } from 'react';
import { Ticket, Plus, Pencil, Trash2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { inr } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Code } from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';
import { SimpleFormModal } from '@/components/ui/SimpleFormModal';
import { ConfirmDialog } from '@/components/ui/Modal';

/** Offer cards shown in the mobile app */
export default function Offers() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/offers');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/offers/${id}`),
    { success: 'Offer deleted', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      <PageHeader
        title="Offer cards"
        subtitle="The offer cards shown on the mobile app home screen"
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add offer card</Button>
        )}
      />

      <Card dense>
        <DataTable
          rowKey="id" rows={rows || []} loading={loading}
          rowTone={(o) => (Number(o.status) ? 'ok' : 'idle')}
          columns={[
            {
              key: 'title', label: 'Offer',
              render: (o) => (
                <div>
                  <p className="text-[0.8125rem] text-ink">{o.title}</p>
                  <p className="text-2xs text-ink-500">{o.desc_code}</p>
                </div>
              ),
            },
            { key: 'CODE', label: 'Code', render: (o) => <Code>{o.CODE}</Code> },
            {
              key: 'percenatge_off', label: 'Discount', align: 'right',
              render: (o) => (
                <span className="text-[0.8125rem] tabular-nums text-ink-700">
                  {o.discount_type === 'Percentage' ? `${o.percenatge_off}%` : inr(o.percenatge_off)}
                </span>
              ),
            },
            {
              key: 'min_order_value', label: 'Min order', align: 'right',
              render: (o) => (
                <span className="text-2xs tabular-nums text-ink-500">
                  {o.min_order_value ? inr(o.min_order_value) : '—'}
                </span>
              ),
            },
            {
              key: 'status', label: 'Status',
              render: (o) => <StatusPill status={Number(o.status) ? 'Active' : 'Inactive'} size="xs" />,
            },
            {
              key: 'actions', label: '', align: 'right',
              render: (o) => canManage && (
                <div className="flex justify-end gap-0.5">
                  <Button size="xs" variant="ghost" onClick={() => setEditing(o)}><Pencil size={13} /></Button>
                  <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(o)}><Trash2 size={13} /></Button>
                </div>
              ),
            },
          ]}
          emptyIcon={Ticket} emptyTitle="No offer cards"
          emptyDescription="The offer cards shown in the app are created here."
          emptyAction={canManage && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add offer card</Button>
          )}
        />
      </Card>

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="id" path="/admin/offers" title="offer" onDone={reload} json
        fields={[
          { key: 'title', label: 'Title', required: true },
          { key: 'CODE', label: 'Coupon code', mono: true, hint: 'Enter the code from the Coupons page' },
          { key: 'desc_code', label: 'Description' },
          { key: 'discount_type', label: 'Discount type', type: 'select',
            options: ['Percentage', 'Fixed'], default: 'Percentage' },
          { key: 'percenatge_off', label: 'Discount value', type: 'number' },
          { key: 'maxDiscount', label: 'Max discount (₹)', type: 'number' },
          { key: 'min_order_value', label: 'Min order (₹)', type: 'number' },
          { key: 'theme', label: 'Theme colour', hint: '#RRGGBB' },
          { key: 'status', label: 'Active', type: 'select',
            options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], default: '1' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete offer" confirmLabel="Delete"
        message={`"${toDelete?.title}" will be removed from the app. The coupon itself stays active.`}
      />
    </>
  );
}
