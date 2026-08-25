const express = require('express');

const router = express.Router();

const auth = require('../controllers/app/auth.controller');
const catalog = require('../controllers/app/catalog.controller');
const cart = require('../controllers/app/cart.controller');
const order = require('../controllers/app/order.controller');
const prescription = require('../controllers/app/prescription.controller');
const cms = require('../controllers/app/cms.controller');
const payment = require('../controllers/app/payment.controller');

const { customerAuth, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadPrescription } = require('../middleware/upload');

/**
 * BOTH the website and the mobile app use these routes.
 * The client simply sends a header:  X-Client-Platform: web  |  app
 * orders.orderFrom and prescriptions.source are set automatically from it.
 */

// ===========================================================================
// AUTH
// ===========================================================================
router.post('/auth/register', optionalAuth, validate({
  customer_name: { required: true, maxLength: 100 },
  password: { required: true, minLength: 6 },
  mobile: { required: true, type: 'mobile' },
  email_id: { type: 'email' },
  pincode: { type: 'pincode' },
}), auth.register);

router.post('/auth/login', optionalAuth, validate({
  mobile: { required: true, type: 'mobile' },
  password: { required: true },
}), auth.login);

router.post('/auth/otp/request', optionalAuth, validate({
  mobile: { required: true, type: 'mobile' },
}), auth.requestOtp);

router.post('/auth/otp/verify', optionalAuth, validate({
  customer_id: { required: true, type: 'int' },
  otp: { required: true, minLength: 4, maxLength: 8 },
}), auth.verifyOtp);

// FCM push tokens — app login/logout pe
router.post('/auth/device-token', customerAuth, auth.registerDevice);
router.delete('/auth/device-token', customerAuth, auth.unregisterDevice);

router.post('/auth/password/reset', validate({
  customer_id: { required: true, type: 'int' },
  otp: { required: true },
  new_password: { required: true, minLength: 6 },
}), auth.resetPassword);

router.post('/auth/password/change', customerAuth, validate({
  old_password: { required: true },
  new_password: { required: true, minLength: 6 },
}), auth.changePassword);

router.get('/auth/me', customerAuth, auth.me);
router.patch('/auth/me', customerAuth, auth.updateProfile);

// ===========================================================================
// CATALOG (public — login optional)
// ===========================================================================
router.get('/home', optionalAuth, catalog.home);
router.get('/search', catalog.search);
router.get('/brands', catalog.listBrands);
router.get('/products', optionalAuth, catalog.listProducts);
router.get('/products/:slug', optionalAuth, catalog.productDetail);
router.get('/products/:productId/reviews', catalog.productReviews);
router.get('/categories', catalog.listCategories);
router.get('/categories/tree', catalog.categoryTree);
router.get('/categories/:slug', catalog.categoryDetail);
router.get('/serviceable-city', catalog.checkServiceability);

// ===========================================================================
// CART / WISHLIST / COUPONS
// ===========================================================================
router.get('/cart', customerAuth, cart.getCart);
router.get('/cart/count', customerAuth, cart.cartCount);
router.post('/cart', customerAuth, validate({
  product_id: { required: true, type: 'int' },
  quantity: { type: 'int', min: 1 },
}), cart.addToCart);
router.patch('/cart/:cartId', customerAuth, validate({
  quantity: { required: true, type: 'int', min: 0 },
}), cart.updateCartItem);
router.delete('/cart/:cartId', customerAuth, cart.removeCartItem);
router.delete('/cart', customerAuth, cart.clearCart);
router.post('/cart/merge', customerAuth, cart.mergeCart);
router.post('/cart/apply-coupon', customerAuth, validate({
  coupon_code: { required: true },
}), cart.applyCoupon);

router.get('/coupons', cart.availableCoupons);

router.get('/wishlist', customerAuth, cart.getWishlist);
router.post('/wishlist', customerAuth, validate({
  product_id: { required: true, type: 'int' },
}), cart.toggleWishlist);
router.delete('/wishlist/:productId', customerAuth, cart.removeFromWishlist);

