import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Backend base URL. Change it in app.json -> expo.extra.apiBase
 * The app talks to the SAME /api/app/* endpoints as the website,
 * only the X-Client-Platform header differs (app vs web).
 */
export const API_BASE = (
  Constants?.expoConfig?.extra?.apiBase ||
  Constants?.manifest?.extra?.apiBase ||
  'https://www.api.oncohealthmart.com'
).replace(/\/$/, '');

const PREFIX = '/api/app';
const TOKEN_KEY = 'ohm_token';
export const PLATFORM = 'app';

let memToken = null;
let onUnauthorized = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export const tokenStore = {
  async get() {
    if (memToken) return memToken;
    try {
      memToken = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      memToken = null;
    }
    return memToken;
  },
  async set(token) {
    memToken = token || null;
    try {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* keychain unavailable — stay in memory */
    }
  },
  async clear() {
    memToken = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

function buildQuery(params) {
  if (!params) return '';
  const parts = [];
  Object.keys(params).forEach((k) => {
    const v = params[k];
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((x) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(x)}`));
    else parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function request(path, options = {}) {
  const { method = 'GET', body, params, isForm = false, timeout = 30000 } = options;

  const token = await tokenStore.get();
  const headers = {
    Accept: 'application/json',
    'X-Client-Platform': PLATFORM,
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(`${API_BASE}${PREFIX}${path}${buildQuery(params)}`, {
      method,
      headers,
      signal: controller.signal,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError(
      err.name === 'AbortError' ? 'The request timed out. Please try again.' : 'Network error. Check your connection.',
      0
    );
  }
  clearTimeout(timer);

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.status === 401) {
    await tokenStore.clear();
    if (onUnauthorized) onUnauthorized();
  }

  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json?.errors);
  }

  return json;
}

/** Returns only the `data` part of the envelope */
export async function requestData(path, options) {
  const json = await request(path, options);
  return json ? json.data : null;
}

/** Returns { data, pagination } */
export async function requestPaged(path, options) {
  const json = await request(path, options);
  return { data: json?.data || [], pagination: json?.pagination || null };
}

/** Turn a stored relative path into a full URL */
export function mediaUrl(path, fallback = null) {
  if (!path) return fallback;
  const p = String(path);
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${API_BASE}${p.startsWith('/') ? '' : '/'}${p}`;
}

export function isPdfUrl(path) {
  return !!path && /\.pdf($|\?)/i.test(String(path));
}
