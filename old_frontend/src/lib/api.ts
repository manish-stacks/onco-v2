import axios, { AxiosError, AxiosRequestConfig, AxiosInstance } from 'axios';

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
  /** Next.js fetch cache — axios me sirf revalidate ka use hota hai (next fetch cache tag) */
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
// Axios instance
// ---------------------------------------------------------------------------

const axiosClient: AxiosInstance = axios.create({
  baseURL: `${BASE}/api/app`,
  withCredentials: true,
  headers: {
    'X-Client-Platform': PLATFORM,
  },
});

axiosClient.interceptors.request.use((config) => {
  const authToken = (config as AxiosRequestConfig & { __token?: string | null }).__token;
  const token = authToken !== undefined ? authToken : tokenStore.get();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
  const qs = config.params ? new URLSearchParams(config.params as Record<string, string>).toString() : '';
  console.log(
    `[API] ${config.method?.toUpperCase()} ${fullUrl}${qs ? `?${qs}` : ''} — ${token ? 'WITH TOKEN' : 'NO TOKEN'}`
  );

  return config;
});

axiosClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiEnvelope>) => {
    if (err.response?.status === 401) {
      tokenStore.clear();
      unauthorizedHandlers.forEach((fn) => {
        try {
          fn();
        } catch {
          /* handler ki galti se request na tootey */
        }
      });
      return Promise.reject(new ApiError('Session khatam ho gaya. Dobara login karo.', 401));
    }

    if (!err.response) {
      if (err.code === 'ERR_CANCELED') return Promise.reject(err);
      return Promise.reject(new ApiError('Server se connect nahi ho paaya. Internet check karo.', 0));
    }

    const json = err.response.data as ApiEnvelope | undefined;
    return Promise.reject(
      new ApiError(
        json?.message || `Request fail hui (${err.response.status})`,
        err.response.status,
        (json as { errors?: Record<string, string[]> } | undefined)?.errors,
        json?.data
      )
    );
  }
);

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

function buildParams(params?: QueryParams): Record<string, string | string[]> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | string[]> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    out[k] = Array.isArray(v) ? v.map(String) : String(v);
  });
  return out;
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = 'GET', body, params, isForm, token, revalidate, signal, headers: extraHeaders } = opts;

  const headers: Record<string, string> = { ...extraHeaders };
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const config: AxiosRequestConfig & { __token?: string | null } = {
    url: path,
    method,
    headers,
    params: buildParams(params),
    data: isForm ? (body as FormData) : body,
    signal,
    __token: token,
  };

  // Next.js fetch cache tags axios ke through pass nahi hote (axios uses XHR/http, not fetch),
  // isliye revalidate sirf app router server-fetch wrappers me matter karta hai. Yahan no-op.
  void revalidate;

  try {
    const res = await axiosClient.request<ApiEnvelope<T>>(config);
    if (res.status === 204 || res.data === undefined || res.data === null) {
      return { success: true, data: null as T };
    }
    return res.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'CanceledError') throw err;
    throw new ApiError('Kuch galat ho gaya.', 0);
  }
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
    if (res?.data?.token) {
      tokenStore.set(res.data.token);
      document.cookie = `ohm_token=${res.data.token}; path=/; max-age=2592000`;
    }

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
    if (res?.data?.token) {
      document.cookie = `ohm_token=${res.data.token}; path=/; max-age=2592000`;
      tokenStore.set(res.data.token);
    }
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
// PUBLIC API
// =============================================================================

export const publicApi = {
  settings: <T = unknown>(opts?: RequestOptions) => api.data<T>('/settings', undefined, { revalidate: 600, ...opts }),
}
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
 * `revalidate` yahan sirf marker hai — axios fetch cache tags support nahi
 * karta, isliye Next.js ISR chahiye to server component me native `fetch`
 * use karo ya route handler cache lagao.
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
  search: <T = unknown>(q: string, opts?: RequestOptions) => api.data<T>('/search', { q }, { ...opts }),

  /** Checkout se pehle — is city me delivery hoti hai ya nahi */
  checkServiceability: <T = unknown>(city: string) => api.data<T>('/serviceable-city', { city }),
};

// =============================================================================
// CART / WISHLIST / ADDRESS API
// =============================================================================

