import { useState, useRef, useEffect } from 'react';
import {
  Activity, Database, Zap, HardDrive, CreditCard, Truck, MessageSquare,
  Smartphone, Bell, Trash2, CloudUpload, Play, Pause, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Search, RotateCcw, Eye, Wrench, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { num, dateTime } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, Select, Code, Tabs, EmptyState, Skeleton, cx,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

const TABS = [
  { value: 'health', label: 'Health' },
  { value: 'cache', label: 'Cache' },
  { value: 'media', label: 'Media migration' },
];

const SERVICE_ICON = {
  database: Database,
  redis: Zap,
  storage: HardDrive,
  razorpay: CreditCard,
  payu: CreditCard,
  dtdc: Truck,
  sms: Smartphone,
  whatsapp: MessageSquare,
  push: Bell,
};

export default function System() {
  const [tab, setTab] = useState('health');

  return (
    <>
      <PageHeader
        title="System"
        subtitle="What is running, cache, and media migration"
      />
      <Card dense>
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="px-4 pt-1" />
        {tab === 'health' && <Health />}
        {tab === 'cache' && <CachePanel />}
        {tab === 'media' && <MediaMigration />}
      </Card>
    </>
  );
}

/* =========================================================================
 * HEALTH
 * ======================================================================= */
export function Health({ compact }) {
  const [deep, setDeep] = useState(false);
  const { data, loading, reload } = useResource(`/admin/system/health${deep ? '?deep=true' : ''}`);

  // The dashboard strip refreshes every 60s, the full page every 30s
  useEffect(() => {
    const t = setInterval(reload, compact ? 60000 : 30000);
    return () => clearInterval(t);
  }, [reload, compact]);

  if (loading && !data) {
    return (
      <div className={cx('grid gap-3', compact ? 'grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3 p-4')}>
        {Array.from({ length: compact ? 5 : 9 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (!data) return null;

  const services = Object.entries(data.services);

  if (compact) {
    // For the dashboard — only the ones that are down/warning
    const problems = services.filter(([, s]) => !s.ok || s.warning);
    if (!problems.length) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {problems.map(([key, s]) => {
          const Icon = SERVICE_ICON[key] || Activity;
          const tone = !s.ok && s.critical ? 'danger' : !s.ok ? 'idle' : 'warn';
          return (
            <span key={key} className={cx(
              'inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-md border text-[0.8125rem]',
              tone === 'danger' && 'bg-signal-dangerBg border-signal-danger/25 text-signal-danger',
              tone === 'warn' && 'bg-signal-warnBg border-signal-warn/25 text-signal-warn',
              tone === 'idle' && 'bg-paper-sunk border-line text-ink-500'
            )}>
              <Icon size={14} />
              <span>{s.label} {s.ok ? 'has a warning' : s.configured === false ? 'is not configured' : 'is down'}</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className={cx(
            'w-2.5 h-2.5 rounded-full',
            data.overall === 'healthy' ? 'bg-signal-ok animate-pulse'
              : data.overall === 'degraded' ? 'bg-signal-warn' : 'bg-signal-danger'
          )} />
          <div>
            <p className="text-sm font-semibold text-ink capitalize">{data.overall}</p>
            <p className="text-2xs text-ink-500 tabular-nums">
              {data.summary.up}/{data.summary.total} services up
              {data.summary.warnings > 0 && ` · ${data.summary.warnings} warning`}
              {' · '}checked {dateTime(data.checked_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant={deep ? 'primary' : 'secondary'} onClick={() => setDeep((v) => !v)}>
            {deep ? 'Deep checks on' : 'Deep checks off'}
          </Button>
          <Button size="sm" icon={RefreshCw} onClick={reload}>Refresh</Button>
        </div>
      </div>

      {!data.payments_usable && (
        <div className="flex items-start gap-2.5 text-2xs text-signal-danger bg-signal-dangerBg border border-signal-danger/25 rounded px-3 py-2 mb-4">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            <strong>No payment gateway is configured.</strong> Online orders
            cannot be placed right now — only COD will work. Add the Razorpay or PayU keys to .env.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map(([key, s]) => {
          const Icon = SERVICE_ICON[key] || Activity;
          return (
            <div key={key} className={cx(
              'border rounded-lg p-3.5',
              !s.ok && s.critical ? 'border-signal-danger/30 bg-signal-dangerBg'
                : !s.ok ? 'border-line bg-paper'
                  : s.warning ? 'border-signal-warn/30 bg-signal-warnBg'
                    : 'border-line bg-paper-card'
            )}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className={cx('shrink-0',
                    s.ok ? 'text-signal-ok' : s.critical ? 'text-signal-danger' : 'text-ink-300')} />
                  <p className="text-[0.8125rem] font-medium text-ink truncate">{s.label}</p>
                </div>
                {s.ok
                  ? <CheckCircle2 size={14} className="text-signal-ok shrink-0" />
                  : <XCircle size={14} className={cx('shrink-0',
                    s.critical ? 'text-signal-danger' : 'text-ink-300')} />}
              </div>

              <p className="text-2xs text-ink-500 leading-relaxed">{s.detail || s.error}</p>

              {s.latency_ms !== undefined && (
                <p className="text-2xs text-ink-300 mt-1 tabular-nums">{s.latency_ms}ms</p>
              )}
              {s.warning && (
                <p className="text-2xs text-signal-warn mt-1.5 leading-relaxed">⚠ {s.warning}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <MiniBlock label="Push tokens"
          value={`${num(data.push_tokens.customers)} customers · ${num(data.push_tokens.admins)} admins`} />
        <MiniBlock label="Live admin connections" value={num(data.live_connections)} />
        {data.media_migration && (
          <MiniBlock label="Media migration"
            value={`${num(data.media_migration.done)} / ${num(data.media_migration.total)} done`} />
        )}
      </div>

      {data.delivery_24h?.length > 0 && (
        <div className="mt-4">
          <p className="label mb-2">Notification delivery (last 24h)</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {data.delivery_24h.map((d) => (
              <div key={d.channel} className={cx('border rounded p-3',
                d.rate !== null && d.rate < 80 ? 'border-signal-warn/30 bg-signal-warnBg' : 'border-line')}>
                <p className="text-2xs uppercase tracking-wider text-ink-500 mb-1">{d.channel}</p>
                <p className="text-base font-semibold tabular-nums text-ink">
                  {d.rate !== null ? `${d.rate}%` : '—'}
                </p>
                <p className="text-2xs text-ink-500 tabular-nums">{d.sent}/{d.total} sent</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBlock({ label, value }) {
  return (
    <div className="border border-line rounded p-3">
      <p className="text-2xs uppercase tracking-wider text-ink-500 mb-1">{label}</p>
      <p className="text-[0.8125rem] font-medium text-ink tabular-nums">{value}</p>
    </div>
  );
}

/* =========================================================================
 * CACHE
 * ======================================================================= */
const SCOPES = [
  { value: 'all', label: 'Everything (Redis + media disk cache)' },
  { value: 'redis', label: 'Redis only' },
  { value: 'media', label: 'Media disk cache only' },
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'orders', label: 'Orders & dashboard' },
  { value: 'settings', label: 'Settings & homepage' },
  { value: 'cms', label: 'CMS pages' },
];

function CachePanel() {
  const { can } = useAuth();
  const { data, loading, reload } = useResource('/admin/system/cache');
  const [scope, setScope] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const clear = useMutation(
    () => api.post('/admin/system/cache/clear', { scope }),
    { success: (res) => res.message, onSuccess: () => { setConfirmOpen(false); reload(); } }
  );

  const canManage = can(P.SYSTEM_MANAGE);

  return (
    <div className="p-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">Redis</h3>
          {loading && !data ? <Skeleton className="h-32" /> : data?.redis?.ok ? (
            <div className="border border-line rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Stat label="Keys" value={num(data.redis.keys)} />
                <Stat label="Memory" value={data.redis.used_memory || '—'} />
                <Stat label="Peak" value={data.redis.peak_memory || '—'} />
              </div>
              {data.redis.by_namespace?.length > 0 && (
                <div>
                  <p className="label mb-1.5">Namespace wise</p>
                  <ul className="space-y-1">
                    {data.redis.by_namespace.slice(0, 8).map((n) => (
                      <li key={n.namespace} className="flex items-center justify-between text-2xs">
                        <Code className="text-2xs">{n.namespace}</Code>
                        <span className="tabular-nums text-ink-700">{num(n.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-signal-warn/30 bg-signal-warnBg rounded-lg p-4 text-2xs text-signal-warn">
              Redis is not connecting. The site keeps working (the cache is fail-open)
              but every request will go to the DB.
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">Media disk cache</h3>
          {loading && !data ? <Skeleton className="h-32" /> : (
            <div className="border border-line rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Stat label="Files" value={num(data?.media_cache?.files)} />
                <Stat label="Size" value={`${data?.media_cache?.size_mb || 0} MB`} />
                <Stat label="Limit" value={`${data?.media_cache?.limit_mb || 0} MB`} />
              </div>
              <p className="text-2xs text-ink-500 leading-relaxed">
                Images from S3 are cached here, so S3 is not hit on every page load.
                Once the limit is crossed, the oldest files are removed automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-5 pt-4 border-t border-line">
          <h3 className="text-sm font-semibold text-ink mb-2">Clear cache</h3>
          <p className="text-2xs text-ink-500 mb-3 max-w-2xl leading-relaxed">
            The cache clears itself when data changes. This button is only needed when you have
            changed directly in the DB (via phpMyAdmin), or some old data appears to be stuck.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <span className="label">What to clear</span>
              <Select value={scope} onChange={(e) => setScope(e.target.value)}
                options={SCOPES} className="min-w-[280px]" />
            </div>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
              Clear cache
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={clear.run} loading={clear.loading}
        variant="warn" title="Clear the cache?" confirmLabel="Yes, clear it"
        message={scope === 'all'
          ? 'Both the entire Redis cache and the media disk cache will be cleared. The next few requests will be a little slower until the cache refills. No data will be deleted.'
          : `The "${SCOPES.find((s) => s.value === scope)?.label}" cache will be cleared. No data will be deleted.`}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-ink-500 mb-0.5">{label}</p>
      <p className="text-[0.9375rem] font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/* =========================================================================
 * MEDIA MIGRATION
 * ======================================================================= */
function MediaMigration() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useResource('/admin/system/media/status');

  const [selected, setSelected] = useState([]);   // which tables to migrate
  const [batchSize, setBatchSize] = useState('50');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [failedOpen, setFailedOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const stopRef = useRef(false);

  const canManage = can(P.SYSTEM_MANAGE);

  // Pehli baar status aane pe sab tables select kar do
  const initRef = useRef(false);
  useEffect(() => {
    if (data?.tables?.length && !initRef.current) {
      initRef.current = true;
      setSelected(data.tables.map((t) => t.table));
    }
  }, [data]);

  const [scanResult, setScanResult] = useState(null);

  const scan = useMutation(
    () => api.post('/admin/system/media/scan', { tables: selected }),
    {
      success: (res) => res.message,
      onSuccess: (res) => { setScanResult(res.data); reload(); },
    }
  );

  const retry = useMutation(
    () => api.post('/admin/system/media/retry-failed'),
    { success: (res) => res.message, onSuccess: reload }
  );

  const clearQueue = useMutation(
    () => api.del('/admin/system/media/queue'),
    { success: 'Queue cleared', onSuccess: () => { setLog([]); reload(); } }
  );

  // If LEGACY_MEDIA_PATH changed, the old queued rows hold the wrong URL
  const repairUrls = useMutation(
    () => api.post('/admin/system/media/repair-urls', { tables: selected }),
    { success: (res) => res.message, onSuccess: reload }
  );

  const toggleTable = (table) => setSelected((s) => (
    s.includes(table) ? s.filter((t) => t !== table) : [...s, table]
  ));

  /** Selected tables ka pending count — queue se */
  const pendingFor = (table) => {
    const row = data?.byTable?.find((t) => t.source_table === table);
    return Number(row?.pending || 0);
  };
  const selectedPending = selected.reduce((sum, t) => sum + pendingFor(t), 0);

  /**
   * Batch loop. The backend does 50-100 at a time; we keep calling it
   * until it is finished. Pressing Stop mid-way makes `stopRef`
   * stops the loop after the in-flight request finishes.
   */
  const runMigration = async () => {
    setRunning(true);
    stopRef.current = false;
    setLog([]);

    let totalOk = 0;
    let totalFail = 0;
    let batch = 0;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (stopRef.current) {
          setLog((l) => [...l, { type: 'info', text: 'Stop was pressed — halted.' }]);
          break;
        }

        batch += 1;
        // eslint-disable-next-line no-await-in-loop
        const res = await api.post('/admin/system/media/migrate', {
          limit: Number(batchSize),
          tables: selected,
        });
        const d = res.data;

        totalOk += d.succeeded;
        totalFail += d.failed;

        setLog((l) => [...l, {
          type: d.failed > 0 ? 'warn' : 'ok',
          text: `Batch ${batch}: ${d.succeeded} ok, ${d.failed} fail · ${d.remaining} baaki`,
          errors: d.errors,
        }]);

        if (d.done || d.processed === 0) {
          setLog((l) => [...l, { type: 'ok', text: `Finished — ${totalOk} migrated, ${totalFail} failed in total.` }]);
          break;
        }
      }
    } catch (err) {
      setLog((l) => [...l, { type: 'error', text: `Stopped: ${err.message}` }]);
      toast.error(err.message);
    } finally {
      setRunning(false);
      reload();
    }
  };

  if (loading && !data) return <div className="p-4"><Skeleton className="h-64" /></div>;
  if (!data) return null;

  const pct = data.progress || 0;

  return (
    <div className="p-4">
      {!data.storage_configured && (
        <div className="flex items-start gap-2.5 text-2xs text-signal-danger bg-signal-dangerBg border border-signal-danger/25 rounded px-3 py-2 mb-4">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1">S3 is not configured</p>
            <p className="leading-relaxed">
              Backend ki .env me <Code className="text-2xs">S3_BUCKET</Code>,{' '}
              <Code className="text-2xs">S3_ACCESS_KEY_ID</Code>,{' '}
              <Code className="text-2xs">S3_SECRET_ACCESS_KEY</Code>, then restart the server.
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="border border-line rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold text-ink">
              {num(data.done)} / {num(data.total)} images have been migrated
            </p>
            <p className="text-2xs text-ink-500 mt-0.5">
              Source: <Code className="text-2xs">{data.legacy_base}</Code>
              {data.storage_config && (
                <> → <Code className="text-2xs">{data.storage_config.bucket}</Code></>
              )}
            </p>
          </div>
          <span className="text-xl font-semibold tabular-nums text-ink">{pct}%</span>
        </div>

        <div className="h-2 bg-paper-sunk rounded-full overflow-hidden mb-3">
          <div className="h-full bg-teal rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Pending" value={num(data.pending)} />
          <Stat label="Done" value={num(data.done)} />
          <Stat label="Failed" value={num(data.failed)} />
        </div>
      </div>

      {/* Step 1 — what to migrate */}
      <div className="border border-line rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">What should be migrated?</h3>
            <p className="text-2xs text-ink-500 mt-0.5">
              Only the selected tables are scanned and migrated
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button size="xs" variant="ghost"
              onClick={() => setSelected(data.tables.map((t) => t.table))} disabled={running}>
              All select
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected([])} disabled={running}>
              Remove all
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.tables.map((t) => {
            const on = selected.includes(t.table);
            const pending = pendingFor(t.table);
            const doneCount = Number(data.byTable?.find((b) => b.source_table === t.table)?.done || 0);

            return (
              <button
                key={t.table} type="button" disabled={running}
                onClick={() => toggleTable(t.table)}
                className={cx(
                  'text-left border rounded-lg p-3 transition-colors disabled:opacity-60',
                  on ? 'border-teal bg-teal-light/40' : 'border-line bg-paper hover:border-line-strong'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cx(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      on ? 'bg-teal border-teal' : 'border-line-strong bg-white'
                    )}>
                      {on && <CheckCircle2 size={11} className="text-white" />}
                    </span>
                    <span className="text-[0.8125rem] font-medium text-ink truncate">
                      {TABLE_LABELS[t.table] || t.table}
                    </span>
                  </span>
                  {pending > 0 && (
                    <span className="text-2xs font-semibold tabular-nums text-signal-warn shrink-0">
                      {num(pending)}
                    </span>
                  )}
                </div>
                <p className="text-2xs text-ink-500 pl-6 truncate">
                  {t.columns.join(', ')}
                  {t.json && ' (JSON array)'}
                </p>
                {doneCount > 0 && (
                  <p className="text-2xs text-signal-ok pl-6 mt-0.5 tabular-nums">
                    {num(doneCount)} done already
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — actions */}
      {canManage && (
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <Button icon={Search} onClick={scan.run} loading={scan.loading}
            disabled={running || !selected.length}>
            1. Scan {selected.length} table{selected.length === 1 ? '' : 's'}
          </Button>

          <Button icon={Eye} onClick={() => setPreviewOpen(true)}
            disabled={running || !selectedPending}>
            2. Preview {selectedPending ? num(selectedPending) : ''}
          </Button>

          <Button icon={Wrench} onClick={repairUrls.run} loading={repairUrls.loading}
            disabled={running || !selectedPending}
            title="Fix old URLs if LEGACY_MEDIA_PATH changed">
            URLs fix
          </Button>

          <div>
            <span className="label">Batch size</span>
            <Select value={batchSize} onChange={(e) => setBatchSize(e.target.value)}
              disabled={running}
              options={[
                { value: '25', label: '25 per batch' },
                { value: '50', label: '50 per batch' },
                { value: '100', label: '100 per batch' },
                { value: '200', label: '200 per batch' },
              ]}
              className="min-w-[150px]" />
          </div>

          {running ? (
            <Button variant="danger" icon={Pause} onClick={() => { stopRef.current = true; }}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" icon={Play} onClick={runMigration}
              disabled={!selectedPending || !data.storage_configured}>
              3. Migrate {selectedPending ? num(selectedPending) : ''} images
            </Button>
          )}

          {data.failed > 0 && (
            <>
              <Button icon={RotateCcw} onClick={retry.run} loading={retry.loading} disabled={running}>
                Retry {num(data.failed)} failed
              </Button>
              <Button variant="ghost" onClick={() => setFailedOpen(true)}>
                Failed dekho
              </Button>
            </>
          )}

          <div className="flex-1" />
          <Button variant="dangerGhost" icon={Trash2} onClick={clearQueue.run}
            loading={clearQueue.loading} disabled={running}>
            Queue clear
          </Button>
        </div>
      )}

      {/* Scan result — confirms that nothing was queued twice */}
      {scanResult && (
        <div className="border border-line rounded-lg overflow-hidden mb-4">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-paper border-b border-line">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
              Scan result
            </p>
            <button onClick={() => setScanResult(null)}
              className="text-ink-300 hover:text-ink" aria-label="Close">
              <XCircle size={13} />
            </button>
          </div>
          <table className="w-full text-2xs">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left font-semibold text-ink-500 px-3 py-1.5">Table</th>
                <th className="text-right font-semibold text-ink-500 px-3 py-1.5">Found in DB</th>
                <th className="text-right font-semibold text-ink-500 px-3 py-1.5">Nayi queue hui</th>
                <th className="text-right font-semibold text-ink-500 px-3 py-1.5">Already on S3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {scanResult.tables.map((t) => (
                <tr key={t.table}>
                  <td className="px-3 py-1.5">
                    {TABLE_LABELS[t.table] || <Code className="text-2xs">{t.table}</Code>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-700">{num(t.found)}</td>
                  <td className={cx('px-3 py-1.5 text-right tabular-nums',
                    t.queued > 0 ? 'text-teal font-medium' : 'text-ink-300')}>
                    {t.queued > 0 ? `+${num(t.queued)}` : '0'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-signal-ok">
                    {num(t.already_migrated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-2xs text-ink-500 border-t border-line">
            Running the scan again should report 0 for &quot;newly queued&quot; — the same rows
            will not be added.
          </p>
        </div>
      )}

      {/* Live log */}
      {log.length > 0 && (
        <div className="border border-line rounded-lg overflow-hidden mb-4">
          <p className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-500 bg-paper border-b border-line">
            Progress log
          </p>
          <ul className="max-h-52 overflow-y-auto divide-y divide-line">
            {log.map((l, i) => (
              <li key={i} className="px-3 py-2">
                <p className={cx('text-2xs font-mono',
                  l.type === 'ok' && 'text-signal-ok',
                  l.type === 'warn' && 'text-signal-warn',
                  l.type === 'error' && 'text-signal-danger',
                  l.type === 'info' && 'text-ink-500')}>
                  {l.text}
                </p>
                {l.errors?.slice(0, 3).map((e, j) => (
                  <p key={j} className="text-2xs text-ink-500 mt-0.5 pl-3 truncate">
                    {e.table} #{e.record_id} — {e.error}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.total === 0 && (
        <EmptyState
          icon={CloudUpload}
          title="Not scanned yet"
          description="Choose the tables above, then press 'Scan' — it checks how many images are still on the old site."
        />
      )}

      <PreviewModal
        open={previewOpen} onClose={() => setPreviewOpen(false)}
        tables={selected} total={selectedPending}
        onConfirm={() => { setPreviewOpen(false); runMigration(); }}
        canMigrate={canManage && data.storage_configured}
      />
      <FailedModal open={failedOpen} onClose={() => setFailedOpen(false)} />
    </div>
  );
}

/** Make table names readable */
const TABLE_LABELS = {
  products: 'Product images',
  categories: 'Category images',
  banners: 'Homepage banners',
  brands: 'Brand logos',
  deals: 'Deal images',
  news: 'News / blog images',
  settings: 'Logo & site images',
  prescriptions: 'Prescription uploads',
  order_items: 'Order item snapshots',
};

/**
 * Preview before migrating.
 *
 * the source_url belongs to the public site, so the browser loads it directly —
 * any broken image shows up right here, before a 404 page is pushed to S3.
 */
function PreviewModal({ open, onClose, tables, total, onConfirm, canMigrate }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [broken, setBroken] = useState({});

  // Back to the first page when the modal opens / the tables change
  useEffect(() => {
    if (open) { setPage(1); setBroken({}); }
  }, [open, tables?.join(',')]);

  const offset = (page - 1) * perPage;
  const qs = [
    tables?.length ? `tables=${tables.join(',')}` : null,
    `limit=${perPage}`,
    `offset=${offset}`,
  ].filter(Boolean).join('&');

  const { data, loading } = useResource(open ? `/admin/system/media/preview?${qs}` : null);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / perPage)) : 1;
  const brokenCount = Object.values(broken).filter(Boolean).length;
  const checked = Object.keys(broken).length;

  return (
    <Modal
      open={open} onClose={onClose} size="xl"
      title="Review before migrating"
      subtitle={data
        ? `${num(data.total)} images in the queue · page ${page}/${num(totalPages)}`
        : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Back</Button>
          {canMigrate && (
            <Button variant="primary" icon={Play} onClick={onConfirm} disabled={!total}>
              Yes, migrate {num(total)} images
            </Button>
          )}
        </>
      }
    >
      {/* Pagination + page size — at the top, so no scrolling is needed */}
      {data?.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-line">
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="secondary" disabled={page <= 1 || loading}
              onClick={() => setPage(1)}>First</Button>
            <Button size="xs" variant="secondary" disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={13} />
            </Button>

            <span className="text-2xs text-ink-500 tabular-nums px-2">
              {num(offset + 1)}–{num(Math.min(offset + perPage, data.total))} of {num(data.total)}
            </span>

            <Button size="xs" variant="secondary" disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={13} />
            </Button>
            <Button size="xs" variant="secondary" disabled={page >= totalPages || loading}
              onClick={() => setPage(totalPages)}>Last</Button>
          </div>

          <div className="flex items-center gap-2">
            {checked > 0 && (
              <span className={cx('text-2xs tabular-nums',
                brokenCount ? 'text-signal-danger' : 'text-signal-ok')}>
                {brokenCount ? `${brokenCount} broken` : 'all loaded'}
              </span>
            )}
            <Select
              value={String(perPage)}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              options={[
                { value: '24', label: '24 per page' },
                { value: '48', label: '48 per page' },
                { value: '100', label: '100 per page' },
              ]}
              className="py-1 text-2xs min-w-[110px]"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Array.from({ length: perPage > 24 ? 24 : perPage }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : data?.rows?.length ? (
        <>
          {brokenCount > 0 && (
            <div className="flex items-start gap-2 text-2xs text-signal-warn bg-signal-warnBg border border-signal-warn/20 rounded px-3 py-2 mb-3">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <p>
                <strong>{brokenCount}</strong> images on this page are not loading.
                If <em>all</em> of them are broken, the path is wrong — in the backend .env{' '}
                <Code className="text-2xs">LEGACY_MEDIA_PATH</Code>, then press
                &quot;URLs fix&quot;. If only a few are broken, those are missing at the source
                — the migration will skip them and mark them as &quot;failed&quot;.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {data.rows.map((r) => (
              <a
                key={r.id} href={r.source_url} target="_blank" rel="noreferrer"
                className="group block"
                title={`${r.source_table} #${r.record_id} · ${r.column_name}\n${r.old_value}`}
              >
                <div className={cx(
                  'aspect-square rounded border overflow-hidden bg-paper-sunk relative',
                  broken[r.id] ? 'border-signal-danger/40' : 'border-line group-hover:border-teal'
                )}>
                  <img
                    src={r.source_url} alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onLoad={() => setBroken((b) => (r.id in b ? b : { ...b, [r.id]: false }))}
                    onError={() => setBroken((b) => ({ ...b, [r.id]: true }))}
                  />
                  {broken[r.id] && (
                    <span className="absolute inset-0 flex items-center justify-center bg-signal-dangerBg/90">
                      <XCircle size={16} className="text-signal-danger" />
                    </span>
                  )}
                </div>
                <p className="text-2xs text-ink-500 mt-1 truncate">
                  {TABLE_LABELS[r.source_table] || r.source_table}
                </p>
                <p className="text-2xs text-ink-300 truncate">#{r.record_id}</p>
              </a>
            ))}
          </div>

          {/* Bottom pagination — so you do not have to scroll up on a long list */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-line">
              <Button size="xs" variant="secondary" disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={13} /> Pichhla
              </Button>
              <span className="text-2xs text-ink-500 tabular-nums px-3">
                Page {num(page)} / {num(totalPages)}
              </span>
              <Button size="xs" variant="secondary" disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}>
                Agla <ChevronRight size={13} />
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={CloudUpload} title="The queue is empty"
          description="Press 'Scan' first — it reads the DB and builds the list of images to migrate."
        />
      )}
    </Modal>
  );
}

function FailedModal({ open, onClose }) {
  const { data, loading } = useResource(open ? '/admin/system/media/failed?limit=100' : null);

  return (
    <Modal open={open} onClose={onClose} size="xl"
      title="Failed migrations"
      subtitle={data ? `${num(data.total)} images could not be migrated` : undefined}
    >
      {loading ? <Skeleton className="h-40" /> : data?.rows?.length ? (
        <ul className="divide-y divide-line -mx-5">
          {data.rows.map((r) => (
            <li key={r.id} className="px-5 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-2xs text-ink">
                    <Code className="text-2xs">{r.source_table}</Code> #{r.record_id} · {r.column_name}
                  </p>
                  <p className="text-2xs text-ink-500 truncate max-w-lg mt-0.5">{r.source_url}</p>
                </div>
                <span className="text-2xs text-ink-300 tabular-nums shrink-0">{r.attempts}x</span>
              </div>
              <p className="text-2xs text-signal-danger mt-1">{r.error}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={CheckCircle2} title="No failures" />
      )}
    </Modal>
  );
}