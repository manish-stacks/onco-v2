"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronsRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import type { BrandTag } from "@/types";

export function Brands({ brands }: { brands: BrandTag[] }) {
  if (!brands.length) return null;

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8">
      {/* Heading */}
      <Reveal className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#063b67]">
            Popular Brands
          </h2>
          <div className="mt-3 h-1 w-12 rounded-full bg-[#1e90ff]" />
        </div>

        <Link
          href="/shop"
          className="flex items-center gap-1 font-semibold text-[#063b67]"
        >
          All Brands
          <ChevronsRight size={18} />
        </Link>
      </Reveal>

      {/* Logos */}
      <div className="grid grid-cols-2 items-center gap-8 sm:grid-cols-3 lg:grid-cols-6">
        {brands.slice(0, 6).map((brand, index) => (
          <Reveal key={brand.id} delay={index * 0.05}>
            <Link
              href={`/shop?brand_id=${brand.id}`}
              className="flex h-24 items-center justify-center rounded-2xl border border-[#e0e0e0] bg-white p-4 transition hover:scale-105 hover:shadow-lg"
            >
              <Image
                src={brand.logo}
                alt={brand.name}
                width={150}
                height={70}
                unoptimized
                className="h-14 w-auto object-contain transition duration-300 hover:scale-110"
              />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}