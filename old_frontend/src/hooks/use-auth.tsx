"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, tokenStore, onUnauthorized } from "@/lib/api";

export interface AuthUser {
  customer_id?: string | number;
  customer_name?: string;
  mobile?: string;
  email?: string;
  [key: string]: unknown;
}

interface RequestOtpResult {
  customer_id?: string | number;
  is_new_user?: boolean;
  dev_otp?: string;
  [key: string]: unknown;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  loginWithPassword: (mobile: string, password: string) => Promise<void>;
  requestOtp: (mobile: string, customer_name?: string) => Promise<RequestOtpResult>;
  verifyOtp: (customer_id: string | number, otp: string) => Promise<void>;
  register: (payload: {
    mobile: string;
    password: string;
    customer_name?: string;
    email?: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.has()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me<AuthUser>();
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const loginWithPassword = useCallback(
    async (mobile: string, password: string) => {
      await authApi.login({ mobile, password });
      await refresh();
    },
    [refresh]
  );

  const requestOtp = useCallback(async (mobile: string, customer_name?: string) => {
    const res = await authApi.requestOtp({ mobile, customer_name, allow_signup: true });
    return (res || {}) as RequestOtpResult;
  }, []);

  const verifyOtp = useCallback(
    async (customer_id: string | number, otp: string) => {
      await authApi.verifyOtp({ customer_id, otp });
      await refresh();
    },
    [refresh]
  );

  const register = useCallback(
    async (payload: { mobile: string; password: string; customer_name?: string; email?: string }) => {
      await authApi.register(payload);
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isLoggedIn: !!user, loginWithPassword, requestOtp, verifyOtp, register, logout, refresh }}
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
