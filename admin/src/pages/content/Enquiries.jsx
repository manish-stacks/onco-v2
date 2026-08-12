import { useState } from 'react';
import { Inbox, Mail, Check, Trash2 } from 'lucide-react';
import { useList, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { dateTime, truncate } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, StatusPill, Code } from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

/** Contact form se aane wale messages */
export default function Enquiries() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList('/admin/enquiries');
  const [toDelete, setToDelete] = useState(null);
  const [reading, setReading] = useState(null);

  if (filters.search !== debounced) setFilter('search', debounced);

  const resolve = useMutation(
    ({ id, solved }) => api.patch(`/admin/enquiries/${id}`, { solved }),
    { success: 'Enquiry update ho gayi', onSuccess: reload }
  );
  const del = useMutation((id) => api.del(`/admin/enquiries/${id}`),
    { success: 'Enquiry delete ho gayi', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.CMS_MANAGE);

  return (
    <>
      <PageHeader
        title="Enquiries"
        subtitle="Website ke contact form se aaye messages"
      />

      <Card dense>
      <FilterBar hasFilters={!!(filters.search || filters.issue_solved)} onReset={() => { setSearch(''); resetFilters(); }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Naam, email, issue…" className="w-full sm:w-56" />
        <FilterSelect label="State" value={filters.issue_solved} placeholder="All"
          options={[{ value: '0', label: 'Open' }, { value: '1', label: 'Resolved' }]}
          onChange={(v) => setFilter('issue_solved', v)} />
      </FilterBar>

      <DataTable
        rowKey="id" rows={rows} loading={loading}
        rowTone={(e) => (Number(e.issue_solved) ? 'ok' : 'warn')}
        onRowClick={(e) => setReading(e)}
        columns={[
          {
            key: 'name', label: 'From',
            render: (e) => (
              <div className="min-w-0">
                <p className="text-[0.8125rem] text-ink">{e.name}</p>
                <p className="text-2xs text-ink-500 truncate max-w-[180px]">{e.email}</p>
              </div>
            ),
          },
          {
            key: 'issue', label: 'Issue',
            render: (e) => (
              <div className="min-w-0 max-w-md">
                <p className="text-[0.8125rem] text-ink-700">{e.issue || '—'}</p>
                <p className="text-2xs text-ink-500 line-clamp-1">{truncate(e.message, 70)}</p>
              </div>
            ),
          },
          {
            key: 'number', label: 'Phone',
            render: (e) => (e.number ? <Code className="text-2xs">{e.number}</Code> : <span className="text-ink-300">—</span>),
          },
          {
            key: 'date', label: 'Received',
            render: (e) => <span className="text-2xs tabular-nums text-ink-500">{dateTime(e.date)}</span>,
          },
          {
            key: 'issue_solved', label: 'State',
            render: (e) => <StatusPill status={Number(e.issue_solved) ? 'Resolved' : 'Open'}
              tone={Number(e.issue_solved) ? 'ok' : 'warn'} size="xs" />,
          },
          {
            key: 'actions', label: '', align: 'right',
            render: (e) => canManage && (
              <div className="flex justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                {!Number(e.issue_solved) && (
                  <Button size="xs" variant="ghost" title="Mark resolved"
                    onClick={() => resolve.run({ id: e.id, solved: true })}>
                    <Check size={13} className="text-signal-ok" />
                  </Button>
                )}
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(e)}><Trash2 size={13} /></Button>
              </div>
            ),
          },
        ]}
        emptyIcon={Inbox} emptyTitle="Koi enquiry nahi"
        emptyDescription="Contact form se aane wale messages yahan dikhenge."
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>

      <Modal
        open={!!reading} onClose={() => setReading(null)}
        title={reading?.issue || 'Enquiry'}
        subtitle={reading ? `${reading.name} · ${dateTime(reading.date)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReading(null)}>Close</Button>
            {reading && !Number(reading.issue_solved) && canManage && (
              <Button variant="primary" icon={Check}
                onClick={() => { resolve.run({ id: reading.id, solved: true }); setReading(null); }}>
                Mark resolved
              </Button>
            )}
          </>
        }
      >
        {reading && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-2xs">
              <a href={`mailto:${reading.email}`} className="inline-flex items-center gap-1 text-teal hover:underline">
                <Mail size={12} /> {reading.email}
              </a>
              {reading.number ? <Code>{reading.number}</Code> : null}
            </div>
            <div className="bg-paper-sunk rounded p-3">
              <p className="text-[0.8125rem] text-ink-700 leading-relaxed whitespace-pre-wrap">
                {reading.message || 'Koi message nahi likha.'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete enquiry" confirmLabel="Delete"
        message={`${toDelete?.name} ki enquiry delete ho jaayegi.`} />
    </>
  );
}
