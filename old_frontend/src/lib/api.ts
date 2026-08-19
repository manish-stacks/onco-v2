/**
 * Storefront API client.
 *
 * Backend ke `/api/app/*` endpoints ke liye. Admin panel wale client se alag
 * hai kyunki:
 *   • SSR-safe hona chahiye — Next.js server pe `window`/`localStorage` nahi hote
 *   • `X-Client-Platform: web` header bhejta hai (backend isse orderFrom set karta hai)
 *   • Server components me token manually pass karna padta hai
 *
 * .env:
 *   NEXT_PUBLIC_API_BASE=https://api.oncohealthmart.com
 *   (khaali chhodo to same-origin /api use hoga)
 */

import type { Order } from '@/types';

const BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000').replace(/\/$/, '');
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
  /** Server component me manually pass karo */
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
 * localStorage me rakhte hain, cookie me nahi — customer token ki zaroorat
 * sirf client-side pe hai (cart, orders), aur cookie hoti to har SSR request
 * ke saath jaati.
 *
 * Server component me token chahiye ho to `withToken()` se explicitly pass karo.
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
 * Session expire hone pe callback. AuthContext isse subscribe karke user ko
 * logout kar deta hai.
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

  /** Network fail vs server ne reject kiya — UI me alag message dikhana ho to */
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

  // Next.js fetch options — sirf tab lagao jab diye gaye hon
  if (cache) init.cache = cache;
  if (revalidate !== undefined) init.next = { revalidate };

  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), init);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError('Server se connect nahi ho paaya. Internet check karo.', 0);
  }

  if (res.status === 401) {
    tokenStore.clear();
    unauthorizedHandlers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* handler ki galti se request na tootey */
      }
    });
    throw new ApiError('Session khatam ho gaya. Dobara login karo.', 401);
  }

  // 204 ya khaali body
  if (res.status === 204) return { success: true, data: null as T };

  let json: ApiEnvelope<T> | null = null;
  try {
    json = await res.json();
  } catch {
    if (res.ok) return { success: true, data: null as T };
  }

  if (!res.ok) {
    throw new ApiError(
      json?.message || `Request fail hui (${res.status})`,
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

  /** FormData — prescription images wagairah */
  form: <T = unknown>(path: string, formData: FormData, method: 'POST' | 'PUT' | 'PATCH' = 'POST', opts?: RequestOptions) =>
    request<T>(path, { ...opts, method, body: formData, isForm: true }),

  /** Sirf `data` chahiye, poora envelope nahi */
  async data<T = unknown>(path: string, params?: QueryParams, opts?: RequestOptions): Promise<T | null> {
    const res = await request<T>(path, { ...opts, params });
    return res?.data ?? null;
  },
};

/**
 * Server component / route handler me token pass karne ke liye.
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
 * Backend relative path deta hai (`/media/products/x.jpg` ya `/uploads/...`).
 * Absolute URL bana do — Next.js `<Image>` ko full URL chahiye.
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
 * Do tarike hain login ke — password aur OTP. OTP flow me `requestOtp` naya
 * account bhi bana deta hai (agar number registered nahi hai), isliye alag
 * signup step ki zaroorat nahi.
 */
export const authApi = {
  /** Password se signup */
  async register(payload: RegisterPayload): Promise<AuthTokenPayload | null> {
    const res = await api.post<AuthTokenPayload>('/auth/register', payload);
    if (res?.data?.token) tokenStore.set(res.data.token);
    return res.data;
  },

  /** Password se login */
  async login({ mobile, password }: LoginPayload): Promise<AuthTokenPayload | null> {
    const res = await api.post<AuthTokenPayload>('/auth/login', { mobile, password });
    if (res?.data?.token) tokenStore.set(res.data.token);
    return res.data;
  },

  /**
   * OTP bhejo. Number registered na ho to account bhi ban jaata hai —
   * response me `is_new_user: true` aata hai.
   *
   * Local dev me (Fast2SMS key na ho) response me `dev_otp` bhi aata hai.
   */
  requestOtp: ({ mobile, customer_name, allow_signup = true }: RequestOtpPayload) =>
    api.data<AuthTokenPayload>('/auth/otp/request', undefined, {
      method: 'POST',
      body: { mobile, customer_name, allow_signup },
    }),

  /** OTP verify — yahi login complete karta hai */
  async verifyOtp({ customer_id, otp }: VerifyOtpPayload): Promise<AuthTokenPayload | null> {
    const res = await api.post<AuthTokenPayload>('/auth/otp/verify', { customer_id, otp });
    if (res?.data?.token) tokenStore.set(res.data.token);
    return res.data;
  },

  /** Bhula hua password — pehle requestOtp, phir ye */
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
  prescription_required?: boolean;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Products, categories, search.
 *
 * Ye saare public hain — token optional hai. Login ho to product detail me
 * `in_wishlist` flag bhi aata hai.
 *
 * Next.js me `revalidate` pass karke ISR use kar sakte ho:
 *   catalogApi.product(slug, { revalidate: 300 })
 */
export const catalogApi = {
  /**
   * Homepage ka poora data ek call me — banners, categories, brands, deals,
   * offers, testimonials, top selling, latest, deal of the day, settings.
   * Backend pe cached hai, isliye alag-alag calls karne ki zaroorat nahi.
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

  /** Nested tree — mega menu ke liye */
  categoryTree: <T = unknown>(opts?: RequestOptions) =>
    api.data<T>('/categories/tree', undefined, { revalidate: 600, ...opts }),

  category: <T = unknown>(slug: string, opts?: RequestOptions) =>
    api.data<T>(`/categories/${slug}`, undefined, { revalidate: 600, ...opts }),

  /** Search box ka autocomplete — products + categories dono */
  search: <T = unknown>(q: string, opts?: RequestOptions) =>
    api.data<T>('/search', { q }, { cache: 'no-store', ...opts }),

  /** Checkout se pehle — is city me delivery hoti hai ya nahi */
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
 * Cart, wishlist, addresses — sab login ke baad ke hain.
 *
 * Cart har response me updated totals ke saath aata hai (subtotal, GST,
 * out-of-stock items, COD allowed hai ya nahi), to add/update ke baad
 * alag se fetch karne ki zaroorat nahi.
 */
export const cartApi = {
  get: <T = unknown>() => api.data<T>('/cart'),

  /** Header ke badge ke liye — poora cart nahi chahiye */
  count: async (): Promise<number> => {
    const data = await api.data<{ count?: number }>('/cart/count');
    return data?.count ?? 0;
  },

  add: <T = unknown>(product_id: string | number, quantity = 1) =>
    api.data<T>('/cart', undefined, {
      method: 'POST',
      body: { product_id, quantity },
    }),

  /** quantity 0 bhejo to item hat jaata hai */
  updateQuantity: <T = unknown>(cartId: string | number, quantity: number) =>
    api.data<T>(`/cart/${cartId}`, undefined, {
      method: 'PATCH',
      body: { quantity },
    }),

  remove: <T = unknown>(cartId: string | number) => api.data<T>(`/cart/${cartId}`, undefined, { method: 'DELETE' }),

  clear: <T = unknown>() => api.del<T>('/cart'),

  /**
   * Guest cart merge — login se pehle localStorage me pada cart server pe
   * bhej do. Jo item add na ho paye (out of stock) wo silently skip ho jaata
   * hai, poora merge fail nahi hota.
   */
  merge: <T = unknown>(items: Array<{ product_id: string | number; quantity: number }>) =>
    api.data<T>('/cart/merge', undefined, {
      method: 'POST',
      body: { items },
    }),

  /** Order banaye bina coupon check — cart page pe "Apply" button */
  applyCoupon: <T = unknown>(coupon_code: string) =>
    api.data<T>('/cart/apply-coupon', undefined, {
      method: 'POST',
      body: { coupon_code },
    }),

  /** Available offers — coupon list dikhane ke liye */
  availableCoupons: <T = unknown>(opts?: RequestOptions) =>
    api.data<T>('/coupons', undefined, { revalidate: 300, ...opts }),
};

export const wishlistApi = {
  list: <T = unknown>() => api.data<T>('/wishlist'),

  /** Heart icon — add/remove dono, response me `{ added: true/false }` */
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

/** Response shape of orderApi.checkout() */
export interface CheckoutResult {
  order: Order;
  payment: {
    type: 'sdk' | 'redirect';
    gateway: 'razorpay' | 'payu';
    gateway_order_id?: string;
    key?: string;
    amount?: number;
    currency?: string;
    action_url?: string;
    fields?: Record<string, string>;
  } | null;
  razorpay?: unknown;
}

/**
 * Orders + checkout.
 *
 * Flow: quote() -> totals preview (no order created) -> checkout() -> order
 * banta hai, online ho to payment session bhi milta hai.
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

  retryPayment: <T = unknown>(orderId: string | number) =>
    api.data<T>(`/orders/${orderId}/retry-payment`, undefined, { method: 'POST' }),

  list: <T = unknown>({ page = 1, limit = 10, status }: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<T>('/orders', { page, limit, status }),

  detail: <T = unknown>(orderId: string | number) => api.data<T>(`/orders/${orderId}`),

  track: <T = unknown>(orderId: string | number) => api.data<T>(`/orders/${orderId}/track`),

  cancel: <T = unknown>(orderId: string | number, reason: string) =>
    api.data<T>(`/orders/${orderId}/cancel`, undefined, { method: 'POST', body: { reason } }),

  review: <T = unknown>(
    orderId: string | number,
    payload: { product_id: string | number; rating: number; title?: string; review?: string }
  ) => api.post<T>(`/orders/${orderId}/review`, payload),

  gateways: <T = unknown>(opts?: RequestOptions) => api.data<T>('/payments/gateways', undefined, { revalidate: 300, ...opts }),
};

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