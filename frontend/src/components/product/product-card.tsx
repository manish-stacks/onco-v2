"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, ShieldCheck } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import type { Medicine } from "@/types";

export function ProductCard({ medicine }: { medicine: Medicine }) {
  const { addToCart, wishlistIds, toggleWishlist } = useStore();
  const isWished = wishlistIds.includes(medicine.id);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-[0_20px_45px_-20px_rgba(11,33,48,0.25)]"
    >
      {medicine.discountPercent > 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-blue-500 px-3 py-1 text-[11px] font-bold text-white">
          {medicine.discountPercent}% OFF
        </span>
      )}

      <button
        onClick={() => toggleWishlist(medicine.id)}
        aria-label="Toggle wishlist"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-coral-50"
      >
        <Heart
          size={15}
          className={isWished ? "fill-coral-500 text-coral-500" : "text-ink-soft"}
        />
      </button>

      <Link href={`/product-details/${medicine.id}/${medicine.slug}`} className="block">
        <div className="relative mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-blue-50/40">
          <Image
            src={medicine.image}
            alt={medicine.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <h3 className="mb-1 line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold text-ink">
          {medicine.name}
        </h3>
        {medicine.packSize && (
          <p className="mb-2 text-xs text-ink-soft">{medicine.packSize}</p>
        )}
        {medicine.prescriptionRequired && (
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-green-500">
            <ShieldCheck size={13} /> Prescription Required
          </p>
        )}
      </Link>

      <div className="mt-auto flex items-center justify-between pt-1">
        <div className="flex items-baseline gap-2 font-mono-nums">
          <span className="text-lg font-bold text-ink">{formatINR(medicine.price)}</span>
          {medicine.mrp > medicine.price && (
            <span className="text-xs text-ink-soft line-through">{formatINR(medicine.mrp)}</span>
          )}
        </div>
        <button
          onClick={() => addToCart(medicine)}
          disabled={!medicine.inStock}
          aria-label="Add to cart"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart size={16} />
        </button>
      </div>

      {!medicine.inStock && (
        <span className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 bg-ink/70 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-white">
          Out of Stock
        </span>
      )}
    </motion.div>
  );
}