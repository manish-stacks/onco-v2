"use client";

import { useState } from "react";
import { Phone, KeyRound, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import type { Customer } from "@/types";

/**
 * Mobile verification embedded inside checkout — instead of logging in first and
 * there is no need to send them to a separate page. The number is checked: if registered,
 * the OTP goes straight to login; if not, a new account is created and the same
 * is verified over OTP. The backend `/auth/otp/request` handles both
 * (`allow_signup: true`).
 */
export function InlineOtpVerify({ onVerified }: { onVerified: (customer: Customer | null) => void }) {
  const { requestOtp, verifyOtp } = useAuth();

  const [mobile, setMobile] = useState("");
  const [customerId, setCustomerId] = useState<string | number | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const clean = mobile.replace(/\D/g, "");
    if (clean.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(clean);
      setCustomerId(res.customer_id);
      setIsNewUser(!!res.is_new_user);
      setDevOtp(res.dev_otp || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "There was a problem sending the OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    setError(null);
    setLoading(true);
    try {
      const customer = await verifyOtp(customerId, otp);
      onVerified(customer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The OTP is incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
      <p className="mb-1 flex items-center gap-2 font-semibold text-[var(--ink)]">
        <ShieldCheck size={17} className="text-[var(--blue-500)]" /> Verify Mobile Number
      </p>
      <p className="mb-4 text-xs text-[var(--ink-soft)]">
        Phone number verification is required to place your order. If you are using a new number, an account will be created automatically.
      </p>

      {error && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
          {error}
        </div>
      )}

      {!customerId ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex h-12 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
            <Phone size={16} className="text-[var(--ink-soft)]" />

            <input
              required
              type="tel"
              inputMode="numeric"
              autoFocus
              value={mobile}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                setMobile(value);
              }}
              maxLength={10}
              placeholder="10-digit mobile number"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            className="flex items-center gap-2"
          >
            {loading ? "Sending…" : "Send OTP"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-xs text-[var(--ink-soft)]">
            {isNewUser ? "Creating a new account" : "Welcome back"} — An OTP has been sent to {mobile}.{" "}            <button type="button" onClick={() => setCustomerId(null)} className="font-semibold text-[var(--blue-600)]">
              Change Number
            </button>
          </p>
          {devOtp && (
            <p className="rounded-[var(--radius-sm)] bg-[var(--blue-50)] px-4 py-2 text-xs text-[var(--blue-600)]">
              Dev mode OTP: <span className="font-mono-nums font-bold">{devOtp}</span>
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-12 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
              <KeyRound size={16} className="text-[var(--ink-soft)]" />
              <input
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            >
              {loading ? "Verifying…" : "Verify"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
