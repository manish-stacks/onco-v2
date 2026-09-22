import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Download, Printer, XCircle, Eye, MapPin } from 'lucide-react';
import { useList, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, tokenStore } from '@/lib/api';
import { PERMISSIONS as P, ORDER_STATUSES, PAYMENT_STATUSES, toneOf, paymentPillProps } from '@/lib/constants';
import { inr, num, dateTime, ago, orderRef } from '@/lib/format';
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

  const { rows, pagination, filters, setFilter, setManyFilters, resetFilters, loading, reload } = useList(
    '/admin/orders',
    { status: params.get('status') || '', orderFrom: params.get('orderFrom') || '' },
    { syncUrl: true }
  );

  const BASE = import.meta.env.VITE_API_BASE || '';
  const canShip = can(P.SHIPPING_MANAGE);

  // Print the DTDC label (auth header needed, so fetch the PDF blob and open it)
  const printLabel = async (awb) => {
    try {
      const res = await fetch(`${BASE}/api/admin/shipments/${awb}/label`, {
        headers: { Authorization: `Bearer ${tokenStore.get()}` },
      });
      if (!res.ok) throw new Error('Label could not be generated');
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Cancel the DTDC booking straight from the list (order itself is NOT cancelled)
  const cancelShipment = async (order) => {
    if (!window.confirm(`Cancel DTDC booking ${order.awb_number}? The order stays, only the shipment is cancelled.`)) return;
    try {
      await api.del(`/admin/orders/${order.order_id}/ship`);
      toast.success('Booking cancelled');
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

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
            <Code className="font-semibold text-ink">{orderRef(o)}</Code>
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
          <p className="text-[0.8125rem] font-semibold text-ink truncate max-w-[170px]">{o.customer_name}</p>
          <Code className="text-2xs">{o.customer_phone}</Code>
          {o.customer_email && <p className="text-2xs font-semibold text-ink-700 truncate max-w-[170px]">{o.customer_email}</p>}
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
          <StatusPill {...paymentPillProps(o)} size="xs" />
        </div>
      ),
    },
    {
      key: 'payment_mode', label: 'Payment',
      render: (o) => {
        const mode = String(o.payment_mode || '').toLowerCase();
        // POS orders store the actual method (Cash/UPI/Card/Bank Transfer/COD);
        // web/app orders only ever store 'cod' or 'online'. Was previously
        // collapsing everything non-COD to "Online", which mislabeled every
        // in-store Cash/UPI/Card/Bank-Transfer POS sale.
        const LABELS = {
          cod: 'Cash on Delivery', online: 'Online',
          cash: 'Cash', upi: 'UPI', card: 'Card (swipe machine)',
          'bank transfer': 'Bank transfer',
        };
        const label = LABELS[mode] || o.payment_mode || '—';
        return (
          <div className="text-2xs">
            <p className="font-semibold text-ink-700">{label}</p>
            {o.payment_gateway && mode === 'online' && (
              <p className="text-ink-500 capitalize">{o.payment_gateway}</p>
            )}
          </div>
        );
      },
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
    {
      key: '_ship_actions', label: 'Shipment', align: 'right',
      render: (o) => (o.awb_number && canShip
        ? (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="xs" icon={Printer} onClick={() => printLabel(o.awb_number)}>Label</Button>
            <Button size="xs" variant="dangerGhost" icon={XCircle} onClick={() => cancelShipment(o)}>Cancel</Button>
            <Button size="xs" variant="primary" icon={MapPin} onClick={() => window.open(`${import.meta.env.VITE_SITE_URL || 'https://oncohealthmart.com'}/track-shipment?awb=${o.awb_number}`, '_blank')}>Track</Button>
          </div>
        )
        : <span className="text-ink-300 text-2xs">—</span>),
    },
    {
      key: '_view', label: '', align: 'right',
      render: (o) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button size="xs" icon={Eye} onClick={() => navigate(`/orders/${o.order_id}`)}>View</Button>
        </div>
      ),
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
            options={[
              { value: 'Online', label: 'Online' },
              { value: 'COD', label: 'Cash on Delivery' },
              { value: 'Cash', label: 'Cash' },
              { value: 'UPI', label: 'UPI' },
              { value: 'Card', label: 'Card (swipe machine)' },
              { value: 'Bank Transfer', label: 'Bank transfer' },
            ]}
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
          // onRowClick={(o) => {
          //   // Selecting/copying text (e.g. the order ID or email) ends the
          //   // click on mouseup inside the row — without this check that
          //   // click still fired the row navigation, so copying a value
          //   // accidentally opened the order detail page every time.
          //   if (window.getSelection()?.toString()) return;
          //   navigate(`/orders/${o.order_id}`);
          // }}
          emptyIcon={ShoppingCart}
          emptyTitle="No orders found"
          emptyDescription={hasFilters ? 'Try removing the filters.' : 'New orders will appear here.'}
        />

        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>
    </>
  );
}
