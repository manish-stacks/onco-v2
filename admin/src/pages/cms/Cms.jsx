import { useState } from 'react';
import { Newspaper, Plus, Pencil, Trash2, FileText, Mail, Check, Inbox } from 'lucide-react';
import { useList, useResource, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { date, dateTime, truncate } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, Code, Field, Input, Select, Textarea, Tabs, EmptyState, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

const TABS = [
  { value: 'pages', label: 'Pages' },
  { value: 'news', label: 'News & blog' },
  { value: 'enquiries', label: 'Enquiries' },
];

export default function Cms() {
  const [tab, setTab] = useState('pages');

  return (
    <>
      <PageHeader
        title="Content"
        subtitle="Static pages, blog posts and customer enquiries"
      />
      <Card dense>
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="px-4 pt-1" />
        {tab === 'pages' && <Pages />}
        {tab === 'news' && <News />}
        {tab === 'enquiries' && <Enquiries />}
      </Card>
    </>
  );
}

/* =========================================================================
 * PAGES — about us, privacy policy, terms
 * ======================================================================= */
function Pages() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/pages');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation((id) => api.del(`/admin/pages/${id}`),
    { success: 'Page deleted', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.CMS_MANAGE);

  return (
    <>
      {canManage && (
        <div className="px-4 py-3 border-b border-line bg-paper">
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing({})}>New page</Button>
        </div>
      )}

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
                {p.seo_title || <span className="text-signal-warn">not set</span>}
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
        emptyIcon={FileText} emptyTitle="No pages"
        emptyDescription="About us, privacy policy, terms — all of these are created here."
        emptyAction={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New page</Button>}
      />

      <PageModal open={!!editing} onClose={() => setEditing(null)} page={editing} onDone={reload} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.page_id)} loading={del.loading}
        title="Delete page" confirmLabel="Delete"
        message={`"${toDelete?.name}" will be deleted and /${toDelete?.slug} will return a 404.`} />
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
    { success: isEdit ? 'Page updated' : 'Page created', onSuccess: () => { onClose(); onDone(); } }
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
          <Field label="URL slug" hint="Leave empty to generate it from the name">
            <Input mono value={form.slug || ''} onChange={(e) => set('slug', e.target.value)}
              placeholder="privacy-policy" />
          </Field>
          <Field label="Type" hint="Used for grouping — optional">
            <Input value={form.type || ''} onChange={(e) => set('type', e.target.value)}
              placeholder="legal" />
          </Field>
        </div>

        <Field label="Content">
          <RichTextEditor rows={12} value={form.content} onChange={(v) => set('content', v)}
            placeholder="Write the page content here…" />
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

/* =========================================================================
 * NEWS / BLOG
 * ======================================================================= */
function News() {
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
      <FilterBar hasFilters={!!(filters.search || filters.status)} onReset={() => { setSearch(''); resetFilters(); }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Title ya excerpt…" className="w-full sm:w-56" />
        <FilterSelect label="Status" value={filters.status} placeholder="All"
          options={['active', 'inactive']} onChange={(v) => setFilter('status', v)} />
        <div className="flex-1" />
        {canManage && <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({})}>New post</Button>}
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
        emptyIcon={Newspaper} emptyTitle="No posts"
        emptyAction={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New post</Button>}
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />

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
    { success: isEdit ? 'Post updated' : 'Post published', onSuccess: () => { onClose(); onDone(); } }
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

        <Field label="Excerpt" hint="The summary shown on the listing">
          <Textarea rows={2} value={form.excerpt || ''} onChange={(e) => set('excerpt', e.target.value)} />
        </Field>

        <Field label="Content">
          <RichTextEditor rows={10} value={form.content} onChange={(v) => set('content', v)}
            placeholder="Write the post content here…" />
        </Field>
      </div>
    </Modal>
  );
}

/* =========================================================================
 * CONTACT ENQUIRIES
 * ======================================================================= */
