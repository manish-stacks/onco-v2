const express = require('express');

const router = express.Router();

const auth = require('../controllers/admin/auth.controller');
const dashboard = require('../controllers/admin/dashboard.controller');
const order = require('../controllers/admin/order.controller');
const product = require('../controllers/admin/product.controller');
const inventory = require('../controllers/admin/inventory.controller');
const customer = require('../controllers/admin/customer.controller');
const prescription = require('../controllers/admin/prescription.controller');
const catalog = require('../controllers/admin/catalog.controller');
const settings = require('../controllers/admin/settings.controller');
const report = require('../controllers/admin/report.controller');
const adminUser = require('../controllers/admin/admin.controller');
const eventsCtrl = require('../controllers/admin/events.controller');
const shipping = require('../controllers/admin/shipping.controller');
const payment = require('../controllers/admin/payment.controller');
const otpCtrl = require('../controllers/admin/otp.controller');
const system = require('../controllers/admin/system.controller');
const pos = require('../controllers/admin/pos.controller');

const { adminAuth, requirePermission } = require('../middleware/adminAuth');
const { validate } = require('../middleware/validate');
const {
  uploadProduct, uploadCategory, uploadBanner, uploadBrand, uploadNews, uploadAvatar, uploadInvoice,
  uploadPrescription,
} = require('../middleware/upload');
const { PERMISSIONS: P } = require('../config/constants');

const productImages = uploadProduct.fields([
  { name: 'image_1', maxCount: 1 }, { name: 'image_2', maxCount: 1 },
  { name: 'image_3', maxCount: 1 }, { name: 'image_4', maxCount: 1 },
  { name: 'image_5', maxCount: 1 },
]);
const categoryImages = uploadCategory.fields([
  { name: 'category_image', maxCount: 1 }, { name: 'category_banner', maxCount: 1 },
]);

// ===========================================================================
// AUTH (login public, baaki protected)
// ===========================================================================
router.post('/auth/login', validate({
  username: { required: true },
  password: { required: true },
}), auth.login);

// OTP step of login — public (the admin is not authenticated yet)
router.post('/auth/verify-otp', validate({
  admin_id: { required: true },
  otp: { required: true },
}), auth.verifyOtp);
router.post('/auth/resend-otp', validate({
  admin_id: { required: true },
}), auth.resendOtp);

/**
 * SSE live stream. Mounted BEFORE adminAuth because EventSource cannot send custom headers
 * so the token arrives as a query param and the controller verifies it itself
 * .
 */
router.get('/events', eventsCtrl.stream);

router.use(adminAuth); // ---- everything below this is protected ----

router.get('/events/status', eventsCtrl.status);

router.get('/auth/me', auth.me);
router.patch('/auth/me', uploadAvatar.single('avatar'), auth.updateProfile);
router.post('/auth/change-password', validate({
  old_password: { required: true },
  new_password: { required: true, minLength: 8 },
}), auth.changePassword);
router.post('/auth/logout', auth.logout);
router.post('/auth/device-token', auth.registerDevice);
router.delete('/auth/device-token', auth.unregisterDevice);

// ===========================================================================
// DASHBOARD
// ===========================================================================
router.get('/dashboard', requirePermission(P.DASHBOARD_VIEW), dashboard.overview);
router.get('/dashboard/quick-stats', requirePermission(P.DASHBOARD_VIEW), dashboard.quickStats);

