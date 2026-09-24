"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import { catalogApi, mediaUrl } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import { useStore } from "@/hooks/use-store";
import { formatINR } from "@/lib/utils";
import type { ApiProduct, Category } from "@/types";

interface SearchApiResult {
  products?: ApiProduct[];
  categories?: Category[];
}

export function SearchSuggest({
  value,
  onChange,
  onSubmit,
  placeholder = "Search Here...",
  inputClassName,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (term: string) => void;
  placeholder?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { addToCart } = useStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = value.trim();
    if (term.length < 2) {
      setProducts([]);
      setCategories([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await catalogApi.search<SearchApiResult | ApiProduct[]>(term);
        if (Array.isArray(res)) {
          setProducts(res.slice(0, 10));
          setCategories([]);
        } else {
          setProducts((res?.products ?? []).slice(0, 10));
          setCategories((res?.categories ?? []).slice(0, 2));
        }
      } catch {
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const showDropdown = open && value.trim().length >= 2;

  function go(term: string) {
    setOpen(false);
    onSubmit(term);
  }

  return (
    // No `relative` here: the dropdown anchors to the nearest positioned
    // ancestor (the search bar wrapper) so it spans the full bar width.
    <div ref={boxRef} className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="flex h-full w-full items-center"
      >
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={inputClassName ?? "w-full bg-transparent px-4 text-sm outline-none placeholder:text-ink-soft"}
        />
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[999] max-h-[440px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white shadow-2xl">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[var(--ink-soft)]">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </div>
          )}

          {!loading && products.length === 0 && categories.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--ink-soft)]">
              No matches for &ldquo;{value}&rdquo;
            </div>
          )}

          {!loading &&
            categories.map((c) => (
              <button
                key={c.category_id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/products/${c.slug}`);
                }}
                className="flex w-full items-center justify-between border-b border-[var(--line)] px-4 py-3.5 text-left text-sm hover:bg-black/[0.03]"
              >
                <span className="text-[var(--ink)]">
                  <span className="font-semibold underline">{value.trim().toUpperCase()}</span> in{" "}
                  <span className="font-medium text-[#16a34a]">{c.category_name}</span>
                </span>
                <ArrowUpRight size={16} className="text-[var(--ink-soft)]" />
              </button>
            ))}

          {!loading &&
            products.map((p) => {
              const m = productToMedicine(p);
              return (
                <div
                  key={p.product_id}
                  role="link"
                  tabIndex={0}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/product-details/${p.product_id}/${p.slug}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setOpen(false);
                      router.push(`/product-details/${p.product_id}/${p.slug}`);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0 hover:bg-black/[0.03]"
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--blue-50)]">
                    <Image src={mediaUrl(p.image_1)} alt={p.product_name} fill className="object-contain" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-[var(--ink)]">{p.product_name}</p>
                    {m.packSize && <p className="line-clamp-1 text-xs uppercase text-[var(--ink-soft)]">{m.packSize}</p>}
                    {m.composition && <p className="line-clamp-1 text-xs uppercase text-[var(--ink-soft)]">{m.composition}</p>}
                  </div>

                  <div className="shrink-0 text-left font-mono-nums">
                    <p className="text-sm font-semibold text-[var(--ink)]">{formatINR(m.price)}</p>
                    {m.discountPercent > 0 && (
                      <>
                        <p className="text-xs font-medium text-[#16a34a]">({m.discountPercent}% Discount)</p>
                        <p className="text-xs font-medium text-[var(--ink-soft)] line-through">MRP {formatINR(m.mrp)}</p>
                      </>
                    )}
                  </div>

                  {m.prescriptionRequired && (
                    <span
                      title="Prescription required"
                      className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--blue-600)] text-[11px] font-bold text-white sm:flex"
                    >
                      ℞
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={!m.inStock}
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(m, 1);
                    }}
                    className="shrink-0 rounded-full bg-[var(--blue-600)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                  >
                    {m.inStock ? (
                      <>
                        <span className="hidden sm:inline">Add to cart</span>
                        <span className="sm:hidden">Add</span>
                      </>
                    ) : (
                      "Out of stock"
                    )}
                  </button>
                </div>
              );
            })}

          {!loading && products.length > 0 && (
            <button
              type="button"
              onClick={() => go(value)}
              className="flex w-full items-center justify-center gap-1 border-t border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--blue-600)] hover:bg-black/[0.03]"
            >
              See all results for &ldquo;{value.trim()}&rdquo; <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
