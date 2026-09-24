"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, onUnauthorized, tokenStore, ApiError } from "@/lib/api";
import { enablePush, disablePush } from "@/lib/push";
import type { Customer } from "@/types";

interface AuthContextValue {
  user: Customer | null;
  loading: boolean;
  isLoggedIn: boolean;
  requestOtp: (mobile: string, customer_name?: string) => Promise<{ customer_id: string | number; is_new_user?: boolean; dev_otp?: string }>;
  verifyOtp: (customer_id: string | number, otp: string) => Promise<Customer | null>;
  loginPassword: (mobile: string, password: string) => Promise<Customer | null>;
  register: (payload: { mobile: string; password: string; customer_name?: string }) => Promise<Customer | null>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.has()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me<Customer>();
      setUser(me);
    } catch (err) {
      // Only an invalid/expired token should log the user out — a network
      // hiccup (common on mobile data) must not undo a successful login.
      if (err instanceof ApiError && err.status === 401) {
        tokenStore.clear();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => onUnauthorized(() => setUser(null)), []);

  // Register this browser for push once we know who's logged in — covers
  // both a fresh login and restoring the session on page load. Runs once
  // per session (not on every user object change) since re-registering the
  // same token repeatedly is harmless but pointless.
  useEffect(() => {
    if (user) enablePush();
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestOtp = useCallback(async (mobile: string, customer_name?: string) => {
    const data = await authApi.requestOtp({ mobile, customer_name, allow_signup: true });
    return (data || {}) as { customer_id: string | number; is_new_user?: boolean; dev_otp?: string };
  }, []);

  const verifyOtp = useCallback(async (customer_id: string | number, otp: string) => {
    const data = await authApi.verifyOtp({ customer_id, otp });
    const customer = (data?.customer as Customer) ?? null;
    // Use the customer from the verify response right away so the next step
    // never depends on a second /auth/me request. Sync the full profile in
    // the background afterwards.
    if (customer) {
      setUser(customer);
      setLoading(false);
      void refresh();
    } else {
      await refresh();
    }
    return customer;
  }, [refresh]);

  const loginPassword = useCallback(async (mobile: string, password: string) => {
    const data = await authApi.login({ mobile, password });
    await refresh();
    return (data?.customer as Customer) ?? null;
  }, [refresh]);

  const register = useCallback(async (payload: { mobile: string; password: string; customer_name?: string }) => {
    const data = await authApi.register(payload);
    await refresh();
    return (data?.customer as Customer) ?? null;
  }, [refresh]);

  const logout = useCallback(() => {
    disablePush();
    authApi.logout();
    setUser(null);
  }, []);

  /** Permanent — backend anonymizes the account (orders/prescriptions are kept) */
  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount();
    disablePush();
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        requestOtp,
        verifyOtp,
        loginPassword,
        register,
        logout,
        deleteAccount,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