// ===========================================================================
// ORDERS — web + app in one place
//   ?orderFrom=web / ?orderFrom=app / (blank = both)
// ===========================================================================
router.get('/orders', requirePermission(P.ORDERS_VIEW), order.list);
router.get('/orders/stats', requirePermission(P.ORDERS_VIEW), order.stats);
router.get('/orders/export', requirePermission(P.ORDERS_EXPORT), order.exportCsv);
router.post('/track-shipment', requirePermission(P.ORDERS_VIEW), order.trackShipment);
router.get('/orders/:orderId', requirePermission(P.ORDERS_VIEW), order.detail);
router.get('/orders/:orderId/invoice', requirePermission(P.ORDERS_VIEW), order.invoice);
router.post('/orders/:orderId/original-invoice', requirePermission(P.SHIPPING_MANAGE), uploadInvoice.single('invoice'), order.uploadOriginalInvoice);
router.patch('/orders/:orderId', requirePermission(P.ORDERS_MANAGE), order.updateOrder);
router.patch('/orders/:orderId/status', requirePermission(P.ORDERS_MANAGE), validate({
  status: { required: true },
}), order.updateStatus);
router.patch('/orders/:orderId/tracking', requirePermission(P.ORDERS_MANAGE), order.updateTracking);
router.patch('/orders/:orderId/payment', requirePermission(P.ORDERS_MANAGE), order.updatePayment);
router.post('/orders/:orderId/cancel', requirePermission(P.ORDERS_CANCEL), order.cancelOrder);
// Hard delete — only ever succeeds while the order is still Pending (see service-layer check)
router.delete('/orders/:orderId', requirePermission(P.ORDERS_CANCEL), order.deleteOrder);
router.patch('/orders/:orderId/prescription', requirePermission(P.PRESCRIPTIONS_MANAGE),
  order.updatePrescriptionStatus);

// ---- POS (admin creates a custom order) ----
router.get('/pos/config', requirePermission(P.ORDERS_MANAGE), pos.getConfig);
router.get('/pos/products', requirePermission(P.ORDERS_MANAGE), pos.searchProducts);
router.get('/pos/customer', requirePermission(P.ORDERS_MANAGE), pos.lookupCustomer);
router.post('/pos/orders', requirePermission(P.ORDERS_MANAGE),
  uploadPrescription.array('prescription_images', 10), pos.createOrder);

// ===========================================================================
// SHIPPING — DTDC
// ===========================================================================
router.get('/shipping/config', requirePermission(P.SHIPPING_VIEW), shipping.config);
router.get('/orders/:orderId/shipments', requirePermission(P.SHIPPING_VIEW), shipping.shipments);
router.get('/orders/:orderId/tracking', requirePermission(P.SHIPPING_VIEW), shipping.refreshTracking);
router.post('/orders/:orderId/ship', requirePermission(P.SHIPPING_MANAGE), shipping.bookShipment);
router.post('/orders/:orderId/ship-manual', requirePermission(P.SHIPPING_MANAGE), shipping.bookManualShipment);
router.delete('/orders/:orderId/ship', requirePermission(P.SHIPPING_MANAGE), shipping.cancelShipment);
router.get('/shipments/:awb/label', requirePermission(P.SHIPPING_VIEW), shipping.label);
router.get('/shipments/:awb/scans', requirePermission(P.SHIPPING_VIEW), shipping.scans);
router.get('/payments', requirePermission(P.PAYMENTS_VIEW), payment.list);
router.get('/payments/export', requirePermission(P.PAYMENTS_VIEW), payment.exportCsv);

// ===========================================================================
// OTP LOGS + NOTIFICATION LOGS
// ⚠ otp.view shows the live OTP — by default only Super Admin has it
// ===========================================================================
router.get('/otp-logs', requirePermission(P.OTP_VIEW), otpCtrl.list);
router.get('/otp-logs/stats', requirePermission(P.OTP_VIEW), otpCtrl.stats);
router.get('/notification-logs', requirePermission(P.NOTIFICATIONS_VIEW), otpCtrl.notificationLogs);
// NOTE: gated on NOTIFICATIONS_VIEW (not the new NOTIFICATIONS_MANAGE permission
// constant) so it works immediately for existing admin accounts without
// needing a role_permissions migration first. Switch this to
// P.NOTIFICATIONS_MANAGE once that permission has been synced into the roles
// that should have it (Admins > Roles).
router.post('/notifications/send', requirePermission(P.NOTIFICATIONS_VIEW), otpCtrl.sendCustom);

