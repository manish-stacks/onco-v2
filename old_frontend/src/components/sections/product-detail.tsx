"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
} from "lucide-react";
import { ProductRail } from "@/components/sections/product-rail";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { InlineToast, type InlineToastState } from "@/components/ui/inline-toast";
import { cartApi, wishlistApi, catalogApi, mediaUrl, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatINR, cn } from "@/lib/utils";
import type { Medicine, ProductReview } from "@/types";

function splitLines(text?: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|,\s*(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProductDetail({ medicine }: { medicine: Medicine }) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const images = [
    medicine.image_1,
    medicine.image_2,
    medicine.image_3,
    medicine.image_4,
    medicine.image_5,
  ]
    .filter((img): img is string => !!img && img.trim() !== "")
    .map((img) => mediaUrl(img));

  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);

  const [wishlisted, setWishlisted] = useState(!!medicine.in_wishlist);
  const [wishBusy, setWishBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<InlineToastState | null>(null);

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    setWishlisted(!!medicine.in_wishlist);
  }, [medicine.in_wishlist, medicine.product_id]);

  useEffect(() => {
    let active = true;
    setReviewsLoading(true);
    catalogApi
      .productReviews<ProductReview[]>(medicine.product_id)
      .then((res) => {
        if (!active) return;
        setReviews(res?.data || []);
      })
      .catch(() => {
        if (active) setReviews([]);
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [medicine.product_id]);

  function notify(message: string, tone: "success" | "error" = "success") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2400);
  }

  const brandName = medicine.brand_name || medicine.company_name;
  const category = medicine.categories?.[0];
  const prescriptionRequired = medicine.presciption_required === "Yes";
  const inStock = medicine.stock
    ? medicine.stock === "In Stock" && (medicine.stock_quantity ?? 1) > 0
    : (medicine.stock_quantity ?? 0) > 0 || !!medicine.allow_backorder;

  const discountPercent =
    medicine.product_mrp > 0
      ? Math.round(((medicine.product_mrp - medicine.product_sp) / medicine.product_mrp) * 100)
      : 0;

  const rating = medicine.avg_rating ?? 0;
  const reviewCount = medicine.review_count ?? reviews.length;

  const benefits = splitLines(medicine.benifits);
  const keyFeatures = splitLines(medicine.key_features);
  const sideEffects = splitLines(medicine.side_effects);

  function goToLogin() {
    router.push(`/login?redirect=${encodeURIComponent(`/medicines/${medicine.slug}`)}`);
  }

  async function handleAddToCart() {
    if (!isLoggedIn) {
      notify("Please login to add items to your cart", "error");
      goToLogin();
      return;
    }
    if (!inStock || adding) return;
    setAdding(true);
    try {
      await cartApi.add(medicine.product_id, qty);
      notify("Added to cart");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not add to cart", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleWishlist() {
    if (!isLoggedIn) {
      notify("Please login to use your wishlist", "error");
      goToLogin();
      return;
    }
    if (wishBusy) return;
    setWishBusy(true);
    try {
      const res = await wishlistApi.toggle(medicine.product_id);
      const added = res?.added ?? !wishlisted;
      setWishlisted(added);
      notify(added ? "Added to wishlist" : "Removed from wishlist");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not update wishlist", "error");
    } finally {
      setWishBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-6 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/">Home</Link> /{" "}
        <Link href={category ? `/category/${category.slug}` : "/category/health-essentials"}>
          {category?.category_name || "Medicines"}
        </Link>{" "}
        / <span className="text-[var(--ink)]">{medicine.product_name}</span>
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
              {images.length > 0 ? (
                <Image
                  src={images[activeImage]}
                  alt={medicine.alt_text_1 || medicine.product_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-[var(--ink-soft)]">
                  No image available
                </div>
              )}
            </motion.div>
            <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--ink-soft)] opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn size={16} />
            </span>
            {discountPercent > 0 && (
              <Badge tone="coral" className="absolute left-4 top-4">
                {discountPercent}% OFF
              </Badge>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-3">
              {images.map((img, i) => (
                <button
                  key={img + i}
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
          )}
        </div>

        {/* Info */}
        <div>
          {brandName && <p className="mb-1 text-sm font-medium text-[var(--blue-600)]">{brandName}</p>}
          <h1 className="mb-3 font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            {medicine.product_name}
          </h1>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Rating value={rating} count={reviewCount} />
            {prescriptionRequired && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4DE] px-2.5 py-1 text-xs font-semibold text-[#B4790C]">
                <FileWarning size={12} /> Prescription Required
              </span>
            )}
          </div>

          <div className="mb-6 flex items-baseline gap-3 font-mono-nums">
            <span className="text-3xl font-bold text-[var(--ink)]">{formatINR(medicine.product_sp)}</span>
            {medicine.product_mrp > medicine.product_sp && (
              <>
                <span className="text-lg text-[var(--ink-soft)] line-through">{formatINR(medicine.product_mrp)}</span>
                <Badge tone="mint">Save {discountPercent}%</Badge>
              </>
            )}
          </div>

          <p className="mb-6 text-sm text-[var(--ink-soft)]">
            {medicine.weight_quantity && <>{medicine.weight_quantity} · </>}
            {inStock ? (
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
              disabled={!inStock || adding}
              icon={adding ? <Loader2 size={17} className="animate-spin" /> : <ShoppingCart size={17} />}
              onClick={handleAddToCart}
            >
              {adding ? "Adding..." : "Add to Cart"}
            </Button>
            <button
              onClick={handleToggleWishlist}
              disabled={wishBusy}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--line)] disabled:opacity-60"
            >
              <Heart
                size={19}
                className={wishlisted ? "fill-[var(--coral-500)] text-[var(--coral-500)]" : "text-[var(--ink-soft)]"}
              />
            </button>
          </div>

          {!isLoggedIn && (
            <p className="mb-6 -mt-3 text-xs text-[var(--ink-soft)]">
              <Link href={`/login?redirect=${encodeURIComponent(`/medicines/${medicine.slug}`)}`} className="font-semibold text-[var(--blue-600)] underline">
                Log in
              </Link>{" "}
              to add items to your cart or wishlist.
            </p>
          )}

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
                    {(medicine.long_description || medicine.about_product || medicine.short_description) && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Description</p>
                        <p>{medicine.long_description || medicine.about_product || medicine.short_description}</p>
                      </div>
                    )}
                    {medicine.salt && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Composition</p>
                        <p>{medicine.salt}</p>
                      </div>
                    )}
                    {keyFeatures.length > 0 && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Key Features</p>
                        <ul className="list-inside list-disc space-y-1">
                          {keyFeatures.map((k) => (
                            <li key={k}>{k}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {benefits.length > 0 && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Benefits</p>
                        <ul className="list-inside list-disc space-y-1">
                          {benefits.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                label: "Dosage & Safety",
                content: (
                  <div className="space-y-4 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {medicine.how_to_use && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">How to Use</p>
                        <p>{medicine.how_to_use}</p>
                      </div>
                    )}
                    {sideEffects.length > 0 && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Side Effects</p>
                        <ul className="list-inside list-disc space-y-1">
                          {sideEffects.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {medicine.caution && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Caution</p>
                        <p>{medicine.caution}</p>
                      </div>
                    )}
                    {medicine.storage && (
                      <div>
                        <p className="mb-1 font-semibold text-[var(--ink)]">Storage</p>
                        <p>{medicine.storage}</p>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                label: `Reviews (${reviewCount})`,
                content: (
                  <div className="space-y-4">
                    {reviewsLoading ? (
                      <p className="text-sm text-[var(--ink-soft)]">Loading reviews...</p>
                    ) : reviews.length === 0 ? (
                      <p className="text-sm text-[var(--ink-soft)]">No reviews yet.</p>
                    ) : (
                      reviews.map((r, i) => (
                        <div key={r.review_id ?? r.id ?? i} className="rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[var(--ink)]">{r.customer_name || r.author || "Anonymous"}</p>
                            <p className="text-xs text-[var(--ink-soft)]">{r.created_at || r.date}</p>
                          </div>
                          <Rating value={r.rating} className="mb-2" />
                          <p className="text-sm text-[var(--ink-soft)]">{r.review || r.comment}</p>
                          {r.verified && <Badge tone="mint" className="mt-2">Verified Purchase</Badge>}
                        </div>
                      ))
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      {medicine.related && medicine.related.length > 0 && (
        <ProductRail title="Related Products" medicines={medicine.related} />
      )}

      <InlineToast toast={toast} />
    </div>
  );
}
