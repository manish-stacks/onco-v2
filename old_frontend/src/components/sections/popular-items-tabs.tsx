"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import { categories } from "@/lib/data";
import type { Medicine } from "@/types";

export function PopularItemsTabs({
  medicines,
}: {
  medicines: Medicine[];
}) {
  const tabs = categories.slice(0, 6);
  const [active, setActive] = useState(tabs[0]?.id);

  const filtered = medicines
    .filter((m) => m.categoryId === active)
    .slice(0, 4);

  const shown = filtered.length ? filtered : medicines.slice(0, 4);

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
          href="/search"
          className="flex items-center gap-1 text-base font-semibold text-[#063b67] transition hover:text-[#0b5a97]"
        >
          All Products
          <ChevronsRight size={18} />
        </Link>
      </Reveal>

      {/* Category Tabs */}
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

      {/* Products */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((medicine) => (
          <ProductCard key={medicine.productId} medicine={medicine} />
        ))}
      </div>

      {/* Mobile Button */}
      <div className="mt-10 flex justify-center sm:hidden">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-full bg-[#063b67] px-6 py-3 text-sm font-semibold text-white"
        >
          View All Products
          <ChevronsRight size={16} />
        </Link>
      </div>
    </section>
  );
}