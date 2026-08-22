import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { BarChart3, Download, TrendingUp, Package, Users, MapPin, FileText, Ticket, Receipt } from 'lucide-react';
import { useResource } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P, DATE_PRESETS } from '@/lib/constants';
import { inr, compactInr, num, pct, date, titleCase } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, Select, Tabs, Code, StatusPill, SourceTag, EmptyState, Skeleton, cx,
} from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';

const TABS = [
  { value: 'sales', label: 'Sales' },
  { value: 'products', label: 'Products' },
  { value: 'customers', label: 'Customers' },
  { value: 'locations', label: 'Locations' },
  { value: 'prescriptions', label: 'Prescriptions' },
  { value: 'coupons', label: 'Coupons' },
  { value: 'gst', label: 'GST' },
];

export default function Reports() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('sales');
  const [preset, setPreset] = useState('month');
  const [source, setSource] = useState('');
  const [exporting, setExporting] = useState(false);

  const qs = `preset=${preset}${source ? `&orderFrom=${source}` : ''}`;

  const exportCsv = async (type) => {
    setExporting(true);
    try {
      const path = type === 'gst' ? '/admin/reports/gst' : '/admin/reports/export';
      await api.download(path, { preset, orderFrom: source, type, format: 'csv' }, `${type}-report.csv`);
      toast.success('Report downloaded');
    } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales, products and customers — full analysis"
        actions={
          <>
            <Select value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="Web + App"
              options={[{ value: 'web', label: 'Website only' }, { value: 'app', label: 'App only' }]}
              className="py-1.5 text-[0.8125rem] min-w-[130px]" />
            <Select value={preset} onChange={(e) => setPreset(e.target.value)}
              options={DATE_PRESETS} className="py-1.5 text-[0.8125rem] min-w-[140px]" />
            {can(P.REPORTS_EXPORT) && (
              <Button icon={Download} loading={exporting} onClick={() => exportCsv(tab)}>Export</Button>
            )}
          </>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4 bg-paper-card rounded-t-lg px-3 pt-1 border border-line border-b-0" />

      {tab === 'sales' && <SalesReport qs={qs} />}
      {tab === 'products' && <ProductsReport qs={qs} />}
      {tab === 'customers' && <CustomersReport qs={qs} />}
      {tab === 'locations' && <LocationsReport qs={qs} />}
      {tab === 'prescriptions' && <PrescriptionsReport qs={qs} />}
      {tab === 'coupons' && <CouponsReport qs={qs} />}
      {tab === 'gst' && <GstReport qs={qs} />}
    </>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function Metric({ label, value, sub, accent }) {
  return (
    <div className={cx('card p-3.5', accent && 'bg-ink border-ink')}>
      <p className={cx('text-2xs font-semibold uppercase tracking-wider mb-1.5',
        accent ? 'text-white/50' : 'text-ink-500')}>{label}</p>
      <p className={cx('text-xl font-semibold tabular-nums tracking-tight',
        accent ? 'text-white' : 'text-ink')}>{value}</p>
      {sub && <p className={cx('text-2xs mt-1 tabular-nums', accent ? 'text-white/40' : 'text-ink-500')}>{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function SalesReport({ qs }) {
  const { data, loading } = useResource(`/admin/reports/sales?${qs}&group_by=day`);
  if (loading) return <Loading />;
  if (!data) return null;

  const s = data.summary || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Revenue" value={compactInr(s.revenue)} accent sub={`${num(s.orders)} orders`} />
        <Metric label="Avg order value" value={compactInr(s.avg_order_value)} />
        <Metric label="GST collected" value={compactInr(s.gst_collected)} />
        <Metric label="Discount given" value={compactInr(s.discount_given)}
          sub={s.revenue ? pct(s.discount_given, s.revenue) : undefined} />
      </div>

      <Card title="Revenue over time" dense>
        {data.trend?.length ? (
          <div className="p-3">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="r2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0E7C7B" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#0E7C7B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#DDE5E7" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => compactInr(v).replace('₹', '')} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-ink text-white rounded-md px-3 py-2 shadow-pop">
                      <p className="font-mono text-2xs text-white/60 mb-1">{label}</p>
                      <p className="text-[0.8125rem] font-semibold tabular-nums">{inr(d.revenue)}</p>
                      <p className="text-2xs text-white/60 tabular-nums">{num(d.orders)} orders</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="revenue" stroke="#0E7C7B" strokeWidth={2} fill="url(#r2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState icon={TrendingUp} title="No sales in this period" />}
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Web vs App" dense>
          <div className="p-4 space-y-3">
            {(data.by_source || []).map((r) => (
              <div key={r.source} className="flex items-center justify-between gap-2">
                <SourceTag source={r.source} />
                <div className="text-right">
                  <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{compactInr(r.revenue)}</p>
                  <p className="text-2xs text-ink-500 tabular-nums">{num(r.orders)} orders</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="By status" dense>
          <div className="p-4 space-y-2">
            {(data.by_status || []).map((r) => (
              <div key={r.status} className="flex items-center justify-between gap-2">
                <StatusPill status={r.status} size="xs" />
                <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(r.orders)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="By payment" dense>
          <div className="p-4 space-y-2">
            {(data.by_payment || []).map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs uppercase font-semibold text-ink-700">{r.payment_mode || '—'}</span>
                  <StatusPill status={r.payment_status} size="xs" />
                </div>
                <span className="text-[0.8125rem] tabular-nums text-ink-700">{compactInr(r.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ProductsReport({ qs }) {
  const { data, loading } = useResource(`/admin/reports/products?${qs}&limit=20`);
  if (loading) return <Loading />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card title="Top selling products" subtitle="Units sold" dense>
        <DataTable
          rowKey="product_id" rows={data.top_products || []} compact
          columns={[
            { key: 'product_name', label: 'Product',
              render: (p) => (
                <div>
                  <p className="text-[0.8125rem] text-ink truncate max-w-[280px]">{p.product_name}</p>
                  {p.sku && <Code className="text-2xs">{p.sku}</Code>}
                </div>
              ) },
            { key: 'units_sold', label: 'Units', align: 'right',
              render: (p) => <span className="font-semibold tabular-nums text-ink">{num(p.units_sold)}</span> },
            { key: 'order_count', label: 'Orders', align: 'right',
              render: (p) => <span className="tabular-nums text-ink-700">{num(p.order_count)}</span> },
            { key: 'revenue', label: 'Revenue', align: 'right',
              render: (p) => <span className="tabular-nums font-medium text-ink">{inr(p.revenue)}</span> },
            { key: 'stock_quantity', label: 'In stock', align: 'right',
              render: (p) => (
                <span className={cx('tabular-nums', Number(p.stock_quantity) <= 0 ? 'text-signal-danger font-medium' : 'text-ink-700')}>
                  {num(p.stock_quantity)}
                </span>
              ) },
          ]}
          emptyIcon={Package} emptyTitle="Nothing sold in this period"
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Category performance" dense>
          <DataTable
            rowKey="category_id" rows={data.category_performance || []} compact
            columns={[
              { key: 'category_name', label: 'Category' },
              { key: 'units_sold', label: 'Units', align: 'right',
                render: (c) => <span className="tabular-nums text-ink-700">{num(c.units_sold)}</span> },
              { key: 'revenue', label: 'Revenue', align: 'right',
                render: (c) => <span className="tabular-nums font-medium text-ink">{compactInr(c.revenue)}</span> },
            ]}
            emptyIcon={Package} emptyTitle="No data"
          />
        </Card>

        <Card title="Dead stock" subtitle="Not a single sale in 90 days" dense>
          <DataTable
            rowKey="product_id" rows={data.non_moving || []} compact rowTone={() => 'warn'}
            columns={[
              { key: 'product_name', label: 'Product',
                render: (p) => <p className="text-[0.8125rem] text-ink truncate max-w-[200px]">{p.product_name}</p> },
              { key: 'stock_quantity', label: 'Stock', align: 'right',
                render: (p) => <span className="tabular-nums text-ink-700">{num(p.stock_quantity)}</span> },
              { key: 'stock_value', label: 'Value locked', align: 'right',
                render: (p) => <span className="tabular-nums font-medium text-signal-warn">{inr(p.stock_value)}</span> },
            ]}
            emptyIcon={Package} emptyTitle="Everything is selling"
            emptyDescription="No product has been stuck for 90 days."
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function CustomersReport({ qs }) {
  const { data, loading } = useResource(`/admin/reports/customers?${qs}&limit=20`);
  if (loading) return <Loading />;
  if (!data) return null;

  const r = data.retention || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Buyers" value={num(r.total_customers)} />
        <Metric label="Repeat buyers" value={num(r.repeat_customers)}
          sub={r.total_customers ? pct(r.repeat_customers, r.total_customers) : undefined} accent />
        <Metric label="One-time" value={num(r.one_time_customers)} />
        <Metric label="Avg orders/customer" value={Number(r.avg_orders_per_customer || 0).toFixed(1)} />
      </div>

      <Card title="Signups over time" dense>
        {data.growth?.length ? (
          <div className="p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.growth} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#DDE5E7" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#EDF1F1' }} content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-ink text-white rounded-md px-3 py-2 shadow-pop">
                      <p className="font-mono text-2xs text-white/60 mb-1">{label}</p>
                      <p className="text-[0.8125rem] font-semibold tabular-nums">{num(d.signups)} signups</p>
                      <p className="text-2xs text-white/60 tabular-nums">web {num(d.web_signups)} · app {num(d.app_signups)}</p>
                    </div>
                  );
                }} />
                <Bar dataKey="web_signups" stackId="a" fill="#8DA0AB" radius={[0, 0, 0, 0]} />
                <Bar dataKey="app_signups" stackId="a" fill="#0E7C7B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState icon={Users} title="No data" />}
      </Card>

      <Card title="Top customers" subtitle="Ranked by lifetime value" dense>
        <DataTable
          rowKey="customer_id" rows={data.top_customers || []} compact
          columns={[
            { key: 'customer_name', label: 'Customer',
              render: (c) => (
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] text-ink truncate max-w-[160px]">{c.customer_name || `#${c.customer_id}`}</p>
                    <Code className="text-2xs">{c.mobile}</Code>
                  </div>
                  <SourceTag source={c.platform} />
                </div>
              ) },
            { key: 'orders', label: 'Orders', align: 'right',
              render: (c) => <span className="tabular-nums text-ink-700">{num(c.orders)}</span> },
            { key: 'avg_order_value', label: 'AOV', align: 'right',
              render: (c) => <span className="tabular-nums text-ink-700">{inr(c.avg_order_value)}</span> },
            { key: 'total_spent', label: 'Lifetime', align: 'right',
              render: (c) => <span className="tabular-nums font-semibold text-ink">{inr(c.total_spent)}</span> },
            { key: 'last_order', label: 'Last order',
              render: (c) => <span className="text-2xs tabular-nums text-ink-500">{date(c.last_order)}</span> },
          ]}
          emptyIcon={Users} emptyTitle="No customers"
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function LocationsReport({ qs }) {
  const [by, setBy] = useState('city');
  const { data, loading } = useResource(`/admin/reports/locations?${qs}&by=${by}`);
  if (loading) return <Loading />;

  const rows = data?.rows || [];
  const max = Math.max(...rows.map((r) => Number(r.revenue)), 1);

  return (
    <Card
      title={`Sales by ${by}`}
      action={
        <Select value={by} onChange={(e) => setBy(e.target.value)}
          options={[{ value: 'city', label: 'City' }, { value: 'state', label: 'State' }]}
          className="py-1 text-2xs" />
      }
      dense
    >
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.location} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[0.8125rem] text-ink">{r.location}</span>
                <div className="text-right shrink-0">
                  <span className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(r.revenue)}</span>
                  <span className="text-2xs text-ink-500 tabular-nums ml-2">{num(r.orders)} orders</span>
                </div>
              </div>
              <div className="h-1 bg-paper-sunk rounded-full overflow-hidden">
                <div className="h-full bg-teal rounded-full" style={{ width: `${(r.revenue / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={MapPin} title="No location data" />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
function PrescriptionsReport({ qs }) {
  const { data, loading } = useResource(`/admin/reports/prescriptions?${qs}`);
  if (loading) return <Loading />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Metric label="Total uploads" value={num(data.total)} accent />
        <Metric label="Avg review time"
          value={data.avg_review_hours ? `${Number(data.avg_review_hours).toFixed(1)}h` : '—'}
          sub="upload se decision tak" />
        <Metric label="Sources" value={(data.bySource || []).map((s) => `${s.source} ${s.count}`).join(' · ') || '—'} />
      </div>

      <Card title="By status" dense>
        <div className="p-4 space-y-2.5">
          {(data.byStatus || []).map((s) => {
            const max = Math.max(...data.byStatus.map((x) => Number(x.count)), 1);
            return (
              <div key={s.status}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <StatusPill status={s.status} size="xs" />
                  <span className="text-[0.8125rem] tabular-nums font-medium text-ink">{num(s.count)}</span>
                </div>
                <div className="h-1 bg-paper-sunk rounded-full overflow-hidden">
                  <div className="h-full bg-teal rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {!data.byStatus?.length && <EmptyState icon={FileText} title="No prescriptions" />}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function CouponsReport({ qs }) {
  const { data, loading } = useResource(`/admin/reports/coupons?${qs}`);
  if (loading) return <Loading />;

  return (
    <Card title="Coupon performance" dense>
      <DataTable
        rowKey="coupon_id" rows={data?.rows || []} compact
        columns={[
          { key: 'coupon_code', label: 'Code',
            render: (c) => <span className="font-mono text-[0.8125rem] font-semibold text-ink">{c.coupon_code}</span> },
          { key: 'discount_type', label: 'Type',
            render: (c) => <span className="text-2xs text-ink-500">{c.discount_type}</span> },
          { key: 'times_used', label: 'Used', align: 'right',
            render: (c) => <span className="tabular-nums font-medium text-ink">{num(c.times_used)}</span> },
          { key: 'total_discount', label: 'Discount given', align: 'right',
            render: (c) => <span className="tabular-nums text-signal-warn">{inr(c.total_discount)}</span> },
          { key: 'revenue_generated', label: 'Revenue driven', align: 'right',
            render: (c) => <span className="tabular-nums font-semibold text-signal-ok">{inr(c.revenue_generated)}</span> },
        ]}
        emptyIcon={Ticket} emptyTitle="No coupon was used in this period"
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
function GstReport({ qs }) {
  const { data, loading } = useResource(`/admin/reports/gst?${qs}`);
  if (loading) return <Loading />;

  const rows = data?.rows || [];
  const totalTax = rows.reduce((s, r) => s + Number(r.tax_amount || 0), 0);
  const totalTaxable = rows.reduce((s, r) => s + Number(r.taxable_value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Taxable value" value={compactInr(totalTaxable)} />
        <Metric label="Tax collected" value={compactInr(totalTax)} accent />
      </div>

      <Card title="HSN-wise summary" subtitle="This is what the accountant needs" dense>
        <DataTable
          rowKey="hsn_code" rows={rows} compact
          columns={[
            { key: 'hsn_code', label: 'HSN', render: (r) => <Code>{r.hsn_code || '—'}</Code> },
            { key: 'tax_percent', label: 'Rate', align: 'right',
              render: (r) => <span className="tabular-nums text-ink-700">{r.tax_percent}%</span> },
            { key: 'orders', label: 'Orders', align: 'right',
              render: (r) => <span className="tabular-nums text-ink-700">{num(r.orders)}</span> },
            { key: 'taxable_value', label: 'Taxable value', align: 'right',
              render: (r) => <span className="tabular-nums text-ink-700">{inr(r.taxable_value)}</span> },
            { key: 'tax_amount', label: 'Tax', align: 'right',
              render: (r) => <span className="tabular-nums font-semibold text-ink">{inr(r.tax_amount)}</span> },
          ]}
          emptyIcon={Receipt} emptyTitle="No taxable sales in this period"
        />
      </Card>
    </div>
  );
}