// ===========================================================================
// PRODUCTS
// ===========================================================================
router.get('/products', requirePermission(P.PRODUCTS_VIEW), product.list);
router.get('/products/export', requirePermission(P.PRODUCTS_VIEW), product.exportCsv);
router.get('/products/flag-counts', requirePermission(P.PRODUCTS_VIEW), product.flagCounts);
router.get('/products/:productId', requirePermission(P.PRODUCTS_VIEW), product.detail);
router.post('/products', requirePermission(P.PRODUCTS_CREATE), productImages, product.create);
router.put('/products/:productId', requirePermission(P.PRODUCTS_UPDATE), productImages, product.update);
router.patch('/products/bulk-status', requirePermission(P.PRODUCTS_UPDATE), product.bulkStatus);
router.patch('/products/bulk-flags', requirePermission(P.PRODUCTS_UPDATE), product.bulkFlags);
router.patch('/products/bulk-brand', requirePermission(P.PRODUCTS_UPDATE), product.bulkBrand);
router.patch('/products/:productId/flag', requirePermission(P.PRODUCTS_UPDATE), product.toggleFlag);
router.patch('/products/:productId/status', requirePermission(P.PRODUCTS_UPDATE), product.setStatus);
router.delete('/products/:productId', requirePermission(P.PRODUCTS_DELETE), product.remove);

// ===========================================================================
// INVENTORY — stock management + audit trail
// ===========================================================================
router.get('/inventory/summary', requirePermission(P.INVENTORY_VIEW), inventory.summary);
router.get('/inventory/low-stock', requirePermission(P.INVENTORY_VIEW), inventory.lowStock);
router.get('/inventory/out-of-stock', requirePermission(P.INVENTORY_VIEW), inventory.outOfStock);
router.get('/inventory/expiring', requirePermission(P.INVENTORY_VIEW), inventory.expiring);
router.get('/inventory/movements', requirePermission(P.INVENTORY_VIEW), inventory.movements);
router.get('/inventory/export', requirePermission(P.INVENTORY_VIEW), inventory.exportCsv);
router.post('/inventory/bulk', requirePermission(P.INVENTORY_MANAGE), inventory.bulkUpdate);
router.patch('/inventory/:productId', requirePermission(P.INVENTORY_MANAGE), inventory.adjustStock);
router.post('/inventory/:productId/add', requirePermission(P.INVENTORY_MANAGE), inventory.addStock);
router.post('/inventory/:productId/remove', requirePermission(P.INVENTORY_MANAGE), inventory.removeStock);

// ===========================================================================
// CATEGORIES / BRANDS
// ===========================================================================
router.get('/categories', requirePermission(P.CATEGORIES_VIEW), catalog.listCategories);
router.get('/categories/tree', requirePermission(P.CATEGORIES_VIEW), catalog.categoryTree);
router.get('/categories/:categoryId', requirePermission(P.CATEGORIES_VIEW), catalog.categoryDetail);
router.post('/categories', requirePermission(P.CATEGORIES_MANAGE), categoryImages, validate({
  category_name: { required: true, maxLength: 255 },
}), catalog.createCategory);
router.put('/categories/:categoryId', requirePermission(P.CATEGORIES_MANAGE), categoryImages, catalog.updateCategory);
router.delete('/categories/:categoryId', requirePermission(P.CATEGORIES_MANAGE), catalog.removeCategory);

router.get('/brands', requirePermission(P.BRANDS_VIEW), catalog.listBrands);
router.post('/brands', requirePermission(P.BRANDS_MANAGE), uploadBrand.single('image_url'), catalog.createBrand);
router.put('/brands/:brandId', requirePermission(P.BRANDS_MANAGE), uploadBrand.single('image_url'), catalog.updateBrand);
router.post('/brands/:brandId/merge', requirePermission(P.BRANDS_MANAGE), catalog.mergeBrands);
router.delete('/brands/:brandId', requirePermission(P.BRANDS_MANAGE), catalog.removeBrand);

