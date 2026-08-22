import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  LockKeyhole,
  ArrowRight,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Button, Field, Input, PageLoader } from '@/components/ui';

export default function Login() {
  const { admin, loading, login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc]">
        <PageLoader />
      </div>
    );
  }

  if (admin) {
    return (
      <Navigate
        to={location.state?.from || '/'}
        replace
      />
    );
  }

  const submit = async (e) => {
    e.preventDefault();

    setError('');
    setBusy(true);

    try {
      await login(
        form.username.trim(),
        form.password
      );

      navigate(
        location.state?.from || '/',
        { replace: true }
      );
    } catch (err) {
      setError(
        err?.message || 'Invalid username or password.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center p-4 sm:p-6">

      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-teal-100/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[1050px] min-h-[650px] bg-white rounded-3xl shadow-[0_25px_80px_rgba(15,23,42,0.10)] overflow-hidden border border-slate-200/70 grid lg:grid-cols-2">

        {/* ================= LEFT BRAND PANEL ================= */}
        <section className="hidden lg:flex relative bg-[#0b1220] p-12 xl:p-16 flex-col justify-between overflow-hidden">

          {/* Decorative shapes */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="relative z-10">

            {/* Logo */}
            <div className="flex items-center gap-3 mb-16">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg">
                <img
                  src="/favicon.ico"
                  alt="logo"
                  className="w-6 h-6"
                />
              </div>

              <div>
                <div className="leading-none">
                  <span className="font-mono text-xl font-bold text-white">
                    Onco
                  </span>
                  <span className="text-xl font-bold text-teal-400">
                    Healthmart
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-1 tracking-wide">
                  ADMINISTRATION PORTAL
                </p>
              </div>
            </div>

            {/* Heading */}
            <div className="max-w-md">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 mb-6">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                Secure Admin Access
              </div>

              <h1 className="text-4xl xl:text-5xl font-bold leading-[1.08] tracking-tight text-white">
                Manage your
                <span className="block text-teal-400">
                  healthcare platform.
                </span>
              </h1>

              <p className="mt-6 text-base leading-7 text-slate-400 max-w-sm">
                Access your administration dashboard to manage
                products, orders, customers and your entire
                healthcare marketplace.
              </p>
            </div>
          </div>

          {/* Bottom security info */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <LockKeyhole className="w-4 h-4 text-teal-400" />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Protected environment
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Every login attempt is securely recorded.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= RIGHT LOGIN PANEL ================= */}
        <section className="flex items-center justify-center p-7 sm:p-10 lg:p-14">

          <div className="w-full max-w-[420px]">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center mb-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#0b1220] flex items-center justify-center">
                  <img
                    src="/favicon.ico"
                    alt="logo"
                    className="w-6 h-6"
                  />
                </div>

                <div>
                  <span className="font-mono text-xl font-bold text-slate-900">
                    Onco
                  </span>
                  <span className="text-xl font-bold text-teal-600">
                    Healthmart
                  </span>
                </div>
              </div>
            </div>

            {/* Header */}
            <div className="mb-9">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-5">
                <LockKeyhole className="w-5 h-5 text-blue-600" />
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to access your admin dashboard.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={submit}>
              <div className="space-y-5">

                {/* Username */}
                <Field
                  label="Username"
                  required
                >
                  <Input
                    value={form.username}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username: e.target.value,
                      })
                    }
                    autoComplete="username"
                    autoFocus
                    required
                    placeholder="Enter your username"
                    className="h-12 rounded-xl"
                  />
                </Field>

                {/* Password */}
                <Field
                  label="Password"
                  required
                  error={error}
                >
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          password: e.target.value,
                        })
                      }
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      className="h-12 rounded-xl pr-12"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </Field>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-red-200 bg-red-50">
                    <div className="w-5 h-5 shrink-0 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                      <span className="text-xs font-bold text-red-600">
                        !
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Sign in failed
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Login button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon={busy ? undefined : ArrowRight}
                  loading={busy}
                  className="w-full h-12 rounded-xl !text-sm font-semibold shadow-lg shadow-blue-500/10"
                >
                  {busy ? 'Signing in...' : 'Sign in to dashboard'}
                </Button>
              </div>
            </form>

            {/* Security footer */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-teal-500" />
                <span>
                  Authorised staff only
                </span>
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-2">
                All login activity is securely recorded.
              </p>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}