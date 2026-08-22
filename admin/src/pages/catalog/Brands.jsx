import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2, Merge, ArrowRight } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { num } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Code, Field, Input, Select, Checkbox, cx } from '@/components/ui';
import {
  DataTable,
  Pagination,
  FilterBar,
  SearchInput,
  FilterSelect,
} from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

/* =========================================================================
 * BRANDS
 * ======================================================================= */
export function Brands() {
  const { can } = useAuth();
  const canManage = can(P.BRANDS_MANAGE);

  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [homepage, setHomepage] = useState(''); // '' | '1' | '0' — is_featured filter

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Query string — when the path changes, useResource re-fetches on its own
  const queryParams = new URLSearchParams();
  if (search.trim()) queryParams.set('title', search.trim());
  if (status) queryParams.set('status', status);
  if (homepage !== '') queryParams.set('is_featured', homepage);
  queryParams.set('page', page);
  queryParams.set('limit', limit);

  const {
    data: response,
    loading,
    reload,
  } = useResource(`/admin/brands?${queryParams.toString()}`, true);

  const { data: categories } = useResource('/admin/categories');

  const rows = response?.data || [];
  const pagination = response?.pagination || {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  // Clear previously selected ids from older pages when the page/filters change
  useEffect(() => {
    setSelected([]);
  }, [page, limit, search, status, homepage]);

  const toggleOne = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const handlePageChange = (newPage) => setPage(Number(newPage));

  const handleSearch = (value) => { setSearch(value); setPage(1); };
  const handleStatus = (value) => { setStatus(value); setPage(1); };
  const handleHomepage = (value) => { setHomepage(value); setPage(1); };
  const clearFilters = () => { setSearch(''); setStatus(''); setHomepage(''); setPage(1); };
  const hasFilters = search.trim() || status || homepage !== '';

  const del = useMutation(
    (id) => api.del(`/admin/brands/${id}`),
    {
      success: 'Brand deleted',
      onSuccess: () => {
        setToDelete(null);
        setSelected((s) => s.filter((id) => id !== toDelete?.id));
        // If the last item on the current page was deleted, step back one page
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
      key: 'title', label: 'Brand',
      render: (b) => (
        <div className="flex items-center gap-2.5">
          {b.image_url ? (
            <img src={mediaUrl(b.image_url)} alt=""
              className="w-9 h-9 rounded object-contain border border-line bg-white p-0.5"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          ) : (
            <div className="w-9 h-9 rounded bg-paper-sunk border border-line flex items-center justify-center">
              <Building2 size={13} className="text-ink-300" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-ink">{b.title}</p>
            {b.slug && <Code className="text-2xs">/{b.slug}</Code>}
          </div>
        </div>
      ),
    },
    {
      key: 'live_product_count', label: 'Products', align: 'right',
      render: (b) => (
        <span className={cx('text-[0.8125rem] tabular-nums',
          Number(b.product_count) ? 'font-medium text-ink' : 'text-ink-300')}>
          {num(b.product_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'is_featured', label: 'Homepage', align: 'center',
      render: (b) => (Number(b.is_featured)
        ? <span className="text-2xs text-teal font-medium">Shop by brand</span>
        : <span className="text-2xs text-ink-300">—</span>),
    },
    {
      key: 'category_name', label: 'Links to',
      render: (b) => <span className="text-2xs text-ink-500">{b.category_name || '—'}</span>,
    },
    { key: 'status', label: 'Status', render: (b) => <StatusPill status={b.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (b) => canManage && (
        <div className="flex items-center justify-end gap-0.5">
          <Button size="xs" variant="ghost" onClick={() => setEditing(b)} title="Edit"><Pencil size={13} /></Button>
          <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(b)} title="Delete"><Trash2 size={13} /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Brands"
        subtitle="Homepage ka 'shop by brand' section"
        actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add brand</Button>}
      />

      <Card dense>
        <div className="mb-0">
          <FilterBar hasFilters={hasFilters} onReset={clearFilters}>
            <SearchInput value={search} onChange={handleSearch} placeholder="Search brands..." />
            <FilterSelect
              value={status}
              onChange={handleStatus}
              placeholder="All status"
              options={[
                { value: '', label: 'All status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <FilterSelect
              value={homepage}
              onChange={handleHomepage}
              placeholder="All brands"
              options={[
                { value: '', label: 'All brands' },
                { value: '1', label: 'On homepage' },
                { value: '0', label: 'Not on homepage' },
              ]}
            />
          </FilterBar>
        </div>

        {/* For merging duplicate brands — when "Cipla" and "Cipla Ltd" ended up separate */}
        {canManage && selected.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-ink text-white">
            <span className="text-[0.8125rem] font-medium tabular-nums">
              {selected.length} brands selected
            </span>
            <span className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={() => setMergeOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Merge size={11} /> Merge into one
            </button>
            <div className="flex-1" />
            <button onClick={() => setSelected([])}
              className="text-2xs text-white/60 hover:text-white">Clear</button>
          </div>
        )}

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="id"
          emptyIcon={Building2}
          emptyTitle={hasFilters ? 'No brands found' : 'No brands'}
          emptyDescription={hasFilters ? 'No brand matched the search/filter.' : 'Create the first brand for the homepage.'}
          emptyAction={canManage && !hasFilters && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add brand</Button>
          )}
        />

        {pagination.total > 0 && (
          <div className="mt-4 pt-3 border-t border-line">
            <Pagination pagination={pagination} onPage={handlePageChange} />
          </div>
        )}
      </Card>

      <MergeBrandsModal
        open={mergeOpen} onClose={() => setMergeOpen(false)}
        brands={rows.filter((b) => selected.includes(b.id))}
        onDone={() => { setMergeOpen(false); setSelected([]); reload(); }}
      />

      <BrandModal
        open={!!editing} onClose={() => setEditing(null)}
        brand={editing} categories={categories || []} onDone={reload}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete brand" confirmLabel="Delete"
        message={`"${toDelete?.title}" will be removed from the homepage.`}
      />
    </>
  );
}

function BrandModal({ open, onClose, brand, categories, onDone }) {
  const isEdit = !!brand?.id;
  const [form, setForm] = useState({});
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: brand?.title || '',
      slug: brand?.slug || '',
      description: brand?.description || '',
      category_id: brand?.category_id || '',
      is_featured: brand?.is_featured ? 1 : 0,
      status: brand?.status || 'active',
    });
    setImage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brand?.id]);

  const save = useMutation(
    async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      if (image) fd.append('image_url', image);
      return isEdit ? api.form(`/admin/brands/${brand.id}`, fd, 'PUT') : api.form('/admin/brands', fd, 'POST');
    },
    { success: isEdit ? 'Brand updated' : 'Brand created', onSuccess: () => { onClose(); onDone(); } }
  );

  return (
    <Modal
      open={open} onClose={onClose} title={isEdit ? 'Edit brand' : 'New brand'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Brand name" required>
          <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
        </Field>
        <Field label="Logo">
          <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])}
            className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs" />
        </Field>
        <Field label="Homepage pe dikhaye">
          <div className="pt-1">
            <Checkbox
              label='"Shop by brand" section me dikhao'
              checked={!!Number(form.is_featured)}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked ? 1 : 0 })}
            />
          </div>
        </Field>
        <Field label="Links to category" hint="Which category opens on click">
          <Select
            value={form.category_id || ''} placeholder="— None"
            options={categories.map((c) => ({ value: c.category_id, label: c.category_name }))}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <Select value={form.status || 'active'} options={['active', 'inactive']}
            onChange={(e) => setForm({ ...form, status: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Duplicate brands ko jodo.
 *
 * The brand mapping script normalizes names and merges them, but even so
 * cases like "Sun Pharma" and "Sun Pharmaceutical Industries" are left over
 * that do not match after normalization. The admin can link those manually here.
 */
function MergeBrandsModal({ open, onClose, brands, onDone }) {
  const [targetId, setTargetId] = useState('');

  // The brand with the most products is the default target — that shifts the fewest
  const suggested = [...brands].sort(
    (a, b) => (b.live_product_count || 0) - (a.live_product_count || 0)
  )[0];

  const target = brands.find((b) => b.id === Number(targetId)) || suggested;
  const others = brands.filter((b) => b.id !== target?.id);
  const movingCount = others.reduce((s, b) => s + Number(b.live_product_count || 0), 0);

  const merge = useMutation(
    () => api.post(`/admin/brands/${target.id}/merge`, {
      merge_ids: others.map((b) => b.id),
    }),
    { success: (res) => res.message, onSuccess: onDone }
  );

  if (!brands.length) return null;

  return (
    <Modal
      open={open} onClose={onClose}
      title="Merge brands into one"
      subtitle={`${brands.length} brands selected`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Merge} onClick={merge.run} loading={merge.loading}
            disabled={!target || !others.length}>
            Merge
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Which brand to keep" hint="The rest will be merged into it">
          <Select
            value={String(target?.id || '')}
            onChange={(e) => setTargetId(e.target.value)}
            options={brands.map((b) => ({
              value: b.id,
              label: `${b.title} (${b.live_product_count ?? 0} products)`,
            }))}
          />
        </Field>

        {target && others.length > 0 && (
          <div className="bg-paper-sunk rounded p-3 space-y-1.5">
            {others.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-2xs">
                <span className="text-ink-700 line-through">{b.title}</span>
                <ArrowRight size={11} className="text-ink-300 shrink-0" />
                <span className="text-ink font-medium">{target.title}</span>
                <span className="text-ink-500 tabular-nums ml-auto">
                  {num(b.live_product_count ?? 0)} products
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-2xs text-signal-warn bg-signal-warnBg border border-signal-warn/20 rounded px-3 py-2 leading-relaxed">
          {num(movingCount)} products <strong>{target?.title}</strong> will be moved to
          and the other {others.length} brands will be deleted. No products will be deleted, and
          unka purana <Code className="text-2xs">company_name</Code> text waise ka waisa rahega.
        </p>
      </div>
    </Modal>
  );
}