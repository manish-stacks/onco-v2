import { useMemo, useState } from 'react';

/** Client-side search + status filter + pagination for small lists that the API returns in one go. */
export function useClientList(rows, { pageSize = 10 } = {}) {
  const [search, setSearchRaw] = useState('');
  const [status, setStatusRaw] = useState('');
  const [page, setPage] = useState(1);
  const all = Array.isArray(rows) ? rows : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (status && r.status !== status) return false;
      if (!q) return true;
      return Object.values(r).some((v) => (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(q));
    });
  }, [all, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const view = filtered.slice((current - 1) * pageSize, current * pageSize);

  return {
    view, search, status,
    hasStatus: all.some((r) => Object.prototype.hasOwnProperty.call(r, 'status')),
    hasFilters: !!(search || status),
    setSearch: (v) => { setSearchRaw(v); setPage(1); },
    setStatus: (v) => { setStatusRaw(v); setPage(1); },
    reset: () => { setSearchRaw(''); setStatusRaw(''); setPage(1); },
    setPage,
    pagination: { page: current, limit: pageSize, total: filtered.length, totalPages },
  };
}
