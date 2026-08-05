"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "@/components/ui/reveal";

const promos = [
  {
    tag: "SANITIZER",
    title: "Hand Sanitizer Collections",
    cta: "Shop Now",
    href: "/category/personal-care",
    bg: "from-[#FFF4E4] to-[#FFF9EF]",
    image: "/images/banner/mini-banner-1.webp"
  },
  {
    tag: "HOT SALE",
    title: "Face Wash Sale Collections",
    cta: "Discover Now",
    href: "/category/skin-care",
    bg: "from-[var(--blue-50)] to-[#F3F9FF]",
    image: "/images/banner/mini-banner-2.webp"
  },
  {
    tag: "FACIAL MASK",
    title: "Facial Mask Sale Up To 50% Off",
    cta: "Discover Now",
    href: "/category/health-essentials",
    bg: "from-[#FFEDF0] to-[#FFF6F7]",
    image: "/images/banner/mini-banner-3.webp"
  },
];

export function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {promos.map((p, i) => (
          <Reveal key={p.tag} delay={i * 0.05}>
            <Link
              href={p.href}
              className="group relative flex h-62 flex-col justify-center overflow-hidden rounded-sm px-7"
            >

              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{
                  backgroundImage: `url(${p.image})`,
                }}
              />

              {/* Content */}
              <div className="relative z-10">
                <span className="mb-3 inline-block w-fit rounded-full bg-blue-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  {p.tag}
                </span>

                <h3 className="max-w-[65%] font-display text-xl font-bold leading-snug text-ink">
                  {p.title}
                </h3>

                <span className="mt-3 inline-block w-fit border-b-2 border-ink pb-0.5 text-xs font-bold uppercase tracking-wide text-ink transition-colors group-hover:border-blue-500 group-hover:text-blue-600">
                  {p.cta}
                </span>
              </div>

              <motion.span
                className="pointer-events-none absolute -right-6 bottom-0 h-40 w-40 rounded-full bg-white/40 blur-2xl"
                aria-hidden
              />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
