import { useState } from 'react';
import { Newspaper, Plus, Pencil, Trash2 } from 'lucide-react';
import { useList, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { date, truncate } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Field, Input, Select, Textarea } from '@/components/ui';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

/** News aur blog posts */
export default function News() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList('/admin/news');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  if (filters.search !== debounced) setFilter('search', debounced);

  const del = useMutation((id) => api.del(`/admin/news/${id}`),
    { success: 'Post delete ho gaya', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.CMS_MANAGE);

  return (
    <>
      <PageHeader
        title="News & Blog"
        subtitle="Health tips, announcements aur blog posts"
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New post</Button>
        )}
      />

      <Card dense>
      <FilterBar hasFilters={!!(filters.search || filters.status)} onReset={() => { setSearch(''); resetFilters(); }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Title ya excerpt…" className="w-full sm:w-56" />
        <FilterSelect label="Status" value={filters.status} placeholder="All"
          options={['active', 'inactive']} onChange={(v) => setFilter('status', v)} />
      </FilterBar>

      <DataTable
        rowKey="id" rows={rows} loading={loading}
        rowTone={(n) => (n.status === 'active' ? 'ok' : 'idle')}
        columns={[
          {
            key: 'title', label: 'Post',
            render: (n) => (
              <div className="flex items-center gap-2.5">
                {n.image ? (
                  <img src={mediaUrl(n.image)} alt=""
                    className="w-11 h-11 rounded object-cover border border-line bg-paper-sunk shrink-0"
                    onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                ) : (
                  <div className="w-11 h-11 rounded bg-paper-sunk border border-line flex items-center justify-center shrink-0">
                    <Newspaper size={14} className="text-ink-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[0.8125rem] text-ink truncate max-w-[260px]">{n.title}</p>
                  <p className="text-2xs text-ink-500 truncate max-w-[260px]">{truncate(n.excerpt, 60)}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'category', label: 'Category',
            render: (n) => <span className="text-2xs text-ink-500">{n.category || '—'}</span>,
          },
          {
            key: 'date', label: 'Published',
            render: (n) => <span className="text-2xs tabular-nums text-ink-500">{date(n.date)}</span>,
          },
          { key: 'status', label: 'Status', render: (n) => <StatusPill status={n.status} size="xs" /> },
          {
            key: 'actions', label: '', align: 'right',
            render: (n) => canManage && (
              <div className="flex justify-end gap-0.5">
                <Button size="xs" variant="ghost" onClick={() => setEditing(n)}><Pencil size={13} /></Button>
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(n)}><Trash2 size={13} /></Button>
              </div>
            ),
          },
        ]}
        emptyIcon={Newspaper} emptyTitle="Koi post nahi"
        emptyAction={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New post</Button>}
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>

      <NewsModal open={!!editing} onClose={() => setEditing(null)} post={editing} onDone={reload} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete post" confirmLabel="Delete" message={`"${toDelete?.title}" delete ho jaayega.`} />
    </>
  );
}

function NewsModal({ open, onClose, post, onDone }) {
  const isEdit = !!post?.id;
  const [form, setForm] = useState({});
  const [image, setImage] = useState(null);
  const [lastId, setLastId] = useState(null);

  if (open && lastId !== (post?.id ?? 'new')) {
    setLastId(post?.id ?? 'new');
    setForm({
      title: post?.title || '',
      category: post?.category || '',
      excerpt: post?.excerpt || '',
      content: post?.content || '',
      date: post?.date ? String(post.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: post?.status || 'active',
    });
    setImage(null);
  }

  const save = useMutation(
    async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      if (image) fd.append('image', image);
      return isEdit ? api.form(`/admin/news/${post.id}`, fd, 'PUT') : api.form('/admin/news', fd, 'POST');
    },
    { success: isEdit ? 'Post update ho gaya' : 'Post publish ho gaya', onSuccess: () => { onClose(); onDone(); } }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open} onClose={onClose} size="xl"
      title={isEdit ? 'Edit post' : 'New post'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>
            {isEdit ? 'Save changes' : 'Publish post'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Title" required>
          <Input value={form.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus />
        </Field>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Category">
            <Input value={form.category || ''} onChange={(e) => set('category', e.target.value)}
              placeholder="Health tips" />
          </Field>
          <Field label="Publish date">
            <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={form.status} options={['active', 'inactive']}
              onChange={(e) => set('status', e.target.value)} />
          </Field>
        </div>

        <Field label="Cover image">
          <div className="flex items-center gap-3">
            {(image || post?.image) && (
              <img src={image ? URL.createObjectURL(image) : mediaUrl(post.image)} alt=""
                className="w-20 h-14 rounded border border-line object-cover" />
            )}
            <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])}
              className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs" />
          </div>
        </Field>

        <Field label="Excerpt" hint="Listing pe dikhne wali summary">
          <Textarea rows={2} value={form.excerpt || ''} onChange={(e) => set('excerpt', e.target.value)} />
        </Field>

        <Field label="Content">
          <RichTextEditor rows={10} value={form.content} onChange={(v) => set('content', v)}
            placeholder="Post ka content yahan likho…" />
        </Field>
      </div>
    </Modal>
  );
}

