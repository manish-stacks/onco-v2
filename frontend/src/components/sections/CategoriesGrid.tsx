// components/sections/CategoriesGrid.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search, Package, X, LayoutGrid, ShieldCheck, Truck, RotateCcw,
  Headphones, FileText, Upload, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { CategoryTag } from "@/types";

const PAGE_SIZE = 15;

const TRUST_ITEMS = [
  { icon: ShieldCheck, title: "100% Genuine", sub: "Authentic medicines you can trust" },
  { icon: Truck, title: "Fast Delivery", sub: "24–48 hr delivery at your doorstep" },
  { icon: RotateCcw, title: "Easy Returns", sub: "Hassle free returns within 7 days" },
  { icon: Headphones, title: "Customer Support", sub: "We're here to help you 24x7" },
];

// soft rotating palette for fallback icon tiles
const TILE_COLORS = [
  { bg: "bg-blue-50", fg: "text-blue-500" },
  { bg: "bg-rose-50", fg: "text-rose-500" },
  { bg: "bg-amber-50", fg: "text-amber-500" },
  { bg: "bg-emerald-50", fg: "text-emerald-500" },
  { bg: "bg-violet-50", fg: "text-violet-500" },
  { bg: "bg-cyan-50", fg: "text-cyan-500" },
];

