"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import type { Medicine } from "@/types";

function statusBadge(m: Medicine): { label: string; className: string } | null {
  const inStock = m.stock === "In Stock" && (m.stock_quantity ?? 0) > 0;
  if (!inStock) return { label: "OUT OF STOCK", className: "bg-[var(--coral-500)] text-white" };

  const discountPercent =
    m.product_mrp > 0 ? Math.round(((m.product_mrp - m.product_sp) / m.product_mrp) * 100) : 0;
  if (discountPercent > 0) return { label: `${discountPercent}% OFF`, className: "bg-[var(--amber-500)] text-white" };

  if (m.is_featured === "1") return { label: "FEATURED", className: "bg-[var(--blue-500)] text-white" };
  if (m.latest_product === "1") return { label: "NEW", className: "bg-[var(--mint-500)] text-white" };

  return null;
}

export function ProductCard({ medicine }: { medicine: Medicine }) {
  const { addToCart } = useStore();
  const badge = statusBadge(medicine);
  const inStock = medicine.stock === "In Stock" && (medicine.stock_quantity ?? 0) > 0;

  const images = [
    medicine.image_1,
    medicine.image_2,
    medicine.image_3,
    medicine.image_4,
    medicine.image_5,
  ].filter((img): img is string => !!img && img.trim() !== "");

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  const go = (newIndex: number, dir: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDirection(dir);
    setIndex((newIndex + images.length) % images.length);
  };

  useEffect(() => {
    if (images.length <= 1 || !isHovering) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((indexRef.current + 1) % images.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [isHovering, images.length]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      onHoverStart={() => setIsHovering(true)}
      onHoverEnd={() => setIsHovering(false)}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)]/60 bg-[var(--blue-50)]/60 p-4 transition-shadow hover:shadow-[0_20px_45px_-20px_rgba(11,33,48,0.25)]"
    >
      <Link href={`/medicines/${medicine.slug}`} className="block">
        <div className="relative mb-4 aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-white">
          {images.length > 0 ? (
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={index}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <Image
                  src={images[index]}
                  alt={medicine.alt_text_1 || medicine.product_name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[var(--ink-soft)]">
              No image
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => go(index - 1, -1, e)}
                aria-label="Previous image"
                className="absolute left-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[var(--ink)] opacity-0 shadow transition-opacity group-hover:opacity-100"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={(e) => go(index + 1, 1, e)}
                aria-label="Next image"
                className="absolute right-1 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[var(--ink)] opacity-0 shadow transition-opacity group-hover:opacity-100"
              >
                <ChevronRight size={14} />
              </button>

              <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => go(i, i > index ? 1 : -1, e)}
                    aria-label={`Go to image ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-[var(--blue-500)]" : "w-1.5 bg-white/80"
                      }`}
                  />
                ))}
              </div>
            </>
          )}

          {badge && (
            <span
              className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${badge.className}`}
            >
              {badge.label}
            </span>
          )}

          {medicine.presciption_required === "Yes" && (
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--ink)] shadow">
              Rx
            </span>
          )}
        </div>

        <h3 className="mb-1 line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold text-[var(--ink)]">
          {medicine.product_name}
        </h3>
        {medicine.brand_name && (
          <p className="mb-1.5 line-clamp-1 text-xs text-[var(--ink-soft)]">{medicine.brand_name}</p>
        )}
      </Link>

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-baseline gap-2 font-mono-nums">
          <span className="text-base font-bold text-[var(--coral-500)]">{formatINR(medicine.product_sp)}</span>
          {medicine.product_mrp > medicine.product_sp && (
            <span className="text-xs text-[var(--ink-soft)] line-through">{formatINR(medicine.product_mrp)}</span>
          )}
        </div>
        <button
          onClick={() => addToCart(medicine.product_id, 1)}
          disabled={!inStock}
          aria-label="Add to cart"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue-500)] text-white transition-colors hover:bg-[var(--blue-600)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingBag size={16} />
        </button>
      </div>
    </motion.div>
  );
}