function Enquiries() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList('/admin/enquiries');
  const [toDelete, setToDelete] = useState(null);
  const [reading, setReading] = useState(null);

  if (filters.search !== debounced) setFilter('search', debounced);

  const resolve = useMutation(
    ({ id, solved }) => api.patch(`/admin/enquiries/${id}`, { solved }),
    { success: 'Enquiry updated', onSuccess: reload }
  );
  const del = useMutation((id) => api.del(`/admin/enquiries/${id}`),
    { success: 'Enquiry deleted', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.CMS_MANAGE);

  return (
    <>
      <FilterBar hasFilters={!!(filters.search || filters.issue_solved)} onReset={() => { setSearch(''); resetFilters(); }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Naam, email, issue…" className="w-full sm:w-56" />
        <FilterSelect label="State" value={filters.issue_solved} placeholder="All"
          options={[{ value: '0', label: 'Open' }, { value: '1', label: 'Resolved' }]}
          onChange={(v) => setFilter('issue_solved', v)} />
      </FilterBar>

      <DataTable
        rowKey="id" rows={rows} loading={loading}
        rowTone={(e) => (Number(e.issue_solved) ? 'ok' : 'warn')}
        onRowClick={(e) => setReading(e)}
        columns={[
          {
            key: 'name', label: 'From',
            render: (e) => (
              <div className="min-w-0">
                <p className="text-[0.8125rem] text-ink">{e.name}</p>
                <p className="text-2xs text-ink-500 truncate max-w-[180px]">{e.email}</p>
              </div>
            ),
          },
          {
            key: 'issue', label: 'Issue',
            render: (e) => (
              <div className="min-w-0 max-w-md">
                <p className="text-[0.8125rem] text-ink-700">{e.issue || '—'}</p>
                <p className="text-2xs text-ink-500 line-clamp-1">{truncate(e.message, 70)}</p>
              </div>
            ),
          },
          {
            key: 'number', label: 'Phone',
            render: (e) => (e.number ? <Code className="text-2xs">{e.number}</Code> : <span className="text-ink-300">—</span>),
          },
          {
            key: 'date', label: 'Received',
            render: (e) => <span className="text-2xs tabular-nums text-ink-500">{dateTime(e.date)}</span>,
          },
          {
            key: 'issue_solved', label: 'State',
            render: (e) => <StatusPill status={Number(e.issue_solved) ? 'Resolved' : 'Open'}
              tone={Number(e.issue_solved) ? 'ok' : 'warn'} size="xs" />,
          },
          {
            key: 'actions', label: '', align: 'right',
            render: (e) => canManage && (
              <div className="flex justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                {!Number(e.issue_solved) && (
                  <Button size="xs" variant="ghost" title="Mark resolved"
                    onClick={() => resolve.run({ id: e.id, solved: true })}>
                    <Check size={13} className="text-signal-ok" />
                  </Button>
                )}
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(e)}><Trash2 size={13} /></Button>
              </div>
            ),
          },
        ]}
        emptyIcon={Inbox} emptyTitle="No enquiries"
        emptyDescription="Messages from the contact form will appear here."
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />

      <Modal
        open={!!reading} onClose={() => setReading(null)}
        title={reading?.issue || 'Enquiry'}
        subtitle={reading ? `${reading.name} · ${dateTime(reading.date)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReading(null)}>Close</Button>
            {reading && !Number(reading.issue_solved) && canManage && (
              <Button variant="primary" icon={Check}
                onClick={() => { resolve.run({ id: reading.id, solved: true }); setReading(null); }}>
                Mark resolved
              </Button>
            )}
          </>
        }
      >
        {reading && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-2xs">
              <a href={`mailto:${reading.email}`} className="inline-flex items-center gap-1 text-teal hover:underline">
                <Mail size={12} /> {reading.email}
              </a>
              {reading.number ? <Code>{reading.number}</Code> : null}
            </div>
            <div className="bg-paper-sunk rounded p-3">
              <p className="text-[0.8125rem] text-ink-700 leading-relaxed whitespace-pre-wrap">
                {reading.message || 'No message was written.'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete enquiry" confirmLabel="Delete"
        message={`${toDelete?.name} 's enquiry will be deleted.`} />
    </>
  );
}
