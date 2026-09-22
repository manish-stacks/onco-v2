import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

/** For the search box — so the API is not hit on every keystroke */
export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Paginated list + filters. Every list page uses this.
 *   const { rows, pagination, filters, setFilter, loading, reload } = useList('/admin/orders');
 *
 * Pass `syncUrl: true` to also mirror filters into the URL's query string —
 * without it, filters are only ever in local component state, so navigating
 * to a detail page and pressing Back remounts the list with none of them
 * (this was the "filters reset after opening an order" bug on OrderList).
 * Off by default so it doesn't change behaviour on every other list page.
 */
export function useList(path, initialFilters = {}, { immediate = true, syncUrl = false } = {}) {
  const [urlParams, setUrlParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [extra, setExtra] = useState({});
  const [filters, setFilters] = useState(() => {
    if (!syncUrl) return { page: 1, limit: 25, ...initialFilters };
    const fromUrl = Object.fromEntries(urlParams);
    if (fromUrl.page) fromUrl.page = Number(fromUrl.page);
    if (fromUrl.limit) fromUrl.limit = Number(fromUrl.limit);
    return { page: 1, limit: 25, ...initialFilters, ...fromUrl };
  });
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const toast = useToast();
  const reqId = useRef(0);

  const load = useCallback(async (override) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(path, override || filters);
      if (id !== reqId.current) return; // purani request — ignore
      setRows(Array.isArray(res.data) ? res.data : []);
      if (res.pagination) setPagination(res.pagination);
      const { data, pagination: _p, success, message, ...rest } = res;
      setExtra(rest);
    } catch (err) {
      if (id !== reqId.current) return;
      setError(err);
      if (err.status !== 401) toast.error(err.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [path, filters, toast]);

  useEffect(() => {
    if (immediate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), path]);

  // Keep the URL in sync so Back (from an order/detail page) restores the
  // exact same filters instead of the list remounting blank. `replace` so
  // typing in a filter doesn't spam a new history entry per keystroke.
  useEffect(() => {
    if (!syncUrl) return;
    const qp = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qp[k] = String(v);
    });
    setUrlParams(qp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), syncUrl]);

  /** Go back to page 1 when a filter changes — otherwise an empty page is shown */
  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? value : 1 }));
  }, []);

  const setManyFilters = useCallback((obj) => {
    setFilters((f) => ({ ...f, ...obj, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ page: 1, limit: 25, ...initialFilters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    rows, pagination, extra, filters, setFilter, setManyFilters, resetFilters,
    loading, error, reload: load, setRows,
  };
}

/** Single resource — detail pages ke liye */
export function useResource(
  path,
  isFull = false,
  { immediate = true } = {}
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!path) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(path);

      if (isFull) {
        setData(res);
      } else {
        setData(res.data);
      }
    } catch (err) {
      setError(err);

      if (err?.status !== 401) {
        toast.error(err?.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }, [path, isFull, toast]);

  useEffect(() => {
    if (immediate && path) {
      load();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return {
    data,
    setData,
    loading,
    error,
    reload: load,
  };
}
/**
 * Mutation — submit buttons ke liye. Loading state + toast automatic.
 *   const save = useMutation((body) => api.post('/admin/products', body), { success: 'Product created' });
 *   await save.run(payload);
 */
export function useMutation(fn, { success, onSuccess, onError } = {}) {
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(null);
  const toast = useToast();

  const run = useCallback(async (...args) => {
    setLoading(true);
    setFieldErrors(null);
    try {
      const res = await fn(...args);
      if (success) toast.success(typeof success === 'function' ? success(res) : success);
      onSuccess?.(res);
      return res;
    } catch (err) {
      if (err.errors) setFieldErrors(err.errors);
      if (err.status !== 401) toast.error(err.message);
      onError?.(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fn, success, onSuccess, onError, toast]);

  return useMemo(() => ({ run, loading, fieldErrors, setFieldErrors }), [run, loading, fieldErrors]);
}