// ===========================================================================
// COUPONS
// ===========================================================================
router.get('/coupons', requirePermission(P.COUPONS_VIEW), catalog.listCoupons);
router.get('/coupons/:couponId', requirePermission(P.COUPONS_VIEW), catalog.couponDetail);
router.get('/coupons/:couponId/usage', requirePermission(P.COUPONS_VIEW), catalog.couponUsage);
router.post('/coupons', requirePermission(P.COUPONS_MANAGE), validate({
  coupon_code: { required: true, maxLength: 50 },
}), catalog.createCoupon);
router.put('/coupons/:couponId', requirePermission(P.COUPONS_MANAGE), catalog.updateCoupon);
router.delete('/coupons/:couponId', requirePermission(P.COUPONS_MANAGE), catalog.removeCoupon);

// ===========================================================================
// CUSTOMERS
// ===========================================================================
router.get('/customers', requirePermission(P.CUSTOMERS_VIEW), customer.list);
router.get('/customers/stats', requirePermission(P.CUSTOMERS_VIEW), customer.stats);
router.get('/customers/export', requirePermission(P.CUSTOMERS_VIEW), customer.exportCsv);
// NOTE: /customers/carts must stay above /customers/:customerId or Express
// would swallow "carts" as a customerId.
router.get('/customers/carts', requirePermission(P.CUSTOMERS_VIEW), customer.carts);
router.get('/customers/:customerId', requirePermission(P.CUSTOMERS_VIEW), customer.detail);
router.get('/customers/:customerId/orders', requirePermission(P.CUSTOMERS_VIEW), customer.customerOrders);
router.get('/customers/:customerId/cart', requirePermission(P.CUSTOMERS_VIEW), customer.customerCart);
router.patch('/customers/:customerId', requirePermission(P.CUSTOMERS_MANAGE), customer.update);
router.patch('/customers/:customerId/status', requirePermission(P.CUSTOMERS_MANAGE), customer.setStatus);

// ===========================================================================
// PRESCRIPTIONS — web and app share one table
// ===========================================================================
router.get('/prescriptions', requirePermission(P.PRESCRIPTIONS_VIEW), prescription.list);
router.get('/prescriptions/stats', requirePermission(P.PRESCRIPTIONS_VIEW), prescription.stats);
router.get('/prescriptions/:id', requirePermission(P.PRESCRIPTIONS_VIEW), prescription.detail);
router.patch('/prescriptions/:id/status', requirePermission(P.PRESCRIPTIONS_MANAGE), validate({
  status: { required: true },
}), prescription.updateStatus);
router.put('/prescriptions/:id/medicines', requirePermission(P.PRESCRIPTIONS_MANAGE), prescription.setMedicines);
router.delete('/prescriptions/:id', requirePermission(P.PRESCRIPTIONS_MANAGE), prescription.remove);

// ===========================================================================
// REVIEWS / TESTIMONIALS
// ===========================================================================
router.get('/reviews', requirePermission(P.REVIEWS_VIEW), catalog.listReviews);
router.patch('/reviews/:reviewId', requirePermission(P.REVIEWS_MANAGE), catalog.moderateReview);
router.delete('/reviews/:reviewId', requirePermission(P.REVIEWS_MANAGE), catalog.removeReview);

router.get('/testimonials', requirePermission(P.REVIEWS_VIEW), catalog.listTestimonials);
router.post('/testimonials', requirePermission(P.REVIEWS_MANAGE), catalog.createTestimonial);
router.put('/testimonials/:id', requirePermission(P.REVIEWS_MANAGE), catalog.updateTestimonial);
router.delete('/testimonials/:id', requirePermission(P.REVIEWS_MANAGE), catalog.removeTestimonial);