// ===========================================================================
// ADDRESSES
// ===========================================================================
const ADDRESS_RULES = {
  full_name: { required: true, minLength: 3, maxLength: 100,
    message: 'Please enter the full name (at least 3 characters)' },
  phone: { required: true, type: 'mobile',
    message: 'Please enter a valid 10-digit mobile number' },
  house_no: { required: true, message: 'House / Flat number is required' },
  stree_address: { required: true, minLength: 3,
    message: 'Please enter the street address' },
  city: { required: true, message: 'City is required' },
  state: { required: true, message: 'State is required' },
  pincode: { required: true, type: 'pincode',
    message: 'Please enter a valid 6-digit PIN code' },
};

router.get('/addresses', customerAuth, cart.listAddresses);
router.post('/addresses', customerAuth, validate(ADDRESS_RULES), cart.createAddress);
router.patch('/addresses/:addressId', customerAuth, validate({
  phone: { type: 'mobile', message: 'Please enter a valid 10-digit mobile number' },
  pincode: { type: 'pincode', message: 'Please enter a valid 6-digit PIN code' },
}), cart.updateAddress);
router.patch('/addresses/:addressId/default', customerAuth, cart.setDefaultAddress);
router.delete('/addresses/:addressId', customerAuth, cart.removeAddress);

// ===========================================================================
// PRESCRIPTIONS — however many images you send, they are all stored in one JSON array
// ===========================================================================
router.post('/prescriptions', customerAuth,
  uploadPrescription.array('images', 10), prescription.upload);
router.get('/prescriptions', customerAuth, prescription.myPrescriptions);
router.get('/prescriptions/:id', customerAuth, prescription.prescriptionDetail);
router.post('/prescriptions/:id/images', customerAuth,
  uploadPrescription.array('images', 10), prescription.addImages);
router.delete('/prescriptions/:id/images', customerAuth, prescription.removeImage);
router.delete('/prescriptions/:id', customerAuth, prescription.cancelPrescription);

// ===========================================================================
// ORDERS — same endpoints for web and app
// ===========================================================================
// Public — for tracking an order without logging in (order_ref + phone match)
router.post('/orders/track-public', order.trackPublic);

router.post('/orders/quote', customerAuth, order.quote);
router.post('/orders/checkout', customerAuth, order.checkout);
router.post('/orders/verify-payment', customerAuth, validate({
  razorpay_order_id: { required: true },
  razorpay_payment_id: { required: true },
  razorpay_signature: { required: true },
}), order.verifyPayment);
router.get('/orders', customerAuth, order.myOrders);
router.get('/orders/:orderId', customerAuth, order.orderDetail);
router.get('/orders/:orderId/track', customerAuth, order.trackOrder);
router.post('/orders/:orderId/retry-payment', customerAuth, order.retryPayment);
router.post('/orders/:orderId/cancel', customerAuth, order.cancelOrder);
router.post('/orders/:orderId/reorder', customerAuth, order.reorder);
router.get('/orders/:orderId/invoice', customerAuth, order.invoice);
router.post('/orders/:orderId/review', customerAuth, validate({
  product_id: { required: true, type: 'int' },
  rating: { required: true, type: 'int', min: 1, max: 5 },
}), order.submitReview);

// ===========================================================================
// PAYMENTS
// ===========================================================================
router.get('/payments/gateways', payment.gateways);

// Razorpay webhook — the raw body parser is mounted only on this path in server.js
router.post('/payments/razorpay/webhook', payment.razorpayWebhook);

// PayU returns via a form POST (browser redirect), so there is no JWT.
// The hash verification happens inside the controller.
router.post('/payments/payu/success', payment.payuSuccess);
router.post('/payments/payu/failure', payment.payuFailure);
router.get('/payments/payu/success', payment.payuSuccess);
router.get('/payments/payu/failure', payment.payuFailure);

// The mobile app cannot handle a browser redirect — it verifies directly
router.post('/payments/payu/verify', customerAuth, payment.payuVerify);

// ===========================================================================
// CMS / PUBLIC CONTENT
// ===========================================================================
router.get('/settings', cms.publicSettings);
router.get('/pages', cms.pages);
router.get('/pages/:slug', cms.page);
router.get('/news', cms.news);
router.get('/news/:id', cms.newsDetail);
router.post('/contact', validate({
  name: { required: true, maxLength: 50 },
  email: { required: true, type: 'email' },
}), cms.submitEnquiry);
router.get('/locations/states', cms.states);
router.get('/locations/countries', cms.countries);
router.get('/locations/cities', cms.serviceableCities);

module.exports = router;