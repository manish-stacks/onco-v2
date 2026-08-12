import { useState } from 'react';
import { Boxes, Plus, Minus, SlidersHorizontal, Download, AlertTriangle, CalendarClock, PackageX, Upload } from 'lucide-react';
import { useList, useResource, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P, INVENTORY_CHANGE_TYPES } from '@/lib/constants';
import { inr, compactInr, num, dateTime, date } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, Field, Input, Select, Textarea, Code, Tabs, EmptyState, Skeleton, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import BulkImportModal from './BulkImportModal';

const TABS = [
  { value: 'stock', label: 'Stock levels' },
  { value: 'movements', label: 'Movement ledger' },
  { value: 'expiring', label: 'Expiring soon' },
];

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { can } = useAuth();
  const { data: summary, reload: reloadSummary } = useResource('/admin/inventory/summary');

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, movements aur expiry — sab yahan"
        actions={can(P.INVENTORY_MANAGE) && (
          <Button icon={Upload} onClick={() => setBulkOpen(true)}>Bulk import</Button>
        )}
      />

      <SummaryCards summary={summary} />

      <Card dense>
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="px-4 pt-1" />
        {tab === 'stock' && <StockTab key={refreshKey} onChanged={reloadSummary} />}
        {tab === 'movements' && <MovementsTab />}
        {tab === 'expiring' && <ExpiringTab />}
      </Card>

      <BulkImportModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => { reloadSummary(); setRefreshKey((k) => k + 1); }}
      />
    </>
  );
}

