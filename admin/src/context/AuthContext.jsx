import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api, tokenStore, onUnauthorized } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      if (tokenStore.get()) await api.post('/admin/auth/logout');
    } catch {
      /* logout is best-effort */
    }
    tokenStore.clear();
    setAdmin(null);
    setPermissions([]);
  }, []);

  // when the token expires, the api client signals here
  useEffect(() => onUnauthorized(() => {
    tokenStore.clear();
    setAdmin(null);
    setPermissions([]);
  }), []);

  // page reload pe session restore
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/admin/auth/me');
        if (!alive) return;
        setAdmin(res.data);
        setPermissions(res.data.permissions || []);
      } catch {
        tokenStore.clear();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/admin/auth/login', { username, password });
    tokenStore.set(res.data.token);
    setAdmin(res.data.admin);
    setPermissions(res.data.permissions || []);
    return res.data.admin;
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.get('/admin/auth/me');
    setAdmin(res.data);
    setPermissions(res.data.permissions || []);
  }, []);

  /** One or several permissions — true if any one of them matches */
  const can = useCallback((perm) => {
    if (!perm) return true;
    const list = Array.isArray(perm) ? perm : [perm];
    return list.some((p) => permissions.includes(p));
  }, [permissions]);

  const value = useMemo(
    () => ({ admin, permissions, loading, login, logout, refresh, can }),
    [admin, permissions, loading, login, logout, refresh, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
