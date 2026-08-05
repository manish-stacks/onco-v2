"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Rating } from "@/components/ui/rating";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import type { Medicine } from "@/types";

function statusBadge(m: Medicine): { label: string; className: string } | null {
  if (!m.inStock) return { label: "OUT OF STOCK", className: "bg-[var(--coral-500)] text-white" };
  if (m.discountPercent > 0) return { label: `${m.discountPercent}% OFF`, className: "bg-[var(--amber-500)] text-white" };
  if (m.rating >= 4.5) return { label: "HOT", className: "bg-[var(--blue-500)] text-white" };
  if (m.reviewCount < 60) return { label: "NEW", className: "bg-[var(--mint-500)] text-white" };
  return null;
}

export function ProductCard({ medicine }: { medicine: Medicine }) {
  const { addToCart } = useStore();
  const badge = statusBadge(medicine);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)]/60 bg-[var(--blue-50)]/60 p-4 transition-shadow hover:shadow-[0_20px_45px_-20px_rgba(11,33,48,0.25)]"
    >
      <Link href={`/medicines/${medicine.slug}`} className="block">
        <div className="relative mb-4 aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-white">
          <Image
            src={medicine.image}
            alt={medicine.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {badge && (
            <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        <h3 className="mb-1.5 line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold text-[var(--ink)]">
          {medicine.name}
        </h3>
        <Rating value={medicine.rating} className="mb-2" />
      </Link>

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-baseline gap-2 font-mono-nums">
          <span className="text-base font-bold text-[var(--coral-500)]">{formatINR(medicine.price)}</span>
          {medicine.mrp > medicine.price && (
            <span className="text-xs text-[var(--ink-soft)] line-through">{formatINR(medicine.mrp)}</span>
          )}
        </div>
        <button
          onClick={() => addToCart(medicine.id)}
          disabled={!medicine.inStock}
          aria-label="Add to cart"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue-500)] text-white transition-colors hover:bg-[var(--blue-600)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingBag size={16} />
        </button>
      </div>
    </motion.div>
  );
}