function SummaryCards({ summary }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}
      </div>
    );
  }

  const cards = [
    { label: 'Stock value', value: compactInr(summary.stock_value), tone: null },
    { label: 'Total units', value: num(summary.total_units), tone: null },
    { label: 'Low stock', value: num(summary.low_stock), tone: 'warn', icon: AlertTriangle },
    { label: 'Out of stock', value: num(summary.out_of_stock), tone: 'danger', icon: PackageX },
    { label: 'Expiring 90d', value: num(summary.expiring_soon), tone: 'warn', icon: CalendarClock },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
      {cards.map((c) => (
        <div key={c.label} className={cx(
          'card p-3.5',
          c.tone === 'danger' && Number(c.value.replace(/\D/g, '')) > 0 && 'border-signal-danger/30 bg-signal-dangerBg',
          c.tone === 'warn' && Number(c.value.replace(/\D/g, '')) > 0 && 'border-signal-warn/30 bg-signal-warnBg'
        )}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500">{c.label}</p>
            {c.icon && <c.icon size={13} className={
              c.tone === 'danger' ? 'text-signal-danger' : 'text-signal-warn'
            } />}
          </div>
          <p className={cx(
            'text-xl font-semibold tabular-nums tracking-tight',
            c.tone === 'danger' ? 'text-signal-danger' : c.tone === 'warn' ? 'text-signal-warn' : 'text-ink'
          )}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StockTab({ onChanged }) {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [adjusting, setAdjusting] = useState(null);
  const [mode, setMode] = useState('set');

  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList('/admin/products');
  if (filters.search !== debounced) setFilter('search', debounced);

  const canManage = can(P.INVENTORY_MANAGE);

  const columns = [
    {
      key: 'product_name', label: 'Product',
      render: (p) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-ink truncate max-w-[280px] leading-snug">{p.product_name}</p>
          <div className="flex gap-1.5 mt-0.5">
            {p.sku && <Code className="text-2xs">{p.sku}</Code>}
            {p.batch_number && <span className="code-chip">B: {p.batch_number}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'stock_quantity', label: 'On hand', align: 'right', sortable: true,
      render: (p) => {
        const q = Number(p.stock_quantity);
        const low = q > 0 && q <= Number(p.low_stock_alert);
        return (
          <span className={cx(
            'text-base font-semibold tabular-nums',
            q <= 0 ? 'text-signal-danger' : low ? 'text-signal-warn' : 'text-ink'
          )}>
            {num(q)}
          </span>
        );
      },
    },
    {
      key: 'low_stock_alert', label: 'Alert at', align: 'right',
      render: (p) => <span className="text-2xs tabular-nums text-ink-500">{num(p.low_stock_alert)}</span>,
    },
    {
      key: 'value', label: 'Value', align: 'right',
      render: (p) => (
        <span className="text-[0.8125rem] tabular-nums text-ink-700">
          {inr(Number(p.stock_quantity) * Number(p.product_sp))}
        </span>
      ),
    },
    {
      key: 'expiry_date', label: 'Expiry',
      render: (p) => (p.expiry_date
        ? <span className="text-2xs tabular-nums text-ink-700">{date(p.expiry_date)}</span>
        : <span className="text-ink-300 text-2xs">—</span>),
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (p) => canManage && (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="ghost" title="Stock aaya"
            onClick={() => { setAdjusting(p); setMode('add'); }}>
            <Plus size={13} />
          </Button>
          <Button size="xs" variant="ghost" title="Stock nikaalo"
            onClick={() => { setAdjusting(p); setMode('remove'); }}>
            <Minus size={13} />
          </Button>
          <Button size="xs" variant="ghost" title="Exact count set karo"
            onClick={() => { setAdjusting(p); setMode('set'); }}>
            <SlidersHorizontal size={13} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <FilterBar
        hasFilters={!!(filters.search || filters.low_stock || filters.out_of_stock)}
        onReset={() => { setSearch(''); resetFilters(); }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Product ya SKU…" className="w-full sm:w-64" />
        <FilterSelect
          label="Show" placeholder="All products"
          value={filters.low_stock ? 'low' : filters.out_of_stock ? 'out' : ''}
          options={[{ value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }]}
          onChange={(v) => {
            setFilter('low_stock', v === 'low' ? 'true' : '');
            setFilter('out_of_stock', v === 'out' ? 'true' : '');
          }}
        />
      </FilterBar>

      <DataTable
        columns={columns} rows={rows} loading={loading} rowKey="product_id"
        rowTone={(p) => (Number(p.stock_quantity) <= 0 ? 'danger'
          : Number(p.stock_quantity) <= Number(p.low_stock_alert) ? 'warn' : 'ok')}
        emptyIcon={Boxes} emptyTitle="Koi product nahi mila"
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />

      <AdjustModal
        product={adjusting} mode={mode} onClose={() => setAdjusting(null)}
        onDone={() => { reload(); onChanged?.(); }}
      />
    </>
  );
}

function AdjustModal({ product, mode, onClose, onDone }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [changeType, setChangeType] = useState(mode === 'add' ? 'purchase' : mode === 'remove' ? 'damage' : 'adjustment');

  const save = useMutation(
    async () => {
      const id = product.product_id;
      if (mode === 'set') {
        return api.patch(`/admin/inventory/${id}`, {
          stock_quantity: Number(qty), note, change_type: changeType,
        });
      }
      const path = mode === 'add' ? 'add' : 'remove';
      return api.post(`/admin/inventory/${id}/${path}`, {
        quantity: Number(qty), note, change_type: changeType,
      });
    },
    {
      success: 'Stock update ho gaya',
      onSuccess: () => { onClose(); onDone(); setQty(''); setNote(''); },
    }
  );

  if (!product) return null;

  const titles = {
    add: 'Stock aaya',
    remove: 'Stock nikaalo',
    set: 'Exact stock set karo',
  };
  const current = Number(product.stock_quantity);
  const after = mode === 'set' ? Number(qty || 0)
    : mode === 'add' ? current + Number(qty || 0)
      : Math.max(0, current - Number(qty || 0));

  const typeOptions = mode === 'add'
    ? ['purchase', 'return', 'adjustment', 'initial']
    : mode === 'remove'
      ? ['damage', 'expiry', 'adjustment']
      : INVENTORY_CHANGE_TYPES;

  return (
    <Modal
      open={!!product} onClose={onClose}
      title={titles[mode]} subtitle={product.product_name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading} disabled={qty === ''}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-paper-sunk rounded p-3">
          <div>
            <p className="label mb-0.5">Abhi</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{num(current)}</p>
          </div>
          <span className="text-ink-300 text-lg">→</span>
          <div className="text-right">
            <p className="label mb-0.5">Baad me</p>
            <p className={cx(
              'text-lg font-semibold tabular-nums',
              after <= 0 ? 'text-signal-danger' : after < current ? 'text-signal-warn' : 'text-signal-ok'
            )}>
              {num(after)}
            </p>
          </div>
        </div>

        <Field
          label={mode === 'set' ? 'New stock count' : 'Quantity'}
          required
          hint={mode === 'set' ? 'Physical count ke baad exact number daalo' : undefined}
        >
          <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>

        <Field label="Reason" required>
          <Select value={changeType} options={typeOptions}
            onChange={(e) => setChangeType(e.target.value)} />
        </Field>

        <Field label="Note" hint="Ledger me record hoga">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Invoice number, supplier, ya jo bhi context ho" />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function MovementsTab() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const { rows, pagination, filters, setFilter, resetFilters, loading } = useList('/admin/inventory/movements', { limit: 50 });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download('/admin/inventory/export', filters, `inventory-${Date.now()}.csv`);
      toast.success('Export download ho gaya');
    } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };

  const TONE = {
    purchase: 'ok', return: 'ok', initial: 'info',
    sale: 'idle', adjustment: 'info', damage: 'danger', expiry: 'danger',
  };

  const columns = [
    {
      key: 'created_at', label: 'When',
      render: (m) => <span className="text-2xs tabular-nums text-ink-500">{dateTime(m.created_at)}</span>,
    },
    {
      key: 'product_name', label: 'Product',
      render: (m) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-ink truncate max-w-[240px]">{m.product_name || `#${m.product_id}`}</p>
          {m.sku && <Code className="text-2xs">{m.sku}</Code>}
        </div>
      ),
    },
    {
      key: 'change_type', label: 'Type',
      render: (m) => (
        <span className={cx(
          'text-2xs font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border',
          TONE[m.change_type] === 'ok' && 'text-signal-ok bg-signal-okBg border-signal-ok/20',
          TONE[m.change_type] === 'danger' && 'text-signal-danger bg-signal-dangerBg border-signal-danger/20',
          TONE[m.change_type] === 'info' && 'text-signal-info bg-signal-infoBg border-signal-info/20',
          TONE[m.change_type] === 'idle' && 'text-signal-idle bg-signal-idleBg border-line'
        )}>
          {m.change_type}
        </span>
      ),
    },
    {
      key: 'quantity_change', label: 'Change', align: 'right',
      render: (m) => (
        <span className={cx(
          'text-[0.8125rem] font-semibold tabular-nums',
          m.quantity_change > 0 ? 'text-signal-ok' : 'text-signal-danger'
        )}>
          {m.quantity_change > 0 ? '+' : ''}{num(m.quantity_change)}
        </span>
      ),
    },
    {
      key: 'quantity_after', label: 'Before → After', align: 'right',
      render: (m) => (
        <span className="text-2xs tabular-nums text-ink-500">
          {num(m.quantity_before)} → <span className="text-ink-700 font-medium">{num(m.quantity_after)}</span>
        </span>
      ),
    },
    {
      key: 'reference', label: 'Ref',
      render: (m) => (m.reference_type
        ? <span className="text-2xs text-ink-500">{m.reference_type}{m.reference_id ? ` #${m.reference_id}` : ''}</span>
        : <span className="text-ink-300 text-2xs">—</span>),
    },
    {
      key: 'changed_by', label: 'By',
      render: (m) => <Code className="text-2xs">{m.changed_by}</Code>,
    },
    {
      key: 'note', label: 'Note',
      render: (m) => <span className="text-2xs text-ink-500 line-clamp-2 max-w-[180px]">{m.note || '—'}</span>,
    },
  ];

  return (
    <>
      <FilterBar hasFilters={!!(filters.change_type || filters.from_date)} onReset={resetFilters}>
        <FilterSelect
          label="Type" value={filters.change_type} placeholder="All types"
          options={INVENTORY_CHANGE_TYPES} onChange={(v) => setFilter('change_type', v)}
        />
        <div>
          <span className="label">From</span>
          <Input type="date" value={filters.from_date || ''} className="py-1.5 text-[0.8125rem]"
            onChange={(e) => setFilter('from_date', e.target.value)} />
        </div>
        <div>
          <span className="label">To</span>
          <Input type="date" value={filters.to_date || ''} className="py-1.5 text-[0.8125rem]"
            onChange={(e) => setFilter('to_date', e.target.value)} />
        </div>
        <Button size="sm" icon={Download} onClick={exportCsv} loading={exporting}>Export</Button>
      </FilterBar>

      <DataTable
        columns={columns} rows={rows} loading={loading} rowKey="log_id" compact
        rowTone={(m) => (m.quantity_change > 0 ? 'ok' : 'danger')}
        emptyIcon={Boxes} emptyTitle="Koi movement nahi"
        emptyDescription="Stock change hone pe yahan record aa jaayega."
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
    </>
  );
}

// ---------------------------------------------------------------------------
function ExpiringTab() {
  const [days, setDays] = useState(90);
  const { data, loading } = useResource(`/admin/inventory/expiring?days=${days}&limit=200`);

  const columns = [
    {
      key: 'product_name', label: 'Product',
      render: (p) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-ink truncate max-w-[280px]">{p.product_name}</p>
          {p.sku && <Code className="text-2xs">{p.sku}</Code>}
        </div>
      ),
    },
    { key: 'batch_number', label: 'Batch', render: (p) => <Code>{p.batch_number}</Code> },
    {
      key: 'expiry_date', label: 'Expires',
      render: (p) => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - Date.now()) / 86400000);
        return (
          <div>
            <p className="text-[0.8125rem] tabular-nums text-ink">{date(p.expiry_date)}</p>
            <p className={cx(
              'text-2xs tabular-nums font-medium',
              daysLeft < 0 ? 'text-signal-danger' : daysLeft < 30 ? 'text-signal-danger' : 'text-signal-warn'
            )}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)} din pehle expire` : `${daysLeft} din bache`}
            </p>
          </div>
        );
      },
    },
    {
      key: 'stock_quantity', label: 'Stock at risk', align: 'right',
      render: (p) => <span className="text-[0.8125rem] font-semibold tabular-nums text-ink">{num(p.stock_quantity)}</span>,
    },
  ];

  return (
    <>
      <FilterBar>
        <FilterSelect
          label="Window" value={String(days)}
          options={[
            { value: '30', label: 'Next 30 days' },
            { value: '60', label: 'Next 60 days' },
            { value: '90', label: 'Next 90 days' },
            { value: '180', label: 'Next 6 months' },
          ]}
          onChange={(v) => setDays(Number(v))}
        />
      </FilterBar>

      <DataTable
        columns={columns} rows={data || []} loading={loading} rowKey="product_id"
        rowTone={(p) => {
          const d = Math.ceil((new Date(p.expiry_date) - Date.now()) / 86400000);
          return d < 30 ? 'danger' : 'warn';
        }}
        emptyIcon={CalendarClock}
        emptyTitle="Kuch expire nahi ho raha"
        emptyDescription={`Agle ${days} din me koi batch expire nahi ho rahi.`}
      />
    </>
  );
}
