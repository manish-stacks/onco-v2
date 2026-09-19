import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  ShoppingCart, IndianRupee, Users, Package, AlertTriangle, CalendarClock,
  FileText, TrendingUp, ArrowRight, Wrench,
} from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { DATE_PRESETS, TONE_HEX, toneOf } from '@/lib/constants';
import { compactInr, inr, num, date, ago, orderRef } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Select, StatusPill, Code, SourceTag, PageLoader, EmptyState, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { Health } from '@/pages/system/System';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS as P } from '@/lib/constants';

/** Quick on/off for the whole storefront (website + app) — Settings > General
 *  has the full form with a custom message, this is the one-click version for
 *  "site is down for a bit, put up the maintenance page right now". */
function MaintenanceToggle() {
  const { can } = useAuth();
  const { data, reload } = useResource('/admin/settings');
  const on = !!Number(data?.maintenance_mode);

  const toggle = useMutation(
    () => api.put(`/admin/settings/${data.id}`, { maintenance_mode: on ? 0 : 1 }),
    { success: on ? 'Site is back online' : 'Site is now in maintenance mode', onSuccess: reload }
  );

  if (!data || !can(P.SETTINGS_MANAGE)) return null;

  return (
    <div className={cx(
      'mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3',
      on ? 'border-signal-danger/30 bg-signal-dangerBg' : 'border-line bg-white'
    )}>
      <div className="flex items-center gap-3">
        <Wrench className={cx('w-4 h-4 shrink-0', on ? 'text-signal-danger' : 'text-ink-400')} />
        <div>
          <p className="text-[0.8125rem] font-semibold text-ink">Site maintenance mode</p>
          <p className="text-2xs text-ink-500">
            {on
              ? 'The website and app are showing the maintenance page to everyone right now.'
              : 'Website and app are live. Turn this on to take the storefront offline temporarily.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle.run}
        disabled={toggle.loading}
        className={cx(
          'shrink-0 px-3 py-1.5 rounded-md text-[0.8125rem] font-medium border transition-colors disabled:opacity-50',
          on
            ? 'bg-white border-signal-danger/30 text-signal-danger hover:bg-signal-dangerBg'
            : 'bg-ink text-white border-ink hover:opacity-90'
        )}
      >
        {toggle.loading ? 'Saving…' : on ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [preset, setPreset] = useState('month');
  const { can } = useAuth();
  const { data, loading } = useResource(`/admin/dashboard?preset=${preset}`);

  if (loading && !data) return <PageLoader label="Loading the dashboard…" />;
  if (!data) return <EmptyState icon={TrendingUp} title="No dashboard data" description="Try refreshing the page." />;

  const c = data.cards || {};

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={data.period?.from ? `${date(data.period.from)} – ${date(data.period.to)}` : undefined}
        actions={
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            options={DATE_PRESETS}
            className="py-1.5 text-[0.8125rem] min-w-[150px]"
          />
        }
      />

      <MaintenanceToggle />

      {/* System health — if something is down, show it first */}
      {can(P.SYSTEM_VIEW) && <Health compact />}

      {/* Alerts — these need action */}
      <AlertStrip cards={c} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Orders" value={num(c.period_orders)} icon={ShoppingCart}
          foot={`${num(c.lifetime_orders)} lifetime`} />
        <Stat label="Revenue" value={compactInr(c.period_revenue)} icon={IndianRupee} accent
          foot={`AOV ${compactInr(c.avg_order_value)}`} />
        <Stat label="Customers" value={num(c.total_customers)} icon={Users}
          foot={`${num(c.today_signups)} aaj join hue`} />
        <Stat label="Stock value" value={compactInr(c.stock_value)} icon={Package}
          foot={`${num(c.total_products)} products`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Sales trend" subtitle="Order count aur revenue" className="lg:col-span-2" dense>
          <TrendChart rows={data.sales_trend} />
        </Card>

        <Card title="Web vs App" subtitle="Where orders are coming from" dense>
          <SourceSplit rows={data.orders_by_source} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Order pipeline" subtitle="Status wise" dense>
          <StatusBreakdown rows={data.orders_by_status} />
        </Card>

        <Card
          title="Top products" subtitle="Best sellers"
          action={<Link to="/reports" className="text-2xs text-teal hover:underline">Full report</Link>}
          className="lg:col-span-2" dense
        >
          <TopProducts rows={data.top_products} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card
          title="Stock is running out"
          subtitle="Below the low stock alert"
          action={<Link to="/inventory" className="text-2xs text-teal hover:underline">Inventory</Link>}
          dense
        >
          <LowStockList rows={data.low_stock_products} />
        </Card>

        <Card
          title="Latest orders"
          action={<Link to="/orders" className="text-2xs text-teal hover:underline">All orders</Link>}
          dense
        >
          <RecentOrders rows={data.recent_orders} />
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
function AlertStrip({ cards }) {
  const alerts = [
    { n: cards.out_of_stock_count, label: 'products out of stock', to: '/inventory?out_of_stock=true', tone: 'danger', icon: AlertTriangle },
    { n: cards.low_stock_count, label: 'products low on stock', to: '/inventory', tone: 'warn', icon: Package },
    { n: cards.expiring_soon, label: 'batches expiring in 90 days', to: '/inventory', tone: 'warn', icon: CalendarClock },
    { n: cards.pending_prescriptions, label: 'prescriptions awaiting review', to: '/prescriptions?status=Pending', tone: 'info', icon: FileText },
  ].filter((a) => a.n > 0);

  if (!alerts.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {alerts.map((a) => (
        <Link
          key={a.label}
          to={a.to}
          className={cx(
            'group inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-md border text-[0.8125rem] transition-colors',
            a.tone === 'danger' && 'bg-signal-dangerBg border-signal-danger/25 text-signal-danger hover:border-signal-danger/50',
            a.tone === 'warn' && 'bg-signal-warnBg border-signal-warn/25 text-signal-warn hover:border-signal-warn/50',
            a.tone === 'info' && 'bg-signal-infoBg border-signal-info/25 text-signal-info hover:border-signal-info/50'
          )}
        >
          <a.icon size={14} />
          <span><span className="font-semibold tabular-nums">{num(a.n)}</span> {a.label}</span>
          <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value, foot, icon: Icon, accent }) {
  return (
    <div className={cx('card p-4', accent && 'bg-ink border-ink')}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={cx('text-2xs font-semibold uppercase tracking-wider', accent ? 'text-white/50' : 'text-ink-500')}>
          {label}
        </p>
        <Icon size={15} className={accent ? 'text-teal' : 'text-ink-300'} />
      </div>
      <p className={cx('text-2xl font-semibold tracking-tight tabular-nums leading-none', accent ? 'text-white' : 'text-ink')}>
        {value}
      </p>
      {foot && (
        <p className={cx('text-2xs mt-2 tabular-nums', accent ? 'text-white/40' : 'text-ink-500')}>{foot}</p>
      )}
    </div>
  );
}

function TrendChart({ rows = [] }) {
  if (!rows.length) return <EmptyState icon={TrendingUp} title="No orders in this period" />;

  return (
    <div className="p-3">
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0E7C7B" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#0E7C7B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#DDE5E7" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => compactInr(v).replace('₹', '')} />
          <Tooltip content={<ChartTip />} />
          <Area type="monotone" dataKey="revenue" stroke="#0E7C7B" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-ink text-white rounded-md px-3 py-2 shadow-pop">
      <p className="font-mono text-2xs text-white/60 mb-1">{label}</p>
      <p className="text-[0.8125rem] font-semibold tabular-nums">{inr(d.revenue)}</p>
      <p className="text-2xs text-white/60 tabular-nums">{num(d.orders)} orders · {num(d.customers)} customers</p>
    </div>
  );
}

function SourceSplit({ rows = [] }) {
  const total = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
  if (!total) return <EmptyState icon={TrendingUp} title="No data" />;

  return (
    <div className="p-4 space-y-4">
      {rows.map((r) => {
        const share = (Number(r.revenue) / total) * 100;
        const isApp = r.source === 'app';
        return (
          <div key={r.source}>
            <div className="flex items-baseline justify-between mb-1.5">
              <SourceTag source={r.source} />
              <span className="text-sm font-semibold tabular-nums text-ink">{compactInr(r.revenue)}</span>
            </div>
            <div className="h-1.5 bg-paper-sunk rounded-full overflow-hidden">
              <div
                className={cx('h-full rounded-full transition-all', isApp ? 'bg-teal' : 'bg-ink-300')}
                style={{ width: `${share}%` }}
              />
            </div>
            <p className="text-2xs text-ink-500 mt-1 tabular-nums">
              {num(r.orders)} orders · {share.toFixed(0)}% · AOV {compactInr(r.avg_order_value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function StatusBreakdown({ rows = [] }) {
  if (!rows.length) return <EmptyState icon={ShoppingCart} title="No orders" />;
  const max = Math.max(...rows.map((r) => Number(r.count)));

  return (
    <div className="p-4 space-y-2.5">
      {rows.map((r) => (
        <Link
          key={r.status}
          to={`/orders?status=${encodeURIComponent(r.status)}`}
          className="block group"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <StatusPill status={r.status} size="xs" />
            <span className="text-[0.8125rem] font-semibold tabular-nums text-ink group-hover:text-teal transition-colors">
              {num(r.count)}
            </span>
          </div>
          <div className="h-1 bg-paper-sunk rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, background: TONE_HEX[toneOf(r.status)] }}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

function TopProducts({ rows = [] }) {
  if (!rows.length) return <EmptyState icon={Package} title="Nothing sold in this period" />;

  return (
    <div className="p-3">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={rows.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#DDE5E7" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#8DA0AB' }} tickLine={false} axisLine={false} />
          <YAxis
            type="category" dataKey="product_name" width={140}
            tick={{ fontSize: 10, fill: '#546A78' }} tickLine={false} axisLine={false}
            tickFormatter={(v) => (v?.length > 22 ? `${v.slice(0, 22)}…` : v)}
          />
          <Tooltip
            cursor={{ fill: '#EDF1F1' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-ink text-white rounded-md px-3 py-2 shadow-pop max-w-[220px]">
                  <p className="text-2xs font-medium mb-1">{d.product_name}</p>
                  <p className="text-[0.8125rem] font-semibold tabular-nums">{num(d.units_sold)} units</p>
                  <p className="text-2xs text-white/60 tabular-nums">{inr(d.revenue)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="units_sold" radius={[0, 3, 3, 0]} barSize={14}>
            {rows.slice(0, 8).map((r, i) => (
              <Cell key={r.product_id} fill={i === 0 ? '#0E7C7B' : '#8DA0AB'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LowStockList({ rows = [] }) {
  if (!rows.length) {
    return <EmptyState icon={Package} title="All stock is fine" description="No product is low on stock." />;
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((p) => (
        <li key={p.product_id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] text-ink truncate">{p.product_name}</p>
            <Code className="text-2xs">{p.sku || `#${p.product_id}`}</Code>
          </div>
          <div className="text-right shrink-0">
            <p className={cx(
              'text-sm font-semibold tabular-nums',
              p.stock_quantity <= 0 ? 'text-signal-danger' : 'text-signal-warn'
            )}>
              {num(p.stock_quantity)}
            </p>
            <p className="text-2xs text-ink-500 tabular-nums">alert at {p.low_stock_alert}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentOrders({ rows = [] }) {
  if (!rows.length) return <EmptyState icon={ShoppingCart} title="No orders yet" />;

  return (
    <ul className="divide-y divide-line">
      {rows.map((o) => (
        <li key={o.order_id}>
          <Link
            to={`/orders/${o.order_id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper transition-colors rail"
            style={{ '--rail': TONE_HEX[toneOf(o.status)] }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Code>{orderRef(o)}</Code>
                <SourceTag source={o.orderFrom} />
              </div>
              <p className="text-2xs text-ink-500 truncate mt-0.5">
                {o.customer_name} · {ago(o.order_date)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(o.amount)}</p>
              <StatusPill status={o.status} size="xs" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
