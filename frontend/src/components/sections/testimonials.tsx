"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Quote } from "lucide-react";
import { Rating } from "@/components/ui/rating";
import type { TestimonialTag } from "@/types";

const COLORS = ["#0B8AD1", "#C2410C", "#7C3AED", "#15803D", "#BE185D", "#B45309"];

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-label="Google">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function Testimonials({ testimonials }: { testimonials: TestimonialTag[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState(false);
  if (!testimonials.length) return null;

  const scroll = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  return (
    <section className="bg-[var(--paper)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Your Reviews Fuel Us!</h2>
            <p className="mt-1 text-sm text-[var(--ink)]">Hear from those whose lives have been positively impacted by Onco Health Mart&apos;s services.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => scroll(-1)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]"><ArrowLeft size={16} /></button>
            <button onClick={() => setAll((v) => !v)} className="rounded-full border border-[var(--line)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--blue-700)]">{all ? "Show less" : "View all"}</button>
            <button onClick={() => scroll(1)} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)]"><ArrowRight size={16} /></button>
          </div>
        </div>

        <div ref={rail} className={all ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-4" : "flex snap-x gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
          {testimonials.map((t, i) => (
            <div key={t.id} className={all ? "" : "w-[250px] shrink-0 snap-start"}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl text-white" style={{ background: COLORS[i % COLORS.length] }}>
                  {(t.name || "U").charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{t.name}</p>
                  <Rating value={t.rating} />
                </div>
              </div>
              <div className="flex min-h-[220px] flex-col rounded-2xl border border-[var(--line)] bg-[var(--blue-50)] p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <Quote size={30} className="fill-[var(--blue-500)]/20 text-[var(--blue-500)]/20" />
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow"><GoogleG /></span>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-[var(--ink)]">{t.quote}</p>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-soft)]"><BadgeCheck size={13} /> {t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
