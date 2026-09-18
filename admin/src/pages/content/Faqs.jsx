import { useState } from 'react';
import { HelpCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill } from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';
import { SimpleFormModal } from '@/components/ui/SimpleFormModal';
import { ConfirmDialog } from '@/components/ui/Modal';

/** FAQs shown on the website's help/FAQ page */
export default function Faqs() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/faqs');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation(
    (id) => api.del(`/admin/faqs/${id}`),
    { success: 'FAQ deleted', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      <PageHeader
        title="FAQs"
        subtitle="Questions shown on the website's FAQ/help page"
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add FAQ</Button>
        )}
      />

      <Card dense>
        <DataTable
          rowKey="faq_id" rows={rows || []} loading={loading}
          rowTone={(f) => (f.status === 'active' ? 'ok' : 'idle')}
          columns={[
            {
              key: 'question', label: 'Question',
              render: (f) => (
                <div className="max-w-lg">
                  <p className="text-[0.8125rem] text-ink">{f.question}</p>
                  <p className="text-2xs text-ink-500 line-clamp-1">{f.answer}</p>
                </div>
              ),
            },
            {
              key: 'category', label: 'Category',
              render: (f) => f.category
                ? <span className="text-2xs text-ink-500 bg-paper-sunk rounded px-1.5 py-0.5">{f.category}</span>
                : <span className="text-2xs text-ink-300">—</span>,
            },
            { key: 'position', label: 'Order', align: 'right',
              render: (f) => <span className="text-2xs tabular-nums text-ink-500">{f.position}</span> },
            {
              key: 'status', label: 'Status',
              render: (f) => <StatusPill status={f.status === 'active' ? 'Active' : 'Inactive'} size="xs" />,
            },
            {
              key: 'actions', label: '', align: 'right',
              render: (f) => canManage && (
                <div className="flex justify-end gap-0.5">
                  <Button size="xs" variant="ghost" onClick={() => setEditing(f)}><Pencil size={13} /></Button>
                  <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(f)}><Trash2 size={13} /></Button>
                </div>
              ),
            },
          ]}
          emptyIcon={HelpCircle} emptyTitle="No FAQs yet"
          emptyDescription="Add questions and answers to show on the website's FAQ page."
          emptyAction={canManage && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add FAQ</Button>
          )}
        />
      </Card>

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="faq_id" path="/admin/faqs" title="FAQ" onDone={reload} json
        fields={[
          { key: 'question', label: 'Question', required: true },
          { key: 'answer', label: 'Answer', type: 'textarea', required: true },
          { key: 'category', label: 'Category', hint: 'Optional grouping, e.g. "Orders", "Prescriptions"' },
          { key: 'position', label: 'Display order', type: 'number', default: 0,
            hint: 'Lower number shows first' },
          { key: 'status', label: 'Status', type: 'select',
            options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], default: 'active' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.faq_id)} loading={del.loading}
        title="Delete FAQ" confirmLabel="Delete"
        message={`"${toDelete?.question}" will be permanently removed.`}
      />
    </>
  );
}
