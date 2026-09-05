import { request, requestData, requestPaged } from './client';

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
export const authApi = {
  requestOtp: (mobile, extra = {}) =>
    requestData('/auth/otp/request', { method: 'POST', body: { mobile, ...extra } }),

  verifyOtp: (payload) => requestData('/auth/otp/verify', { method: 'POST', body: payload }),

  login: (mobile, password, fcm_token) =>
    requestData('/auth/login', { method: 'POST', body: { mobile, password, fcm_token, platform: 'android' } }),

  register: (payload) => requestData('/auth/register', { method: 'POST', body: payload }),

  me: () => requestData('/auth/me'),

  updateProfile: (payload) => requestData('/auth/me', { method: 'PATCH', body: payload }),

  changePassword: (old_password, new_password) =>
    request('/auth/password/change', { method: 'POST', body: { old_password, new_password } }),

  resetPassword: (payload) => request('/auth/password/reset', { method: 'POST', body: payload }),

  registerDevice: (fcm_token, platform = 'android', device_info) =>
    request('/auth/device-token', { method: 'POST', body: { fcm_token, platform, device_info } }),

  unregisterDevice: (fcm_token) =>
    request('/auth/device-token', { method: 'DELETE', body: { fcm_token } }),
};

// ---------------------------------------------------------------------------
// CATALOG
// ---------------------------------------------------------------------------
export const catalogApi = {
  home: () => requestData('/home'),
  search: (q) => requestData('/search', { params: { q } }),
  brands: () => requestData('/brands'),

  products: (params = {}) => requestPaged('/products', { params }),
  product: (slug) => requestData(`/products/${slug}`),
  reviews: (productId, params = {}) => requestPaged(`/products/${productId}/reviews`, { params }),

  categories: () => requestData('/categories'),
  categoryTree: () => requestData('/categories/tree'),
  category: (slug) => requestData(`/categories/${slug}`),

  serviceableCity: (city) => requestData('/serviceable-city', { params: { city } }),
};

// ---------------------------------------------------------------------------
// CART / WISHLIST / COUPONS
// ---------------------------------------------------------------------------
export const cartApi = {
  get: () => requestData('/cart'),
  count: () => requestData('/cart/count'),
  add: (product_id, quantity = 1) =>
    requestData('/cart', { method: 'POST', body: { product_id, quantity } }),
  update: (cartId, quantity) =>
    requestData(`/cart/${cartId}`, { method: 'PATCH', body: { quantity } }),
  remove: (cartId) => requestData(`/cart/${cartId}`, { method: 'DELETE' }),
  clear: () => request('/cart', { method: 'DELETE' }),
  merge: (items) => requestData('/cart/merge', { method: 'POST', body: { items } }),
  applyCoupon: (coupon_code) =>
    requestData('/cart/apply-coupon', { method: 'POST', body: { coupon_code } }),
  coupons: () => requestData('/coupons'),
};

export const wishlistApi = {
  list: () => requestData('/wishlist'),
  toggle: (product_id) => requestData('/wishlist', { method: 'POST', body: { product_id } }),
  remove: (productId) => request(`/wishlist/${productId}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// ADDRESSES
// ---------------------------------------------------------------------------
export const addressApi = {
  list: () => requestData('/addresses'),
  create: (payload) => requestData('/addresses', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/addresses/${id}`, { method: 'PATCH', body: payload }),
  setDefault: (id) => request(`/addresses/${id}/default`, { method: 'PATCH' }),
  remove: (id) => request(`/addresses/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// PRESCRIPTIONS
// ---------------------------------------------------------------------------
export const prescriptionApi = {
  upload: (formData) =>
    requestData('/prescriptions', { method: 'POST', body: formData, isForm: true, timeout: 60000 }),
  list: (params = {}) => requestPaged('/prescriptions', { params }),
  detail: (id) => requestData(`/prescriptions/${id}`),
  addImages: (id, formData) =>
    requestData(`/prescriptions/${id}/images`, { method: 'POST', body: formData, isForm: true, timeout: 60000 }),
  removeImage: (id, image_path) =>
    requestData(`/prescriptions/${id}/images`, { method: 'DELETE', body: { image_path } }),
  cancel: (id) => request(`/prescriptions/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// ORDERS / PAYMENTS
// ---------------------------------------------------------------------------
export const orderApi = {
  quote: (payload) => requestData('/orders/quote', { method: 'POST', body: payload }),
  checkout: (payload) => requestData('/orders/checkout', { method: 'POST', body: payload, timeout: 60000 }),

  verifyRazorpay: (payload) =>
    requestData('/orders/verify-payment', { method: 'POST', body: payload }),
  verifyPayu: (txnid) => requestData('/payments/payu/verify', { method: 'POST', body: { txnid } }),

  retryPayment: (orderId) => requestData(`/orders/${orderId}/retry-payment`, { method: 'POST' }),

  list: (params = {}) => requestPaged('/orders', { params }),
  detail: (orderId) => requestData(`/orders/${orderId}`),
  track: (orderId) => requestData(`/orders/${orderId}/track`),
  trackPublic: (order_ref, phone) =>
    requestData('/orders/track-public', { method: 'POST', body: { order_ref, phone } }),
  cancel: (orderId, reason) =>
    requestData(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  reorder: (orderId, confirm = false) =>
    requestData(`/orders/${orderId}/reorder`, { method: 'POST', body: { confirm } }),
  invoice: (orderId) => requestData(`/orders/${orderId}/invoice`),
  review: (orderId, payload) =>
    request(`/orders/${orderId}/review`, { method: 'POST', body: payload }),

  gateways: () => requestData('/payments/gateways'),
};

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------
export const cmsApi = {
  settings: () => requestData('/settings'),
  pages: () => requestData('/pages'),
  page: (slug) => requestData(`/pages/${slug}`),
  news: (params = {}) => requestPaged('/news', { params }),
  newsDetail: (id) => requestData(`/news/${id}`),
  contact: (payload) => request('/contact', { method: 'POST', body: payload }),
  subscribe: (email) => request('/subscribe', { method: 'POST', body: { email } }),
  states: () => requestData('/locations/states'),
  countries: () => requestData('/locations/countries'),
  cities: () => requestData('/locations/cities'),
};
