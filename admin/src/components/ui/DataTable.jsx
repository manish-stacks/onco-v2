import { ChevronLeft, ChevronRight, ArrowUpDown, Search, X, Inbox } from 'lucide-react';
import { TONE_HEX } from '@/lib/constants';
import { Button, EmptyState, Skeleton, Input, Select, cx } from './index';

/**
 * columns: [{ key, label, render?, className?, align?, sortable? }]
 * rowTone: (row) => 'ok' | 'warn' | 'danger' | 'info' | 'idle'
 *   -> a 3px rail appears on the left of the row, so the state is clear without reading the status
 */
export function DataTable({
  columns, rows, loading, rowKey = 'id', rowTone, onRowClick,
  emptyTitle = 'Nothing found', emptyDescription, emptyIcon = Inbox, emptyAction,
  sort, onSort, compact,
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cx(
                  'text-2xs font-semibold uppercase tracking-wider text-ink-500 px-3 py-2.5 whitespace-nowrap',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                  c.headClass
                )}
              >
                {c.sortable && onSort ? (
                  <button
                    onClick={() => onSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-ink transition-colors uppercase tracking-wider"
                  >
                    {c.label}
                    <ArrowUpDown size={11} className={sort?.column === c.key ? 'text-teal' : 'opacity-40'} />
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, i) => {
            const tone = rowTone?.(row);
            return (
              <tr
                key={row[rowKey] ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'bg-paper-card transition-colors',
                  tone && 'rail',
                  onRowClick && 'cursor-pointer hover:bg-paper'
                )}
                style={tone ? { '--rail': TONE_HEX[tone] } : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      'px-3 align-middle',
                      compact ? 'py-2' : 'py-2.5',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.className
                    )}
                  >
                    {c.render ? c.render(row) : row[c.key] ?? <span className="text-ink-300">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  const { page, totalPages, total, limit } = pagination;
  if (!total) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // window of page numbers around current
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line">
      <p className="text-2xs text-ink-500 tabular-nums">
        <span className="font-medium text-ink-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink-700">{total.toLocaleString('en-IN')}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          size="xs" variant="ghost" disabled={page <= 1}
          onClick={() => onPage(page - 1)} aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Button>

        {start > 1 && (
          <>
            <button onClick={() => onPage(1)} className="px-2 py-1 text-2xs text-ink-500 hover:text-ink rounded tabular-nums">1</button>
            {start > 2 && <span className="text-2xs text-ink-300 px-0.5">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cx(
              'min-w-[26px] px-2 py-1 text-2xs rounded transition-colors tabular-nums',
              p === page ? 'bg-ink text-white font-semibold' : 'text-ink-500 hover:text-ink hover:bg-paper-sunk'
            )}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="text-2xs text-ink-300 px-0.5">…</span>}
            <button onClick={() => onPage(totalPages)} className="px-2 py-1 text-2xs text-ink-500 hover:text-ink rounded tabular-nums">
              {totalPages}
            </button>
          </>
        )}

        <Button
          size="xs" variant="ghost" disabled={page >= totalPages}
          onClick={() => onPage(page + 1)} aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

/** List pages ka filter bar — search + dropdowns + reset */
export function FilterBar({ children, onReset, hasFilters }) {
  return (
    <div className="flex flex-wrap items-end gap-2 px-4 py-3 border-b border-line bg-paper">
      {children}
      {hasFilters && onReset && (
        <Button size="sm" variant="ghost" icon={X} onClick={onReset}>Clear</Button>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 py-1.5 text-[0.8125rem]"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, placeholder, className }) {
  return (
    <div className={className}>
      {label && <span className="label">{label}</span>}
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder={placeholder}
        className="py-1.5 text-[0.8125rem] min-w-[130px]"
      />
    </div>
  );
}

export function DateRangeFilter({ from, to, onFrom, onTo }) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <span className="label">From</span>
        <Input type="date" value={from || ''} onChange={(e) => onFrom(e.target.value)}
          className="py-1.5 text-[0.8125rem]" />
      </div>
      <div>
        <span className="label">To</span>
        <Input type="date" value={to || ''} onChange={(e) => onTo(e.target.value)}
          className="py-1.5 text-[0.8125rem]" />
      </div>
    </div>
  );
}
