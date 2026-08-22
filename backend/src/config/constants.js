/**
 * All enums/statuses/permissions in one place. To add a new module,
 * just add the permission here, then run `npm run seed`.
 */

// ---------------------------------------------------------------------------
// PERMISSIONS — module.action format
// ---------------------------------------------------------------------------
const PERMISSIONS = {
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

  // ⚠ Shows the live OTP — grant it only to those who truly need it
  OTP_VIEW: 'otp.view',
  NOTIFICATIONS_VIEW: 'notifications.view',

  SYSTEM_VIEW: 'system.view',
  SYSTEM_MANAGE: 'system.manage',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ---------------------------------------------------------------------------
// DEFAULT ROLES — the seed script creates these
// ---------------------------------------------------------------------------
const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    description: 'Full access — everything',
    is_system: 1,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Sub Admin',
    description: 'Most admin work, but not settings/roles/admins/OTP',
    is_system: 1,
    permissions: ALL_PERMISSIONS.filter(
      (p) => !p.startsWith('admins.') && !p.startsWith('roles.')
        && p !== PERMISSIONS.SETTINGS_MANAGE && p !== PERMISSIONS.OTP_VIEW
    ),
  },
  {
    name: 'Order Manager',
    description: 'Handles orders + prescriptions only',
    is_system: 1,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_MANAGE, PERMISSIONS.ORDERS_CANCEL, PERMISSIONS.ORDERS_EXPORT,
      PERMISSIONS.PRESCRIPTIONS_VIEW, PERMISSIONS.PRESCRIPTIONS_MANAGE,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.SHIPPING_VIEW, PERMISSIONS.SHIPPING_MANAGE,
      PERMISSIONS.NOTIFICATIONS_VIEW,
    ],
  },
  {
    name: 'Inventory Manager',
    description: 'Manages products + stock',
    is_system: 1,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.CATEGORIES_VIEW, PERMISSIONS.CATEGORIES_MANAGE,
      PERMISSIONS.BRANDS_VIEW, PERMISSIONS.BRANDS_MANAGE,
      PERMISSIONS.REPORTS_VIEW,
    ],
  },
  {
    name: 'Employee',
    description: 'Read-only staff login',
    is_system: 1,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.PRESCRIPTIONS_VIEW,
      PERMISSIONS.SHIPPING_VIEW,
    ],
  },
];

// ---------------------------------------------------------------------------
// STATUSES
// ---------------------------------------------------------------------------
const ORDER_STATUS = {
  PENDING: 'Pending',
  PRESCRIPTION_PENDING: 'Prescription Pending',
  NEW: 'New',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DELIVERY_FAILED: 'Delivery Failed',
};
const ORDER_STATUSES = Object.values(ORDER_STATUS);

/** Which statuses can transition to which */
const ORDER_STATUS_FLOW = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.NEW, ORDER_STATUS.PRESCRIPTION_PENDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PRESCRIPTION_PENDING]: [ORDER_STATUS.NEW, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.NEW]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERY_FAILED],
  [ORDER_STATUS.DELIVERY_FAILED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

const CANCELLABLE_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PRESCRIPTION_PENDING,
  ORDER_STATUS.NEW,
  ORDER_STATUS.PROCESSING,
];

const PAYMENT_STATUS = {
  UNPAID: 'Unpaid',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially Refunded',
};

const PAYMENT_MODE = { COD: 'cod', ONLINE: 'online' };

const PAYMENT_GATEWAY = { RAZORPAY: 'razorpay', PAYU: 'payu', COD: 'cod', MANUAL: 'manual' };

const SHIPMENT_STATUS = {
  BOOKED: 'Booked',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  RTO: 'RTO',
};

const NOTIFICATION_CHANNELS = ['whatsapp', 'sms', 'push', 'email'];

const PRESCRIPTION_STATUS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const PRESCRIPTION_STATUSES = Object.values(PRESCRIPTION_STATUS);

const INVENTORY_CHANGE_TYPE = {
  PURCHASE: 'purchase',
  SALE: 'sale',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  DAMAGE: 'damage',
  EXPIRY: 'expiry',
  INITIAL: 'initial',
};

const PLATFORMS = ['web', 'app'];

// ---------------------------------------------------------------------------
// CACHE TTLs (seconds)
// ---------------------------------------------------------------------------
const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 900,
  VERY_LONG: 3600,
};

module.exports = {
  PAYMENT_GATEWAY,
  SHIPMENT_STATUS,
  NOTIFICATION_CHANNELS,
  PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  ORDER_STATUS,
  ORDER_STATUSES,
  ORDER_STATUS_FLOW,
  CANCELLABLE_STATUSES,
  PAYMENT_STATUS,
  PAYMENT_MODE,
  PRESCRIPTION_STATUS,
  PRESCRIPTION_STATUSES,
  INVENTORY_CHANGE_TYPE,
  PLATFORMS,
  CACHE_TTL,
};
