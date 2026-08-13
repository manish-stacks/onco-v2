"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { LayoutGrid, List, SlidersHorizontal, ShoppingCart, FileWarning, X } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import type { CategoryTag, BrandTag, Medicine } from "@/types";

const PAGE_SIZE = 8;
type SortKey = "popular" | "price-low" | "price-high" | "rating";

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
  const [maxPrice, setMaxPrice] = useState(1000);
  const [rxOnly, setRxOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const brandsInCategory = allBrands.filter((b) => medicines.some((m) => m.brandId === b.id));

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
          max={1000}
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
      <div className="mb-8">
        <p className="text-xs font-medium text-[var(--ink-soft)]">
          <Link href="/">Home</Link> / <span className="text-[var(--ink)]">{category.name}</span>
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[var(--ink)]">{category.name}</h1>
        <p className="mt-2 max-w-xl text-[var(--ink-soft)]">{category.description}</p>
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
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                    page === i + 1 ? "bg-[var(--blue-500)] text-white" : "border border-[var(--line)] text-[var(--ink-soft)]"
                  )}
                >
                  {i + 1}
                </button>
              ))}
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
      <Link href={`/medicines/${medicine.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
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
        <Link href={`/medicines/${medicine.slug}`} className="font-semibold text-[var(--ink)] hover:underline">
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
          onClick={() => addToCart(medicine.id)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--blue-50)] px-4 py-2 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-500)] hover:text-white"
        >
          <ShoppingCart size={13} /> Add
        </button>
      </div>
    </div>
  );
}
