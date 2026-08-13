"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import type { Medicine } from "@/types";

function getTimeLeft() {
  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, end.getTime() - now.getTime());
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

export function FlashSale({ medicines }: { medicines: Medicine[] }) {
  const [time, setTime] = useState<{ h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    setTime(getTimeLeft());
    const t = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <section id="offers" className="relative overflow-hidden bg-[var(--ink)] py-14 sm:py-16">
      {/* ambient glow accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[var(--blue-500)]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[var(--mint-500)]/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            
            <div>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Today&apos;s Flash Sale</h2>
              <p className="text-sm text-white/60">Deals refresh daily — grab them before midnight.</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {[["Hrs", time?.h], ["Min", time?.m], ["Sec", time?.s]].map(([label, val], i) => (
              <div key={label as string} className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex min-w-[56px] flex-col items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
                  <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-xl font-bold text-transparent tabular-nums sm:text-2xl">
                    {val === undefined ? "--" : pad(val as number)}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">{label}</span>
                </div>
                {i < 2 && <span className="pb-4 text-lg font-bold text-white">:</span>}
              </div>
            ))}
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {medicines.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-lg">
              <ProductCard medicine={m} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}