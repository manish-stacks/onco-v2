import { useState } from 'react';
import {
  MessageSquare, KeyRound, Bell, ShieldAlert, CheckCircle2, XCircle, Smartphone, Send,
} from 'lucide-react';
import { useList, useResource, useDebounced, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS as P } from '@/lib/constants';
import { dateTime, ago, num, truncate, orderRef } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Code, StatusPill, SourceTag, Tabs, Skeleton, EmptyState, Input, Textarea, Field, Select, Button, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { api } from '@/lib/api';

export default function Notifications() {
  const { can } = useAuth();
  const tabs = [
    can(P.NOTIFICATIONS_VIEW) && { value: 'send', label: 'Send notification' },
    can(P.NOTIFICATIONS_VIEW) && { value: 'messages', label: 'Messages sent' },
    can(P.OTP_VIEW) && { value: 'otp', label: 'OTP logs' },
  ].filter(Boolean);

  const [tab, setTab] = useState(tabs[0]?.value || 'messages');

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="A record of WhatsApp, SMS and push — what was sent, to whom, and whether it worked"
      />
      <Card dense>
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-4 pt-1" />
        {tab === 'send' && <SendNotification />}
        {tab === 'messages' && <MessageLogs />}
        {tab === 'otp' && <OtpLogs />}
      </Card>
    </>
  );
}

/* =========================================================================
 * SEND — a one-off push notification, to one customer or everyone
 * ======================================================================= */
function SendNotification() {
  const [target, setTarget] = useState('customer');
  const [mobile, setMobile] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const send = useMutation(
    () => api.post('/admin/notifications/send', {
      target, title, body, mobile: target === 'customer' ? mobile : undefined,
    }),
    {
      success: (res) => res?.message || 'Notification sent',
      onSuccess: () => { setTitle(''); setBody(''); },
    }
  );

  const canSend = title.trim() && body.trim() && (target === 'all' || mobile.trim());

  return (
    <div className="p-5 max-w-lg space-y-4">
      <p className="text-2xs text-ink-500">
        Goes out as a push notification to the app/website (only to devices that already have
        notifications enabled) — not WhatsApp or SMS.
      </p>

      <Field label="Send to">
        <Select
          value={target} onChange={(e) => setTarget(e.target.value)}
          options={[
            { value: 'customer', label: 'One customer (by mobile number)' },
            { value: 'all', label: 'Every customer' },
          ]}
        />
      </Field>

      {target === 'customer' && (
        <Field label="Customer mobile number">
          <Input mono value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" />
        </Field>
      )}

      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={65} placeholder="e.g. Diwali offer" />
      </Field>

      <Field label="Message" hint="Shown as the notification body">
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={200}
          placeholder="e.g. Flat 20% off on all vitamins today only." />
      </Field>

      {target === 'all' && (
        <p className="text-2xs text-signal-warn bg-signal-warnBg border border-signal-warn/20 rounded px-3 py-2">
          This goes to every customer who has notifications on — double-check the wording before sending.
        </p>
      )}

      <Button variant="primary" icon={Send} onClick={send.run} loading={send.loading} disabled={!canSend}>
        {target === 'all' ? 'Send to everyone' : 'Send'}
      </Button>
    </div>
  );
}

/* =========================================================================
 * MESSAGE LOGS — WhatsApp / push / SMS
 * ======================================================================= */
const CHANNEL_ICON = {
  whatsapp: MessageSquare,
  push: Bell,
  sms: Smartphone,
  email: MessageSquare,
};

