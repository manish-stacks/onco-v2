"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronsRight, Loader2 } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import { catalogApi } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import type { Medicine, CategoryTag, ApiProduct } from "@/types";

export function PopularItemsTabs({
  medicines,
  categories,
}: {
  medicines: Medicine[];
  categories: CategoryTag[];
}) {
  const tabs = categories.slice(0, 6);
  const [active, setActive] = useState<string | undefined>(tabs[0]?.id);
  const [items, setItems] = useState<Medicine[]>(medicines.slice(0, 4));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    setLoading(true);
    catalogApi
      .products<ApiProduct[]>({ category_id: active, limit: 4 })
      .then((res) => {
        if (mounted) setItems((res?.data ?? []).map(productToMedicine));
      })
      .catch(() => {
        if (mounted) setItems([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [active]);

  const shown = loading ? [] : items.length ? items : medicines.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Heading */}
      <Reveal className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-[#063b67] lg:text-4xl">
            Popular Items
          </h2>

          <div className="mt-3 h-1 w-12 rounded-full bg-black" />
        </div>

        <Link
          href="/shop"
          className="flex items-center gap-1 text-base font-semibold text-[#063b67] transition hover:text-[#0b5a97]"
        >
          All Products
          <ChevronsRight size={18} />
        </Link>
      </Reveal>

      {/* Category Tabs */}
      {tabs.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 ${
                active === tab.id
                  ? "bg-[#063b67] text-white shadow-md"
                  : "bg-[#eef7ff] text-[#063b67] hover:bg-[#dceeff]"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      {loading ? (
        <div className="flex justify-center py-16 text-[#063b67]">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--ink-soft)]">No products found in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((medicine) => (
            <ProductCard key={medicine.id} medicine={medicine} />
          ))}
        </div>
      )}

      {/* Mobile Button */}
      <div className="mt-10 flex justify-center sm:hidden">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-[#063b67] px-6 py-3 text-sm font-semibold text-white"
        >
          View All Products
          <ChevronsRight size={16} />
        </Link>
      </div>
    </section>
  );
}