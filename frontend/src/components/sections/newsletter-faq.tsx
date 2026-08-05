"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="relative overflow-hidden rounded-lg bg-ink px-6 py-14 text-center sm:px-14">
        <div className="grain pointer-events-none absolute inset-0 opacity-20" />
        <Mail size={30} className="relative mx-auto mb-4 text-white" />
        <h2 className="relative font-display text-2xl font-bold text-white sm:text-3xl">Stay ahead of your health</h2>
        <p className="relative mx-auto mt-2 max-w-md text-white/85">
          Get medication reminders, exclusive offers and doctor-written health tips in your inbox.
        </p>
        {submitted ? (
          <p className="relative mx-auto mt-6 flex max-w-md items-center justify-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-medium text-white">
            <CheckCircle2 size={16} /> You&apos;re subscribed — welcome aboard!
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="relative mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              required
              type="email"
              placeholder="you@example.com"
              className="h-12 flex-1 rounded-full border-0 px-5 text-sm outline-none ring-2 text-white focus:ring-white"
            />
            <button className="h-12 shrink-0 rounded-full bg-blue-500 px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Subscribe
            </button>
          </form>
        )}
      </Reveal>
    </section>
  );
}
