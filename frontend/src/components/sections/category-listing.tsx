"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutGrid, List, SlidersHorizontal, ShoppingCart, FileWarning, X,
  ChevronRight, Package,
} from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { stripInlineFormatting, htmlTextLength } from "@/lib/html";
import type { CategoryTag, BrandTag, Medicine } from "@/types";

const PAGE_SIZE = 8;
type SortKey = "popular" | "price-low" | "price-high" | "rating";

/**
 * Windowed page numbers instead of one button per page — a category can run
 * into 30-40+ pages here, and rendering all of them in one row was the thing
 * overflowing the page horizontally (which, in turn, was breaking the sticky
 * header). Always keeps first, last, current ±1, with "…" for the gaps.
 */
function getPageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push("…");
    result.push(p);
  });
  return result;
}

/**
 * Comes from the CMS rich-text editor — sometimes pasted from Word/Google Docs
 * content where every paragraph carries an inline `style="color:...;
 * font-family:..."` is attached. That clashes with our design
 * (coloured text, odd fonts). Only the structure (p/br/strong/ul/li) is kept
 * and strip presentation attributes — the content stays the same,
 * only our typography is applied.
 */

function CategoryDescription({ html, slug }: { html: string; slug: string }) {
  const clean = useMemo(() => stripInlineFormatting(html), [html]);
  const needsMore = useMemo(() => htmlTextLength(clean) > 220, [clean]);

  if (!clean) return null;

  return (
    <div>
      <div
        className={cn(
          "prose prose-sm max-w-2xl text-[var(--ink-soft)] [&_p]:mb-2 [&_a]:text-[var(--blue-600)] [&_strong]:text-[var(--ink)]",
          needsMore && "line-clamp-3"
        )}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {needsMore && (
        <Link
          href={`/products/${slug}/about`}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--blue-600)]"
        >
          Read more
          <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}

export function CategoryListing({
  category,
  medicines,
  brands: allBrands = [],
}: {
  category: CategoryTag;
  medicines: Medicine[];
  brands?: BrandTag[];
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<SortKey>("popular");
  const [page, setPage] = useState(1);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  // ₹1000 was a hardcoded cap that silently hid every medicine priced above
  // it — fine for a cheap category, but it was quietly filtering out most of
  // e.g. anti-cancer medicines (genuinely expensive) down to a handful.
  // Compute the real ceiling from this category's own data instead.
  const priceCeiling = useMemo(() => {
    const highest = medicines.reduce((max, m) => Math.max(max, m.price), 0);
    return Math.max(1000, Math.ceil(highest / 100) * 100);
  }, [medicines]);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);
  const [rxOnly, setRxOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // maxPrice needs to track the ceiling: it's still "no filter applied" by
  // default, it just has to widen (or narrow) when the category changes.
  useEffect(() => {
    setMaxPrice(priceCeiling);
  }, [priceCeiling]);

  // Some brand rows can repeat with the same id (e.g. a brand mapped to more
  // than one sub-category). Keeping duplicates around means several checkboxes
  // share one id, so ticking one silently ticks all of its duplicates too.
  // Deduping by id before render keeps exactly one checkbox per brand.
  const brandsInCategory = useMemo(() => {
    const seen = new Map<string, BrandTag>();
    allBrands.forEach((b) => {
      if (!seen.has(b.id) && medicines.some((m) => m.brandId === b.id)) seen.set(b.id, b);
    });
    return Array.from(seen.values());
  }, [allBrands, medicines]);

  const filtered = useMemo(() => {
    let list = medicines.filter((m) => m.price <= maxPrice);
    if (selectedBrands.length) list = list.filter((m) => selectedBrands.includes(m.brandId));
    if (rxOnly) list = list.filter((m) => m.prescriptionRequired);
    if (inStockOnly) list = list.filter((m) => m.inStock);

    switch (sort) {
      case "price-low":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list = [...list].sort((a, b) => b.rating - a.rating);
        break;
      default:
        list = [...list].sort((a, b) => b.reviewCount - a.reviewCount);
    }
    return list;
  }, [medicines, selectedBrands, maxPrice, rxOnly, inStockOnly, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleBrand(id: string) {
    setPage(1);
    setSelectedBrands((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Price up to</p>
        <input
          type="range"
          min={50}
          max={priceCeiling}
          step={10}
          value={maxPrice}
          onChange={(e) => {
            setPage(1);
            setMaxPrice(Number(e.target.value));
          }}
          className="w-full accent-[var(--blue-500)]"
        />
        <p className="mt-1 text-xs text-[var(--ink-soft)]">Up to {formatINR(maxPrice)}</p>
      </div>

      {brandsInCategory.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Brand</p>
          <div className="space-y-2">
            {brandsInCategory.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.id)}
                  onChange={() => toggleBrand(b.id)}
                  className="h-4 w-4 rounded accent-[var(--blue-500)]"
                />
                {b.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Availability</p>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setPage(1);
              setInStockOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded accent-[var(--blue-500)]"
          />
          In stock only
        </label>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Prescription</p>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={rxOnly}
            onChange={(e) => {
              setPage(1);
              setRxOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded accent-[var(--blue-500)]"
          />
          Prescription required only
        </label>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/" className="hover:text-[var(--blue-600)]">Home</Link>
        <ChevronRight size={12} />
        <Link href="/shop" className="hover:text-[var(--blue-600)]">Shop</Link>
        <ChevronRight size={12} />
        <span className="text-[var(--ink)]">{category.name}</span>
      </p>

      {/* Category hero banner */}
      <div className="mb-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px]">
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">{category.name}</h1>
              
            </div>
            {category.description && <CategoryDescription html={category.description} slug={category.slug} />}
          </div>

          {category.image && (
            <div className="relative h-40 sm:h-auto">
              <Image
                src={category.image}
                alt={category.name}
                fill
                sizes="220px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent sm:bg-gradient-to-l" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-5">{FiltersPanel}</div>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium lg:hidden"
            >
              <SlidersHorizontal size={15} /> Filters
            </button>
            <p className="text-sm text-[var(--ink-soft)]">{filtered.length} products</p>
            <div className="ml-auto flex items-center gap-3">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm outline-none"
              >
                <option value="popular">Sort: Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
              <div className="flex overflow-hidden rounded-full border border-[var(--line)]">
                <button
                  onClick={() => setView("grid")}
                  className={cn("flex h-9 w-9 items-center justify-center", view === "grid" && "bg-[var(--blue-50)] text-[var(--blue-600)]")}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={cn("flex h-9 w-9 items-center justify-center", view === "list" && "bg-[var(--blue-50)] text-[var(--blue-600)]")}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {paginated.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] py-20 text-center text-[var(--ink-soft)]">
              No medicines match these filters.
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {paginated.map((m) => (
                <ProductCard key={m.id} medicine={m} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {paginated.map((m) => (
                <ListRow key={m.id} medicine={m} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-3 text-sm font-medium text-[var(--ink-soft)] disabled:opacity-40"
              >
                Prev
              </button>
              {getPageWindow(page, totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-[var(--ink-soft)]">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                      page === p ? "bg-[var(--blue-500)] text-white" : "border border-[var(--line)] text-[var(--ink-soft)]"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-3 text-sm font-medium text-[var(--ink-soft)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 lg:hidden" onClick={() => setFiltersOpen(false)}>
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full w-80 overflow-y-auto bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="font-display text-lg font-bold">Filters</p>
              <button onClick={() => setFiltersOpen(false)}>
                <X size={20} />
              </button>
            </div>
            {FiltersPanel}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ListRow({ medicine }: { medicine: Medicine }) {
  const { addToCart } = useStore();
  return (
    <div className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
      <Link href={`/product-details/${medicine.id}/${medicine.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
        <Image src={medicine.image} alt={medicine.name} fill className="object-cover" />
      </Link>
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          {medicine.discountPercent > 0 && <Badge tone="coral">{medicine.discountPercent}% OFF</Badge>}
          {medicine.prescriptionRequired && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--amber-500)]">
              <FileWarning size={12} /> Rx required
            </span>
          )}
        </div>
        <Link href={`/product-details/${medicine.id}/${medicine.slug}`} className="font-semibold text-[var(--ink)] hover:underline">
          {medicine.name}
        </Link>
        <p className="mb-2 text-xs text-[var(--ink-soft)]">{medicine.manufacturer} · {medicine.packSize}</p>
        <Rating value={medicine.rating} count={medicine.reviewCount} />
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <div className="text-right font-mono-nums">
          <p className="font-bold text-[var(--ink)]">{formatINR(medicine.price)}</p>
          {medicine.mrp > medicine.price && <p className="text-xs text-[var(--ink-soft)] line-through">{formatINR(medicine.mrp)}</p>}
        </div>
        <button
          onClick={() => addToCart(medicine)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--blue-50)] px-4 py-2 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-500)] hover:text-white"
        >
          <ShoppingCart size={13} /> Add
        </button>
      </div>
    </div>
  );
}