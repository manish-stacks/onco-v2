"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Phone, Lock, KeyRound, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/account";
  const { requestOtp, verifyOtp, loginPassword } = useAuth();

  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-[var(--ink)]">Welcome back</h1>
      <p className="mb-8 text-sm text-[var(--ink-soft)]">Login to manage orders, prescriptions and your wishlist.</p>

      <div className="mb-6 flex rounded-full bg-black/[0.04] p-1 text-sm font-medium">
        <button
          onClick={() => { setMode("otp"); setError(null); setCustomerId(null); }}
          className={`flex-1 rounded-full py-2 transition ${mode === "otp" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"}`}
        >
          OTP Login
        </button>
        <button
          onClick={() => { setMode("password"); setError(null); }}
          className={`flex-1 rounded-full py-2 transition ${mode === "password" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"}`}
        >
          Password
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
          {error}
        </div>
      )}

      {mode === "otp" ? (
        !customerId ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Mobile number</span>
              <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
                <Phone size={16} className="text-[var(--ink-soft)]" />
                <input
                  required
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}>
              {loading ? "Sending OTP…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {devOtp && (
              <p className="rounded-[var(--radius-sm)] bg-[var(--blue-50)] px-4 py-2 text-xs text-[var(--blue-600)]">
                Dev mode OTP: <span className="font-mono-nums font-bold">{devOtp}</span>
              </p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Enter OTP sent to {mobile}</span>
              <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
                <KeyRound size={16} className="text-[var(--ink-soft)]" />
                <input
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit OTP"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}>
              {loading ? "Verifying…" : "Verify & Login"}
            </Button>
            <button type="button" onClick={() => setCustomerId(null)} className="w-full text-center text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Change mobile number
            </button>
          </form>
        )
      ) : (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Mobile number</span>
            <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
              <Phone size={16} className="text-[var(--ink-soft)]" />
              <input
                required
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Password</span>
            <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
              <Lock size={16} className="text-[var(--ink-soft)]" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}>
            {loading ? "Logging in…" : "Login"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
        New here?{" "}
        <Link href="/register" className="font-semibold text-[var(--blue-600)]">Create an account</Link>
      </p>
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
