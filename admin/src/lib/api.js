const BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'ohm_admin_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** 401 aane pe AuthContext isse subscribe karke logout karta hai */
const listeners = new Set();
export const onUnauthorized = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function buildUrl(path, params) {
  const url = `${BASE}/api${path}`;
  if (!params) return url;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function request(path, { method = 'GET', body, params, isForm } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Server se connect nahi ho paaya. Network check karo.', 0);
  }

  if (res.status === 401) {
    listeners.forEach((fn) => fn());
    throw new ApiError('Session khatam ho gaya. Dobara login karo.', 401);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    throw new ApiError(json?.message || `Request fail hui (${res.status})`, res.status, json?.errors);
  }
  return json;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body, params) => request(path, { method: 'POST', body, params }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path, body) => request(path, { method: 'DELETE', body }),

  /** FormData bhejne ke liye — images wagairah */
  form: (path, formData, method = 'POST') =>
    request(path, { method, body: formData, isForm: true }),

  /** CSV export — browser me download trigger karta hai */
  async download(path, params, filename) {
    const token = tokenStore.get();
    const res = await fetch(buildUrl(path, params), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError('Export fail hua', res.status);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

/** Uploaded image ka full URL (backend relative path deta hai) */
export const mediaUrl = (p) => {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return `${BASE}${p}`;
};
