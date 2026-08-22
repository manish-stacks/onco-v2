import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Users, Download, Ban, CheckCircle2, ShoppingCart, MapPin, FileText } from 'lucide-react';
import { useList, useResource, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P, toneOf, TONE_HEX } from '@/lib/constants';
import { inr, compactInr, num, date, dateTime, ago } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, SourceTag, Code, PageLoader, EmptyState, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/Modal';

/* =========================================================================
 * LIST
 * ======================================================================= */
export function CustomerList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [exporting, setExporting] = useState(false);

  const { rows, pagination, filters, setFilter, resetFilters, loading } = useList('/admin/customers');
  if (filters.search !== debounced) setFilter('search', debounced);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download('/admin/customers/export', filters, `customers-${Date.now()}.csv`);
      toast.success('Export downloaded');
    } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };

  const columns = [
    {
      key: 'customer_name', label: 'Customer',
      render: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[0.8125rem] text-ink truncate max-w-[170px]">{c.customer_name}</p>
            <SourceTag source={c.platform} />
          </div>
          <Code className="text-2xs">{c.mobile}</Code>
        </div>
      ),
    },
    {
      key: 'email_id', label: 'Email',
      render: (c) => <span className="text-2xs text-ink-500 truncate block max-w-[180px]">{c.email_id || '—'}</span>,
    },
    {
      key: 'city', label: 'Location',
      render: (c) => (
        <div className="text-2xs text-ink-500">
          <p className="text-ink-700">{c.city || '—'}</p>
          <p>{c.state}</p>
        </div>
      ),
    },
    {
      key: 'order_count', label: 'Orders', align: 'right',
      render: (c) => <span className="text-[0.8125rem] tabular-nums font-medium text-ink">{num(c.order_count)}</span>,
    },
    {
      key: 'total_spent', label: 'Lifetime value', align: 'right',
      render: (c) => (
        <div>
          <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(c.total_spent)}</p>
          {c.last_order_date && <p className="text-2xs text-ink-500">{ago(c.last_order_date)}</p>}
        </div>
      ),
    },
    {
      key: 'registration_date', label: 'Joined',
      render: (c) => <span className="text-2xs tabular-nums text-ink-500">{date(c.registration_date)}</span>,
    },
    { key: 'status', label: 'Status', render: (c) => <StatusPill status={c.status} size="xs" /> },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${num(pagination.total)} registered`}
        actions={can(P.CUSTOMERS_VIEW) && (
          <Button icon={Download} onClick={exportCsv} loading={exporting}>Export</Button>
        )}
      />

      <Card dense>
        <FilterBar
          hasFilters={!!(filters.search || filters.status || filters.platform)}
          onReset={() => { setSearch(''); resetFilters(); }}
        >
          <SearchInput value={search} onChange={setSearch}
            placeholder="Naam, mobile, email…" className="w-full sm:w-64" />
          <FilterSelect label="Platform" value={filters.platform} placeholder="All"
            options={[{ value: 'web', label: 'Website' }, { value: 'app', label: 'Mobile app' }]}
            onChange={(v) => setFilter('platform', v)} />
          <FilterSelect label="Status" value={filters.status} placeholder="All"
            options={['Active', 'Inactive']} onChange={(v) => setFilter('status', v)} />
        </FilterBar>

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="customer_id"
          rowTone={(c) => (c.status === 'Active' ? 'ok' : 'idle')}
          onRowClick={(c) => navigate(`/customers/${c.customer_id}`)}
          emptyIcon={Users} emptyTitle="No customers found"
        />
        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>
    </>
  );
}

/* =========================================================================
 * DETAIL
 * ======================================================================= */
export function CustomerDetail() {
  const { customerId } = useParams();
  const { can } = useAuth();
  const { data: c, loading, reload } = useResource(`/admin/customers/${customerId}`);
  const [blockOpen, setBlockOpen] = useState(false);

  const setStatus = useMutation(
    (status) => api.patch(`/admin/customers/${customerId}/status`, { status }),
    { success: 'Customer status updated', onSuccess: () => { setBlockOpen(false); reload(); } }
  );

  if (loading && !c) return <PageLoader />;
  if (!c) return <EmptyState icon={Users} title="Customer not found" />;

  const s = c.stats || {};
  const blocked = c.status !== 'Active';

  return (
    <>
      <PageHeader
        back="/customers" backLabel="Customers"
        title={
          <span className="flex items-center gap-2.5 flex-wrap">
            {c.customer_name}
            <StatusPill status={c.status} />
            <SourceTag source={c.platform} />
          </span>
        }
        subtitle={`Customer #${c.customer_id} · joined ${date(c.registration_date)}`}
        actions={can(P.CUSTOMERS_MANAGE) && (
          <Button
            variant={blocked ? 'primary' : 'dangerGhost'}
            icon={blocked ? CheckCircle2 : Ban}
            onClick={() => setBlockOpen(true)}
          >
            {blocked ? 'Unblock' : 'Block customer'}
          </Button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Orders" value={num(s.total_orders)} />
        <MiniStat label="Lifetime value" value={compactInr(s.total_spent)} accent />
        <MiniStat label="Avg order" value={compactInr(s.avg_order_value)} />
        <MiniStat label="Prescriptions" value={num(s.prescription_count)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card
          title="Recent orders" className="lg:col-span-2"
          action={<Link to={`/orders?customer_id=${c.customer_id}`} className="text-2xs text-teal hover:underline">All orders</Link>}
          dense
        >
          {c.recentOrders?.length ? (
            <ul className="divide-y divide-line">
              {c.recentOrders.map((o) => (
                <li key={o.order_id}>
                  <Link
                    to={`/orders/${o.order_id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper transition-colors rail"
                    style={{ '--rail': TONE_HEX[toneOf(o.status)] }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Code>{o.databaseOrderID}</Code>
                        <SourceTag source={o.orderFrom} />
                      </div>
                      <p className="text-2xs text-ink-500 mt-0.5">{dateTime(o.order_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(o.amount)}</p>
                      <StatusPill status={o.status} size="xs" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ShoppingCart} title="No orders yet" />
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Contact" dense>
            <dl className="p-4 space-y-2 text-[0.8125rem]">
              <DRow label="Mobile" value={c.mobile} mono />
              <DRow label="Email" value={c.email_id} />
              <DRow label="Verified" value={c.is_mobile_verified ? 'Mobile verified' : 'Not verified'} />
              <DRow label="Last login" value={c.last_login ? dateTime(c.last_login) : 'Never'} />
            </dl>
          </Card>

          <Card title="Addresses" subtitle={`${c.addresses?.length || 0} saved`} dense>
            {c.addresses?.length ? (
              <ul className="divide-y divide-line">
                {c.addresses.map((a) => (
                  <li key={a.ad_id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-ink-300 mt-0.5 shrink-0" />
                      <div className="min-w-0 text-2xs leading-relaxed">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-ink">{a.type || 'Home'}</span>
                          {!!a.is_default && (
                            <span className="code-chip text-[0.625rem] bg-teal-light text-teal-dark border-teal/20">
                              default
                            </span>
                          )}
                        </div>
                        <p className="text-ink-700">{a.house_no}, {a.stree_address}</p>
                        {a.landmark && <p className="text-ink-500">{a.landmark}</p>}
                        <p className="text-ink-700">{a.city}, {a.state}</p>
                        <Code className="text-2xs">{a.pincode}</Code>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={MapPin} title="No saved addresses" />
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={blockOpen} onClose={() => setBlockOpen(false)}
        onConfirm={() => setStatus.run(blocked ? 'Active' : 'Inactive')}
        loading={setStatus.loading}
        variant={blocked ? 'warn' : 'danger'}
        title={blocked ? 'Unblock customer' : 'Block customer'}
        confirmLabel={blocked ? 'Unblock' : 'Block'}
        message={blocked
          ? `${c.customer_name} will be able to log in and order again.`
          : `${c.customer_name} will not be able to log in or place new orders. Existing orders are unaffected.`}
      />
    </>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className={cx('card p-3.5', accent && 'bg-ink border-ink')}>
      <p className={cx('text-2xs font-semibold uppercase tracking-wider mb-1.5',
        accent ? 'text-white/50' : 'text-ink-500')}>{label}</p>
      <p className={cx('text-xl font-semibold tabular-nums tracking-tight',
        accent ? 'text-white' : 'text-ink')}>{value}</p>
    </div>
  );
}

function DRow({ label, value, mono }) {
  return (
    <div className="flex gap-3">
      <dt className="text-ink-500 w-20 shrink-0 text-2xs pt-0.5">{label}</dt>
      <dd className={cx('min-w-0 flex-1 break-words', mono ? 'code' : 'text-ink-700')}>
        {value || <span className="text-ink-300">—</span>}
      </dd>
    </div>
  );
}