// ===========================================================================
// REPORTS
// ===========================================================================
router.get('/reports/sales', requirePermission(P.REPORTS_VIEW), report.sales);
router.get('/reports/products', requirePermission(P.REPORTS_VIEW), report.products);
router.get('/reports/customers', requirePermission(P.REPORTS_VIEW), report.customers);
router.get('/reports/inventory', requirePermission(P.REPORTS_VIEW), report.inventory);
router.get('/reports/locations', requirePermission(P.REPORTS_VIEW), report.locations);
router.get('/reports/prescriptions', requirePermission(P.REPORTS_VIEW), report.prescriptions);
router.get('/reports/coupons', requirePermission(P.REPORTS_VIEW), report.coupons);
router.get('/reports/gst', requirePermission(P.REPORTS_VIEW), report.gst);
router.get('/reports/export', requirePermission(P.REPORTS_EXPORT), report.exportReport);

// ===========================================================================
// SETTINGS / BANNERS / DEALS / OFFERS / CITIES
// ===========================================================================
router.get('/settings', requirePermission(P.SETTINGS_VIEW), settings.getSettings);
router.put('/settings/:id', requirePermission(P.SETTINGS_MANAGE), uploadBanner.single('logo'), settings.updateSettings);
router.post('/settings/test-email', requirePermission(P.SETTINGS_MANAGE), settings.testEmailSettings);

router.get('/banners', requirePermission(P.SETTINGS_VIEW), settings.listBanners);
router.post('/banners', requirePermission(P.SETTINGS_MANAGE), uploadBanner.single('banner_image'), settings.createBanner);
router.put('/banners/:bannerId', requirePermission(P.SETTINGS_MANAGE), uploadBanner.single('banner_image'), settings.updateBanner);
router.delete('/banners/:bannerId', requirePermission(P.SETTINGS_MANAGE), settings.removeBanner);

router.get('/deals', requirePermission(P.SETTINGS_VIEW), settings.listDeals);
router.post('/deals', requirePermission(P.SETTINGS_MANAGE), uploadBanner.single('image'), settings.createDeal);
router.put('/deals/:dealId', requirePermission(P.SETTINGS_MANAGE), uploadBanner.single('image'), settings.updateDeal);
router.delete('/deals/:dealId', requirePermission(P.SETTINGS_MANAGE), settings.removeDeal);

router.get('/offers', requirePermission(P.SETTINGS_VIEW), settings.listOffers);
router.post('/offers', requirePermission(P.SETTINGS_MANAGE), settings.createOffer);
router.put('/offers/:offerId', requirePermission(P.SETTINGS_MANAGE), settings.updateOffer);
router.delete('/offers/:offerId', requirePermission(P.SETTINGS_MANAGE), settings.removeOffer);

// NOTE: testimonials are registered once already, above (near REVIEWS_*
// permissions, using catalog.controller) — a second, dead duplicate set
// using settings.controller + SETTINGS_* permissions used to be here.
// Express only ever runs the first-registered handler for a path, so the
// duplicate never actually ran; removed to avoid confusion.

router.get('/faqs', requirePermission(P.SETTINGS_VIEW), settings.listFaqs);
router.post('/faqs', requirePermission(P.SETTINGS_MANAGE), settings.createFaq);
router.put('/faqs/:faqId', requirePermission(P.SETTINGS_MANAGE), settings.updateFaq);
router.delete('/faqs/:faqId', requirePermission(P.SETTINGS_MANAGE), settings.removeFaq);

router.get('/cities', requirePermission(P.SETTINGS_VIEW), settings.listCities);
router.post('/cities', requirePermission(P.SETTINGS_MANAGE), settings.createCity);
router.put('/cities/:cityId', requirePermission(P.SETTINGS_MANAGE), settings.updateCity);
router.delete('/cities/:cityId', requirePermission(P.SETTINGS_MANAGE), settings.removeCity);

