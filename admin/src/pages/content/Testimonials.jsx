import { useState } from 'react';
import { Quote, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill } from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';
import { SimpleFormModal } from '@/components/ui/SimpleFormModal';
import { ConfirmDialog } from '@/components/ui/Modal';

/** Customer testimonials shown on the homepage */
export default function Testimonials() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/testimonials');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/testimonials/${id}`),
    { success: 'Testimonial deleted', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      <PageHeader
        title="Testimonials"
        subtitle="Customer reviews shown on the homepage"
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add testimonial</Button>
        )}
      />

      <Card dense>
        <DataTable
          rowKey="review_id" rows={rows || []} loading={loading}
          rowTone={(t) => (t.status === 'active' ? 'ok' : 'idle')}
          columns={[
            {
              key: 'name', label: 'Reviewer',
              render: (t) => (
                <div>
                  <p className="text-[0.8125rem] text-ink">{t.name}</p>
                  <p className="text-2xs text-ink-500">{t.profession}</p>
                </div>
              ),
            },
            {
              key: 'review', label: 'Review',
              render: (t) => <p className="text-2xs text-ink-500 max-w-md line-clamp-2">{t.review}</p>,
            },
            {
              key: 'stars', label: 'Rating',
              render: (t) => (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < Number(t.stars) ? 'fill-amber-400 text-amber-400' : 'text-ink-300'} />
                  ))}
                </div>
              ),
            },
            {
              key: 'status', label: 'Status',
              render: (t) => <StatusPill status={t.status === 'active' ? 'Active' : 'Inactive'} size="xs" />,
            },
            {
              key: 'actions', label: '', align: 'right',
              render: (t) => canManage && (
                <div className="flex justify-end gap-0.5">
                  <Button size="xs" variant="ghost" onClick={() => setEditing(t)}><Pencil size={13} /></Button>
                  <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(t)}><Trash2 size={13} /></Button>
                </div>
              ),
            },
          ]}
          emptyIcon={Quote} emptyTitle="No testimonials yet"
          emptyDescription="Customer reviews shown on the homepage are added here."
          emptyAction={canManage && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add testimonial</Button>
          )}
        />
      </Card>

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="review_id" path="/admin/testimonials" title="testimonial" onDone={reload} json
        fields={[
          { key: 'name', label: 'Reviewer name', required: true },
          { key: 'profession', label: 'Profession / title', hint: 'e.g. "Caregiver", "Patient"' },
          { key: 'review', label: 'Review text', type: 'textarea', required: true },
          { key: 'stars', label: 'Rating', type: 'select',
            options: ['5', '4', '3', '2', '1'], default: '5' },
          { key: 'status', label: 'Status', type: 'select',
            options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], default: 'active' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.review_id)} loading={del.loading}
        title="Delete testimonial" confirmLabel="Delete"
        message={`The review by "${toDelete?.name}" will be permanently removed.`}
      />
    </>
  );
}
