"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart,
  ShoppingCart,
  FileWarning,
  ShieldCheck,
  Truck,
  RotateCcw,
  Minus,
  Plus,
  ZoomIn,
} from "lucide-react";
import { ProductRail } from "@/components/sections/product-rail";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import type { Medicine } from "@/types";

export function ProductDetail({
  medicine,
  related = [],
}: {
  medicine: Medicine;
  related?: Medicine[];
}) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const wishlisted = isWishlisted(medicine.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-6 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/">Home</Link> / <Link href={`/category/health-essentials`}>Medicines</Link> /{" "}
        <span className="text-[var(--ink)]">{medicine.name}</span>
      </p>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div
            className="group relative mb-4 aspect-square cursor-zoom-in overflow-hidden rounded-[var(--radius-lg)] bg-[var(--blue-50)]"
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
          >
            <motion.div
              animate={{ scale: zoom ? 1.35 : 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative h-full w-full"
            >
              <Image src={medicine.images[activeImage]} alt={medicine.name} fill className="object-cover" />
            </motion.div>
            <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--ink-soft)] opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn size={16} />
            </span>
            {medicine.discountPercent > 0 && (
              <Badge tone="coral" className="absolute left-4 top-4">
                {medicine.discountPercent}% OFF
              </Badge>
            )}
          </div>
          <div className="flex gap-3">
            {medicine.images.map((img, i) => (
              <button
                key={img}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2",
                  activeImage === i ? "border-[var(--blue-500)]" : "border-transparent"
                )}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          {medicine.manufacturer && <p className="mb-1 text-sm font-medium text-[var(--blue-600)]">{medicine.manufacturer}</p>}
          <h1 className="mb-3 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">{medicine.name}</h1>
          <div className="mb-4 flex items-center gap-3">
            <Rating value={medicine.rating} count={medicine.reviewCount} />
            {medicine.prescriptionRequired && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4DE] px-2.5 py-1 text-xs font-semibold text-[#B4790C]">
                <FileWarning size={12} /> Prescription Required
              </span>
            )}
          </div>

          <div className="mb-6 flex items-baseline gap-3 font-mono-nums">
            <span className="text-3xl font-bold text-[var(--ink)]">{formatINR(medicine.price)}</span>
            {medicine.mrp > medicine.price && (
              <>
                <span className="text-lg text-[var(--ink-soft)] line-through">{formatINR(medicine.mrp)}</span>
                <Badge tone="mint">Save {medicine.discountPercent}%</Badge>
              </>
            )}
          </div>

          <p className="mb-6 text-sm text-[var(--ink-soft)]">
            {medicine.packSize} · {medicine.inStock ? (
              <span className="font-medium text-[var(--mint-600)]">In Stock</span>
            ) : (
              <span className="font-medium text-[var(--coral-500)]">Out of Stock</span>
            )}
          </p>

          <div className="mb-6 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-[var(--line)]">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center">
                <Minus size={15} />
              </button>
              <span className="w-8 text-center text-sm font-semibold font-mono-nums">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center">
                <Plus size={15} />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              disabled={!medicine.inStock}
              icon={<ShoppingCart size={17} />}
              onClick={() => addToCart(medicine.id, qty)}
            >
              Add to Cart
            </Button>
            <button
              onClick={() => toggleWishlist(medicine.id)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--line)]"
            >
              <Heart size={19} className={wishlisted ? "fill-[var(--coral-500)] text-[var(--coral-500)]" : "text-[var(--ink-soft)]"} />
            </button>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
              <ShieldCheck size={17} className="mx-auto mb-1 text-[var(--blue-500)]" />
              <p className="text-[11px] text-[var(--ink-soft)]">100% Genuine</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
              <Truck size={17} className="mx-auto mb-1 text-[var(--mint-500)]" />
              <p className="text-[11px] text-[var(--ink-soft)]">24-48 hr Delivery</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
              <RotateCcw size={17} className="mx-auto mb-1 text-[var(--coral-500)]" />
              <p className="text-[11px] text-[var(--ink-soft)]">Easy Returns</p>
            </div>
          </div>

          <Tabs
            tabs={[
              {
                label: "Overview",
                content: (
                  <div className="space-y-4 text-sm leading-relaxed text-[var(--ink-soft)]">
                    <div>
                      <p className="mb-1 font-semibold text-[var(--ink)]">Composition</p>
                      <p>{medicine.composition}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-[var(--ink)]">Benefits</p>
                      <ul className="list-inside list-disc space-y-1">
                        {medicine.benefits.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-[var(--ink)]">Uses</p>
                      <ul className="list-inside list-disc space-y-1">
                        {medicine.uses.map((u) => (
                          <li key={u}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ),
              },
              {
                label: "Dosage & Safety",
                content: (
                  <div className="space-y-4 text-sm leading-relaxed text-[var(--ink-soft)]">
                    <div>
                      <p className="mb-1 font-semibold text-[var(--ink)]">Dosage</p>
                      <p>{medicine.dosage}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-[var(--ink)]">Side Effects</p>
                      <ul className="list-inside list-disc space-y-1">
                        {medicine.sideEffects.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-[var(--ink)]">Storage</p>
                      <p>{medicine.storage}</p>
                    </div>
                  </div>
                ),
              },
              {
                label: `Reviews (${medicine.reviewCount})`,
                content: (
                  <div className="space-y-4">
                    {medicine.reviews.map((r) => (
                      <div key={r.id} className="rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-semibold text-[var(--ink)]">{r.author}</p>
                          <p className="text-xs text-[var(--ink-soft)]">{r.date}</p>
                        </div>
                        <Rating value={r.rating} className="mb-2" />
                        <p className="text-sm text-[var(--ink-soft)]">{r.comment}</p>
                        {r.verified && <Badge tone="mint" className="mt-2">Verified Purchase</Badge>}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                label: "FAQs",
                content: (
                  <div className="space-y-4">
                    {medicine.faqs.map((f) => (
                      <div key={f.question}>
                        <p className="mb-1 text-sm font-semibold text-[var(--ink)]">{f.question}</p>
                        <p className="text-sm text-[var(--ink-soft)]">{f.answer}</p>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      {related.length > 0 && <ProductRail title="Related Products" medicines={related} />}
    </div>
  );
}
