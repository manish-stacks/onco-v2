import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Download } from 'lucide-react';
import { useList, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P, ORDER_STATUSES, PAYMENT_STATUSES, toneOf } from '@/lib/constants';
import { inr, num, dateTime, ago } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, SourceTag, Code, Tabs } from '@/components/ui';
import {
  DataTable, Pagination, FilterBar, SearchInput, FilterSelect, DateRangeFilter,
} from '@/components/ui/DataTable';

/**
 * Web and app orders in one list. Filtering happens via tabs —
 * ?orderFrom=web|app is sent to the backend.
 */
const SOURCE_TABS = [
  { value: '', label: 'All orders' },
  { value: 'web', label: 'Website' },
  { value: 'app', label: 'Mobile app' },
];

export default function OrderList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [exporting, setExporting] = useState(false);

  const { rows, pagination, filters, setFilter, setManyFilters, resetFilters, loading } = useList(
    '/admin/orders',
    { status: params.get('status') || '', orderFrom: params.get('orderFrom') || '' }
  );

  // debounced search -> filters
  if (filters.search !== debounced) setFilter('search', debounced);

  const hasFilters = !!(filters.status || filters.orderFrom || filters.payment_status
    || filters.from_date || filters.to_date || filters.search);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download('/admin/orders/export', filters, `orders-${Date.now()}.csv`);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: 'databaseOrderID', label: 'Order',
      render: (o) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Code>{o.databaseOrderID || `#${o.order_id}`}</Code>
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
      key: 'customer_city', label: 'Ship to',
      render: (o) => (
        <div className="text-2xs text-ink-500">
          <p className="text-ink-700">{o.customer_city || '—'}</p>
          <p>{o.customer_state}</p>
        </div>
      ),
    },
    {
      key: 'item_count', label: 'Items', align: 'center',
      render: (o) => <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(o.item_count)}</span>,
    },
    {
      key: 'amount', label: 'Amount', align: 'right', sortable: true,
      render: (o) => (
        <div>
          <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(o.amount)}</p>
          <StatusPill status={o.payment_status} size="xs" />
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (o) => <StatusPill status={o.status} />,
    },
    {
      key: 'awb_number', label: 'Tracking',
      render: (o) => (o.awb_number
        ? <div><Code className="text-2xs">{o.awb_number}</Code><p className="text-2xs text-ink-500">{o.courier_name}</p></div>
        : <span className="text-ink-300 text-2xs">—</span>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Orders from both the website and app — all in one place."
        actions={can(P.ORDERS_EXPORT) && (
          <Button icon={Download} onClick={exportCsv} loading={exporting}>Export CSV</Button>
        )}
      />

      <Card dense>
        <Tabs
          tabs={SOURCE_TABS}
          value={filters.orderFrom || ''}
          onChange={(v) => setFilter('orderFrom', v)}
          className="px-4 pt-1"
        />

        <FilterBar hasFilters={hasFilters} onReset={() => { setSearch(''); resetFilters(); }}>
          <SearchInput
            value={search} onChange={setSearch}
            placeholder="Order ref, naam, phone, AWB…" className="w-full sm:w-64"
          />
          <FilterSelect
            label="Status" value={filters.status} placeholder="All"
            options={ORDER_STATUSES} onChange={(v) => setFilter('status', v)}
          />
          <FilterSelect
            label="Payment" value={filters.payment_status} placeholder="All"
            options={PAYMENT_STATUSES} onChange={(v) => setFilter('payment_status', v)}
          />
          <FilterSelect
            label="Mode" value={filters.payment_mode} placeholder="All"
            options={[{ value: 'cod', label: 'COD' }, { value: 'online', label: 'Online' }]}
            onChange={(v) => setFilter('payment_mode', v)}
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
          rowTone={(o) => toneOf(o.status)}
          onRowClick={(o) => navigate(`/orders/${o.order_id}`)}
          emptyIcon={ShoppingCart}
          emptyTitle="No orders found"
          emptyDescription={hasFilters ? 'Try removing the filters.' : 'New orders will appear here.'}
        />

        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>
    </>
  );
}
