"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  Lock,
  KeyRound,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Truck,
  Pill,
  CheckCircle2,
  Stethoscope,
  Syringe,
  HeartPulse,
  Activity,
  FlaskConical,
  ShieldPlus,
  Cross,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const redirectTo = params.get("redirect") || "/account";

  const { requestOtp, verifyOtp, loginPassword, isLoggedIn, loading: authLoading } = useAuth();

  // No point showing the login page to someone who is already signed in —
  // send them straight to the redirect target (or their account).
  useEffect(() => {
    if (!authLoading && isLoggedIn) router.replace(redirectTo);
  }, [authLoading, isLoggedIn, redirectTo, router]);

  const [mode, setMode] = useState<"otp" | "password">("otp");

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [customerId, setCustomerId] = useState<
    string | number | null
  >(null);

  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const res = await requestOtp(mobile);

      setCustomerId(res.customer_id);
      setDevOtp(res.dev_otp || null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not send OTP"
      );
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
      setError(
        err instanceof ApiError
          ? err.message
          : "Invalid OTP"
      );
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
      setError(
        err instanceof ApiError
          ? err.message
          : "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "otp" | "password") {
    setMode(next);
    setError(null);

    if (next === "otp") {
      setCustomerId(null);
      setOtp("");
      setDevOtp(null);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-10 sm:px-6 sm:py-14">

      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-32 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-teal-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-[440px_1fr]">

        <div>

        {/* Login Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-9 sm:py-10">

         

          {/* Heading */}
          <div className="mb-7 text-center">

            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
              Welcome Back 👋
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Login to continue shopping and manage your account.
            </p>

          </div>

          {/* Login Mode Toggle */}
          <div className="mb-7 rounded-xl bg-slate-100 p-1">

            <div className="grid grid-cols-2 gap-1">

              <button
                type="button"
                onClick={() => switchMode("otp")}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === "otp"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                OTP Login
              </button>

              <button
                type="button"
                onClick={() => switchMode("password")}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === "password"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Password
              </button>

            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}

          {/* ================= OTP LOGIN ================= */}

          {mode === "otp" ? (
            !customerId ? (

              <form
                onSubmit={handleRequestOtp}
                className="space-y-5"
              >

                {/* Mobile */}
                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Mobile Number
                  </label>

                  <div className="flex h-13 items-center rounded-xl border border-slate-200 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">

                    <span className="mr-3 border-r border-slate-200 pr-3 text-sm font-semibold text-slate-700">
                      +91
                    </span>

                    <Phone
                      size={17}
                      className="mr-2 shrink-0 text-slate-400"
                    />

                    <input
                      required
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) =>
                        setMobile(
                          e.target.value.replace(/\D/g, "")
                        )
                      }
                      placeholder="Enter mobile number"
                      className="h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />

                  </div>

                </div>

                {/* Button */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="h-13 w-full rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/15 transition-all hover:shadow-xl hover:shadow-blue-500/20"
                  icon={
                    loading ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <ArrowRight size={17} />
                    )
                  }
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>

                <p className="text-center text-xs leading-5 text-slate-400">
                  New number? Your account will be created
                  automatically after verification.
                </p>

              </form>

            ) : (

              /* ================= OTP VERIFY ================= */

              <form
                onSubmit={handleVerifyOtp}
                className="space-y-5"
              >

                {/* OTP Sent */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">

                  <div className="flex items-start gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <CheckCircle2
                        size={17}
                        className="text-blue-600"
                      />
                    </div>

                    <div>

                      <p className="text-sm font-medium text-slate-700">
                        OTP sent successfully
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Enter the OTP sent to{" "}
                        <span className="font-semibold text-slate-700">
                          +91 {mobile}
                        </span>
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId(null);
                          setOtp("");
                          setDevOtp(null);
                        }}
                        className="mt-2 text-xs font-semibold text-blue-600 underline underline-offset-2"
                      >
                        Change number
                      </button>

                    </div>

                  </div>
                </div>

                {/* Dev OTP */}
                {devOtp && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                    Development OTP:
                    <span className="ml-2 font-mono font-bold">
                      {devOtp}
                    </span>
                  </div>
                )}

                {/* OTP Input */}
                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Enter OTP
                  </label>

                  <div className="flex h-14 items-center rounded-xl border border-slate-200 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">

                    <KeyRound
                      size={18}
                      className="mr-3 shrink-0 text-slate-400"
                    />

                    <input
                      required
                      autoFocus
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) =>
                        setOtp(
                          e.target.value.replace(/\D/g, "")
                        )
                      }
                      placeholder="Enter 6-digit OTP"
                      className="w-full bg-transparent text-center text-lg font-semibold tracking-[0.45em] text-slate-900 outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-400"
                    />

                  </div>

                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="h-13 w-full rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/15"
                  icon={
                    loading ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <ArrowRight size={17} />
                    )
                  }
                >
                  {loading
                    ? "Verifying..."
                    : "Verify & Login"}
                </Button>

              </form>
            )

          ) : (

            /* ================= PASSWORD LOGIN ================= */

            <form
              onSubmit={handlePasswordLogin}
              className="space-y-5"
            >

              {/* Mobile */}
              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Mobile Number
                </label>

                <div className="flex h-13 items-center rounded-xl border border-slate-200 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">

                  <span className="mr-3 border-r border-slate-200 pr-3 text-sm font-semibold text-slate-700">
                    +91
                  </span>

                  <Phone
                    size={17}
                    className="mr-2 shrink-0 text-slate-400"
                  />

                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) =>
                      setMobile(
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="Enter mobile number"
                    className="h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />

                </div>

              </div>

              {/* Password */}
              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label className="text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </Link>

                </div>

                <div className="flex h-13 items-center rounded-xl border border-slate-200 bg-white px-4 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">

                  <Lock
                    size={17}
                    className="mr-2 shrink-0 text-slate-400"
                  />

                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    className="h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((v) => !v)
                    }
                    className="ml-2 shrink-0 text-slate-400 transition hover:text-slate-700"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>

                </div>

              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-13 w-full rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/15"
                icon={
                  loading ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <ArrowRight size={17} />
                  )
                }
              >
                {loading ? "Logging in..." : "Login"}
              </Button>

            </form>
          )}


          {/* Register */}
          <div className="mt-6 border-t border-slate-100 pt-6 text-center">

            <p className="text-sm text-slate-500">
              New to Onco Health Mart?
            </p>

            <Link
              href="/register"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Create an account
              <ArrowRight size={14} />
            </Link>

          </div>

          {/* Footer */}
          <p className="mt-7 text-center text-[11px] leading-5 text-slate-400">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="text-slate-500 underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-policy"
              className="text-slate-500 underline"
            >
              Privacy Policy
            </Link>
            .
          </p>

        </div>

        {/* Rating widget */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div className="flex -space-x-2">
            {["a", "b", "c"].map((seed) => (
              <Image
                key={seed}
                src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`}
                alt=""
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 rounded-full border-2 border-white bg-slate-100"
              />
            ))}
          </div>
          <div>
            <p className="flex items-center gap-1 text-sm font-bold text-slate-900">
              Rated 4.5+ <span aria-hidden>⭐</span> On Google
            </p>
            <a
              href="https://www.google.com/search?q=onco+health+mart+reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Read Reviews
            </a>
          </div>
        </div>

        {/* Bottom security text */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={14} className="text-teal-500" />
          Your information is protected and securely encrypted
        </div>

        </div>

        {/* Illustration panel */}
        <div className="relative hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-blue-50 via-white to-teal-50 p-10 lg:flex lg:min-h-[600px] lg:flex-col lg:items-center lg:justify-center">
          <div className="relative flex h-72 w-72 items-center justify-center">
            {/* Floating medical icon badges */}
            {[
              { Icon: Stethoscope, pos: "left-2 top-2" },
              { Icon: Syringe, pos: "left-1/2 -top-6 -translate-x-1/2" },
              { Icon: Pill, pos: "right-2 top-2" },
              { Icon: HeartPulse, pos: "-left-8 top-1/2 -translate-y-1/2" },
              { Icon: Activity, pos: "-right-8 top-1/2 -translate-y-1/2" },
              { Icon: FlaskConical, pos: "left-2 bottom-2" },
              { Icon: ShieldPlus, pos: "left-1/2 -bottom-6 -translate-x-1/2" },
              { Icon: Cross, pos: "right-2 bottom-2" },
            ].map(({ Icon, pos }, i) => (
              <span
                key={i}
                className={`absolute ${pos} flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg ring-4 ring-white`}
              >
                <Icon size={22} />
              </span>
            ))}

            {/* Central avatar */}
            <span className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white shadow-xl">
              <UserRound size={72} strokeWidth={1.3} />
            </span>
          </div>

          {/* Speciality medicines badge */}
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-8 py-4 shadow-lg">
            <p className="font-display text-3xl font-black text-slate-900">
              900<span className="text-teal-500">+</span>
            </p>
            <p className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1 text-sm font-semibold text-white">
              Speciality Medicines
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}