import { useState } from 'react';
import { Newspaper, Plus, Pencil, Trash2 } from 'lucide-react';
import { useList, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { date, truncate } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Field, Input, Select, Textarea, Tabs } from '@/components/ui';
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
    { success: 'Post deleted', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.CMS_MANAGE);

  return (
    <>
      <PageHeader
        title="News & Blog"
        subtitle="Health tips, announcements and blog posts"
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
          {
            key: 'seo', label: 'SEO',
            render: (n) => {
              const done = [n.slug, n.meta_title, n.meta_description, n.keywords, n.image_alt].filter(Boolean).length;
              const tone = done === 5 ? 'text-emerald-600 bg-emerald-50' : done ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
              return <span className={`text-2xs font-medium px-2 py-0.5 rounded-full ${tone}`}>{done}/5 set</span>;
            },
          },
          { key: 'status', label: 'Status', render: (n) => <StatusPill status={n.status} size="xs" /> },
          {
            key: 'actions', label: '', align: 'right',
            render: (n) => canManage && (
              <div className="flex justify-end gap-0.5">
                <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(n)}>Edit / SEO</Button>
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(n)}><Trash2 size={13} /></Button>
              </div>
            ),
          },
        ]}
        emptyIcon={Newspaper} emptyTitle="No posts"
        emptyAction={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New post</Button>}
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>

      <NewsModal open={!!editing} onClose={() => setEditing(null)} post={editing} onDone={reload} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete post" confirmLabel="Delete" message={`"${toDelete?.title}" will be deleted.`} />
    </>
  );
}

function NewsModal({ open, onClose, post, onDone }) {
  const isEdit = !!post?.id;
  const [form, setForm] = useState({});
  const [image, setImage] = useState(null);
  const [lastId, setLastId] = useState(null);
  const [tab, setTab] = useState('content');

  if (open && lastId !== (post?.id ?? 'new')) {
    setLastId(post?.id ?? 'new');
    setTab('content');
    setForm({
      title: post?.title || '',
      category: post?.category || '',
      excerpt: post?.excerpt || '',
      content: post?.content || '',
      date: post?.date ? String(post.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: post?.status || 'active',
      slug: post?.slug || '',
      meta_title: post?.meta_title || '',
      meta_description: post?.meta_description || '',
      keywords: post?.keywords || '',
      image_alt: post?.image_alt || '',
    });
    setImage(null);
  }
  if (!open && lastId !== null) setLastId(null);

  const save = useMutation(
    async () => {
      if (!String(form.title || '').trim()) throw new Error('Title is required');
      const fd = new FormData();
      // '' is sent for SEO fields too, so clearing a field in edit really clears it
      Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
      if (image) fd.append('image', image);
      return isEdit ? api.form(`/admin/news/${post.id}`, fd, 'PUT') : api.form('/admin/news', fd, 'POST');
    },
    { success: isEdit ? 'Post updated' : 'Post published', onSuccess: () => { onClose(); onDone(); } }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const titleLen = (form.meta_title || form.title || '').length;
  const descLen = (form.meta_description || form.excerpt || '').length;
  const slugPreview = (form.slug || form.title || 'your-post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

  const checks = [
    { ok: titleLen >= 30 && titleLen <= 60, text: 'Meta title is 30-60 characters' },
    { ok: descLen >= 100 && descLen <= 160, text: 'Meta description is 100-160 characters' },
    { ok: !!form.keywords, text: 'Focus keywords added' },
    { ok: !!form.image_alt, text: 'Cover image alt text added' },
    { ok: !!(post?.image || image), text: 'Cover image uploaded' },
  ];

  return (
    <Modal
      open={open} onClose={onClose} size="full"
      title={isEdit ? 'Edit post' : 'New post'}
      subtitle="Use the SEO tab to set the URL, meta title and description"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>
            {isEdit ? 'Save changes' : 'Publish post'}
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[{ value: 'content', label: 'Content' }, { value: 'seo', label: 'SEO' }]}
        value={tab} onChange={setTab} className="mb-4"
      />

      {tab === 'content' && (
        <div className="space-y-4">
          <Field label="Title" required>
            <Input value={form.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus />
          </Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Category">
              <Input value={form.category || ''} onChange={(e) => set('category', e.target.value)} placeholder="Health tips" />
            </Field>
            <Field label="Publish date">
              <Input type="date" value={form.date || ''} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.status} options={['active', 'inactive']} onChange={(e) => set('status', e.target.value)} />
            </Field>
          </div>

          <Field label="Cover image">
            <div className="flex items-center gap-3">
              {(image || post?.image) && (
                <img src={image ? URL.createObjectURL(image) : mediaUrl(post.image)} alt=""
                  className="w-28 h-20 rounded border border-line object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs" />
            </div>
          </Field>

          <Field label="Excerpt" hint="The summary shown on the listing">
            <Textarea rows={3} value={form.excerpt || ''} onChange={(e) => set('excerpt', e.target.value)} />
          </Field>

          <Field label="Content">
            <RichTextEditor rows={16} value={form.content} onChange={(v) => set('content', v)}
              placeholder="Write the post content here…" />
          </Field>
        </div>
      )}

      {tab === 'seo' && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-4">
            <Field label="URL slug" hint="Leave blank to generate from the title, e.g. cancer-care-tips">
              <Input value={form.slug || ''} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} placeholder="cancer-care-tips" />
            </Field>
            <Field label="Meta title" hint={`${(form.meta_title || '').length}/60 characters. Defaults to the post title`}>
              <Input value={form.meta_title || ''} maxLength={70} onChange={(e) => set('meta_title', e.target.value)} />
            </Field>
            <Field label="Meta description" hint={`${(form.meta_description || '').length}/160 characters. Defaults to the excerpt`}>
              <Textarea rows={3} maxLength={320} value={form.meta_description || ''} onChange={(e) => set('meta_description', e.target.value)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Focus keywords" hint="Comma separated">
                <Input value={form.keywords || ''} onChange={(e) => set('keywords', e.target.value)} placeholder="cancer medicine, oncology" />
              </Field>
              <Field label="Cover image alt text">
                <Input value={form.image_alt || ''} onChange={(e) => set('image_alt', e.target.value)} placeholder="Describe the image" />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-2xs uppercase tracking-wide text-ink-500 mb-2">Google preview</p>
              <p className="text-[0.8125rem] text-emerald-700 truncate">oncohealthmart.com › blog › {slugPreview}</p>
              <p className="text-base text-blue-700 leading-snug line-clamp-2">{form.meta_title || form.title || 'Post title'} | Onco Health Mart</p>
              <p className="text-[0.8125rem] text-ink-500 line-clamp-3 mt-1">{form.meta_description || form.excerpt || 'The meta description appears here.'}</p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="text-[0.8125rem] font-semibold text-ink mb-2">SEO checklist</p>
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li key={c.text} className={`text-2xs flex items-center gap-2 ${c.ok ? 'text-emerald-600' : 'text-ink-500'}`}>
                    <span>{c.ok ? '✓' : '○'}</span> {c.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
