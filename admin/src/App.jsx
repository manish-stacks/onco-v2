import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppLayout, ProtectedRoute, PermissionGate } from '@/components/layout/Layout';
import { PERMISSIONS as P } from '@/lib/constants';
import { Button, EmptyState } from '@/components/ui';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import OrderList from '@/pages/orders/OrderList';
import OrderDetail from '@/pages/orders/OrderDetail';
import Invoice from '@/pages/orders/Invoice';
import ProductList from '@/pages/products/ProductList';
import ProductForm from '@/pages/products/ProductForm';
import Inventory from '@/pages/inventory/Inventory';
import { CustomerList, CustomerDetail } from '@/pages/customers/Customers';
import { PrescriptionList, PrescriptionDetail } from '@/pages/prescriptions/Prescriptions';
import { Coupons, Reviews } from '@/pages/catalog/Coupons';
import Reports from '@/pages/reports/Reports';
import Settings from '@/pages/settings/Settings';
import Banners from '@/pages/content/Banners';
import Deals from '@/pages/content/Deals';
import Offers from '@/pages/content/Offers';
import Cities from '@/pages/content/Cities';
import Pages from '@/pages/content/Pages';
import News from '@/pages/content/News';
import Enquiries from '@/pages/content/Enquiries';
import Team from '@/pages/admins/Team';
import Notifications from '@/pages/admins/Notifications';
import System from '@/pages/system/System';
import { Brands } from './pages/catalog/Brands';
import { Categories } from './pages/catalog/Categories';

/** Har protected page ke liye chhota wrapper */
const Guard = ({ perm, children }) => <PermissionGate perm={perm}>{children}</PermissionGate>;

function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={FileQuestion}
        title="Ye page nahi mila"
        description="URL galat ho sakta hai, ya ye page hata diya gaya."
        action={<Button variant="primary" onClick={() => window.location.assign("/")}>Dashboard pe jao</Button>}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              element={(
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              )}
            >
              <Route index element={<Guard perm={P.DASHBOARD_VIEW}><Dashboard /></Guard>} />

              {/* Orders */}
              <Route path="orders" element={<Guard perm={P.ORDERS_VIEW}><OrderList /></Guard>} />
              <Route path="orders/:orderId" element={<Guard perm={P.ORDERS_VIEW}><OrderDetail /></Guard>} />
              <Route path="orders/:orderId/invoice" element={<Guard perm={P.ORDERS_VIEW}><Invoice /></Guard>} />

              {/* Prescriptions */}
              <Route path="prescriptions" element={<Guard perm={P.PRESCRIPTIONS_VIEW}><PrescriptionList /></Guard>} />
              <Route path="prescriptions/:id" element={<Guard perm={P.PRESCRIPTIONS_VIEW}><PrescriptionDetail /></Guard>} />

              {/* Customers */}
              <Route path="customers" element={<Guard perm={P.CUSTOMERS_VIEW}><CustomerList /></Guard>} />
              <Route path="customers/:customerId" element={<Guard perm={P.CUSTOMERS_VIEW}><CustomerDetail /></Guard>} />

              {/* Catalog */}
              <Route path="products" element={<Guard perm={P.PRODUCTS_VIEW}><ProductList /></Guard>} />
              <Route path="products/new" element={<Guard perm={P.PRODUCTS_CREATE}><ProductForm /></Guard>} />
              <Route path="products/:productId/edit" element={<Guard perm={P.PRODUCTS_UPDATE}><ProductForm /></Guard>} />
              <Route path="inventory" element={<Guard perm={P.INVENTORY_VIEW}><Inventory /></Guard>} />
              <Route path="categories" element={<Guard perm={P.CATEGORIES_VIEW}><Categories /></Guard>} />
              <Route path="brands" element={<Guard perm={P.BRANDS_VIEW}><Brands /></Guard>} />
              <Route path="coupons" element={<Guard perm={P.COUPONS_VIEW}><Coupons /></Guard>} />
              <Route path="reviews" element={<Guard perm={P.REVIEWS_VIEW}><Reviews /></Guard>} />

              {/* Insights */}
              <Route path="reports" element={<Guard perm={P.REPORTS_VIEW}><Reports /></Guard>} />

              {/* Storefront */}
              <Route path="content/banners" element={<Guard perm={P.SETTINGS_VIEW}><Banners /></Guard>} />
              <Route path="content/deals" element={<Guard perm={P.SETTINGS_VIEW}><Deals /></Guard>} />
              <Route path="content/offers" element={<Guard perm={P.SETTINGS_VIEW}><Offers /></Guard>} />
              <Route path="content/cities" element={<Guard perm={P.SETTINGS_VIEW}><Cities /></Guard>} />

              {/* Content */}
              <Route path="content/pages" element={<Guard perm={P.CMS_VIEW}><Pages /></Guard>} />
              <Route path="content/news" element={<Guard perm={P.CMS_VIEW}><News /></Guard>} />
              <Route path="content/enquiries" element={<Guard perm={P.CMS_VIEW}><Enquiries /></Guard>} />

              {/* Settings */}
              <Route path="settings" element={<Guard perm={P.SETTINGS_VIEW}><Settings /></Guard>} />

              {/* Purane URLs — bookmark tootne se bachne ke liye */}
              <Route path="cms" element={<Navigate to="/content/pages" replace />} />
              <Route path="storefront" element={<Navigate to="/settings" replace />} />

              {/* Access */}
              <Route path="team" element={<Guard perm={[P.ADMINS_VIEW, P.ROLES_VIEW]}><Team /></Guard>} />
              <Route path="notifications" element={<Guard perm={[P.NOTIFICATIONS_VIEW, P.OTP_VIEW]}><Notifications /></Guard>} />
              <Route path="system" element={<Guard perm={P.SYSTEM_VIEW}><System /></Guard>} />

              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}