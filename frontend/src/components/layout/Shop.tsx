"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  SlidersHorizontal, ChevronDown, ChevronRight, ChevronLeft, X, PackageSearch, Loader2,
  ShieldCheck, Truck, RotateCcw, Headphones, FileWarning, UploadCloud, Layers, LayoutGrid,
} from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { catalogApi } from "@/lib/api";
import { productToMedicine, brandToTag } from "@/lib/adapters";
import { getHomeData } from "@/lib/home";
import { useCategories } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";
import type { ApiProduct, Medicine, BrandTag } from "@/types";

const SORT_OPTIONS = [
  { label: "Newest", sort_by: "product_id", sort_dir: "desc" },
  { label: "Price: Low to High", sort_by: "product_sp", sort_dir: "asc" },
  { label: "Price: High to Low", sort_by: "product_sp", sort_dir: "desc" },
  { label: "Best Selling", sort_by: "total_sold", sort_dir: "desc" },
  { label: "Name: A-Z", sort_by: "product_name", sort_dir: "asc" },
];

const PAGE_SIZE = 12;
const VISIBLE_CATEGORIES = 8;

const trustStrip = [
  { icon: ShieldCheck, title: "100% Genuine", desc: "Authentic Medicines" },
  { icon: Truck, title: "24-48 hr Delivery", desc: "Fast & Reliable" },
  { icon: RotateCcw, title: "Easy Returns", desc: "Hassle free returns" },
  { icon: Headphones, title: "Customer Support", desc: "We're here to help" },
];

/** Like MegaMenu — there is no real per-item icon data for categories, hence a rotating neutral pool */
const CATEGORY_ICONS = [Layers, LayoutGrid];

function ShopInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { categories } = useCategories();

  const categoryId = params.get("category_id") || "";
  const brandId = params.get("brand_id") || "";
  const minPrice = params.get("min_price") || "";
  const maxPrice = params.get("max_price") || "";
  const prescriptionOnly = params.get("prescription_required") === "Yes";
  const inStockOnly = params.get("in_stock") === "true";
  const sortIndex = Number(params.get("sort") || 0);
  const page = Number(params.get("page") || 1);

  const [products, setProducts] = useState<Medicine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brands, setBrands] = useState<BrandTag[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Brand list — the Shop page has no brands endpoint of its own, so the home feed
  // (already cached) is reused instead.
  useEffect(() => {
    getHomeData().then((home) => setBrands(home.brands.map(brandToTag))).catch(() => setBrands([]));
  }, []);

  // Local draft state for the price inputs (applied on "Apply" click, not on every keystroke)
  const [minDraft, setMinDraft] = useState(minPrice);
  const [maxDraft, setMaxDraft] = useState(maxPrice);
  useEffect(() => {
    setMinDraft(minPrice);
    setMaxDraft(maxPrice);
  }, [minPrice, maxPrice]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page"); // back to page 1 as soon as a filter changes
    router.push(`/shop?${next.toString()}`);
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const sort = SORT_OPTIONS[sortIndex] || SORT_OPTIONS[0];

    catalogApi
      .products<ApiProduct[]>({
        category_id: categoryId || undefined,
        brand_id: brandId || undefined,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        prescription_required: prescriptionOnly ? "Yes" : undefined,
        in_stock: inStockOnly ? true : undefined,
        sort_by: sort.sort_by,
        sort_dir: sort.sort_dir as "asc" | "desc",
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        if (!mounted) return;
        setProducts((res?.data ?? []).map(productToMedicine));
        setTotal(res?.pagination?.total ?? 0);
      })
      .catch(() => {
        if (mounted) {
          setProducts([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [categoryId, brandId, minPrice, maxPrice, prescriptionOnly, inStockOnly, sortIndex, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCategory = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);
  const activeBrand = useMemo(() => brands.find((b) => b.id === brandId), [brands, brandId]);

  const hasActiveFilters = !!(categoryId || brandId || minPrice || maxPrice || prescriptionOnly || inStockOnly);
  const visibleCategories = showAllCategories ? categories : categories.slice(0, VISIBLE_CATEGORIES);

  function clearFilters() {
    router.push("/shop");
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`/shop?${next.toString()}`);
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 sm:mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            {activeBrand ? activeBrand.name : activeCategory ? activeCategory.name : "Shop All Medicines"}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {loading ? "Loading…" : `${total} product${total === 1 ? "" : "s"} found`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium lg:hidden"
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-[var(--ink-soft)]">Sort by:</span>
            <div className="relative">
              <select
                value={sortIndex}
                onChange={(e) => setParam("sort", e.target.value)}
                className="h-10 appearance-none rounded-full border border-[var(--line)] bg-white pl-4 pr-9 text-sm font-medium outline-none"
              >
                {SORT_OPTIONS.map((s, i) => (
                  <option key={s.label} value={i}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only sort (full width, below header) */}
      <div className="relative mb-5 sm:hidden">
        <select
          value={sortIndex}
          onChange={(e) => setParam("sort", e.target.value)}
          className="h-11 w-full appearance-none rounded-full border border-[var(--line)] bg-white pl-4 pr-9 text-sm font-medium outline-none"
        >
          {SORT_OPTIONS.map((s, i) => (
            <option key={s.label} value={i}>Sort: {s.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
      </div>

      {/* Trust strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-[var(--line)]">
        {trustStrip.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-center gap-2.5 sm:px-4 sm:first:pl-0 sm:last:pr-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--ink)]">{title}</p>
              <p className="truncate text-[11px] text-[var(--ink-soft)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
        {/* Filters sidebar — desktop inline, mobile slide-over */}
        <FilterSidebar
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          categoryId={categoryId}
          brandId={brandId}
          categories={categories}
          visibleCategories={visibleCategories}
          showAllCategories={showAllCategories}
          setShowAllCategories={setShowAllCategories}
          brands={brands}
          minDraft={minDraft}
          maxDraft={maxDraft}
          setMinDraft={setMinDraft}
          setMaxDraft={setMaxDraft}
          prescriptionOnly={prescriptionOnly}
          inStockOnly={inStockOnly}
          hasActiveFilters={hasActiveFilters}
          setParam={setParam}
          clearFilters={clearFilters}
        />

        {/* Product grid */}
        <div>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4.2] animate-pulse rounded-2xl bg-black/[0.04]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-white py-24 text-center">
              <PackageSearch size={32} className="mb-3 text-[var(--ink-soft)]" />
              <p className="mb-4 text-[var(--ink-soft)]">No products match these filters.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-sm font-semibold text-[var(--blue-600)]">Clear filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {products.map((m) => (
                  <ProductCard key={m.id} medicine={m} />
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10 sm:flex-row sm:justify-between">
                <p className="text-xs text-[var(--ink-soft)] sm:text-sm">
                  Showing {rangeStart}–{rangeEnd} of {total} products
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => goToPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={15} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, i, arr) => (
                        <span key={p} className="flex items-center gap-1.5">
                          {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-[var(--ink-soft)]">…</span>}
                          <button
                            onClick={() => goToPage(p)}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                              p === page ? "bg-[var(--blue-500)] text-white" : "border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--blue-500)]"
                            )}
                          >
                            {p}
                          </button>
                        </span>
                      ))}

                    <button
                      onClick={() => goToPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterSidebarProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  brandId: string;
  categories: { id: string; name: string; productCount?: number }[];
  visibleCategories: { id: string; name: string; productCount?: number }[];
  showAllCategories: boolean;
  setShowAllCategories: (v: boolean) => void;
  brands: BrandTag[];
  minDraft: string;
  maxDraft: string;
  setMinDraft: (v: string) => void;
  setMaxDraft: (v: string) => void;
  prescriptionOnly: boolean;
  inStockOnly: boolean;
  hasActiveFilters: boolean;
  setParam: (key: string, value: string | null) => void;
  clearFilters: () => void;
}

function FilterSidebar({
  open, onClose, categoryId, brandId, categories, visibleCategories, showAllCategories,
  setShowAllCategories, brands, minDraft, maxDraft, setMinDraft, setMaxDraft,
  prescriptionOnly, inStockOnly, hasActiveFilters, setParam, clearFilters,
}: FilterSidebarProps) {
  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount ?? 0), 0);

  const content = (
    <div className="space-y-5">
      {/* Categories */}
      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Categories</p>
        <div className="space-y-1">
          <button
            onClick={() => setParam("category_id", null)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
              !categoryId ? "bg-[var(--blue-50)] font-semibold text-[var(--blue-600)]" : "text-[var(--ink-soft)] hover:bg-black/5"
            )}
          >
            <span className="flex items-center gap-2">
              <LayoutGrid size={14} className={!categoryId ? "text-[var(--blue-500)]" : "text-[var(--ink-soft)]"} />
              All Categories
            </span>
            <span className="text-xs tabular-nums">({totalProducts})</span>
          </button>
          {visibleCategories.map((c, i) => {
            const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
            const isActive = categoryId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setParam("category_id", c.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-[var(--blue-50)] font-semibold text-[var(--blue-600)]" : "text-[var(--ink-soft)] hover:bg-black/5"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon size={14} className={cn("shrink-0", isActive ? "text-[var(--blue-500)]" : "text-[var(--ink-soft)]")} />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums">({c.productCount ?? 0})</span>
              </button>
            );
          })}
        </div>
        {categories.length > VISIBLE_CATEGORIES && (
          <button
            onClick={() => setShowAllCategories(!showAllCategories)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-[var(--blue-600)] hover:bg-black/5"
          >
            {showAllCategories ? "Show Less" : "View More"}
            <ChevronDown size={13} className={cn("transition-transform", showAllCategories && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Brands */}
      {brands.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Brands</p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            <button
              onClick={() => setParam("brand_id", null)}
              className={cn(
                "block w-full rounded-lg px-3 py-2 text-left text-sm",
                !brandId ? "bg-[var(--blue-50)] font-semibold text-[var(--blue-600)]" : "text-[var(--ink-soft)] hover:bg-black/5"
              )}
            >
              All Brands
            </button>
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setParam("brand_id", b.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                  brandId === b.id ? "bg-[var(--blue-50)] font-semibold text-[var(--blue-600)]" : "text-[var(--ink-soft)] hover:bg-black/5"
                )}
              >
                <span className="truncate">{b.name}</span>
                {!!b.productCount && <span className="shrink-0 text-xs tabular-nums">({b.productCount})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price range */}
      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Price Range</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--line)] px-3 text-sm outline-none"
          />
          <span className="text-[var(--ink-soft)]">–</span>
          <input
            type="number"
            placeholder="Max"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--line)] px-3 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => {
            setParam("min_price", minDraft || null);
            setParam("max_price", maxDraft || null);
          }}
          className="mt-2 w-full rounded-lg bg-[var(--ink)] py-2 text-xs font-semibold text-white"
        >
          Apply
        </button>
      </div>

      {/* Availability + prescription */}
      <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setParam("in_stock", e.target.checked ? "true" : null)}
            className="h-4 w-4 accent-[var(--blue-500)]"
          />
          In Stock only
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={prescriptionOnly}
            onChange={(e) => setParam("prescription_required", e.target.checked ? "Yes" : null)}
            className="h-4 w-4 accent-[var(--blue-500)]"
          />
          Prescription medicines only
        </label>
      </div>

      {hasActiveFilters && (
        <button onClick={clearFilters} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--coral-500)]/30 py-2.5 text-xs font-semibold text-[var(--coral-500)]">
          <X size={13} /> Clear all filters
        </button>
      )}

      {/* Prescription upload card */}
      <div className="rounded-[var(--radius-md)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 p-4">
        <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--blue-500)] shadow-sm">
          <FileWarning size={16} />
        </span>
        <p className="mb-1 text-sm font-semibold text-[var(--ink)]">Prescription Required?</p>
        <p className="mb-3 text-xs text-[var(--ink-soft)]">Upload your prescription and we&apos;ll take care of the rest.</p>
        <Link
          href="/prescription-upload"
          className="flex items-center justify-center gap-1.5 rounded-full border border-[var(--blue-200)] bg-white py-2.5 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-50)]"
        >
          <UploadCloud size={13} /> Upload Prescription
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop — inline sidebar */}
      <aside className="hidden lg:block">{content}</aside>

      {/* Mobile — slide-over drawer */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 lg:hidden" onClick={onClose}>
          <div
            className="ml-auto flex h-full w-[85vw] max-w-sm flex-col overflow-y-auto bg-[#F7F9FC] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-[var(--ink)]">Filters</p>
              <button onClick={onClose} aria-label="Close filters">
                <X size={20} />
              </button>
            </div>
            {content}
            <button
              onClick={onClose}
              className="sticky bottom-0 mt-4 w-full rounded-full bg-[var(--blue-500)] py-3 text-sm font-semibold text-white"
            >
              Show Results
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function Shop() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="animate-spin text-[var(--blue-500)]" /></div>}>
      <ShopInner />
    </Suspense>
  );
}

export default Shop;