/** Backend ke src/config/constants.js ka mirror */

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_EXPORT: 'orders.export',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',
  BRANDS_VIEW: 'brands.view',
  BRANDS_MANAGE: 'brands.manage',
  COUPONS_VIEW: 'coupons.view',
  COUPONS_MANAGE: 'coupons.manage',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  PRESCRIPTIONS_VIEW: 'prescriptions.view',
  PRESCRIPTIONS_MANAGE: 'prescriptions.manage',
  REVIEWS_VIEW: 'reviews.view',
  REVIEWS_MANAGE: 'reviews.manage',
  CMS_VIEW: 'cms.view',
  CMS_MANAGE: 'cms.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  ADMINS_VIEW: 'admins.view',
  ADMINS_MANAGE: 'admins.manage',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  SHIPPING_VIEW: 'shipping.view',
  SHIPPING_MANAGE: 'shipping.manage',
  PAYMENTS_VIEW: 'payments.view',
  OTP_VIEW: 'otp.view',
  NOTIFICATIONS_VIEW: 'notifications.view',
  SYSTEM_VIEW: 'system.view',
  SYSTEM_MANAGE: 'system.manage',
};

export const PAYMENT_GATEWAYS = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'payu', label: 'PayU' },
];

export const ORDER_STATUSES = [
  'Pending', 'Prescription Pending', 'New', 'Processing',
  'Shipped', 'Completed', 'Cancelled', 'Delivery Failed',
];

export const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Failed', 'Refunded', 'Partially Refunded'];

export const PRESCRIPTION_STATUSES = [
  'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Cancelled',
];

export const INVENTORY_CHANGE_TYPES = [
  'purchase', 'sale', 'return', 'adjustment', 'damage', 'expiry', 'initial',
];

export const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last year' },
  { value: 'custom', label: 'Custom range' },
];

/**
 * Status -> tone. The left rail of every list row takes its colour from this,
 * so 50 rows can be scanned at a glance.
 */
export const STATUS_TONE = {
  // orders
  Pending: 'warn',
  'Prescription Pending': 'warn',
  New: 'info',
  Processing: 'info',
  Shipped: 'info',
  Completed: 'ok',
  Cancelled: 'danger',
  'Delivery Failed': 'danger',
  // payment
  Unpaid: 'warn',
  Paid: 'ok',
  Failed: 'danger',
  Refunded: 'idle',
  'Partially Refunded': 'idle',
  // prescriptions
  'Under Review': 'info',
  Approved: 'ok',
  Rejected: 'danger',
  // generic
  Active: 'ok',
  Inactive: 'idle',
  active: 'ok',
  inactive: 'idle',
  'In Stock': 'ok',
  'Out of Stock': 'danger',
  // shipments
  Booked: 'info',
  'In Transit': 'info',
  'Out for Delivery': 'warn',
  Delivered: 'ok',
  RTO: 'danger',
  Verified: 'ok',
  Expired: 'idle',
  Open: 'warn',
  Resolved: 'ok',
};

export const TONE_CLASS = {
  ok: 'text-signal-ok bg-signal-okBg border-signal-ok/20',
  warn: 'text-signal-warn bg-signal-warnBg border-signal-warn/20',
  danger: 'text-signal-danger bg-signal-dangerBg border-signal-danger/20',
  info: 'text-signal-info bg-signal-infoBg border-signal-info/20',
  idle: 'text-signal-idle bg-signal-idleBg border-line',
};

export const TONE_HEX = {
  ok: '#1B7F4D',
  warn: '#A9610B',
  danger: '#B3261E',
  info: '#1D5FA8',
  idle: '#8DA0AB',
};

export const toneOf = (status) => STATUS_TONE[status] || 'idle';

/** A fresh COD order is legitimately "Unpaid" until delivery — showing that
 *  in red next to every COD order makes the list look like a payment problem
 *  when it's expected. Show "COD" (neutral tone) instead in that one case;
 *  everything else (online Unpaid/Paid/Failed/Refunded, or a COD order
 *  already marked Paid on delivery) still shows its real status as-is. */
export function paymentPillProps(order) {
  if (order?.payment_mode === 'cod' && order?.payment_status === 'Unpaid') {
    return { status: 'COD', tone: 'idle' };
  }
  return { status: order?.payment_status, tone: toneOf(order?.payment_status) };
}
