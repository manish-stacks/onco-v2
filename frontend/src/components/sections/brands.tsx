"use client";

import Link from "next/link";
import Image from "next/image";
import { Building2, ChevronsRight } from "lucide-react";
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
          href="/brands"
          className="flex items-center gap-1 font-semibold text-[#063b67]"
        >
          All Brands
          <ChevronsRight size={18} />
        </Link>
      </Reveal>

      {/* Logos */}
      <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-6">
        {brands.slice(0, 6).map((brand, index) => (
          <Reveal key={brand.id} delay={index * 0.05}>
            <Link
              href={`/shop?brand_id=${brand.id}`}
              className="group flex h-full flex-col items-center justify-between rounded-2xl border border-[#e0e0e0] bg-white p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1e90ff] hover:shadow-lg"
            >
              <div className="flex h-20 w-full items-center justify-center">
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    width={150}
                    height={70}
                    unoptimized
                    className="max-h-20 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <Building2
                    size={32}
                    className="text-[var(--ink-soft)] transition-colors group-hover:text-[#1e90ff]"
                  />
                )}
              </div>

              {/* <div className="mt-3 w-full text-center"> */}
              {/* <p className="line-clamp-2 text-sm font-semibold text-[#063b67]">
                  {brand.name}
                </p> */}

              {/* {typeof brand.productCount === "number" &&
            brand.productCount > 0 && (
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                {brand.productCount} product
                {brand.productCount === 1 ? "" : "s"}
              </p>
            )} */}
              {/* </div> */}
            </Link>
          </Reveal>
        ))}
      </div>

    </section>
  );
}