"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  KeyRound,
  ArrowRight,
  Loader2,
  ShieldCheck,
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

  const { requestOtp, verifyOtp, isLoggedIn, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && isLoggedIn) router.replace(redirectTo);
  }, [authLoading, isLoggedIn, redirectTo, router]);

  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [customerId, setCustomerId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(mobile);
      setCustomerId(res.customer_id);
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
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 sm:py-14">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-24 h-56 w-56 -translate-x-1/2 rounded-full bg-[#1C398E]/10 blur-3xl sm:top-32 sm:h-72 sm:w-72" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#1C398E]/5 blur-3xl sm:h-72 sm:w-72" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 sm:gap-8 lg:grid-cols-[440px_1fr]">
        <div>
          {/* Login Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:rounded-3xl sm:px-9 sm:py-10">
            {/* Heading */}
            <div className="mb-6 text-center sm:mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                Welcome Back 👋
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Login to continue shopping and manage your account.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {/* ================= OTP LOGIN ================= */}
            {!customerId ? (
              <form onSubmit={handleRequestOtp} className="space-y-4 sm:space-y-5">
                {/* Mobile */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Mobile Number
                  </label>

                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 transition-all focus-within:border-[#1C398E] focus-within:ring-4 focus-within:ring-[#1C398E]/10 sm:h-14">
                    <span className="mr-3 border-r border-slate-200 pr-3 text-sm font-semibold text-slate-700">
                      +91
                    </span>
                    <Phone size={17} className="mr-2 shrink-0 text-slate-400" />
                    <input
                      required
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
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
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1C398E] to-[#2F4EA8] text-white shadow-lg shadow-[#1C398E]/20 transition-all hover:shadow-xl hover:shadow-[#1C398E]/25 disabled:opacity-70 sm:h-14"
                  icon={
                    loading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ArrowRight size={17} />
                    )
                  }
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>

                <p className="text-center text-xs leading-5 text-slate-400">
                  New number? Your account will be created automatically after verification.
                </p>
              </form>
            ) : (
              /* ================= OTP VERIFY ================= */
              <form onSubmit={handleVerifyOtp} className="space-y-4 sm:space-y-5">
                {/* OTP Sent */}
                <div className="rounded-xl border border-[#1C398E]/15 bg-[#1C398E]/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1C398E]/10">
                      <CheckCircle2 size={17} className="text-[#1C398E]" />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-700">OTP sent successfully</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Enter the OTP sent to{" "}
                        <span className="font-semibold text-slate-700">+91 {mobile}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId(null);
                          setOtp("");
                        }}
                        className="mt-2 text-xs font-semibold text-[#1C398E] underline underline-offset-2"
                      >
                        Change number
                      </button>
                    </div>
                  </div>
                </div>

                {/* OTP Input */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Enter OTP
                  </label>

                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 transition-all focus-within:border-[#1C398E] focus-within:ring-4 focus-within:ring-[#1C398E]/10 sm:h-14">
                    <KeyRound size={18} className="mr-3 shrink-0 text-slate-400" />
                    <input
                      required
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full bg-transparent text-center text-base font-semibold tracking-[0.35em] text-slate-900 outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-400 sm:text-lg sm:tracking-[0.45em]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1C398E] to-[#2F4EA8] text-white shadow-lg shadow-[#1C398E]/20 transition-all hover:shadow-xl hover:shadow-[#1C398E]/25 disabled:opacity-70 sm:h-14"
                  icon={
                    loading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ArrowRight size={17} />
                    )
                  }
                >
                  {loading ? "Verifying..." : "Verify & Login"}
                </Button>
              </form>
            )}

            {/* Footer */}
            <p className="mt-6 text-center text-[11px] leading-5 text-slate-400 sm:mt-7">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-slate-500 underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="text-slate-500 underline">
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
                className="text-xs font-semibold text-[#1C398E] hover:underline"
              >
                Read Reviews
              </a>
            </div>
          </div>

          {/* Bottom security text */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-[#1C398E]" />
            Your information is protected and securely encrypted
          </div>
        </div>

        {/* Illustration panel */}
        <div className="relative hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-[#1C398E]/5 via-white to-[#1C398E]/10 p-10 lg:flex lg:min-h-[600px] lg:flex-col lg:items-center lg:justify-center">
          <div className="relative flex h-72 w-72 items-center justify-center">
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
                className={`absolute ${pos} flex h-14 w-14 items-center justify-center rounded-full bg-[#1C398E] text-white shadow-lg ring-4 ring-white`}
              >
                <Icon size={22} />
              </span>
            ))}

            <span className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-[#1C398E] to-[#2F4EA8] text-white shadow-xl">
              <UserRound size={72} strokeWidth={1.3} />
            </span>
          </div>

          <div className="mt-10 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-8 py-4 shadow-lg">
            <p className="font-display text-3xl font-black text-slate-900">
              900<span className="text-[#1C398E]">+</span>
            </p>
            <p className="rounded-full bg-gradient-to-r from-[#1C398E] to-[#2F4EA8] px-4 py-1 text-sm font-semibold text-white">
              Speciality Medicines
            </p>
          </div>
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