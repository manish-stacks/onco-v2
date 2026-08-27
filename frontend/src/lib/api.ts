/**
 * Storefront API client.
 *
 * For the backend `/api/app/*` endpoints. Separate from the admin panel client
 * because:
 *   • must be SSR-safe — `window`/`localStorage` do not exist on the Next.js server
 *   • sends the `X-Client-Platform: web` header (backend uses it to set orderFrom)
 *   • the token has to be passed manually in server components
 *
 * .env:
 *   NEXT_PUBLIC_API_BASE=https://api.oncohealthmart.com
 *   (leave it empty to use the same-origin /api)
 */

import type { Order } from '@/types';

const BASE = (process.env.NEXT_PUBLIC_API_BASE || 'https://www.betaapi.oncohealthmart.com').replace(/\/$/, '');
const TOKEN_KEY = 'ohm_token';
const PLATFORM = 'web';

const isBrowser = () => typeof window !== 'undefined';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: Pagination;
  [key: string]: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type QueryParams = Record<string, string | number | boolean | (string | number)[] | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: QueryParams;
  isForm?: boolean;
  /** Pass it manually inside a server component */
  token?: string | null;
  /** Next.js fetch cache */
  cache?: RequestCache;
  /** Next.js ISR seconds */
  revalidate?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

/**
 * We keep it in localStorage, not a cookie — the customer token is only needed
 * on the client side (cart, orders), and a cookie
 * would be sent with every SSR request.
 *
 * If a server component needs the token, pass it explicitly via `withToken()`.
 */
export const tokenStore = {
  get(): string | null {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode */
    }
  },
  clear(): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
  has(): boolean {
    return !!this.get();
  },
};

// ---------------------------------------------------------------------------
// 401 handling
// ---------------------------------------------------------------------------

type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/**
 * Callback for when the session expires. AuthContext subscribes to this and
 * logs the user out.
 *
 *   useEffect(() => onUnauthorized(() => setUser(null)), []);
 */
export function onUnauthorized(fn: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(fn);
  return () => unauthorizedHandlers.delete(fn);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;
  data: unknown;

  constructor(message: string, status: number, errors?: Record<string, string[]> | null, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || null; // field-wise validation errors
    this.data = data || null;
  }

  /** Network failure vs the server rejecting it — for showing a different message in the UI */
  get isNetwork(): boolean {
    return this.status === 0;
  }
  get isAuth(): boolean {
    return this.status === 401;
  }
  get isValidation(): boolean {
    return this.status === 422;
  }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

function buildUrl(path: string, params?: QueryParams): string {
  const url = `${BASE}/api/app${path}`;
  if (!params) return url;

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)));
    else qs.append(k, String(v));
  });

  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const {
    method = 'GET',
    body,
    params,
    isForm,
    token,
    cache,
    revalidate,
    signal,
    headers: extraHeaders,
  } = opts;

  const headers: Record<string, string> = {
    'X-Client-Platform': PLATFORM,
    ...extraHeaders,
  };

  const authToken = token ?? tokenStore.get();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const init: RequestInit & { next?: { revalidate?: number } } = {
    method,
    headers,
    body: isForm ? (body as BodyInit) : body ? JSON.stringify(body) : undefined,
    signal,
  };

  // Next.js fetch options — only applied when they are provided
  if (cache) init.cache = cache;
  if (revalidate !== undefined) init.next = { revalidate };

  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), init);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError('Could not connect to the server. Please check your internet connection.', 0);
  }

  if (res.status === 401) {
    tokenStore.clear();
    unauthorizedHandlers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* a broken handler must not break the request */
      }
    });
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }

  // 204 or an empty body
  if (res.status === 204) return { success: true, data: null as T };

  let json: ApiEnvelope<T> | null = null;
  try {
    json = await res.json();
  } catch {
    if (res.ok) return { success: true, data: null as T };
  }

  if (!res.ok) {
    throw new ApiError(
      json?.message || `Request failed (${res.status})`,
      res.status,
      (json as { errors?: Record<string, string[]> } | null)?.errors,
      json?.data
    );
  }

  return json as ApiEnvelope<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const api = {
  get: <T = unknown>(path: string, params?: QueryParams, opts?: RequestOptions) =>
    request<T>(path, { ...opts, params }),

  post: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),

  patch: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),

  put: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),

  del: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE', body }),

  /** FormData — prescription images and the like */
  form: <T = unknown>(path: string, formData: FormData, method: 'POST' | 'PUT' | 'PATCH' = 'POST', opts?: RequestOptions) =>
    request<T>(path, { ...opts, method, body: formData, isForm: true }),

  /** Only `data` is needed, not the full envelope */
  async data<T = unknown>(path: string, params?: QueryParams, opts?: RequestOptions): Promise<T | null> {
    const res = await request<T>(path, { ...opts, params });
    return res?.data ?? null;
  },
};