// ===========================================================================
// CMS — pages, news, enquiries
// ===========================================================================
router.get('/pages', requirePermission(P.CMS_VIEW), settings.listPages);
router.get('/pages/:pageId', requirePermission(P.CMS_VIEW), settings.pageDetail);
router.post('/pages', requirePermission(P.CMS_MANAGE), settings.createPage);
router.put('/pages/:pageId', requirePermission(P.CMS_MANAGE), settings.updatePage);
router.delete('/pages/:pageId', requirePermission(P.CMS_MANAGE), settings.removePage);

router.get('/news', requirePermission(P.CMS_VIEW), settings.listNews);
router.post('/news', requirePermission(P.CMS_MANAGE), uploadNews.single('image'), settings.createNews);
router.put('/news/:newsId', requirePermission(P.CMS_MANAGE), uploadNews.single('image'), settings.updateNews);
router.delete('/news/:newsId', requirePermission(P.CMS_MANAGE), settings.removeNews);

router.get('/enquiries', requirePermission(P.CMS_VIEW), settings.listEnquiries);
router.patch('/enquiries/:enquiryId', requirePermission(P.CMS_MANAGE), settings.resolveEnquiry);
router.delete('/enquiries/:enquiryId', requirePermission(P.CMS_MANAGE), settings.removeEnquiry);

// ===========================================================================
// ADMIN USERS / ROLES — sub-admins and employees are created here
// ===========================================================================
router.get('/admins', requirePermission(P.ADMINS_VIEW), adminUser.list);
router.get('/admins/:adminId', requirePermission(P.ADMINS_VIEW), adminUser.detail);
router.post('/admins', requirePermission(P.ADMINS_MANAGE), adminUser.create);
router.patch('/admins/:adminId', requirePermission(P.ADMINS_MANAGE), adminUser.update);
router.patch('/admins/:adminId/status', requirePermission(P.ADMINS_MANAGE), adminUser.setStatus);
router.post('/admins/:adminId/reset-password', requirePermission(P.ADMINS_MANAGE), adminUser.resetPassword);
router.delete('/admins/:adminId', requirePermission(P.ADMINS_MANAGE), adminUser.remove);

router.get('/roles', requirePermission(P.ROLES_VIEW), adminUser.listRoles);
router.get('/roles/permissions', requirePermission(P.ROLES_VIEW), adminUser.permissionCatalog);
router.get('/roles/:roleId', requirePermission(P.ROLES_VIEW), adminUser.roleDetail);
router.post('/roles', requirePermission(P.ROLES_MANAGE), adminUser.createRole);
router.put('/roles/:roleId', requirePermission(P.ROLES_MANAGE), adminUser.updateRole);
router.delete('/roles/:roleId', requirePermission(P.ROLES_MANAGE), adminUser.removeRole);

router.get('/activity-logs', requirePermission(P.ADMINS_VIEW), adminUser.activityLog);

// ===========================================================================
// SYSTEM — health, cache, media migration
// ===========================================================================
router.get('/system/health', requirePermission(P.SYSTEM_VIEW), system.getHealth);
router.get('/system/cache', requirePermission(P.SYSTEM_VIEW), system.cacheStats);
router.post('/system/cache/clear', requirePermission(P.SYSTEM_MANAGE), system.clearCache);

router.get('/system/media/status', requirePermission(P.SYSTEM_VIEW), system.mediaStatus);
router.get('/system/media/preview', requirePermission(P.SYSTEM_VIEW), system.previewMedia);
router.get('/system/media/failed', requirePermission(P.SYSTEM_VIEW), system.failedMedia);
router.post('/system/media/scan', requirePermission(P.SYSTEM_MANAGE), system.scanMedia);
router.post('/system/media/migrate', requirePermission(P.SYSTEM_MANAGE), system.migrateMedia);
router.post('/system/media/repair-urls', requirePermission(P.SYSTEM_MANAGE), system.repairUrls);
router.post('/system/media/retry-failed', requirePermission(P.SYSTEM_MANAGE), system.retryFailed);
router.delete('/system/media/queue', requirePermission(P.SYSTEM_MANAGE), system.clearQueue);

module.exports = router;