import { useState } from 'react';
import { Ticket, Plus, Pencil, Trash2, Star, BarChart2, Check, X } from 'lucide-react';
import { useList, useResource, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { inr, num, date, dateTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, Code, Field, Input, Select, Textarea, Tabs, EmptyState, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

/* =========================================================================
 * COUPONS
 * ======================================================================= */
export function Coupons() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [usageOf, setUsageOf] = useState(null);

  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList('/admin/coupons');
  if (filters.search !== debounced) setFilter('search', debounced);

  const del = useMutation(
    (id) => api.del(`/admin/coupons/${id}`),
    { success: 'Coupon deleted', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.COUPONS_MANAGE);

  const columns = [
    {
      key: 'coupon_code', label: 'Code',
      render: (c) => (
        <div>
          <span className="font-mono text-[0.8125rem] font-semibold text-ink tracking-tight">{c.coupon_code}</span>
          {c.start_date && <p className="text-2xs text-ink-500 mt-0.5">from {date(c.start_date)}</p>}
        </div>
      ),
    },
    {
      key: 'discount', label: 'Discount',
      render: (c) => (
        <div>
          <p className="text-[0.8125rem] font-medium text-ink tabular-nums">
            {c.discount_type === 'Percentage' ? `${c.discount_percentage}%` : inr(c.discount_amount)}
          </p>
          {c.max_discount_amount && (
            <p className="text-2xs text-ink-500 tabular-nums">max {inr(c.max_discount_amount)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'minimum_amount', label: 'Min order', align: 'right',
      render: (c) => (
        <span className="text-[0.8125rem] tabular-nums text-ink-700">
          {c.minimum_amount ? inr(c.minimum_amount) : '—'}
        </span>
      ),
    },
    {
      key: 'used_count', label: 'Used', align: 'right',
      render: (c) => (
        <div>
          <p className="text-[0.8125rem] font-medium tabular-nums text-ink">{num(c.used_count)}</p>
          <p className="text-2xs text-ink-500 tabular-nums">
            {c.number_of_total_uses === null ? 'unlimited' : `${num(c.number_of_total_uses)} left`}
          </p>
        </div>
      ),
    },
    {
      key: 'expiry_date', label: 'Expires',
      render: (c) => {
        if (!c.expiry_date) return <span className="text-2xs text-ink-500">never</span>;
        const expired = new Date(c.expiry_date) < new Date();
        return (
          <span className={cx('text-2xs tabular-nums', expired ? 'text-signal-danger font-medium' : 'text-ink-700')}>
            {date(c.expiry_date)}{expired && ' · expired'}
          </span>
        );
      },
    },
    { key: 'status', label: 'Status', render: (c) => <StatusPill status={c.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button size="xs" variant="ghost" title="Usage report" onClick={() => setUsageOf(c)}>
            <BarChart2 size={13} />
          </Button>
          {canManage && (
            <>
              <Button size="xs" variant="ghost" onClick={() => setEditing(c)}><Pencil size={13} /></Button>
              <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(c)}><Trash2 size={13} /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Discount codes and their usage"
        actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New coupon</Button>}
      />

      <Card dense>
        <FilterBar hasFilters={!!(filters.search || filters.status)} onReset={() => { setSearch(''); resetFilters(); }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Coupon code…" className="w-full sm:w-56" />
          <FilterSelect label="Status" value={filters.status} placeholder="All"
            options={['Active', 'Inactive']} onChange={(v) => setFilter('status', v)} />
          <FilterSelect label="Validity" value={filters.expired} placeholder="All"
            options={[{ value: 'false', label: 'Valid' }, { value: 'true', label: 'Expired' }]}
            onChange={(v) => setFilter('expired', v)} />
        </FilterBar>

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="coupon_id"
          rowTone={(c) => {
            if (c.status !== 'Active') return 'idle';
            if (c.expiry_date && new Date(c.expiry_date) < new Date()) return 'danger';
            if (c.number_of_total_uses !== null && c.number_of_total_uses <= 0) return 'warn';
            return 'ok';
          }}
          emptyIcon={Ticket} emptyTitle="No coupons"
          emptyAction={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New coupon</Button>}
        />
        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>

      <CouponModal open={!!editing} onClose={() => setEditing(null)} coupon={editing} onDone={reload} />
      <UsageModal coupon={usageOf} onClose={() => setUsageOf(null)} />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.coupon_id)} loading={del.loading}
        title="Delete coupon" confirmLabel="Delete"
        message={`"${toDelete?.coupon_code}" will be deleted. Orders already placed with it are unaffected.`}
      />
    </>
  );
}

function CouponModal({ open, onClose, coupon, onDone }) {
  const isEdit = !!coupon?.coupon_id;
  const [form, setForm] = useState({});
  const [lastId, setLastId] = useState(null);

  if (open && lastId !== (coupon?.coupon_id ?? 'new')) {
    setLastId(coupon?.coupon_id ?? 'new');
    setForm({
      coupon_code: coupon?.coupon_code || '',
      discount_type: coupon?.discount_type || 'Percentage',
      discount_percentage: coupon?.discount_percentage || '',
      discount_amount: coupon?.discount_amount || '',
      max_discount_amount: coupon?.max_discount_amount || '',
      minimum_amount: coupon?.minimum_amount || '',
      number_of_total_uses: coupon?.number_of_total_uses ?? '',
      per_customer_limit: coupon?.per_customer_limit || '',
      start_date: coupon?.start_date ? String(coupon.start_date).slice(0, 10) : '',
      expiry_date: coupon?.expiry_date ? String(coupon.expiry_date).slice(0, 10) : '',
      status: coupon?.status || 'Active',
    });
  }

  const save = useMutation(
    () => {
      const body = { ...form };
      if (body.number_of_total_uses === '') body.number_of_total_uses = null;
      return isEdit
        ? api.put(`/admin/coupons/${coupon.coupon_id}`, body)
        : api.post('/admin/coupons', body);
    },
    { success: isEdit ? 'Coupon updated' : 'Coupon created', onSuccess: () => { onClose(); onDone(); } }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isPct = form.discount_type === 'Percentage';

  return (
    <Modal
      open={open} onClose={onClose} title={isEdit ? 'Edit coupon' : 'New coupon'} size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save coupon</Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Coupon code" required className="sm:col-span-2">
          <Input mono value={form.coupon_code || ''} placeholder="FIRST100" autoFocus
            onChange={(e) => set('coupon_code', e.target.value.toUpperCase())} />
        </Field>

        <Field label="Discount type" required>
          <Select value={form.discount_type} options={['Percentage', 'Fixed']}
            onChange={(e) => set('discount_type', e.target.value)} />
        </Field>

        {isPct ? (
          <Field label="Percentage off" required>
            <Input type="number" step="0.01" value={form.discount_percentage || ''}
              onChange={(e) => set('discount_percentage', e.target.value)} placeholder="10" />
          </Field>
        ) : (
          <Field label="Flat discount (₹)" required>
            <Input type="number" step="0.01" value={form.discount_amount || ''}
              onChange={(e) => set('discount_amount', e.target.value)} placeholder="100" />
          </Field>
        )}

        {isPct && (
          <Field label="Max discount cap (₹)" hint="Upper limit for a percentage discount">
            <Input type="number" value={form.max_discount_amount || ''}
              onChange={(e) => set('max_discount_amount', e.target.value)} placeholder="500" />
          </Field>
        )}

        <Field label="Minimum order (₹)">
          <Input type="number" value={form.minimum_amount || ''}
            onChange={(e) => set('minimum_amount', e.target.value)} placeholder="999" />
        </Field>

        <Field label="Total uses" hint="Leave empty for unlimited">
          <Input type="number" value={form.number_of_total_uses ?? ''}
            onChange={(e) => set('number_of_total_uses', e.target.value)} placeholder="unlimited" />
        </Field>

        <Field label="Per customer limit" hint="How many times one customer may use it">
          <Input type="number" value={form.per_customer_limit || ''}
            onChange={(e) => set('per_customer_limit', e.target.value)} placeholder="1" />
        </Field>

        <Field label="Starts on">
          <Input type="date" value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} />
        </Field>

        <Field label="Expires on">
          <Input type="date" value={form.expiry_date || ''} onChange={(e) => set('expiry_date', e.target.value)} />
        </Field>

        <Field label="Status">
          <Select value={form.status} options={['Active', 'Inactive']}
            onChange={(e) => set('status', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function UsageModal({ coupon, onClose }) {
  const { data, loading } = useResource(coupon ? `/admin/coupons/${coupon.coupon_id}/usage` : null);

  return (
    <Modal
      open={!!coupon} onClose={onClose} size="lg"
      title={`Usage — ${coupon?.coupon_code || ''}`}
      subtitle={data ? `${num(data.times_used)} times used · ${inr(data.total_discount_given)} discount given` : undefined}
    >
      {loading ? (
        <p className="text-sm text-ink-500 py-6 text-center">Loading…</p>
      ) : data?.usages?.length ? (
        <ul className="divide-y divide-line -mx-5">
          {data.usages.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] text-ink truncate">{u.customer_name || `Customer #${u.customer_id}`}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Code className="text-2xs">{u.databaseOrderID || `order #${u.order_id}`}</Code>
                  <span className="text-2xs text-ink-500">{dateTime(u.created_at)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[0.8125rem] font-semibold tabular-nums text-signal-ok">− {inr(u.discount_amount)}</p>
                <p className="text-2xs text-ink-500 tabular-nums">on {inr(u.order_amount)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Ticket} title="No usage yet" description="Nobody has applied this coupon yet." />
      )}
    </Modal>
  );
}

/* =========================================================================
 * REVIEWS
 * ======================================================================= */
const REVIEW_TABS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export function Reviews() {
  const { can } = useAuth();
  const { rows, pagination, filters, setFilter, loading, reload } = useList('/admin/reviews', { status: 'Pending' });
  const [toDelete, setToDelete] = useState(null);

  const moderate = useMutation(
    ({ id, status }) => api.patch(`/admin/reviews/${id}`, { status }),
    { success: 'Review updated', onSuccess: reload }
  );
  const del = useMutation(
    (id) => api.del(`/admin/reviews/${id}`),
    { success: 'Review deleted', onSuccess: () => { setToDelete(null); reload(); } }
  );

  const canManage = can(P.REVIEWS_MANAGE);

  const columns = [
    {
      key: 'rating', label: 'Rating', align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={11}
              className={i < r.rating ? 'fill-signal-warn text-signal-warn' : 'text-line-strong'} />
          ))}
        </div>
      ),
    },
    {
      key: 'review', label: 'Review',
      render: (r) => (
        <div className="min-w-0 max-w-md">
          {r.title && <p className="text-[0.8125rem] font-medium text-ink">{r.title}</p>}
          <p className="text-2xs text-ink-700 leading-relaxed line-clamp-2">{r.review || '—'}</p>
        </div>
      ),
    },
    {
      key: 'product_name', label: 'Product',
      render: (r) => <p className="text-2xs text-ink-500 truncate max-w-[160px]">{r.product_name}</p>,
    },
    {
      key: 'customer_name', label: 'By',
      render: (r) => (
        <div className="text-2xs">
          <p className="text-ink-700">{r.customer_name}</p>
          <p className="text-ink-500">{dateTime(r.created_at)}</p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} size="xs" /> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => canManage && (
        <div className="flex items-center justify-end gap-0.5">
          {r.status !== 'Approved' && (
            <Button size="xs" variant="ghost" title="Approve"
              onClick={() => moderate.run({ id: r.review_id, status: 'Approved' })}>
              <Check size={13} className="text-signal-ok" />
            </Button>
          )}
          {r.status !== 'Rejected' && (
            <Button size="xs" variant="ghost" title="Reject"
              onClick={() => moderate.run({ id: r.review_id, status: 'Rejected' })}>
              <X size={13} className="text-signal-danger" />
            </Button>
          )}
          <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(r)}><Trash2 size={13} /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Product reviews" subtitle="Only visible on the site once approved" />

      <Card dense>
        <Tabs tabs={REVIEW_TABS} value={filters.status ?? ''}
          onChange={(v) => setFilter('status', v)} className="px-4 pt-1" />

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="review_id"
          rowTone={(r) => (r.status === 'Approved' ? 'ok' : r.status === 'Rejected' ? 'danger' : 'warn')}
          emptyIcon={Star} emptyTitle="No reviews"
          emptyDescription="Customer reviews will arrive here for moderation."
        />
        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>

      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.review_id)} loading={del.loading}
        title="Delete review" confirmLabel="Delete"
        message="This review will be permanently deleted."
      />
    </>
  );
}
