"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Lock, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineToast, type InlineToastState } from "@/components/ui/inline-toast";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Mode = "otp" | "password";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const { loginWithPassword, requestOtp, verifyOtp } = useAuth();

  const [mode, setMode] = useState<Mode>("otp");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [customerId, setCustomerId] = useState<string | number | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<InlineToastState | null>(null);

  function notify(message: string, tone: "success" | "error" = "error") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile.trim()) return notify("Enter your mobile number");
    setLoading(true);
    try {
      const res = await requestOtp(mobile.trim());
      setCustomerId(res.customer_id ?? null);
      setDevOtp(res.dev_otp ?? null);
      setOtpSent(true);
      notify("OTP sent to your mobile", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || customerId === null) return notify("Enter the OTP sent to you");
    setLoading(true);
    try {
      await verifyOtp(customerId, otp.trim());
      notify("Logged in successfully", "success");
      router.push(redirectTo);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile.trim() || !password) return notify("Enter mobile and password");
    setLoading(true);
    try {
      await loginWithPassword(mobile.trim(), password);
      notify("Logged in successfully", "success");
      router.push(redirectTo);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Welcome back</h1>
      <p className="mb-8 text-sm text-[var(--ink-soft)]">Log in to manage your cart, wishlist and orders.</p>

      <div className="mb-6 flex gap-1 rounded-full bg-black/[0.04] p-1">
        <button
          onClick={() => {
            setMode("otp");
            setOtpSent(false);
          }}
          className={cn(
            "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            mode === "otp" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
          )}
        >
          OTP Login
        </button>
        <button
          onClick={() => setMode("password")}
          className={cn(
            "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            mode === "password" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
          )}
        >
          Password
        </button>
      </div>

      {mode === "otp" ? (
        <form onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp} className="space-y-4">
          <Field icon={<Phone size={16} />} label="Mobile number">
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={otpSent}
              placeholder="9876543210"
              className="w-full bg-transparent text-sm outline-none disabled:opacity-60"
            />
          </Field>

          {otpSent && (
            <Field icon={<KeyRound size={16} />} label="Enter OTP">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-full bg-transparent text-sm outline-none"
                autoFocus
              />
            </Field>
          )}

          {devOtp && (
            <p className="text-xs text-[var(--ink-soft)]">Dev OTP (test only): <span className="font-semibold text-[var(--ink)]">{devOtp}</span></p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : undefined}>
            {otpSent ? "Verify & Login" : "Send OTP"}
          </Button>

          {otpSent && (
            <button type="button" onClick={() => setOtpSent(false)} className="w-full text-center text-xs font-medium text-[var(--blue-600)]">
              Change mobile number
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <Field icon={<Phone size={16} />} label="Mobile number">
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="9876543210"
              className="w-full bg-transparent text-sm outline-none"
            />
          </Field>
          <Field icon={<Lock size={16} />} label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent text-sm outline-none"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : undefined}>
            Log In
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
        New here?{" "}
        <Link href={`/register?redirect=${encodeURIComponent(redirectTo)}`} className="font-semibold text-[var(--blue-600)]">
          Create an account
        </Link>
      </p>

      <InlineToast toast={toast} />
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      <div className="flex h-12 items-center gap-2 rounded-full border border-[var(--line)] px-4">
        <span className="text-[var(--ink-soft)]">{icon}</span>
        {children}
      </div>
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
