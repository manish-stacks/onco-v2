"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, TrendingUp, History, X } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { catalogApi } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import { useCategories } from "@/hooks/use-categories";
import type { ApiProduct, Medicine } from "@/types";

const TRENDING = ["Dolo 650", "Shelcal 500", "Vitamin C", "Blood pressure monitor", "Glucometer"];

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const catSlug = params.get("category") ?? "";
  const [value, setValue] = useState(q);
  const [results, setResults] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const { categories } = useCategories();

  const activeCat = categories.find((c) => c.slug === catSlug) || null;
  // The category slug is in the URL but categories have not loaded yet — wait until they do
  const waitingForCat = !!catSlug && categories.length === 0;

  useEffect(() => {
    setValue(q);
    if (!q || waitingForCat) {
      if (!q) setResults([]);
      return;
    }
    let mounted = true;
    setLoading(true);
    catalogApi
      .products<ApiProduct[]>({
        search: q,
        limit: 40,
        ...(activeCat ? { category_id: activeCat.id } : {}),
      })
      .then((res) => {
        if (mounted) setResults((res?.data ?? []).map(productToMedicine));
      })
      .catch(() => {
        if (mounted) setResults([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [q, activeCat?.id, waitingForCat]);

  function go(term: string, category = catSlug) {
    const sp = new URLSearchParams({ q: term });
    if (category) sp.set("category", category);
    router.push(`/search?${sp.toString()}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="mb-4 flex h-14 items-center gap-3 rounded-full border border-[var(--line)] bg-white px-5 shadow-sm"
      >
        <SearchIcon size={18} className="text-[var(--ink-soft)]" />
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search medicines, brands, categories..."
          className="w-full bg-transparent text-base outline-none"
        />
      </form>

      {/* Category filter chips */}
      {(activeCat || categories.length > 0) && q && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--ink-soft)]">Category:</span>
          {activeCat ? (
            <button
              onClick={() => go(q, "")}
              className="flex items-center gap-1.5 rounded-full bg-[var(--blue-50)] px-3 py-1.5 text-xs font-semibold text-[var(--blue-600)]"
            >
              {activeCat.name} <X size={12} />
            </button>
          ) : (
            <>
              <span className="rounded-full bg-[var(--blue-50)] px-3 py-1.5 text-xs font-semibold text-[var(--blue-600)]">All</span>
              {categories.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(q, c.slug)}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-600)]"
                >
                  {c.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {!q ? (
        <div className="space-y-10">
          <div>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <TrendingUp size={16} className="text-[var(--coral-500)]" /> Trending Searches
            </p>
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button key={t} onClick={() => { setValue(t); go(t); }} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm hover:border-[var(--blue-500)] hover:text-[var(--blue-600)]">
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <History size={16} className="text-[var(--blue-500)]" /> Popular Categories
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((c) => (
                <Link key={c.id} href={`/products/${c.slug}`} className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 text-sm font-medium hover:border-[var(--blue-500)]">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--ink-soft)]">
            {loading || waitingForCat ? "Searching..." : (
              <>
                {results.length} results for <span className="font-semibold text-[var(--ink)]">&ldquo;{q}&rdquo;</span>
                {activeCat && <> in <span className="font-semibold text-[var(--ink)]">{activeCat.name}</span></>}
              </>
            )}
          </p>
          {!loading && !waitingForCat && results.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] py-20 text-center text-[var(--ink-soft)]">
              No medicines found. Try a different search term{activeCat ? " or remove the category filter" : ""}.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {results.map((m) => (
                <ProductCard key={m.id} medicine={m} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