/**
 * For passing the token inside a server component / route handler.
 *
 *   const serverApi = withToken(cookies().get('token')?.value);
 *   const orders = await serverApi.get('/orders');
 */
export function withToken(token: string | null | undefined) {
  return {
    get: <T = unknown>(path: string, params?: QueryParams, opts?: RequestOptions) =>
      request<T>(path, { ...opts, params, token }),

    post: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'POST', body, token }),

    patch: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'PATCH', body, token }),

    put: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'PUT', body, token }),

    del: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'DELETE', body, token }),

    data: async <T = unknown>(path: string, params?: QueryParams, opts?: RequestOptions): Promise<T | null> => {
      const res = await request<T>(path, { ...opts, params, token });
      return res?.data ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/**
 * The backend returns a relative path (`/media/products/x.jpg` or `/uploads/...`).
 * Build an absolute URL — Next.js `<Image>` needs a full URL.
 */
export function mediaUrl(path: string | null | undefined, fallback = '/placeholder.png'): string {
  if (!path) return fallback;
  const p = String(path);
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${BASE}${p.startsWith('/') ? '' : '/'}${p}`;
}

export { BASE as API_BASE, PLATFORM };

// =============================================================================
// AUTH API
// =============================================================================

export interface AuthTokenPayload {
  token?: string;
  is_new_user?: boolean;
  customer_id?: string | number;
  dev_otp?: string;
  [key: string]: unknown;
}

export interface RegisterPayload {
  mobile: string;
  password: string;
  customer_name?: string;
  [key: string]: unknown;
}

export interface LoginPayload {
  mobile: string;
  password: string;
}

export interface RequestOtpPayload {
  mobile: string;
  customer_name?: string;
  allow_signup?: boolean;
}

export interface VerifyOtpPayload {
  customer_id: string | number;
  otp: string;
}

export interface ResetPasswordPayload {
  customer_id: string | number;
  otp: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

/**
 * Customer auth.
 *
 * There are two ways to log in — password and OTP. In the OTP flow `requestOtp` is a new
 * also creates an account (if the number is not registered), hence a separate
 * no separate signup step is needed.
 */
export const authApi = {
  /** Sign up with a password */
  async register(payload: RegisterPayload): Promise<AuthTokenPayload | null> {
    const res = await api.post<AuthTokenPayload>('/auth/register', payload);
    if (res?.data?.token) tokenStore.set(res.data.token);
    return res.data;
  },

  /** Log in with a password */
  async login({ mobile, password }: LoginPayload): Promise<AuthTokenPayload | null> {
    const res = await api.post<AuthTokenPayload>('/auth/login', { mobile, password });
    if (res?.data?.token) tokenStore.set(res.data.token);
    return res.data;
  },

  /**
   * Send an OTP. If the number is not registered an account is created too —
   * the response contains `is_new_user: true`.
   *
   * In local dev (no Fast2SMS key) the response also includes `dev_otp`.
   */
  requestOtp: ({ mobile, customer_name, allow_signup = true }: RequestOtpPayload) =>
    api.data<AuthTokenPayload>('/auth/otp/request', undefined, {
      method: 'POST',
      body: { mobile, customer_name, allow_signup },
    }),

  /** Verify the OTP — this is what completes the login */
  async verifyOtp({ customer_id, otp }: VerifyOtpPayload): Promise<AuthTokenPayload | null> {
    const res = await api.post<AuthTokenPayload>('/auth/otp/verify', { customer_id, otp });
    if (res?.data?.token) tokenStore.set(res.data.token);
    return res.data;
  },

  /** Forgotten password — requestOtp first, then this */
  resetPassword: ({ customer_id, otp, new_password }: ResetPasswordPayload) =>
    api.post('/auth/password/reset', { customer_id, otp, new_password }),

  changePassword: ({ old_password, new_password }: ChangePasswordPayload) =>
    api.post('/auth/password/change', { old_password, new_password }),

  me: <T = unknown>(opts?: RequestOptions) => api.data<T>('/auth/me', undefined, opts),

  updateProfile: <T = unknown>(payload: Record<string, unknown>) =>
    api.data<T>('/auth/me', undefined, { method: 'PATCH', body: payload }),

  logout(): void {
    tokenStore.clear();
  },

  isLoggedIn: (): boolean => tokenStore.has(),
};

// =============================================================================
// CATALOG API
// =============================================================================

export interface ProductFilters {
  category_id?: string | number;
  brand_id?: string | number;
  search?: string;
  min_price?: number;
  max_price?: number;
  top_selling?: boolean;
  latest?: boolean;
  deals?: boolean;
  /** These are backend enum values — not booleans. Send 'Yes', or omit it entirely. */
  prescription_required?: 'Yes' | 'No';
  in_stock?: boolean;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Products, categories, search.
 *
 * These are all public — the token is optional. When logged in, the product detail also
 * includes the `in_wishlist` flag.
 *
 * You can use ISR in Next.js by passing `revalidate`:
 *   catalogApi.product(slug, { revalidate: 300 })
 */
export const catalogApi = {
  /**
   * All homepage data in one call — banners, categories, brands, deals,
   * offers, testimonials, top selling, latest, deal of the day, settings.
   * It is cached on the backend, so separate calls are unnecessary.
   */
  home: <T = unknown>(opts?: RequestOptions) => api.data<T>('/home', undefined, { revalidate: 300, ...opts }),

  /**
   * Product listing.
   * filters: { category_id, brand_id, search, min_price, max_price,
   *            top_selling, latest, deals, prescription_required,
   *            sort_by, sort_dir, page, limit }
   */
  products: <T = unknown>(filters: ProductFilters = {}, opts?: RequestOptions) =>
    api.get<T>('/products', filters as QueryParams, opts),

  product: <T = unknown>(slug: string, opts?: RequestOptions) =>
    api.data<T>(`/products/${slug}`, undefined, { revalidate: 300, ...opts }),

  productReviews: <T = unknown>(
    productId: string | number,
    { page = 1, limit = 10 }: { page?: number; limit?: number } = {},
    opts?: RequestOptions
  ) => api.get<T>(`/products/${productId}/reviews`, { page, limit }, opts),

  categories: <T = unknown>(opts?: RequestOptions) => api.data<T>('/categories', undefined, { revalidate: 600, ...opts }),

  /** Every active brand — for the /brands page (the home feed only returns 6) */
  brands: <T = unknown>(opts?: RequestOptions) => api.data<T>('/brands', undefined, { revalidate: 600, ...opts }),

  /** Nested tree — for the mega menu */
  categoryTree: <T = unknown>(opts?: RequestOptions) =>
    api.data<T>('/categories/tree', undefined, { revalidate: 600, ...opts }),

  category: <T = unknown>(slug: string, opts?: RequestOptions) =>
    api.data<T>(`/categories/${slug}`, undefined, { revalidate: 600, ...opts }),

  /** Search box autocomplete — both products and categories */
  search: <T = unknown>(q: string, opts?: RequestOptions) =>
    api.data<T>('/search', { q }, { cache: 'no-store', ...opts }),

  /** Before checkout — whether delivery is available in this city */
  checkServiceability: <T = unknown>(city: string) => api.data<T>('/serviceable-city', { city }),
};

// =============================================================================
// CART / WISHLIST / ADDRESS API
// =============================================================================

export interface Address {
  ad_id?: string | number;
  user_id?: string | number;
  full_name: string;
  phone: string;
  city: string;
  state: string;
  pincode: string;
  house_no?: string;
  type?: string;
  stree_address: string;
  landmark?: string;
  is_default?: number | boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Cart, wishlist, addresses — all of these require login.
 *
 * Every cart response includes updated totals (subtotal, GST,
 * out-of-stock items, whether COD is allowed), so after an add/update
 * no separate fetch is needed.
 */
export const cartApi = {
  get: <T = unknown>() => api.data<T>('/cart'),

  /** For the header badge — the full cart is not needed */
  count: async (): Promise<number> => {
    const data = await api.data<{ count?: number }>('/cart/count');
    return data?.count ?? 0;
  },

  add: <T = unknown>(product_id: string | number, quantity = 1) =>
    api.data<T>('/cart', undefined, {
      method: 'POST',
      body: { product_id, quantity },
    }),

  /** Send quantity 0 to remove the item */
  updateQuantity: <T = unknown>(cartId: string | number, quantity: number) =>
    api.data<T>(`/cart/${cartId}`, undefined, {
      method: 'PATCH',
      body: { quantity },
    }),

  remove: <T = unknown>(cartId: string | number) => api.data<T>(`/cart/${cartId}`, undefined, { method: 'DELETE' }),

  clear: <T = unknown>() => api.del<T>('/cart'),

  /**
   * Guest cart merge — the cart sitting in localStorage before login is pushed
   * send them. Any item that cannot be added (out of stock) is silently skipped
   * the whole merge does not fail.
   */
  merge: <T = unknown>(items: Array<{ product_id: string | number; quantity: number }>) =>
    api.data<T>('/cart/merge', undefined, {
      method: 'POST',
      body: { items },
    }),

  /** Validate a coupon without creating an order — the cart page "Apply" button */
  applyCoupon: <T = unknown>(coupon_code: string) =>
    api.data<T>('/cart/apply-coupon', undefined, {
      method: 'POST',
      body: { coupon_code },
    }),

  /** Available offers — used to show the coupon list */
  availableCoupons: <T = unknown>(opts?: RequestOptions) =>
    api.data<T>('/coupons', undefined, { revalidate: 300, ...opts }),
};

export const wishlistApi = {
  list: <T = unknown>() => api.data<T>('/wishlist'),

  /** Heart icon — handles both add and remove, responds with `{ added: true/false }` */
  toggle: (product_id: string | number) =>
    api.data<{ added: boolean }>('/wishlist', undefined, {
      method: 'POST',
      body: { product_id },
    }),

  remove: <T = unknown>(productId: string | number) => api.del<T>(`/wishlist/${productId}`),
};

export const addressApi = {
  list: <T = Address[]>() => api.data<T>('/addresses'),

  create: <T = Address>(payload: Address) => api.data<T>('/addresses', undefined, { method: 'POST', body: payload }),

  update: <T = Address>(adId: string | number, payload: Partial<Address>) =>
    api.patch<T>(`/addresses/${adId}`, payload),

  setDefault: <T = Address>(adId: string | number) => api.patch<T>(`/addresses/${adId}/default`),

  remove: <T = unknown>(adId: string | number) => api.del<T>(`/addresses/${adId}`),
};

// =============================================================================
// ORDER / CHECKOUT / PAYMENT API
// =============================================================================

export interface QuotePayload {
  items?: Array<{ product_id: string | number; quantity: number }>;
  coupon_code?: string;
  payment_mode?: 'cod' | 'online';
}

export interface CheckoutPayload {
  items?: Array<{ product_id: string | number; quantity: number }>;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_pincode: string;
  customer_country?: string;
  shipping_same_as_billing?: boolean;
  customer_shipping_name?: string;
  customer_shipping_phone?: string;
  customer_shipping_address?: string;
  customer_shipping_city?: string;
  customer_shipping_state?: string;
  customer_shipping_pincode?: string;
  customer_shipping_country?: string;
  payment_mode: 'cod' | 'online';
  payment_gateway?: 'razorpay' | 'payu';
  coupon_code?: string;
  prescription_id?: string | number;
  patient_name?: string;
  doctor_name?: string;
  hospital_name?: string;
  comment?: string;
}

export interface RazorpaySession {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  prefill?: { name?: string; contact?: string; email?: string };
}

export interface PayuSession {
  endpoint: string;
  params: Record<string, string>;
}

/**
 * Response shape of orderApi.checkout().
 *
 * ⚠ The backend NESTS the `payment` object per gateway —
 * `payment.razorpay` or `payment.payu`, never a flat `payment.key` /
 * there is no `payment.action_url`. Treating it as flat was the bug that
 * both gateways were breaking.
 */
export interface CheckoutResult {
  order: Order;
  payment: {
    type: 'sdk' | 'redirect';
    gateway: 'razorpay' | 'payu';
    gateway_order_id: string;
    razorpay?: RazorpaySession;
    payu?: PayuSession;
  } | null;
}

export interface PaymentGatewayOption {
  id: 'razorpay' | 'payu';
  label: string;
  type: 'sdk' | 'redirect';
}

export interface PaymentGatewaysResult {
  available: PaymentGatewayOption[];
  default: 'razorpay' | 'payu';
  /** COD on/off from admin Settings — the checkout page follows this */
  cod_enabled?: boolean;
}

/** `/orders/:id/retry-payment` — the backend currently supports Razorpay only */
export interface RetryPaymentResult {
  razorpay?: RazorpaySession;
}

/**
 * Orders + checkout.
 *
 * Flow: quote() -> totals preview (no order created) -> checkout() -> order
 * is created; if online, a payment session is returned as well.
 */
export const orderApi = {
  quote: <T = unknown>(payload: QuotePayload = {}) =>
    api.data<T>('/orders/quote', undefined, { method: 'POST', body: payload }),

  checkout: <T = CheckoutResult>(payload: CheckoutPayload) =>
    api.data<T>('/orders/checkout', undefined, { method: 'POST', body: payload }),

  verifyPayment: <T = unknown>(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => api.data<T>('/orders/verify-payment', undefined, { method: 'POST', body: payload }),

  verifyPayu: <T = unknown>(txnid: string) =>
    api.data<T>('/payments/payu/verify', undefined, { method: 'POST', body: { txnid } }),

  retryPayment: <T = RetryPaymentResult>(orderId: string | number) =>
    api.data<T>(`/orders/${orderId}/retry-payment`, undefined, { method: 'POST' }),

  list: <T = unknown>({ page = 1, limit = 10, status }: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<T>('/orders', { page, limit, status }),

  detail: <T = unknown>(orderId: string | number) => api.data<T>(`/orders/${orderId}`),

  track: <T = unknown>(orderId: string | number) => api.data<T>(`/orders/${orderId}/track`),

  reorder: <T = unknown>(orderId: string | number, confirm = false) =>
    api.data<T>(`/orders/${orderId}/reorder`, undefined, { method: 'POST', body: { confirm } }),
  invoice: <T = unknown>(orderId: string | number) => api.data<T>(`/orders/${orderId}/invoice`),

  cancel: <T = unknown>(orderId: string | number, reason: string) =>
    api.data<T>(`/orders/${orderId}/cancel`, undefined, { method: 'POST', body: { reason } }),

  review: <T = unknown>(
    orderId: string | number,
    payload: { product_id: string | number; rating: number; title?: string; review?: string }
  ) => api.post<T>(`/orders/${orderId}/review`, payload),

  gateways: () => api.data<PaymentGatewaysResult>('/payments/gateways', undefined, { revalidate: 300 }),

  /**
   * Tracking without login — both the Order ID and the registered mobile number must match
   * have to match. Not the full order object, only tracking-safe fields
   * (status, items, courier, city/state — no full address/email).
   */
  trackPublic: <T = PublicTrackResult>(order_ref: string, phone: string) =>
    api.data<T>('/orders/track-public', undefined, { method: 'POST', body: { order_ref, phone } }),
};

export interface PublicTrackResult {
  order_id?: number | string;
  databaseOrderID: string;
  order_date: string;
  status: string;
  payment_status: string;
  payment_mode: string;
  amount: number;
  customer_city?: string;
  customer_state?: string;
  awb_number?: string | null;
  courier_name?: string | null;
  tracking_status?: string | null;
  tracking_location?: string | null;
  tracking_datetime?: string | null;
  delivered_at?: string | null;
  items: { product_name: string; unit_quantity: number; unit_price: number; line_total: number }[];
  history: { old_status: string | null; new_status: string; note: string | null; created_at: string }[];
}

// =============================================================================
// PRESCRIPTIONS API
// =============================================================================

export interface PrescriptionMeta {
  title?: string;
  patient_name?: string;
  doctor_name?: string;
  hospital_name?: string;
  notes?: string;
  contact_number?: string;
  direct_upload?: string | boolean;
}

export const prescriptionApi = {
  upload: async <T = unknown>(files: File[] = [], meta: PrescriptionMeta = {}): Promise<T | null> => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    Object.entries(meta).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
    });
    const res = await api.form<T>('/prescriptions', fd);
    return res?.data ?? null;
  },

  addImages: async <T = unknown>(id: string | number, files: File[] = []): Promise<T | null> => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    const res = await api.form<T>(`/prescriptions/${id}/images`, fd);
    return res?.data ?? null;
  },

  removeImage: <T = unknown>(id: string | number, image_path: string) =>
    api.del<T>(`/prescriptions/${id}/images`, { image_path }),

  list: <T = unknown>({ page = 1, limit = 10, status }: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<T>('/prescriptions', { page, limit, status }),

  detail: <T = unknown>(id: string | number) => api.data<T>(`/prescriptions/${id}`),

  cancel: <T = unknown>(id: string | number, reason: string) => api.del<T>(`/prescriptions/${id}`, { reason }),

  remove: <T = unknown>(id: string | number) => api.del<T>(`/prescriptions/${id}`),
};

// =============================================================================
// CONTENT / CMS API
// =============================================================================

export const contentApi = {
  settings: <T = unknown>(opts?: RequestOptions) => api.data<T>('/settings', undefined, { revalidate: 900, ...opts }),

  pages: <T = unknown>(opts?: RequestOptions) => api.data<T>('/pages', undefined, { revalidate: 900, ...opts }),

  page: <T = unknown>(slug: string, opts?: RequestOptions) => api.data<T>(`/pages/${slug}`, undefined, { revalidate: 900, ...opts }),

  news: <T = unknown>(
    { page = 1, limit = 10, category }: { page?: number; limit?: number; category?: string } = {},
    opts?: RequestOptions
  ) => api.get<T>('/news', { page, limit, category }, { revalidate: 600, ...opts }),

  newsDetail: <T = unknown>(id: string | number, opts?: RequestOptions) =>
    api.data<T>(`/news/${id}`, undefined, { revalidate: 600, ...opts }),

  submitEnquiry: <T = unknown>(payload: { name: string; email: string; issue?: string; message: string; number?: string }) =>
    api.post<T>('/contact', payload),

  states: <T = unknown>(opts?: RequestOptions) => api.data<T>('/locations/states', undefined, { revalidate: 86400, ...opts }),
  countries: <T = unknown>(opts?: RequestOptions) => api.data<T>('/locations/countries', undefined, { revalidate: 86400, ...opts }),
  serviceableCities: <T = unknown>(opts?: RequestOptions) =>
    api.data<T>('/locations/cities', undefined, { revalidate: 3600, ...opts }),
};

export default api;