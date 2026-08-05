"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { medicines } from "@/lib/data";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";

export default function WishlistPage() {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const items = medicines.filter((m) => wishlist.includes(m.id));

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFEDEA] text-[var(--coral-500)]">
          <Heart size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your wishlist is empty</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">Save medicines you care about here so you can order them later.</p>
        <Button href="/category/health-essentials">Browse Medicines</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Your Wishlist</h1>
      <div className="space-y-4">
        {items.map((m) => (
          <div key={m.id} className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 sm:flex-row sm:items-center">
            <Link href={`/medicines/${m.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
              <Image src={m.image} alt={m.name} fill className="object-cover" />
            </Link>
            <div className="flex-1">
              <Link href={`/medicines/${m.slug}`} className="font-semibold text-[var(--ink)] hover:underline">{m.name}</Link>
              <p className="mb-2 text-xs text-[var(--ink-soft)]">{m.manufacturer} · {m.packSize}</p>
              <Rating value={m.rating} count={m.reviewCount} />
            </div>
            <p className="font-mono-nums font-bold text-[var(--ink)]">{formatINR(m.price)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => addToCart(m.id)}
                className="flex items-center gap-1.5 rounded-full bg-[var(--blue-50)] px-4 py-2.5 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-500)] hover:text-white"
              >
                <ShoppingCart size={14} /> Move to Cart
              </button>
              <button
                onClick={() => toggleWishlist(m.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--coral-500)]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
