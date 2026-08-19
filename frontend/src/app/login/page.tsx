"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Phone, Lock, KeyRound, ArrowRight, Loader2, Eye, EyeOff,
  ShieldCheck, Truck, Headphones, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

const trustPoints = [
  { icon: ShieldCheck, text: "100% genuine, licensed pharmacy medicines" },
  { icon: Truck, text: "Fast, discreet delivery across India" },
  { icon: Headphones, text: "Real pharmacist support, 24/7" },
];

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/account";
  const { requestOtp, verifyOtp, loginPassword } = useAuth();

  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [customerId, setCustomerId] = useState<string | number | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(mobile);
      setCustomerId(res.customer_id);
      setDevOtp(res.dev_otp || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(customerId, otp);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginPassword(mobile, password);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "otp" | "password") {
    setMode(next);
    setError(null);
    if (next === "otp") setCustomerId(null);
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl grid-cols-1 lg:grid-cols-[1fr_1fr]">
      {/* Branding panel — desktop only */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[var(--blue-600)] to-[var(--blue-900)] px-12 py-16 lg:flex lg:flex-col lg:justify-center">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />

        <div className="relative">
          <Link href="/" className="mb-10 inline-flex items-center rounded-lg bg-white px-3 py-2">
            <Image src="/logo.png" alt="Onco Health Mart" width={180} height={56} className="h-10 w-auto object-contain" />
          </Link>

          <h2 className="mb-3 max-w-sm font-display text-3xl font-bold leading-tight text-white">
            Your health, delivered with care.
          </h2>
          <p className="mb-10 max-w-sm text-sm leading-relaxed text-white/70">
            Sign in to track orders, manage prescriptions, and get your medicines faster next time.
          </p>

          <ul className="space-y-4">
            {trustPoints.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile-only compact logo */}
          <Link href="/" className="mb-8 flex justify-center lg:hidden">
            <Image src="/logo.png" alt="Onco Health Mart" width={160} height={50} className="h-10 w-auto object-contain" />
          </Link>

          <h1 className="mb-1 font-display text-2xl font-bold text-[var(--ink)]">Welcome back</h1>
          <p className="mb-7 text-sm text-[var(--ink-soft)]">Login to manage orders, prescriptions and your wishlist.</p>

          <div className="mb-6 flex rounded-full bg-black/[0.04] p-1 text-sm font-medium">
            <button
              onClick={() => switchMode("otp")}
              className={`flex-1 rounded-full py-2.5 transition-colors ${mode === "otp" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
            >
              OTP Login
            </button>
            <button
              onClick={() => switchMode("password")}
              className={`flex-1 rounded-full py-2.5 transition-colors ${mode === "password" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}
            >
              Password
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
              {error}
            </div>
          )}

          {mode === "otp" ? (
            !customerId ? (
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Mobile number</span>
                  <div className="flex h-12 items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 transition-colors focus-within:border-[var(--blue-500)]">
                    <Phone size={16} className="shrink-0 text-[var(--ink-soft)]" />
                    <input
                      required
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                </label>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                  icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                >
                  {loading ? "Sending OTP…" : "Send OTP"}
                </Button>
                <p className="text-center text-xs leading-relaxed text-[var(--ink-soft)]">
                  New number? An account will be created automatically after verification.
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 px-4 py-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--blue-500)]" />
                  <p className="text-xs leading-relaxed text-[var(--blue-700)]">
                    OTP sent to <span className="font-semibold">{mobile}</span>.{" "}
                    <button type="button" onClick={() => setCustomerId(null)} className="font-semibold underline underline-offset-2">
                      Change number
                    </button>
                  </p>
                </div>

                {devOtp && (
                  <p className="rounded-[var(--radius-sm)] bg-[var(--blue-50)] px-4 py-2 text-xs text-[var(--blue-600)]">
                    Dev mode OTP: <span className="font-mono-nums font-bold">{devOtp}</span>
                  </p>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Enter OTP</span>
                  <div className="flex h-12 items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 transition-colors focus-within:border-[var(--blue-500)]">
                    <KeyRound size={16} className="shrink-0 text-[var(--ink-soft)]" />
                    <input
                      required
                      autoFocus
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      className="w-full bg-transparent text-sm tracking-[0.3em] outline-none"
                    />
                  </div>
                </label>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                  icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                >
                  {loading ? "Verifying…" : "Verify & Login"}
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Mobile number</span>
                <div className="flex h-12 items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 transition-colors focus-within:border-[var(--blue-500)]">
                  <Phone size={16} className="shrink-0 text-[var(--ink-soft)]" />
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Password</span>
                <div className="flex h-12 items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 transition-colors focus-within:border-[var(--blue-500)]">
                  <Lock size={16} className="shrink-0 text-[var(--ink-soft)]" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="shrink-0 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
                icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              >
                {loading ? "Logging in…" : "Login"}
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
            New here?{" "}
            <Link href="/register" className="font-semibold text-[var(--blue-600)] hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}