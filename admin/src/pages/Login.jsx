import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Button, Field, Input, PageLoader } from '@/components/ui';

export default function Login() {
  const { admin, loading, login, verifyOtp, resendOtp } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP step (second factor after the password check)
  const [otpStage, setOtpStage] = useState(null); // { admin_id, mobile_hint }
  const [otp, setOtp] = useState('');
  const [info, setInfo] = useState('');

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
      const res = await login(
        form.username.trim(),
        form.password
      );

      // Backend asked for an OTP — move to the second step instead of navigating.
      if (res && res.otp_required) {
        setOtpStage({ admin_id: res.admin_id, mobile_hint: res.mobile_hint });
        setInfo(
          res.dev_otp
            ? `OTP sent. (dev: ${res.dev_otp})`
            : `OTP sent to ${res.mobile_hint || 'your registered mobile'}.`
        );
        setBusy(false);
        return;
      }

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

  const submitOtp = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verifyOtp(otpStage.admin_id, otp.trim());
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err?.message || 'The OTP is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      const r = await resendOtp(otpStage.admin_id);
      setInfo(r?.dev_otp ? `New OTP sent. (dev: ${r.dev_otp})` : 'A new OTP has been sent.');
    } catch (err) {
      setError(err?.message || 'Could not resend the OTP.');
    }
  };

  const backToLogin = () => {
    setOtpStage(null);
    setOtp('');
    setError('');
    setInfo('');
  };

  const ErrorBanner = ({ title }) =>
    error ? (
      <div role="alert" className="rounded-md border border-signal-danger/25 bg-signal-dangerBg px-3.5 py-3">
        <p className="text-sm font-medium text-signal-danger">{title}</p>
        <p className="mt-0.5 text-xs text-signal-danger/80">{error}</p>
      </div>
    ) : null;

  return (
    <main className="min-h-screen grid lg:grid-cols-[5fr_4fr] bg-paper">
      {/* Brand panel — a blister-pack grid is the one memorable element; everything else stays quiet */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-teal-dark p-14 text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 0 8px, transparent 9px)',
            backgroundSize: '40px 40px',
            WebkitMaskImage: 'linear-gradient(150deg, transparent 15%, #000 85%)',
            maskImage: 'linear-gradient(150deg, transparent 15%, #000 85%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 0 8px, transparent 9px)',
            backgroundSize: '40px 40px',
            backgroundPosition: '20px 20px',
            WebkitMaskImage: 'linear-gradient(150deg, transparent 15%, #000 85%)',
            maskImage: 'linear-gradient(150deg, transparent 15%, #000 85%)',
          }}
        />

        <div className="relative inline-flex w-fit rounded-md bg-white px-3 py-2">
          <img src="/logo.png" alt="Onco Health Mart" className="h-9 w-auto" />
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-[2.6rem] font-semibold leading-[1.1] tracking-tight">
            Orders, prescriptions and stock, handled in one place.
          </h1>
          <p className="mt-5 max-w-sm text-[0.95rem] leading-7 text-white/70">
            Sign in with your staff account to review new orders, check prescriptions and keep the catalogue up to date.
          </p>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Authorised staff only. Every sign-in is recorded.
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 inline-flex rounded-md border border-line bg-white px-3 py-2 lg:hidden">
            <img src="/logo.png" alt="Onco Health Mart" className="h-8 w-auto" />
          </div>

          <h2 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            {otpStage ? 'Enter your code' : 'Sign in'}
          </h2>
          <p className="mt-1.5 mb-8 text-sm text-ink-500">
            {otpStage ? 'One more step to confirm it is you.' : 'Use your admin username and password.'}
          </p>

          {otpStage ? (
            <form onSubmit={submitOtp} className="space-y-5">
              {info && <p className="text-xs text-ink-500">{info} Enter the 6-digit code to continue.</p>}

              <Field label="One-time password" required>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  placeholder="6-digit code"
                  className="h-12 text-center font-mono text-lg tracking-[0.5em]"
                />
              </Field>

              <ErrorBanner title="Verification failed" />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={busy ? undefined : ArrowRight}
                loading={busy}
                className="h-12 w-full !text-sm font-semibold"
              >
                {busy ? 'Verifying...' : 'Verify and sign in'}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={backToLogin} className="text-ink-500 hover:text-ink transition">
                  Back to sign in
                </button>
                <button type="button" onClick={resend} className="font-semibold text-teal hover:text-teal-dark transition">
                  Resend code
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <Field label="Username" required>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="Your username"
                  className="h-12"
                />
              </Field>

              <Field label="Password" required>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    required
                    placeholder="Your password"
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-ink-300 transition hover:bg-paper-sunk hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <ErrorBanner title="Sign in failed" />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={busy ? undefined : ArrowRight}
                loading={busy}
                className="h-12 w-full !text-sm font-semibold"
              >
                {busy ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          )}

          <p className="mt-10 flex items-center gap-2 text-xs text-ink-300 lg:hidden">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Authorised staff only. Every sign-in is recorded.
          </p>
        </div>
      </section>
    </main>
  );
}
