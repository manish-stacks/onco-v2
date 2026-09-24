"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart,
  Share2,
  ShoppingCart,
  Zap,
  FileWarning,
  ShieldCheck,
  Truck,
  RotateCcw,
  Minus,
  Plus,
  ZoomIn,
  ChevronRight,
  UploadCloud,
  FlaskConical,
  Stethoscope,
  Package,
  Star,
  Lock,
  MessageCircle,
  Snowflake,
  ChevronDown,
  MessageSquareText,
} from "lucide-react";
import { ProductRail } from "@/components/sections/product-rail";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProductReviews } from "@/components/sections/ProductReviews";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import type { Medicine } from "@/types";

const buyBoxTrust = [
  { icon: ShieldCheck, title: "100% Genuine", desc: "Authentic Medicines" },
  { icon: Truck, title: "24-48 hr Delivery", desc: "Depend on your delivery address" },
  { icon: RotateCcw, title: "Easy Returns", desc: "Hassle free returns" },
];

const pageTrust = [
  { icon: Lock, title: "Secure Payments", desc: "100% secure transactions" },
  { icon: ShieldCheck, title: "Genuine Medicines", desc: "Sourced from licensed pharmacies" },
  { icon: MessageCircle, title: "24/7 Customer Support", desc: "We're here to help you anytime" },
  { icon: Snowflake, title: "Cold Chain Delivery", desc: "Temperature controlled packaging" },
];

