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

  // Applies a fully-authenticated session payload ({ token, admin, permissions }).
  const applySession = useCallback((data) => {
    tokenStore.set(data.token);
    setAdmin(data.admin);
    setPermissions(data.permissions || []);
    return data.admin;
  }, []);

  // Step 1. Returns { otp_required, admin_id, mobile_hint, dev_otp? } when an OTP
  // step is needed, otherwise logs straight in and returns the admin.
  const login = useCallback(async (username, password) => {
    const res = await api.post('/admin/auth/login', { username, password });
    if (res.data?.otp_required) return res.data; // caller shows the OTP screen
    return applySession(res.data);
  }, [applySession]);

  // Step 2. Verify the OTP and finish login.
  const verifyOtp = useCallback(async (admin_id, otp) => {
    const res = await api.post('/admin/auth/verify-otp', { admin_id, otp });
    return applySession(res.data);
  }, [applySession]);

  // Resend the login OTP.
  const resendOtp = useCallback(
    (admin_id) => api.post('/admin/auth/resend-otp', { admin_id }).then((r) => r.data),
    []
  );

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
    () => ({ admin, permissions, loading, login, verifyOtp, resendOtp, logout, refresh, can }),
    [admin, permissions, loading, login, verifyOtp, resendOtp, logout, refresh, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