function MessageLogs() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { rows, pagination, filters, setFilter, resetFilters, loading } = useList('/admin/notification-logs');

  if (filters.search !== debounced) setFilter('search', debounced);

  const columns = [
    {
      key: 'created_at', label: 'When',
      render: (n) => (
        <div className="text-2xs">
          <p className="text-ink-700 tabular-nums">{ago(n.created_at)}</p>
          <p className="text-ink-500 tabular-nums">{dateTime(n.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'channel', label: 'Channel',
      render: (n) => {
        const Icon = CHANNEL_ICON[n.channel] || MessageSquare;
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-ink-700">
            <Icon size={12} className="text-ink-300" />
            {n.channel}
          </span>
        );
      },
    },
    {
      key: 'template', label: 'Template',
      render: (n) => <Code className="text-2xs">{n.template || '—'}</Code>,
    },
    {
      key: 'recipient', label: 'To',
      render: (n) => <Code className="text-2xs">{n.recipient || '—'}</Code>,
    },
    {
      key: 'databaseOrderID', label: 'Order',
      render: (n) => (n.order_id
        ? <Code className="text-2xs">{orderRef({ order_id: n.order_id, order_date: n.order_placed_date })}</Code>
        : <span className="text-ink-300 text-2xs">—</span>),
    },
    {
      key: 'success', label: 'Result',
      render: (n) => (Number(n.success)
        ? <span className="inline-flex items-center gap-1 text-2xs text-signal-ok"><CheckCircle2 size={12} /> sent</span>
        : <span className="inline-flex items-center gap-1 text-2xs text-signal-danger"><XCircle size={12} /> failed</span>),
    },
    {
      key: 'error', label: 'Detail',
      render: (n) => (
        <span className={cx('text-2xs line-clamp-2 max-w-[240px]',
          n.error ? 'text-signal-danger' : 'text-ink-500')}>
          {truncate(n.error || n.response, 90) || '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <FilterBar
        hasFilters={!!(filters.search || filters.channel || filters.success)}
        onReset={() => { setSearch(''); resetFilters(); }}
      >
        <SearchInput value={search} onChange={setSearch}
          placeholder="Number ya recipient…" className="w-full sm:w-56" />
        <FilterSelect label="Channel" value={filters.channel} placeholder="All"
          options={['whatsapp', 'push', 'sms', 'email']} onChange={(v) => setFilter('channel', v)} />
        <FilterSelect label="Result" value={filters.success} placeholder="All"
          options={[{ value: 'true', label: 'Sent' }, { value: 'false', label: 'Failed' }]}
          onChange={(v) => setFilter('success', v)} />
        <div>
          <span className="label">From</span>
          <Input type="date" value={filters.from_date || ''} className="py-1.5 text-[0.8125rem]"
            onChange={(e) => setFilter('from_date', e.target.value)} />
        </div>
      </FilterBar>

      <DataTable
        columns={columns} rows={rows} loading={loading} rowKey="id" compact
        rowTone={(n) => (Number(n.success) ? 'ok' : 'danger')}
        emptyIcon={MessageSquare} emptyTitle="No message records"
        emptyDescription="WhatsApp/push messages start going out once orders are placed, and will show here."
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
    </>
  );
}

/* =========================================================================
 * OTP LOGS
 * ======================================================================= */
function OtpLogs() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { rows, pagination, filters, setFilter, resetFilters, loading } = useList('/admin/otp-logs');
  const { data: stats } = useResource('/admin/otp-logs/stats');

  if (filters.search !== debounced) setFilter('search', debounced);

  const columns = [
    {
      key: 'created_at', label: 'When',
      render: (o) => (
        <div className="text-2xs">
          <p className="text-ink-700">{ago(o.created_at)}</p>
          <p className="text-ink-500 tabular-nums">{dateTime(o.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'mobile', label: 'Mobile',
      render: (o) => (
        <div>
          <Code className="text-[0.8125rem]">{o.mobile}</Code>
          {o.customer_name && <p className="text-2xs text-ink-500 mt-0.5">{o.customer_name}</p>}
        </div>
      ),
    },
    {
      key: 'otp', label: 'OTP',
      render: (o) => (
        <span className={cx(
          'font-mono text-[0.9375rem] font-semibold tracking-widest tabular-nums',
          o.is_used || o.is_expired ? 'text-ink-300' : 'text-ink'
        )}>
          {o.otp}
        </span>
      ),
    },
    {
      key: 'purpose', label: 'Purpose',
      render: (o) => (
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-ink-700 capitalize">{o.purpose}</span>
          <SourceTag source={o.source} />
        </div>
      ),
    },
    {
      key: 'delivered', label: 'Delivery',
      render: (o) => (
        <div className="text-2xs">
          {Number(o.delivered)
            ? <span className="inline-flex items-center gap-1 text-signal-ok"><CheckCircle2 size={12} /> sent</span>
            : <span className="inline-flex items-center gap-1 text-signal-danger"><XCircle size={12} /> failed</span>}
          <p className="text-ink-500 mt-0.5">{o.provider}</p>
        </div>
      ),
    },
    {
      key: 'used_at', label: 'State',
      render: (o) => {
        if (o.is_used) return <StatusPill status="Verified" tone="ok" size="xs" />;
        if (o.is_expired) return <StatusPill status="Expired" tone="idle" size="xs" />;
        return <StatusPill status="Active" tone="warn" size="xs" />;
      },
    },
  ];

  return (
    <>
      <div className="px-4 pt-4">
        <div className="flex items-start gap-2.5 text-2xs text-signal-warn bg-signal-warnBg border border-signal-warn/20 rounded px-3 py-2 mb-3">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <p>
            A live OTP is visible — it can be used to log into any account.
            Expired or used OTPs are masked, and every search is recorded in the activity log
            is recorded. Grant this permission only to those who truly need it.
          </p>
        </div>

        {stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <MiniStat label="Last 30 days" value={num(stats.total)} />
            <MiniStat label="Delivery rate" value={`${stats.delivery_rate}%`}
              tone={stats.delivery_rate < 90 ? 'warn' : 'ok'} />
            <MiniStat label="Verify rate" value={`${stats.verify_rate}%`} />
            <MiniStat label="Aaj" value={num(stats.today)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[62px]" />)}
          </div>
        )}
      </div>

      <FilterBar
        hasFilters={!!(filters.search || filters.purpose || filters.active)}
        onReset={() => { setSearch(''); resetFilters(); }}
      >
        <SearchInput value={search} onChange={setSearch}
          placeholder="Mobile number…" className="w-full sm:w-56" />
        <FilterSelect label="Purpose" value={filters.purpose} placeholder="All"
          options={['login', 'signup', 'reset', 'verify']} onChange={(v) => setFilter('purpose', v)} />
        <FilterSelect label="Source" value={filters.source} placeholder="All"
          options={[{ value: 'web', label: 'Website' }, { value: 'app', label: 'Mobile app' }]}
          onChange={(v) => setFilter('source', v)} />
        <FilterSelect label="State" value={filters.active} placeholder="All"
          options={[{ value: 'true', label: 'Currently valid' }]}
          onChange={(v) => setFilter('active', v)} />
        <FilterSelect label="Delivery" value={filters.delivered} placeholder="All"
          options={[{ value: 'true', label: 'Sent' }, { value: 'false', label: 'Failed' }]}
          onChange={(v) => setFilter('delivered', v)} />
      </FilterBar>

      <DataTable
        columns={columns} rows={rows} loading={loading} rowKey="id" compact
        rowTone={(o) => {
          if (!Number(o.delivered)) return 'danger';
          if (o.is_used) return 'ok';
          if (o.is_expired) return 'idle';
          return 'warn';
        }}
        emptyIcon={KeyRound} emptyTitle="No OTP records"
        emptyDescription="History will build up here once customers log in."
      />
      <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
    </>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className={cx('card p-3',
      tone === 'warn' && 'border-signal-warn/30 bg-signal-warnBg')}>
      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-1">{label}</p>
      <p className={cx('text-lg font-semibold tabular-nums tracking-tight',
        tone === 'warn' ? 'text-signal-warn' : 'text-ink')}>{value}</p>
    </div>
  );
}