export function ProductDetail({
  medicine,
  related = [],
}: {
  medicine: Medicine;
  related?: Medicine[];
}) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [buyingNow, setBuyingNow] = useState(false);
  const [benefitsExpanded, setBenefitsExpanded] = useState(false);
  const wishlisted = isWishlisted(medicine.id);

  function goToReviews() {
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleBuyNow() {
    setBuyingNow(true);
    try {
      await addToCart(medicine, qty);
      router.push("/checkout");
    } finally {
      setBuyingNow(false);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: medicine.name, url });
      } catch {
        /* user cancelled — ignore */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Breadcrumb */}
      <p className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/" className="hover:text-[var(--blue-600)]">Home</Link>
        <ChevronRight size={12} />
        <Link href="/shop" className="hover:text-[var(--blue-600)]">Shop</Link>
        <ChevronRight size={12} />
        <span className="line-clamp-1 text-[var(--ink)]">{medicine.name}</span>
      </p>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <div
              className="group relative mb-4 aspect-square cursor-zoom-in overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6"
              onMouseEnter={() => setZoom(true)}
              onMouseLeave={() => setZoom(false)}
            >
              <motion.div
                animate={{ scale: zoom ? 1.35 : 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative h-full w-full"
              >
                <Image src={medicine.images[activeImage]} alt={medicine.name} fill className="object-contain" priority />
              </motion.div>
              <span className="absolute right-4 bottom-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--ink-soft)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                <ZoomIn size={16} />
              </span>
              {medicine.discountPercent > 0 && (
                <Badge tone="coral" className="absolute left-4 top-4">
                  {medicine.discountPercent}% OFF
                </Badge>
              )}
            </div>

            {/* Wishlist + share, floated top-right of the card */}
            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <button
                onClick={() => toggleWishlist(medicine.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white shadow-sm transition-colors hover:border-[var(--coral-500)]"
                aria-label="Toggle wishlist"
              >
                <Heart size={16} className={wishlisted ? "fill-[var(--coral-500)] text-[var(--coral-500)]" : "text-[var(--ink-soft)]"} />
              </button>
              <button
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white shadow-sm transition-colors hover:border-[var(--blue-500)]"
                aria-label="Share this product"
              >
                <Share2 size={15} className="text-[var(--ink-soft)]" />
              </button>
            </div>
          </div>

          {medicine.images.length > 1 && (
            <div className="mb-4 flex gap-3">
              {medicine.images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 bg-white p-1.5 transition-colors",
                    activeImage === i ? "border-[var(--blue-500)]" : "border-[var(--line)] hover:border-[var(--ink-soft)]"
                  )}
                >
                  <Image src={img} alt="" fill className="object-contain p-1" />
                </button>
              ))}
            </div>
          )}

          {/* Prescription upload notice */}
          {/* {medicine.prescriptionRequired && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue-500)] text-white">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">This is a prescription medicine</p>
                  <p className="text-xs text-[var(--ink-soft)]">Upload valid prescription before ordering</p>
                </div>
              </div>
              <Button
                href={isLoggedIn ? "/prescription-upload?redirect=/checkout" : `/login?redirect=${encodeURIComponent("/prescription-upload?redirect=/checkout")}`}
                size="sm"
                variant="outline"
                icon={<UploadCloud size={14} />}
              >
                Upload Prescription
              </Button>
            </div>
          )} */}
        </div>

        {/* Info */}
        <div>
          {medicine.prescriptionRequired && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--blue-50)] px-3 py-1.5 text-xs font-semibold text-[var(--blue-600)]">
              <FileWarning size={12} /> Prescription Required
            </span>
          )}

          {medicine.manufacturer && (
            <p className="mb-1 text-sm font-semibold text-[var(--blue-600)]">
              {medicine.brandId ? (
                <Link href={`/shop?brand_id=${medicine.brandId}`} className="hover:underline">
                  {medicine.manufacturer}
                </Link>
              ) : (
                medicine.manufacturer
              )}
            </p>
          )}

          <h1 className="mb-3 font-display text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl">{medicine.name}</h1>

          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
            {medicine.reviewCount > 0 ? (
              <button onClick={goToReviews} className="hover:opacity-80">
                <Rating value={medicine.rating} count={medicine.reviewCount} />
              </button>
            ) : (
              <>
                <span className="flex items-center gap-1 text-[var(--ink-soft)]">
                  <Star size={13} className="text-[var(--amber-500)]" /> No reviews yet
                </span>
                <span className="text-[var(--line)]">|</span>
                <button onClick={goToReviews} className="font-semibold text-[var(--blue-600)] hover:underline">
                  Be the first to review this product
                </button>
              </>
            )}
          </div>

          <div className="mb-1 flex flex-wrap items-baseline gap-3 font-mono-nums">
            <span className="text-3xl font-bold text-[var(--ink)]">{formatINR(medicine.price)}</span>
            {medicine.mrp > medicine.price && (
              <>
                <span className="text-lg text-[var(--ink-soft)] line-through">{formatINR(medicine.mrp)}</span>
                <Badge tone="coral">Save {medicine.discountPercent}%</Badge>
              </>
            )}
          </div>
          <p className="mb-6 text-xs text-[var(--ink-soft)]">Inclusive of all taxes</p>

          <p className="mb-6 text-sm text-[var(--ink-soft)]">
            {medicine.packSize}
            {medicine.packSize && " · "}
            {medicine.inStock ? (
              <span className="font-medium text-[var(--mint-600)]">In Stock</span>
            ) : (
              <span className="font-medium text-[var(--coral-500)]">Out of Stock</span>
            )}
          </p>

          {/* Weight/Quantity + Storage — quick-glance facts, admin-editable */}
          {(medicine.packSize || medicine.storage) && (
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {medicine.packSize && (
                <div className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                    <Package size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--ink)]">Weight / Quantity</p>
                    <p className="text-sm text-[var(--ink-soft)]">{medicine.packSize}</p>
                  </div>
                </div>
              )}
              {medicine.storage && (
                <div className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                    <Snowflake size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--ink)]">Stores</p>
                    <p className="text-sm text-[var(--ink-soft)]">{medicine.storage}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-center rounded-full border border-[var(--line)] sm:justify-start">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-14 w-12 items-center justify-center sm:h-11" aria-label="Decrease quantity">
                <Minus size={15} />
              </button>
              <span className="w-8 text-center text-sm font-semibold font-mono-nums">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="flex h-14 w-12 items-center justify-center sm:h-11" aria-label="Increase quantity">
                <Plus size={15} />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              disabled={!medicine.inStock}
              icon={<ShoppingCart size={17} />}
              onClick={() => addToCart(medicine, qty)}
            >
              Add to Cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={!medicine.inStock || buyingNow}
              icon={<Zap size={17} />}
              onClick={handleBuyNow}
            >
              {buyingNow ? "Please wait…" : "Buy Now"}
            </Button>
          </div>

          {/* Buy-box trust row */}
          <div className="mb-8 grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-[var(--line)] p-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[var(--line)]">
            {buyBoxTrust.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-2.5 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--ink)]">{title}</p>
                  <p className="text-[11px] text-[var(--ink-soft)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Tabs
              active={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  label: "Description",
                  content: (
                    <div className="space-y-4">
                      {medicine.description ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-soft)]">
                          {medicine.description}
                        </p>
                      ) : (
                        <p className="text-sm text-[var(--ink-soft)]">No description available for this product.</p>
                      )}
                      {medicine.composition && (
                        <div className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                            <FlaskConical size={16} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-[var(--ink)]">Composition</p>
                            <p className="text-sm text-[var(--ink-soft)]">{medicine.composition}</p>
                          </div>
                        </div>
                      )}
                      {medicine.uses.length > 0 && (
                        <div className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                            <Stethoscope size={16} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-[var(--ink)]">Therapeutic Use</p>
                            <p className="text-sm text-[var(--ink-soft)]">{medicine.uses.join(", ")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  label: "Benefits",
                  content: medicine.benefits ? (
                    <div>
                      <p className={cn(
                        "whitespace-pre-line text-sm leading-relaxed text-[var(--ink-soft)]",
                        !benefitsExpanded && "line-clamp-6"
                      )}>
                        {medicine.benefits}
                      </p>
                      {medicine.benefits.length > 260 && (
                        <button
                          onClick={() => setBenefitsExpanded((v) => !v)}
                          className="mt-2 flex items-center gap-1 text-xs font-semibold text-[var(--blue-600)]"
                        >
                          {benefitsExpanded ? "Show less" : "Read more"}
                          <ChevronDown size={13} className={cn("transition-transform", benefitsExpanded && "rotate-180")} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">No benefits listed for this product.</p>
                  ),
                },
                {
                  label: "How to Use",
                  content: medicine.dosage ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-soft)]">{medicine.dosage}</p>
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">No usage instructions available for this product.</p>
                  ),
                },
                {
                  label: "Specification",
                  content: medicine.specification ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-soft)]">{medicine.specification}</p>
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">No specification available for this product.</p>
                  ),
                },
                {
                  label: "Side Effects",
                  content: medicine.sideEffects.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {medicine.sideEffects.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--ink-soft)]">No side effects listed for this product.</p>
                  ),
                },
              ]}
            />
          </div>

          {/* Reviews — in their own place, not hidden behind a tab. That way
              the customer can jump straight to the reviews without clicking, and
              "Be the first to review" style CTA scrolls to this point. */}
          <div id="reviews" className="mt-8 scroll-mt-24 border-t border-[var(--line)] pt-8">
            <p className="mb-5 flex items-center gap-2 font-display text-lg font-bold text-[var(--ink)]">
              <MessageSquareText size={18} className="text-[var(--blue-500)]" />
              Reviews{medicine.reviewCount ? ` (${medicine.reviewCount})` : ""}
            </p>
            <ProductReviews productId={medicine.id} slug={medicine.slug} />
          </div>
        </div>
      </div>

      {/* Page-wide trust strip */}
      <div className="mt-12 grid grid-cols-2 gap-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 sm:grid-cols-4">
        {pageTrust.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
              <Icon size={17} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
              <p className="text-xs text-[var(--ink-soft)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {related.length > 0 && <ProductRail title="Similar Products" medicines={related} />}
    </div>
  );
}