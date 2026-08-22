import { useState } from 'react';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { num } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill } from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';
import { SimpleFormModal } from '@/components/ui/SimpleFormModal';
import { ConfirmDialog } from '@/components/ui/Modal';

/**
 * Where delivery is available.
 * The customer's city is checked against this at checkout — if it is not in the list
 * the order is not placed.
 */
export default function Cities() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/cities');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/cities/${id}`),
    { success: 'City hata di', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.SETTINGS_MANAGE);
  const active = (rows || []).filter((c) => Number(c.status)).length;

  return (
    <>
      <PageHeader
        title="Delivery cities"
        subtitle={rows
          ? `Delivery is active in ${num(active)} cities (${num(rows.length)} total)`
          : 'Where delivery is available'}
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add city</Button>
        )}
      />

      <Card dense>
        <DataTable
          rowKey="id" rows={rows || []} loading={loading}
          rowTone={(c) => (Number(c.status) ? 'ok' : 'idle')}
          columns={[
            {
              key: 'city', label: 'City',
              render: (c) => <span className="text-[0.8125rem] text-ink">{c.city}</span>,
            },
            {
              key: 'E_T_D', label: 'Delivery time',
              render: (c) => <span className="text-2xs text-ink-500">{c.E_T_D || '—'}</span>,
            },
            {
              key: 'status', label: 'Status',
              render: (c) => <StatusPill status={Number(c.status) ? 'Active' : 'Inactive'} size="xs" />,
            },
            {
              key: 'actions', label: '', align: 'right',
              render: (c) => canManage && (
                <div className="flex justify-end gap-0.5">
                  <Button size="xs" variant="ghost" onClick={() => setEditing(c)}><Pencil size={13} /></Button>
                  <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(c)}><Trash2 size={13} /></Button>
                </div>
              ),
            },
          ]}
          emptyIcon={MapPin} emptyTitle="No serviceable cities"
          emptyDescription="Add the cities you deliver to — the customer's city is checked at checkout."
          emptyAction={canManage && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add city</Button>
          )}
        />
      </Card>

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="id" path="/admin/cities" title="city" onDone={reload} json
        fields={[
          { key: 'city', label: 'City name', required: true },
          { key: 'E_T_D', label: 'Estimated delivery', hint: 'Jaise "2-3 days"' },
          { key: 'status', label: 'Active', type: 'select',
            options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], default: '1' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Remove city" confirmLabel="Remove"
        message={`Delivery to "${toDelete?.city}" will be stopped — customers there will not be able to order.`}
      />
    </>
  );
}
