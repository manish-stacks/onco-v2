"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import type { Medicine } from "@/types";

export function ProductRail({
  title,
  subtitle,
  medicines,
  href,
}: {
  title: string;
  subtitle?: string;
  medicines: Medicine[];
  href?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">{title}</h2>
          <span className="mt-2 block h-1 w-10 rounded-full bg-[var(--blue-500)]" />
          {subtitle && <p className="mt-2 text-[var(--ink-soft)]">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[var(--blue-600)] sm:flex">
            View More <ChevronsRight size={16} />
          </Link>
        )}
      </Reveal>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex snap-x gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {medicines.map((m) => (
            <div key={m.product_id} className="w-[220px] shrink-0 snap-start sm:w-[240px]">
              <ProductCard medicine={m} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 hidden h-9 w-9 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--blue-500)] text-white shadow-md hover:bg-[var(--blue-600)] lg:flex"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 hidden h-9 w-9 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--blue-500)] text-white shadow-md hover:bg-[var(--blue-600)] lg:flex"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