export interface Address {
  id?: string | number;
  name: string;
  mobile: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
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


// =============================================================================
// ORDERS API — add this block to lib/api.ts (after cartApi/wishlistApi/addressApi)
// =============================================================================

export interface OrderQuotePayload {
  items?: Array<{ product_id: string | number; unit_quantity: number }>;
  coupon_code?: string;
  payment_mode?: 'cod' | 'online';
}

export interface OrderQuoteResult {
  subtotal: number;
  discount?: number;
  tax_amount?: number;
  delivery_fee?: number;
  total: number;
  [key: string]: unknown;
}

export interface CheckoutPayload {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_mode: 'cod' | 'online';
  coupon_code?: string;
  items?: Array<{ product_id: string | number; unit_quantity: number }>;
  [key: string]: unknown;
}

export interface RazorpayOrderInfo {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}

export interface CheckoutResult {
  order_id: number | string;
  databaseOrderID?: string;
  amount?: number;
  payment_status?: string;
  status?: string;
  razorpay?: RazorpayOrderInfo;
  [key: string]: unknown;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface Order {
  order_id: number | string;
  databaseOrderID?: string;
  status: string;
  payment_status: string;
  amount: number;
  awb_number?: string;
  courier_name?: string;
  tracking_status?: string;
  tracking_location?: string;
  tracking_datetime?: string;
  delivered_at?: string;
  history?: unknown[];
  items?: unknown[];
  [key: string]: unknown;
}

/**
 * Order lifecycle — quote (cart page totals), checkout (place order),
 * payment verify (Razorpay), tracking, cancel, review.
 */
export const orderApi = {
  /** Cart page pe totals dikhane ke liye — cart bhi khud fetch kar leta hai agar items na diye */
  quote: (payload: OrderQuotePayload = {}) => api.data<OrderQuoteResult>('/orders/quote', undefined, {
    method: 'POST',
    body: payload,
  }),

  /** Order place karo. payment_mode 'online' ho to response.razorpay se checkout modal kholo */
  checkout: (payload: CheckoutPayload) => api.data<CheckoutResult>('/orders/checkout', undefined, {
    method: 'POST',
    body: payload,
  }),

  /** Razorpay checkout modal success ke baad */
  verifyPayment: (payload: VerifyPaymentPayload) =>
    api.data<Order>('/orders/verify-payment', undefined, { method: 'POST', body: payload }),

  /** Payment fail hua tha — dobara Razorpay order banao */
  retryPayment: (orderId: string | number) =>
    api.data<{ razorpay: RazorpayOrderInfo }>(`/orders/${orderId}/retry-payment`, undefined, { method: 'POST' }),

  list: (
    { page = 1, limit = 10, status }: { page?: number; limit?: number; status?: string } = {}
  ) => api.get<Order[]>('/orders', { page, limit, status }),

  detail: (orderId: string | number) => api.data<Order>(`/orders/${orderId}`),

  track: (orderId: string | number) => api.data<Order>(`/orders/${orderId}/track`),

  cancel: (orderId: string | number, reason?: string) =>
    api.data<Order>(`/orders/${orderId}/cancel`, undefined, { method: 'POST', body: { reason } }),

  submitReview: (
    orderId: string | number,
    payload: { product_id: string | number; rating: number; title?: string; review?: string }
  ) => api.post(`/orders/${orderId}/review`, payload),
};

// =============================================================================
// PAYMENTS API
// =============================================================================

export interface PaymentGateway {
  id: string;
  name: string;
  enabled: boolean;
  [key: string]: unknown;
}

export const paymentApi = {
  gateways: () => api.data<PaymentGateway[]>('/payments/gateways'),

  /** Mobile app ke liye — browser redirect nahi hota, seedha verify */
  payuVerify: (payload: Record<string, unknown>) =>
    api.data<Order>('/payments/payu/verify', undefined, { method: 'POST', body: payload }),
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

  update: <T = Address>(addressId: string | number, payload: Partial<Address>) =>
    api.patch<T>(`/addresses/${addressId}`, payload),

  setDefault: <T = Address>(addressId: string | number) => api.patch<T>(`/addresses/${addressId}/default`),

  remove: <T = unknown>(addressId: string | number) => api.del<T>(`/addresses/${addressId}`),
};

export default api;