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
    } catch { /* badge fail hone se page nahi rukna chahiye */ }
  }, [can]);

  /**
   * Live events — naya order/prescription aate hi badge turant update hota hai
   * aur toast dikhta hai. SSE connection tootne pe niche wala fallback poll
   * chalta rehta hai.
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
        toast.info(`Naya prescription upload hua — ${data.reference}`);
      }
      if (type === 'stock.out') {
        setAlerts((a) => ({ ...a, '/inventory': (a['/inventory'] || 0) + 1 }));
        toast.error(`Stock khatam — ${data.product_name}`);
      }
      if (type === 'order.status' || type === 'order.paid' || type === 'stock.changed') {
        loadStats(); // count exact rakhne ke liye refetch
      }
    },
  });

  // pehla load + fallback poll (SSE down ho to 60s, chalu ho to 5 min)
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

/** Login na ho to /login pe bhejo */
export function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><PageLoader label="Session check kar rahe hain…" /></div>;
  if (!admin) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

/** Permission na ho to friendly message — blank page nahi */
export function PermissionGate({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="card">
        <EmptyState
          icon={ShieldAlert}
          title="Is section ka access nahi hai"
          description="Ye page dekhne ki permission aapke role me nahi hai. Zaroorat ho to admin se bolo."
          action={<Button variant="secondary" onClick={() => window.history.back()}>Wapas jao</Button>}
        />
      </div>
    );
  }
  return children;
}

/** Har page ka top header — title + actions + optional back link */
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
