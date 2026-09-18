"use client";

import { useState } from "react";
import {
  Mail,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  BellRing,
} from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { contentApi, ApiError } from "@/lib/api";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSending(true);

    try {
      await contentApi.subscribe(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not subscribe. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-[#071C35] px-6 py-8 shadow-[0_25px_80px_rgba(5,31,62,0.18)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
            
            {/* Decorative background */}
            <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-[46%] opacity-[0.04] lg:block">
              <div className="absolute right-10 top-10 h-52 w-52 rounded-full border-[35px] border-white" />
              <div className="absolute bottom-6 right-48 h-28 w-28 rounded-full border-[22px] border-white" />
            </div>

            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
              
              {/* LEFT CONTENT */}
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  <Sparkles className="h-4 w-4 text-blue-300" />

                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
                    Health updates, made simple
                  </span>
                </div>

                <h2 className="max-w-xl font-display text-3xl font-bold leading-[1.15] text-white sm:text-4xl lg:text-[44px]">
                  Better health information,
                  <span className="block text-blue-300">
                    delivered to your inbox.
                  </span>
                </h2>

                <p className="mt-5 max-w-xl text-sm leading-7 text-white/65 sm:text-[15px]">
                  Get useful medication reminders, doctor-reviewed health
                  insights, refill updates and exclusive OncoHealthMart offers.
                </p>

                {/* Benefits */}
                <div className="mt-7 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2.5 text-xs font-medium text-white/80">
                    <BellRing className="h-4 w-4 text-blue-300" />
                    Medicine reminders
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2.5 text-xs font-medium text-white/80">
                    <ShieldCheck className="h-4 w-4 text-blue-300" />
                    Trusted health tips
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2.5 text-xs font-medium text-white/80">
                    <Mail className="h-4 w-4 text-blue-300" />
                    Exclusive updates
                  </div>
                </div>
              </div>

              {/* RIGHT SUBSCRIBE CARD */}
              <div className="rounded-[24px] border border-white/15 bg-white/[0.08] p-5 backdrop-blur-xl sm:p-7">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                    <Mail className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Join our newsletter
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-white/55">
                      Helpful updates. No unnecessary emails.
                    </p>
                  </div>
                </div>

                {submitted ? (
                  <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-6 text-center">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/15">
                      <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                    </div>

                    <p className="font-semibold text-white">
                      You're subscribed!
                    </p>

                    <p className="mt-1 text-xs text-white/60">
                      Welcome to OncoHealthMart updates.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <label className="mb-2 block text-xs font-semibold text-white/70">
                      Email address
                    </label>

                    <div className="rounded-2xl bg-white p-1.5 shadow-lg">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="h-12 w-full rounded-xl border-0 bg-transparent pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={sending}
                          className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition-all duration-300 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}

                          {sending ? "Subscribing..." : "Subscribe"}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="mt-3 text-xs font-medium text-red-300">
                        {error}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />

                      <p className="text-[11px] leading-5 text-white/45">
                        Your email is safe with us. Unsubscribe anytime.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}