"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search as SearchIcon, ArrowUpRight, Loader2 } from "lucide-react";
import { catalogApi, mediaUrl } from "@/lib/api";
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
          setCategories((res?.categories ?? []).slice(0, 3));
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

  const nameSuggestions = Array.from(new Set(products.map((p) => p.product_name))).slice(0, 6);
  const showDropdown = open && value.trim().length >= 2;

  function go(term: string) {
    setOpen(false);
    onSubmit(term);
  }

  return (
    <div ref={boxRef} className="relative w-full">
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
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[999] max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white py-2 shadow-2xl">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[var(--ink-soft)]">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </div>
          )}

          {!loading && nameSuggestions.length === 0 && categories.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--ink-soft)]">
              No matches for &ldquo;{value}&rdquo;
            </div>
          )}

          {!loading &&
            nameSuggestions.map((name) => (
              <button
                key={name}
                onClick={() => go(name)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-black/[0.03]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)]">
                  <SearchIcon size={14} />
                </span>
                <span className="font-medium text-[var(--ink)]">{name}</span>
              </button>
            ))}

          {!loading &&
            categories.map((c) => (
              <button
                key={c.category_id}
                onClick={() => {
                  setOpen(false);
                  router.push(`/category/${c.slug}`);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-black/[0.03]"
              >
                <span className="text-[var(--ink)]">
                  <span className="font-semibold">{value}</span>
                  <span className="block text-xs text-[var(--ink-soft)]">Browse in {c.category_name}</span>
                </span>
                <ArrowUpRight size={16} className="text-[var(--ink-soft)]" />
              </button>
            ))}

          {!loading && products.length > 0 && (
            <div className="mt-1 border-t border-[var(--line)] pt-1">
              {products.slice(0, 5).map((p) => (
                <Link
                  key={p.product_id}
                  href={`/medicines/${p.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/[0.03]"
                >
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--blue-50)]">
                    <Image src={mediaUrl(p.image_1)} alt={p.product_name} fill className="object-cover" />
                  </span>
                  <span className="line-clamp-1 text-[var(--ink)]">{p.product_name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}