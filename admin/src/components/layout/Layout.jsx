import { useState, useEffect, useCallback } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ChevronLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { PageLoader, EmptyState, Button, cx } from '@/components/ui';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState({});
  const { can } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const loadStats = useCallback(async () => {
    if (!can('dashboard.view')) return;
    try {
      const res = await api.get('/admin/dashboard/quick-stats');
      const d = res.data || {};
      setAlerts({
        '/orders': (d.pending_orders || 0) + (d.new_orders || 0),
        '/prescriptions': d.pending_prescriptions || 0,
        '/inventory': (d.low_stock || 0) + (d.out_of_stock || 0),
      });
    } catch { /* a failed badge must not break the page */ }
  }, [can]);

  /**
   * Live events — the badge updates instantly when a new order/prescription arrives
   * and a toast is shown. If the SSE connection drops, the fallback poll below
   * keeps running.
   */
  const { connected } = useLiveEvents({
    onEvent: (event) => {
      const { type, data } = event;

      if (type === 'order.created') {
        setAlerts((a) => ({ ...a, '/orders': (a['/orders'] || 0) + 1 }));
        toast.info(`Naya order — ${data.reference} · ${inr(data.amount)} (${data.source})`);
      }
      if (type === 'prescription.created') {
        setAlerts((a) => ({ ...a, '/prescriptions': (a['/prescriptions'] || 0) + 1 }));
        toast.info(`New prescription uploaded — ${data.reference}`);
      }
      if (type === 'stock.out') {
        setAlerts((a) => ({ ...a, '/inventory': (a['/inventory'] || 0) + 1 }));
        toast.error(`Out of stock — ${data.product_name}`);
      }
      if (type === 'order.status' || type === 'order.paid' || type === 'stock.changed') {
        loadStats(); // count exact rakhne ke liye refetch
      }
    },
  });

  // first load + fallback poll (60s when SSE is down, 5 min when it is up)
  useEffect(() => {
    loadStats();
    const interval = connected ? 300000 : 60000;
    const t = setInterval(loadStats, interval);
    return () => clearInterval(t);
  }, [loadStats, connected, location.pathname]);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        alertCounts={alerts}
        live={connected}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} live={connected} />
        <main className="flex-1 p-4 sm:p-5 lg:p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Redirect to /login when not logged in */
export function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><PageLoader label="Checking your session…" /></div>;
  if (!admin) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

/** A friendly message when the permission is missing — not a blank page */
export function PermissionGate({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="card">
        <EmptyState
          icon={ShieldAlert}
          title="You do not have access to this section"
          description="Your role does not have permission to view this page. Ask an admin if you need it."
          action={<Button variant="secondary" onClick={() => window.history.back()}>Go back</Button>}
        />
      </div>
    );
  }
  return children;
}

/** Top header for every page — title + actions + optional back link */
export function PageHeader({ title, subtitle, actions, back, backLabel = 'Back', className }) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        {back && (
          <Link
            to={back}
            className="inline-flex items-center gap-1 text-2xs font-medium text-ink-500 hover:text-teal mb-1.5 transition-colors"
          >
            <ChevronLeft size={13} /> {backLabel}
          </Link>
        )}
        <h1 className="text-lg font-semibold text-ink tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
