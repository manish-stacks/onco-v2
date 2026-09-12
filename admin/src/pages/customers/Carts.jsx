import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useList, useDebounced } from '@/hooks/useApi';
import { inr, num, ago } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Code } from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput } from '@/components/ui/DataTable';

/** Every customer who currently has items sitting in their cart, with item
 * count + cart value — so support/marketing knows who to nudge. Clicking a
 * row opens that customer's full profile (which shows the same cart again
 * under a "Cart" card, item by item). */
export default function Carts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const { rows, pagination, filters, setFilter, resetFilters, loading } = useList('/admin/customers/carts');
  if (filters.search !== debounced) setFilter('search', debounced);

  const columns = [
    {
      key: 'customer_name', label: 'Customer',
      render: (c) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-ink truncate max-w-[180px]">{c.customer_name}</p>
          <Code className="text-2xs">{c.mobile}</Code>
        </div>
      ),
    },
    {
      key: 'item_count', label: 'Distinct items', align: 'right',
      render: (c) => <span className="text-[0.8125rem] tabular-nums font-medium text-ink">{num(c.item_count)}</span>,
    },
    {
      key: 'total_quantity', label: 'Total quantity', align: 'right',
      render: (c) => <span className="text-[0.8125rem] tabular-nums text-ink-700">{num(c.total_quantity)}</span>,
    },
    {
      key: 'cart_value', label: 'Cart value', align: 'right',
      render: (c) => <span className="text-[0.8125rem] font-semibold tabular-nums text-ink">{inr(c.cart_value)}</span>,
    },
    {
      key: 'last_updated', label: 'Last updated',
      render: (c) => <span className="text-2xs text-ink-500">{c.last_updated ? ago(c.last_updated) : '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader title="Carts" subtitle={`${num(pagination.total)} customers with items in cart`} />

      <Card dense>
        <FilterBar hasFilters={!!filters.search} onReset={() => { setSearch(''); resetFilters(); }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Naam ya mobile…" className="w-full sm:w-64" />
        </FilterBar>

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="customer_id"
          onRowClick={(c) => navigate(`/customers/${c.customer_id}`)}
          emptyIcon={ShoppingBag} emptyTitle="No one has items in their cart right now"
        />
        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>
    </>
  );
}
