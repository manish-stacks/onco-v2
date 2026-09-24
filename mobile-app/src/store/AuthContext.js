import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import { getPushToken } from '../utils/push';

const AuthContext = createContext(null);
const ONBOARD_KEY = 'ohm_onboarded';

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [onboarded, setOnboarded] = useState(true);

  const logout = useCallback(async () => {
    try {
      const push = await getPushToken();
      if (push) await authApi.unregisterDevice(push);
    } catch {
      /* ignore */
    }
    await tokenStore.clear();
    setCustomer(null);
  }, []);

  /** Permanent — calls the backend to wipe personal data, then logs out locally */
  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount();
    await tokenStore.clear();
    setCustomer(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setCustomer(null));
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const seen = await AsyncStorage.getItem(ONBOARD_KEY);
      setOnboarded(seen === '1');
    } catch {
      setOnboarded(false);
    }
    try {
      const token = await tokenStore.get();
      if (token) {
        const me = await authApi.me();
        setCustomer(me);
      }
    } catch {
      await tokenStore.clear();
      setCustomer(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /** Called after OTP verify / password login */
  const signIn = useCallback(async ({ token, customer: cust }) => {
    if (token) await tokenStore.set(token);
    setCustomer(cust || null);
    // Push registration runs in the background so it can never block the
    // navigation that follows a successful login.
    getPushToken()
      .then((push) => (push ? authApi.registerDevice(push) : null))
      .catch(() => { /* push is optional */ });
    if (!cust) {
      try {
        setCustomer(await authApi.me());
      } catch {
        /* ignore */
      }
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    try {
      setCustomer(await authApi.me());
    } catch {
      /* ignore */
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboarded(true);
    try {
      await AsyncStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      booting,
      customer,
      isLoggedIn: !!customer,
      onboarded,
      signIn,
      logout,
      deleteAccount,
      refreshCustomer,
      setCustomer,
      completeOnboarding,
    }),
    [booting, customer, onboarded, signIn, logout, deleteAccount, refreshCustomer, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
