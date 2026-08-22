import { useState, useEffect } from 'react';
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { num } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Code, Field, Input, Select, Textarea } from '@/components/ui';
import {
  DataTable,
  Pagination,
  FilterBar,
  SearchInput,
  FilterSelect,
} from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

/* =========================================================================
 * CATEGORIES
 * ======================================================================= */
export function Categories() {
  const { can } = useAuth();
  const canManage = can(P.CATEGORIES_MANAGE);

  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryParams = new URLSearchParams();
  if (search.trim()) queryParams.set('category_name', search.trim());
  if (status) queryParams.set('status', status);
  queryParams.set('page', page);
  queryParams.set('limit', limit);

  const {
    data: response,
    loading,
    reload,
  } = useResource(`/admin/categories?${queryParams.toString()}`, true);

  // For the parent dropdown and parent-name lookup — the full list is needed,
  // otherwise the paginated table is limited to the current page and other
  // the page's parent cannot be matched at all.
  const { data: allCategoriesRes } = useResource('/admin/categories?limit=1000', true);
  const allCategories = allCategoriesRes?.data || [];

  const rows = response?.data || [];
  const pagination = response?.pagination || {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  const handlePageChange = (newPage) => setPage(Number(newPage));
  const handleSearch = (value) => { setSearch(value); setPage(1); };
  const handleStatus = (value) => { setStatus(value); setPage(1); };
  const clearFilters = () => { setSearch(''); setStatus(''); setPage(1); };
  const hasFilters = search.trim() || status;

  const del = useMutation(
    (id) => api.del(`/admin/categories/${id}`),
    {
      success: 'Category deleted',
      onSuccess: () => {
        setToDelete(null);
        if (rows.length === 1 && page > 1) {
          setPage((p) => p - 1);
        } else {
          reload();
        }
      },
    }
  );

  const columns = [
    {
      key: 'category_name', label: 'Category',
      render: (c) => (
        <div className="flex items-center gap-2.5">
          {c.category_image ? (
            <img src={mediaUrl(c.category_image)} alt=""
              className="w-8 h-8 rounded object-cover border border-line bg-paper-sunk"
              onError={(e) => { e.target.style.visibility = 'hidden'; }} />
          ) : (
            <div className="w-8 h-8 rounded bg-paper-sunk border border-line flex items-center justify-center">
              <Tags size={13} className="text-ink-300" />
            </div>
          )}
          <div>
            <p className="text-[0.8125rem] text-ink">{c.category_name}</p>
            {c.slug && <Code className="text-2xs">/{c.slug}</Code>}
          </div>
        </div>
      ),
    },
    {
      key: 'parent_id', label: 'Parent',
      render: (c) => {
        const parent = allCategories.find((r) => r.category_id === c.parent_id);
        return <span className="text-2xs text-ink-500">{parent?.category_name || '— top level'}</span>;
      },
    },
    {
      key: 'product_count', label: 'Products', align: 'right',
      render: (c) => <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(c.product_count)}</span>,
    },
    { key: 'status', label: 'Status', render: (c) => <StatusPill status={c.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => canManage && (
        <div className="flex items-center justify-end gap-0.5">
          <Button size="xs" variant="ghost" onClick={() => setEditing(c)} title="Edit"><Pencil size={13} /></Button>
          <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(c)} title="Delete"><Trash2 size={13} /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Catalog structure — you can also create sub-categories.
"
        actions={canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add category</Button>
        )}
      />

      <Card dense>
        <div className="mb-0">
          <FilterBar hasFilters={hasFilters} onReset={clearFilters}>
            <SearchInput value={search} onChange={handleSearch} placeholder="Search categories..." />
            <FilterSelect
              value={status}
              onChange={handleStatus}
              placeholder="All status"
              options={[
                { value: '', label: 'All status' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </FilterBar>
        </div>

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="category_id"
          rowTone={(c) => (c.status === 'Active' ? 'ok' : 'idle')}
          emptyIcon={Tags}
          emptyTitle={hasFilters ? 'No categories found' : 'No categories'}
          emptyDescription={hasFilters
            ? 'No category matched the search/filter.'
            : 'Create your first category to organise products.'}
          emptyAction={canManage && !hasFilters && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add category</Button>
          )}
        />

        {pagination.total > 0 && (
          <div className="mt-4 pt-3 border-t border-line">
            <Pagination pagination={pagination} onPage={handlePageChange} />
          </div>
        )}
      </Card>

      <CategoryModal
        open={!!editing} onClose={() => setEditing(null)}
        category={editing} categories={allCategories} onDone={reload}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.category_id)} loading={del.loading}
        title="Delete category" confirmLabel="Delete"
        message={`"${toDelete?.category_name}" will be deleted. No products will be deleted, they will just be removed from this category.`}
      />
    </>
  );
}

function CategoryModal({ open, onClose, category, categories, onDone }) {
  const isEdit = !!category?.category_id;
  const [form, setForm] = useState({});
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      category_name: category?.category_name || '',
      slug: category?.slug || '',
      parent_id: category?.parent_id || '',
      meta_title: category?.meta_title || '',
      meta_description: category?.meta_description || '',
      status: category?.status || 'Active',
    });
    setImage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.category_id]);

  const save = useMutation(
    async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      if (image) fd.append('category_image', image);
      return isEdit
        ? api.form(`/admin/categories/${category.category_id}`, fd, 'PUT')
        : api.form('/admin/categories', fd, 'POST');
    },
    { success: isEdit ? 'Category updated' : 'Category created', onSuccess: () => { onClose(); onDone(); } }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>
            {isEdit ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Category name" required>
          <Input value={form.category_name || ''} onChange={(e) => set('category_name', e.target.value)}
            placeholder="Oncology" autoFocus />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Slug" hint="Leave empty to generate it automatically">
            <Input mono value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="Parent category">
            <Select
              value={form.parent_id || ''} placeholder="— Top level"
              options={categories
                .filter((c) => c.category_id !== category?.category_id)
                .map((c) => ({ value: c.category_id, label: c.category_name }))}
              onChange={(e) => set('parent_id', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Image">
          <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])}
            className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs" />
        </Field>
        <Field label="Meta title">
          <Input value={form.meta_title || ''} onChange={(e) => set('meta_title', e.target.value)} />
        </Field>
        <Field label="Meta description">
          <Textarea rows={2} value={form.meta_description || ''}
            onChange={(e) => set('meta_description', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={form.status || 'Active'} options={['Active', 'Inactive']}
            onChange={(e) => set('status', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}