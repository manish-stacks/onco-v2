import { useState } from 'react';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Code, Field, Input, Select } from '@/components/ui';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

/** Static pages — about us, privacy policy, terms wagairah */
export default function Pages() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/pages');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation((id) => api.del(`/admin/pages/${id}`),
    { success: 'Page delete ho gaya', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.CMS_MANAGE);

  return (
    <>
      <PageHeader
        title="Pages"
        subtitle="About us, privacy policy, terms — static content"
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New page</Button>
        )}
      />

      <Card dense>
      <DataTable
        rowKey="page_id" rows={rows || []} loading={loading}
        rowTone={(p) => (p.status === 'Active' ? 'ok' : 'idle')}
        columns={[
          {
            key: 'name', label: 'Page',
            render: (p) => (
              <div>
                <p className="text-[0.8125rem] text-ink">{p.name}</p>
                <Code className="text-2xs">/{p.slug}</Code>
              </div>
            ),
          },
          {
            key: 'type', label: 'Type',
            render: (p) => <span className="text-2xs text-ink-500">{p.type || '—'}</span>,
          },
          {
            key: 'seo_title', label: 'SEO title',
            render: (p) => (
              <span className="text-2xs text-ink-500 truncate block max-w-[220px]">
                {p.seo_title || <span className="text-signal-warn">set nahi hai</span>}
              </span>
            ),
          },
          { key: 'status', label: 'Status', render: (p) => <StatusPill status={p.status} size="xs" /> },
          {
            key: 'actions', label: '', align: 'right',
            render: (p) => canManage && (
              <div className="flex justify-end gap-0.5">
                <Button size="xs" variant="ghost" onClick={() => setEditing(p)}><Pencil size={13} /></Button>
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(p)}><Trash2 size={13} /></Button>
              </div>
            ),
          },
        ]}
        emptyIcon={FileText} emptyTitle="Koi page nahi"
        emptyDescription="About us, privacy policy, terms — ye sab yahan se bante hain."
        emptyAction={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New page</Button>}
      />
      </Card>

      <PageModal open={!!editing} onClose={() => setEditing(null)} page={editing} onDone={reload} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.page_id)} loading={del.loading}
        title="Delete page" confirmLabel="Delete"
        message={`"${toDelete?.name}" delete ho jaayega aur /${toDelete?.slug} pe 404 aayega.`} />
    </>
  );
}

function PageModal({ open, onClose, page, onDone }) {
  const isEdit = !!page?.page_id;
  const [form, setForm] = useState({});
  const [lastId, setLastId] = useState(null);

  if (open && lastId !== (page?.page_id ?? 'new')) {
    setLastId(page?.page_id ?? 'new');
    setForm({
      name: page?.name || '',
      slug: page?.slug || '',
      type: page?.type || '',
      content: page?.content || '',
      seo_title: page?.seo_title || '',
      seo_description: page?.seo_description || '',
      status: page?.status || 'Active',
    });
  }

  const save = useMutation(
    () => (isEdit ? api.put(`/admin/pages/${page.page_id}`, form) : api.post('/admin/pages', form)),
    { success: isEdit ? 'Page update ho gaya' : 'Page ban gaya', onSuccess: () => { onClose(); onDone(); } }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open} onClose={onClose} size="xl"
      title={isEdit ? `Edit — ${page.name}` : 'New page'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save page</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Page name" required className="sm:col-span-2">
            <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)}
              placeholder="Privacy Policy" autoFocus />
          </Field>
          <Field label="Status">
            <Select value={form.status} options={['Active', 'Inactive']}
              onChange={(e) => set('status', e.target.value)} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="URL slug" hint="Khaali chhodo to naam se ban jaayega">
            <Input mono value={form.slug || ''} onChange={(e) => set('slug', e.target.value)}
              placeholder="privacy-policy" />
          </Field>
          <Field label="Type" hint="Grouping ke liye — optional">
            <Input value={form.type || ''} onChange={(e) => set('type', e.target.value)}
              placeholder="legal" />
          </Field>
        </div>

        <Field label="Content">
          <RichTextEditor rows={12} value={form.content} onChange={(v) => set('content', v)}
            placeholder="Page ka content yahan likho…" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="SEO title" hint={`${(form.seo_title || '').length}/60`}>
            <Input value={form.seo_title || ''} onChange={(e) => set('seo_title', e.target.value)} />
          </Field>
          <Field label="SEO description" hint={`${(form.seo_description || '').length}/160`}>
            <Input value={form.seo_description || ''} onChange={(e) => set('seo_description', e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

