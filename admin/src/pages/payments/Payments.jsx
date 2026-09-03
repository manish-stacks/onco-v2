import { useState } from 'react';
import { CreditCard, Landmark } from 'lucide-react';
import { useList, useDebounced } from '@/hooks/useApi';
import { PERMISSIONS as P } from '@/lib/constants';
import { inr, compactInr, num, ago, orderRef } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Code, StatusPill, SourceTag, cx } from '@/components/ui';
import {
  DataTable, Pagination, FilterBar, SearchInput, FilterSelect, DateRangeFilter,
} from '@/components/ui/DataTable';

/**
 * Every gateway/method value that can end up in orders.payment_gateway —
 * 'razorpay' / 'payu' come from the checkout gateway, the rest are what
 * the admin picks at the POS counter (or 'cod' / 'offline' for a plain
 * cash-on-delivery order).
 */
const GATEWAYS = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'payu', label: 'PayU' },
  { value: 'cod', label: 'COD (online checkout)' },
  { value: 'Cash', label: 'Cash (counter)' },
  { value: 'UPI', label: 'UPI (counter)' },
  { value: 'Card', label: 'Card / swipe machine' },
  { value: 'Bank Transfer', label: 'Bank transfer' },
  { value: 'offline', label: 'Offline (other)' },
];

const GATEWAY_LABEL = Object.fromEntries(GATEWAYS.map((g) => [g.value, g.label]));

function Metric({ label, value, sub, icon: Icon }) {
  return (
    <div className="card p-3.5 flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <Icon size={15} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-1">{label}</p>
        <p className="text-lg font-semibold tabular-nums tracking-tight text-ink truncate">{value}</p>
        {sub && <p className="text-2xs mt-0.5 tabular-nums text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function Payments() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const { rows, pagination, extra, filters, setFilter, resetFilters, loading } = useList(
    '/admin/payments', {}
  );

  if (filters.search !== debounced) setFilter('search', debounced);

  const hasFilters = !!(filters.payment_mode || filters.payment_gateway || filters.payment_status
    || filters.from_date || filters.to_date || filters.search);

  const summary = extra?.summary || [];
  const totalRevenue = summary.reduce((a, r) => a + Number(r.revenue || 0), 0);
  const totalOrders = summary.reduce((a, r) => a + Number(r.orders || 0), 0);
  const codTotal = summary.filter((r) => r.payment_mode === 'cod')
    .reduce((a, r) => a + Number(r.revenue || 0), 0);
  const onlineTotal = totalRevenue - codTotal;

  const columns = [
    {
      key: 'databaseOrderID', label: 'Order',
      render: (o) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Code>{orderRef(o)}</Code>
            <SourceTag source={o.orderFrom} />
          </div>
          <p className="text-2xs text-ink-500 mt-0.5">{ago(o.order_date)}</p>
        </div>
      ),
    },
    {
      key: 'customer_name', label: 'Customer',
      render: (o) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-ink truncate max-w-[170px]">{o.customer_name}</p>
          <Code className="text-2xs">{o.customer_phone}</Code>
        </div>
      ),
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: (o) => <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(o.amount)}</p>,
    },
    {
      key: 'payment_mode', label: 'Mode',
      render: (o) => (
        <span className={cx(
          'inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold uppercase',
          o.payment_mode === 'cod' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
        )}>
          {o.payment_mode === 'cod' ? 'COD' : 'Online'}
        </span>
      ),
    },
    {
      key: 'payment_gateway', label: 'Received via',
      render: (o) => (
        <span className="text-[0.8125rem] text-ink-700">
          {GATEWAY_LABEL[o.payment_gateway] || o.payment_gateway || '—'}
        </span>
      ),
    },
    {
      key: 'transaction_number', label: 'Transaction / Ref',
      render: (o) => (o.transaction_number
        ? <Code className="text-2xs">{o.transaction_number}</Code>
        : <span className="text-ink-300 text-2xs">—</span>),
    },
    {
      key: 'payment_status', label: 'Status',
      render: (o) => <StatusPill status={o.payment_status} size="xs" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Every order's payment in one place — match it against your Razorpay / PayU / bank statements."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Metric label="Total received" value={compactInr(totalRevenue)} sub={`${num(totalOrders)} orders`} icon={Landmark} />
        <Metric label="COD" value={compactInr(codTotal)} icon={CreditCard} />
        <Metric label="Online (Razorpay/PayU/etc)" value={compactInr(onlineTotal)} icon={CreditCard} />
      </div>

      {!!summary.length && (
        <Card title="By gateway / method" dense className="mb-4">
          <div className="grid gap-0 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
            {summary.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.8125rem] font-medium text-ink-700">
                    {GATEWAY_LABEL[r.payment_gateway] || r.payment_gateway || 'Unknown'}
                  </span>
                  <span className={cx(
                    'rounded-full px-1.5 py-0.5 text-2xs font-semibold uppercase',
                    r.payment_mode === 'cod' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
                  )}>
                    {r.payment_mode === 'cod' ? 'COD' : 'Online'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{compactInr(r.revenue)}</p>
                  <p className="text-2xs text-ink-500 tabular-nums">{num(r.orders)} orders</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card dense>
        <FilterBar hasFilters={hasFilters} onReset={() => { setSearch(''); resetFilters(); }}>
          <SearchInput
            value={search} onChange={setSearch}
            placeholder="Order ref, name, phone…" className="w-full sm:w-64"
          />
          <FilterSelect
            label="Mode" value={filters.payment_mode} placeholder="Online or offline"
            options={[{ value: 'cod', label: 'COD' }, { value: 'online', label: 'Online' }]}
            onChange={(v) => setFilter('payment_mode', v)}
          />
          <FilterSelect
            label="Received via" value={filters.payment_gateway} placeholder="All gateways"
            options={GATEWAYS} onChange={(v) => setFilter('payment_gateway', v)}
          />
          <FilterSelect
            label="Status" value={filters.payment_status} placeholder="All"
            options={['Unpaid', 'Paid', 'Failed', 'Refunded', 'Partially Refunded']}
            onChange={(v) => setFilter('payment_status', v)}
          />
          <DateRangeFilter
            from={filters.from_date} to={filters.to_date}
            onFrom={(v) => setFilter('from_date', v)} onTo={(v) => setFilter('to_date', v)}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowKey="order_id"
          emptyIcon={CreditCard}
          emptyTitle="No payments found"
          emptyDescription={hasFilters ? 'Try removing the filters.' : 'Payments will appear here as orders come in.'}
        />

        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>
    </>
  );
}