export function CategoriesGrid({ categories }: { categories: CategoryTag[] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null); // sidebar quick-filter (slug)
  const [page, setPage] = useState(1);
  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = categories;
    if (active) list = list.filter((c) => c.slug === active);
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    return list;
  }, [categories, query, active]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [query, active]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  function handleSidebarClick(slug: string) {
    setActive((prev) => (prev === slug ? null : slug));
  }

  const pageNumbers = useMemo(() => {
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div>
      {/* search */}
      <div className="mx-auto mb-6 max-w-md">
        <div className="flex h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 shadow-sm sm:h-12">
          <Search size={16} className="shrink-0 text-[var(--ink-soft)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="w-full bg-transparent text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="shrink-0">
              <X size={15} className="text-[var(--ink-soft)]" />
            </button>
          )}
        </div>
      </div>

      {/* trust strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--blue-50)]/40 p-4 sm:mb-8 sm:grid-cols-4 sm:gap-4 sm:p-5">
        {TRUST_ITEMS.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--blue-500)] shadow-sm">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight text-[var(--ink)] sm:text-sm">{title}</p>
              <p className="hidden text-[11px] leading-tight text-[var(--ink-soft)] sm:block">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* mobile quick-filter chips */}
      {categories.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <button
            onClick={() => setActive(null)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${!active
                ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white"
                : "border-[var(--line)] bg-white text-[var(--ink-soft)]"
              }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSidebarClick(c.slug)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${active === c.slug
                  ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)]"
                }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* desktop sidebar */}
        <aside className="hidden shrink-0 lg:block lg:w-64">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Browse Categories</p>
              <button
                onClick={() => setActive(null)}
                className={`mb-1 flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${!active ? "bg-[var(--blue-50)] font-semibold text-[var(--blue-600)]" : "text-[var(--ink-soft)] hover:bg-[var(--blue-50)]/60"
                  }`}
              >
                <span className="flex items-center gap-2"><LayoutGrid size={14} /> All Categories</span>
                <span className="text-xs">{categories.length}</span>
              </button>
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSidebarClick(c.slug)}
                    className={`flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors ${active === c.slug
                        ? "bg-[var(--blue-50)] font-semibold text-[var(--blue-600)]"
                        : "text-[var(--ink-soft)] hover:bg-[var(--blue-50)]/60"
                      }`}
                  >
                    <span className="line-clamp-1">{c.name}</span>
                    {c.productCount ? <span className="ml-2 shrink-0 text-xs">{c.productCount}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--blue-50)]/50 p-4">
              <FileText size={18} className="mb-2 text-[var(--blue-500)]" />
              <p className="text-sm font-semibold text-[var(--ink)]">Prescription Required?</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">Upload your prescription and we&apos;ll take care of the rest.</p>
              <Link
                href="/upload-prescription"
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-white text-xs font-semibold text-[var(--blue-600)] shadow-sm hover:bg-[var(--blue-50)]"
              >
                <Upload size={13} /> Upload Prescription
              </Link>
            </div>
          </div>
        </aside>

        {/* main content */}
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--line)] py-20 text-center">
              <LayoutGrid size={24} className="text-[var(--ink-soft)]" />
              <p className="text-sm text-[var(--ink-soft)]">
                No categories match {query ? `"${query}"` : "this filter"}.
              </p>
            </div>
          ) : (
            <>
              
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-5">
                {paged.map((c, i) => {
                  const tile = TILE_COLORS[i % TILE_COLORS.length];

                  return (
                    <Link
                      key={c.id}
                      ref={(el) => {
                        cardRefs.current[c.slug] = el;
                      }}
                      href={`/products/${c.slug}`}
                      className="
                        group relative overflow-hidden rounded-[22px]
                        border border-slate-200/80 bg-white
                        shadow-[0_8px_30px_rgba(15,23,42,0.05)]
                        transition-all duration-300
                        hover:-translate-y-1.5
                        hover:border-[var(--blue-500)]/30
                        hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)]
                      "
                    >
                      {/* IMAGE AREA */}
                      <div
                        className={`
            relative aspect-[1/0.95] overflow-hidden
            ${tile.bg}
          `}
                      >
                        {/* subtle decorative circle */}
                        <div className="pointer-events-none absolute -right-8 -top-8 z-[1] h-24 w-24 rounded-full bg-white/40 blur-xl" />

                        {c.image ? (
                          <Image
                            src={c.image}
                            alt={c.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="
                object-cover
                transition-transform duration-500 ease-out
                group-hover:scale-[1.07]
              "
                          />
                        ) : (
                          <div
                            className={`flex h-full w-full items-center justify-center ${tile.fg}`}
                          >
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 shadow-sm backdrop-blur-sm">
                              <Package size={30} />
                            </div>
                          </div>
                        )}

                        {/* Gradient Overlay */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                        {/* product badge */}
                        {c.productCount ? (
                          <span
                            className="
                              absolute left-3 top-3 z-10
                              rounded-full border border-white/60
                              bg-white/90 px-2.5 py-1
                              text-[10px] font-semibold text-slate-700
                              shadow-sm backdrop-blur-md
                            "
                          >
                            {c.productCount} medicines
                          </span>
                        ) : null}
                      </div>

                      {/* CONTENT */}
                      <div className="relative p-3.5 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="
                              line-clamp-1
                              font-display text-sm font-bold text-[var(--ink)]
                              transition-colors duration-300
                              group-hover:text-[var(--blue-600)]
                              sm:text-[15px]
                            "
                            >
                              {c.name}
                            </p>

                           
                          </div>

                          {/* arrow */}
                          <span
                            className="
                            flex h-8 w-8 shrink-0 items-center justify-center
                            rounded-full bg-[var(--blue-50)]
                            text-[var(--blue-600)]
                            transition-all duration-300
                            group-hover:bg-[var(--blue-600)]
                            group-hover:text-white
                          "
                          >
                            <ChevronRight
                              size={15}
                              className="transition-transform duration-300 group-hover:translate-x-0.5"
                            />
                          </span>
                        </div>

                        {/* bottom hover line */}
                        <span
                          className="
                              absolute bottom-0 left-0 h-[3px] w-0
                              bg-[var(--blue-500)]
                              transition-all duration-500
                              group-hover:w-full
                            "
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
              


              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${n === page
                          ? "bg-[var(--blue-500)] text-white"
                          : "border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--blue-50)]"
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* mobile prescription banner */}
          <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--blue-50)]/50 p-4 lg:hidden">
            <FileText size={20} className="shrink-0 text-[var(--blue-500)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--ink)]">Prescription Required?</p>
              <p className="text-xs text-[var(--ink-soft)]">Upload it, we&apos;ll handle the rest.</p>
            </div>
            <Link
              href="/upload-prescription"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-[var(--blue-600)] shadow-sm"
            >
              <Upload size={13} /> Upload
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}