import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Plus, Download, Pencil, Trash2, EyeOff, Eye, Star, Zap, Flame,
  Sparkles, X, Building2,
} from 'lucide-react';
import { useList, useDebounced, useMutation, useResource } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { inr, num } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Code, Select, Checkbox, cx } from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/**
 * Merchandising flags. Har flag ka apna icon hai taaki list me ek nazar me
 * dikh jaaye kaunsa product kahan feature ho raha hai.
 */
const FLAGS = [
  { key: 'is_featured', label: 'Featured', short: 'F', icon: Star },
  { key: 'deal_of_the_day', label: 'Deal of the day', short: 'D', icon: Zap },
  { key: 'top_selling', label: 'Top selling', short: 'T', icon: Flame },
  { key: 'latest_product', label: 'Latest', short: 'L', icon: Sparkles },
];

export default function ProductList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [toDelete, setToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList('/admin/products');
  const { data: categories } = useResource('/admin/categories');
  const { data: brands } = useResource('/admin/brands');
  const { data: counts, reload: reloadCounts } = useResource('/admin/products/flag-counts');

  if (filters.search !== debounced) setFilter('search', debounced);

  const refresh = () => { reload(); reloadCounts(); };

  const del = useMutation(
    (id) => api.del(`/admin/products/${id}`),
    { success: 'Product delete ho gaya', onSuccess: () => { setToDelete(null); refresh(); } }
  );

  const toggleStatus = useMutation(
    ({ id, status }) => api.patch(`/admin/products/${id}/status`, { status }),
    { success: 'Status update ho gaya', onSuccess: refresh }
  );

  // Ek click me flag on/off — edit page kholne ki zaroorat nahi
  const toggleFlag = useMutation(
    ({ id, flag }) => api.patch(`/admin/products/${id}/flag`, { flag }),
    { onSuccess: refresh }
  );

  const bulkFlags = useMutation(
    (flags) => api.patch('/admin/products/bulk-flags', { product_ids: selected, flags }),
    { success: (res) => res.message, onSuccess: () => { setSelected([]); refresh(); } }
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download('/admin/products/export', filters, `products-${Date.now()}.csv`);
      toast.success('Export download ho gaya');
    } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };

  const hasFilters = !!(filters.search || filters.status || filters.category_id || filters.brand_id
    || filters.low_stock || filters.out_of_stock || filters.has_flag
    || FLAGS.some((f) => filters[f.key]));

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.product_id));
  const toggleOne = (id) => setSelected((s) => (
    s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
  ));

  const canUpdate = can(P.PRODUCTS_UPDATE);

  const columns = [
    ...(canUpdate ? [{
      key: 'select', label: '', headClass: 'w-8',
      render: (p) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.includes(p.product_id)} onChange={() => toggleOne(p.product_id)} />
        </span>
      ),
    }] : []),
    {
      key: 'product_name', label: 'Product',
      render: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          {p.image_1 ? (
            <img src={mediaUrl(p.image_1)} alt=""
              className="w-9 h-9 rounded object-cover border border-line shrink-0 bg-paper-sunk"
              onError={(e) => { e.target.style.visibility = 'hidden'; }} />
          ) : (
            <div className="w-9 h-9 rounded bg-paper-sunk border border-line flex items-center justify-center shrink-0">
              <Package size={13} className="text-ink-300" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-ink truncate max-w-[220px] leading-snug">{p.product_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {p.sku && <Code className="text-2xs">{p.sku}</Code>}
              {p.presciption_required === 'Yes' && (
                <span className="text-2xs text-signal-warn font-medium">Rx</span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'brand_name', label: 'Brand',
      render: (p) => (p.brand_name
        ? <span className="text-2xs text-ink-700">{p.brand_name}</span>
        : p.company_name
          ? <span className="text-2xs text-signal-warn" title="Brand link nahi hua">{p.company_name}</span>
          : <span className="text-ink-300 text-2xs">—</span>),
    },
    {
      key: 'flags', label: 'Merchandising', align: 'center',
      render: (p) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          {FLAGS.map((f) => {
            const on = p[f.key] === '1' || p[f.key] === 1;
            return (
              <button
                key={f.key}
                type="button"
                disabled={!canUpdate}
                title={`${f.label} — click to ${on ? 'hatao' : 'lagao'}`}
                onClick={() => toggleFlag.run({ id: p.product_id, flag: f.key })}
                className={cx(
                  'w-6 h-6 rounded border flex items-center justify-center transition-colors',
                  'disabled:cursor-default',
                  on
                    ? 'bg-teal border-teal text-white'
                    : 'bg-white border-line text-ink-300 hover:border-line-strong hover:text-ink-500'
                )}
              >
                <f.icon size={12} />
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'product_sp', label: 'Price', align: 'right', sortable: true,
      render: (p) => (
        <div>
          <p className="text-[0.8125rem] font-medium tabular-nums text-ink">{inr(p.product_sp)}</p>
          {Number(p.product_mrp) > Number(p.product_sp) && (
            <p className="text-2xs text-ink-300 line-through tabular-nums">{inr(p.product_mrp)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'stock_quantity', label: 'Stock', align: 'right', sortable: true,
      render: (p) => {
        const q = Number(p.stock_quantity);
        const low = q > 0 && q <= Number(p.low_stock_alert);
        return (
          <div>
            <p className={cx('text-[0.8125rem] font-semibold tabular-nums',
              q <= 0 ? 'text-signal-danger' : low ? 'text-signal-warn' : 'text-ink')}>
              {num(q)}
            </p>
            {(q <= 0 || low) && <p className="text-2xs text-ink-500">{q <= 0 ? 'out' : 'low'}</p>}
          </div>
        );
      },
    },
    {
      key: 'total_sold', label: 'Sold', align: 'right', sortable: true,
      render: (p) => <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(p.total_sold)}</span>,
    },
    { key: 'status', label: 'Status', render: (p) => <StatusPill status={p.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {canUpdate && (
            <>
              <Button size="xs" variant="ghost" title={p.status === 'Active' ? 'Hide' : 'Publish'}
                onClick={() => toggleStatus.run({ id: p.product_id, status: p.status === 'Active' ? 'Inactive' : 'Active' })}>
                {p.status === 'Active' ? <EyeOff size={13} /> : <Eye size={13} />}
              </Button>
              <Button size="xs" variant="ghost" title="Edit"
                onClick={() => navigate(`/products/${p.product_id}/edit`)}>
                <Pencil size={13} />
              </Button>
            </>
          )}
          {can(P.PRODUCTS_DELETE) && (
            <Button size="xs" variant="dangerGhost" title="Delete" onClick={() => setToDelete(p)}>
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${num(pagination.total)} products catalog me`}
        actions={
          <>
            {can(P.PRODUCTS_VIEW) && <Button icon={Download} onClick={exportCsv} loading={exporting}>Export</Button>}
            {can(P.PRODUCTS_CREATE) && (
              <Button variant="primary" icon={Plus} onClick={() => navigate('/products/new')}>
                Add product
              </Button>
            )}
          </>
        }
      />

      {/* Flag counts — click karke us flag pe filter lag jaata hai */}
      {counts && (
        <div className="flex flex-wrap gap-2 mb-4">
          {FLAGS.map((f) => {
            const active = filters[f.key] === 'true';
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key, active ? '' : 'true')}
                className={cx(
                  'inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-md border text-[0.8125rem] transition-colors',
                  active
                    ? 'bg-teal text-white border-teal'
                    : 'bg-paper-card border-line text-ink-700 hover:border-line-strong'
                )}
              >
                <f.icon size={14} className={active ? 'text-white' : 'text-ink-300'} />
                <span>{f.label}</span>
                <span className={cx('tabular-nums font-semibold',
                  active ? 'text-white' : 'text-ink')}>{num(counts[f.key])}</span>
              </button>
            );
          })}

          {Number(counts.no_brand) > 0 && (
            <button
              onClick={() => setFilter('no_brand', filters.no_brand === 'true' ? '' : 'true')}
              className={cx(
                'inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-md border text-[0.8125rem] transition-colors',
                filters.no_brand === 'true'
                  ? 'bg-signal-warn text-white border-signal-warn'
                  : 'bg-signal-warnBg border-signal-warn/25 text-signal-warn hover:border-signal-warn/50'
              )}
            >
              <Building2 size={14} />
              <span>Brand nahi laga</span>
              <span className="tabular-nums font-semibold">{num(counts.no_brand)}</span>
            </button>
          )}
        </div>
      )}

      <Card dense>
        <FilterBar hasFilters={hasFilters} onReset={() => { setSearch(''); resetFilters(); }}>
          <SearchInput value={search} onChange={setSearch}
            placeholder="Naam, SKU, salt, brand…" className="w-full sm:w-56" />
          <FilterSelect
            label="Category" value={filters.category_id} placeholder="All"
            options={(categories || []).map((c) => ({ value: c.category_id, label: c.category_name }))}
            onChange={(v) => setFilter('category_id', v)}
          />
          <FilterSelect
            label="Brand" value={filters.brand_id} placeholder="All"
            options={(brands || []).map((b) => ({
              value: b.id,
              label: `${b.title} (${b.live_product_count ?? 0})`,
            }))}
            onChange={(v) => setFilter('brand_id', v)}
          />
          <FilterSelect
            label="Merchandising" value={filters.has_flag} placeholder="All"
            options={[
              { value: 'true', label: 'Koi flag laga hai' },
              { value: 'false', label: 'Koi flag nahi' },
            ]}
            onChange={(v) => setFilter('has_flag', v)}
          />
          <FilterSelect
            label="Status" value={filters.status} placeholder="All"
            options={['Active', 'Inactive']} onChange={(v) => setFilter('status', v)}
          />
          <FilterSelect
            label="Stock" value={filters.low_stock ? 'low' : filters.out_of_stock ? 'out' : ''}
            placeholder="All"
            options={[{ value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }]}
            onChange={(v) => {
              setFilter('low_stock', v === 'low' ? 'true' : '');
              setFilter('out_of_stock', v === 'out' ? 'true' : '');
            }}
          />
        </FilterBar>

        {/* Bulk action bar — tabhi dikhta hai jab kuch select ho */}
        {canUpdate && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-ink text-white">
            <span className="text-[0.8125rem] font-medium tabular-nums">
              {selected.length} selected
            </span>
            <span className="w-px h-4 bg-white/20 mx-1" />

            {FLAGS.map((f) => (
              <span key={f.key} className="flex items-center gap-0.5">
                <button
                  onClick={() => bulkFlags.run({ [f.key]: true })}
                  disabled={bulkFlags.loading}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs bg-white/10 hover:bg-white/20 transition-colors"
                  title={`${f.label} lagao`}
                >
                  <f.icon size={11} /> +{f.short}
                </button>
                <button
                  onClick={() => bulkFlags.run({ [f.key]: false })}
                  disabled={bulkFlags.loading}
                  className="px-1.5 py-1 rounded text-2xs bg-white/5 hover:bg-white/20 transition-colors"
                  title={`${f.label} hatao`}
                >
                  −
                </button>
              </span>
            ))}

            <span className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={() => setBrandModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Building2 size={11} /> Brand set karo
            </button>

            <div className="flex-1" />
            <button onClick={() => setSelected([])}
              className="inline-flex items-center gap-1 text-2xs text-white/60 hover:text-white">
              <X size={12} /> Clear
            </button>
          </div>
        )}

        {/* Select all header */}
        {canUpdate && rows.length > 0 && (
          <div className="px-4 py-2 border-b border-line bg-paper">
            <Checkbox
              checked={allSelected}
              onChange={toggleAll}
              label={<span className="text-2xs text-ink-500">
                Is page ke saare {rows.length} products select karo
              </span>}
            />
          </div>
        )}

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="product_id"
          rowTone={(p) => (Number(p.stock_quantity) <= 0 ? 'danger'
            : Number(p.stock_quantity) <= Number(p.low_stock_alert) ? 'warn'
              : p.status === 'Active' ? 'ok' : 'idle')}
          onRowClick={(p) => navigate(`/products/${p.product_id}/edit`)}
          emptyIcon={Package}
          emptyTitle="Koi product nahi mila"
          emptyDescription={hasFilters ? 'Filters hata ke dekho.' : 'Pehla product add karo.'}
          emptyAction={can(P.PRODUCTS_CREATE) && (
            <Button variant="primary" icon={Plus} onClick={() => navigate('/products/new')}>Add product</Button>
          )}
        />

        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>

      <BulkBrandModal
        open={brandModalOpen} onClose={() => setBrandModalOpen(false)}
        brands={brands || []} count={selected.length}
        onDone={() => { setBrandModalOpen(false); setSelected([]); refresh(); }}
        productIds={selected}
      />

      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.product_id)}
        loading={del.loading}
        title="Delete product"
        confirmLabel="Delete permanently"
        message={`"${toDelete?.product_name}" hamesha ke liye delete ho jaayega. Purane orders me record rahega, lekin catalog se hat jaayega. Sirf hide karna ho to status Inactive kar do.`}
      />
    </>
  );
}

function BulkBrandModal({ open, onClose, brands, count, productIds, onDone }) {
  const [brandId, setBrandId] = useState('');

  const save = useMutation(
    () => api.patch('/admin/products/bulk-brand', {
      product_ids: productIds,
      brand_id: brandId || null,
    }),
    { success: (res) => res.message, onSuccess: onDone }
  );

  return (
    <Modal
      open={open} onClose={onClose} size="sm"
      title="Brand set karo" subtitle={`${count} products`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Set brand</Button>
        </>
      }
    >
      <div className="space-y-2">
        <span className="label">Brand</span>
        <Select
          value={brandId} onChange={(e) => setBrandId(e.target.value)}
          placeholder="— Brand hata do"
          options={brands.map((b) => ({
            value: b.id,
            label: `${b.title} (${b.live_product_count ?? 0} products)`,
          }))}
        />
        <p className="text-2xs text-ink-500 leading-relaxed pt-1">
          Khaali chhodoge to in products ka brand hat jaayega. Purana{' '}
          <Code className="text-2xs">company_name</Code> text waise ka waisa rahega.
        </p>
      </div>
    </Modal>
  );
}