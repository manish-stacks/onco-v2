import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText, Tags,
  Ticket, Star, BarChart3, Settings, ShieldCheck, Newspaper, X, Building2, Bell, Activity,
  Image, Tag, MapPin, Inbox, MonitorSmartphone, CreditCard, ShoppingBag,
} from 'lucide-react';
import { PERMISSIONS as P } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { cx } from '@/components/ui';

/** Sections ordered by ops workflow — what is needed daily sits at the top */
const NAV = [
  {
    section: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: P.DASHBOARD_VIEW, end: true },
    ],
  },
  {
    section: 'Operations',
    items: [
      { to: '/orders', label: 'Orders', icon: ShoppingCart, perm: P.ORDERS_VIEW },
      { to: '/pos', label: 'POS / New order', icon: MonitorSmartphone, perm: P.ORDERS_MANAGE },
      { to: '/prescriptions', label: 'Prescriptions', icon: FileText, perm: P.PRESCRIPTIONS_VIEW },
      { to: '/customers', label: 'Customers', icon: Users, perm: P.CUSTOMERS_VIEW },
      { to: '/carts', label: 'Carts', icon: ShoppingBag, perm: P.CUSTOMERS_VIEW },
    ],
  },
  {
    section: 'Catalog',
    items: [
      { to: '/products', label: 'Products', icon: Package, perm: P.PRODUCTS_VIEW },
      { to: '/categories', label: 'Categories', icon: Tags, perm: P.CATEGORIES_VIEW },
      { to: '/brands', label: 'Brands', icon: Building2, perm: P.BRANDS_VIEW },
      { to: '/coupons', label: 'Coupons', icon: Ticket, perm: P.COUPONS_VIEW },
      { to: '/reviews', label: 'Reviews', icon: Star, perm: P.REVIEWS_VIEW },
    ],
  },
  {
    section: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, perm: P.REPORTS_VIEW },
      { to: '/payments', label: 'Payments', icon: CreditCard, perm: P.PAYMENTS_VIEW },
    ],
  },
  {
    section: 'Storefront',
    items: [
      { to: '/content/banners', label: 'Banners', icon: Image, perm: P.SETTINGS_VIEW },
      { to: '/content/deals', label: 'Deals', icon: Tag, perm: P.SETTINGS_VIEW },
      { to: '/content/offers', label: 'Offer cards', icon: Ticket, perm: P.SETTINGS_VIEW },
      { to: '/content/cities', label: 'Delivery cities', icon: MapPin, perm: P.SETTINGS_VIEW },
    ],
  },
  {
    section: 'Content',
    items: [
      { to: '/content/pages', label: 'Pages', icon: FileText, perm: P.CMS_VIEW },
      { to: '/content/news', label: 'News & Blog', icon: Newspaper, perm: P.CMS_VIEW },
      { to: '/content/enquiries', label: 'Enquiries', icon: Inbox, perm: P.CMS_VIEW },
    ],
  },
  {
    section: 'Access',
    items: [
      { to: '/team', label: 'Team & Roles', icon: ShieldCheck, perm: [P.ADMINS_VIEW, P.ROLES_VIEW] },
      { to: '/notifications', label: 'Notifications', icon: Bell, perm: [P.NOTIFICATIONS_VIEW, P.OTP_VIEW] },
      { to: '/settings', label: 'Site settings', icon: Settings, perm: P.SETTINGS_VIEW },
      { to: '/system', label: 'System', icon: Activity, perm: P.SYSTEM_VIEW },
    ],
  },
];

export default function Sidebar({ open, onClose, alertCounts = {}, live = false }) {
  const { can } = useAuth();

  const sections = NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => can(i.perm)) }))
    .filter((s) => s.items.length);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-ink/40 z-30 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={cx(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-[250px] shrink-0 bg-ink flex flex-col',
          'transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Wordmark: "onco" mono me — poore panel ka code-first character */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span className="font-mono text-2xl font-semibold text-white tracking-tight">Onco</span>
            <span className="text-2xl font-semibold text-teal">Healthmart</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/50 hover:text-white p-1 -mr-1"
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {sections.map((s, si) => (
            <div key={s.section || si} className={si > 0 ? 'mt-5' : ''}>
              {s.section && (
                <p className="px-2.5 mb-1.5 text-2xs font-semibold uppercase tracking-wider text-white/35">
                  {s.section}
                </p>
              )}
              <ul className="space-y-0.5">
                {s.items.map((item) => {
                  const count = alertCounts[item.to];
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) => cx(
                          'flex items-center gap-2.5 px-2.5 py-[7px] rounded transition-colors text-[16px]',
                          isActive
                            ? 'bg-teal/20 text-white font-medium'
                            : 'text-white/80 hover:text-white hover:bg-white/[0.06]'
                        )}
                      >
                        <item.icon size={15} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 && (
                          <span className="text-2xs font-semibold px-1.5 py-0.5 rounded bg-signal-warn text-white tabular-nums">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 shrink-0 flex items-center justify-between gap-2">
          <p className="text-2xs text-white/30">Admin Console v1.0</p>
          <span
            className="flex items-center gap-1.5 text-2xs text-white/40"
            title={live ? 'Live updates are on' : 'No live connection — refreshing every 60s'}
          >
            <span className={cx(
              'w-1.5 h-1.5 rounded-full',
              live ? 'bg-signal-ok animate-pulse' : 'bg-white/25'
            )} />
            {live ? 'Live' : 'Polling'}
          </span>
        </div>
      </aside>
    </>
  );
}
