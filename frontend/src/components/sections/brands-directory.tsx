"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Building2, PackageSearch } from "lucide-react";
import type { BrandTag } from "@/types";

/**
 * "All Brands" page — home page ke Popular Brands section me
 * This is what opens when "All Brands" is clicked.
 */
export function BrandsDirectory({ brands }: { brands: BrandTag[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? brands.filter((b) => b.name?.toLowerCase().includes(q)) : brands;
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [brands, query]);

  // A, B, C ... group — directory style listing
  const grouped = useMemo(() => {
    const map = new Map<string, BrandTag[]>();
    filtered.forEach((b) => {
      const letter = (b.name?.[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-4 text-xs text-[var(--ink-soft)]">
        <Link href="/" className="hover:text-[var(--blue-600)]">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--ink)]">All Brands</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#063b67] lg:text-4xl">All Brands</h1>
          <div className="mt-3 h-1 w-12 rounded-full bg-[#1e90ff]" />
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            {brands.length} trusted brand{brands.length === 1 ? "" : "s"} available
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands…"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--line)] pl-9 pr-4 text-sm outline-none focus:border-[var(--blue-500)]"
          />
        </div>
      </div>

      {brands.length === 0 ? (
        <EmptyBox
          title="No brands to show yet"
          note="Brands will appear here as soon as they are added."
        />
      ) : filtered.length === 0 ? (
        <EmptyBox
          title={`No brand matches “${query}”`}
          note="Try a shorter search term."
        />
      ) : (
        <div className="space-y-10">
          {grouped.map(([letter, list]) => (
            <section key={letter}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#063b67] text-sm font-bold text-white">
                  {letter}
                </span>
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>

              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((brand,index) => (
                  <Link
                    key={index}
                    href={`/shop?brand_id=${brand.id}`}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-[#e0e0e0] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#1e90ff] hover:shadow-lg"
                  >
                    <div className="flex h-20 w-full items-center justify-center">
                      {brand.logo ? (
                        <Image
                          src={brand.logo}
                          alt={brand.name}
                          width={150}
                          height={70}
                          unoptimized
                          className="h-14 w-auto object-contain"
                        />
                      ) : (
                        <Building2 size={32} className="text-[var(--ink-soft)]" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="line-clamp-2 text-sm font-semibold text-[#063b67]">{brand.name}</p>
                      {typeof brand.productCount === "number" && brand.productCount > 0 && (
                        <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                          {brand.productCount} product{brand.productCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyBox({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] px-6 py-20 text-center">
      <PackageSearch size={34} className="mb-3 text-[var(--ink-soft)]" />
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">{note}</p>
      <Link href="/shop" className="mt-5 rounded-full bg-[#063b67] px-6 py-2.5 text-sm font-semibold text-white">
        Browse all medicines
      </Link>
    </div>
  );
}
