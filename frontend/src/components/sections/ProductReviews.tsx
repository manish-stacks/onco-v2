"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PenLine, ShieldCheck, ChevronDown, MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { StarRatingInput } from "@/components/product/StarRatingInput";
import { catalogApi, orderApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

interface ReviewRow {
  review_id: number;
  rating: number;
  title: string | null;
  review: string | null;
  created_at: string;
  customer_name: string | null;
}

interface Breakdown {
  rating: number;
  count: number;
}

const PAGE_SIZE = 5;

/**
 * Backend rule (`customerHasPurchased`): review sirf tabhi allowed hai jab
 * customer ka koi order 'Completed' status me ho aur usme ye product ho.
 * Backend hi ye enforce karta hai — yahan ka check sirf UX ke liye hai
 * (order_id dhoondhne ke liye jo review row ke saath tag hota hai), security
 * boundary backend pe hai.
 */
type Eligibility = { checked: false } | { checked: true; eligible: true; orderId: number } | { checked: true; eligible: false };

export function ProductReviews({ productId, slug }: { productId: string; slug: string }) {
  const { isLoggedIn } = useAuth();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility>({ checked: false });
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    catalogApi
      .productReviews<ReviewRow[]>(productId, { page: 1, limit: PAGE_SIZE })
      .then((res) => {
        if (!mounted) return;
        setReviews(res?.data ?? []);
        setTotal(res?.pagination?.total ?? 0);
        setBreakdown((res?.breakdown as Breakdown[] | undefined) ?? []);
      })
      .catch(() => {
        if (mounted) {
          setReviews([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [productId]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await catalogApi.productReviews<ReviewRow[]>(productId, { page: nextPage, limit: PAGE_SIZE });
      setReviews((prev) => [...prev, ...(res?.data ?? [])]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  /**
   * Customer ke Completed orders me se ye product dhoondhte hain — mile to
   * uska order_id review ke saath save hota hai. Backend ka asli gate
   * `customerHasPurchased` hai (product + Completed status), ye sirf ek
   * matching order_id nikalne ke liye hai. Bounded to 30 orders taaki
   * bahut zyada API calls na ho.
   */
  async function checkEligibility() {
    setCheckingEligibility(true);
    try {
      const ordersRes = await orderApi.list<Order[]>({ status: "Completed", limit: 30 });
      const orders = ordersRes?.data ?? [];

      for (const o of orders) {
        // eslint-disable-next-line no-await-in-loop
        const detail = await orderApi.detail<Order>(o.order_id).catch(() => null);
        const hasProduct = detail?.items?.some((it) => String(it.product_id) === String(productId));
        if (hasProduct) {
          setEligibility({ checked: true, eligible: true, orderId: o.order_id });
          return;
        }
      }
      setEligibility({ checked: true, eligible: false });
    } catch {
      setEligibility({ checked: true, eligible: false });
    } finally {
      setCheckingEligibility(false);
    }
  }

  function openForm() {
    setFormOpen(true);
    if (!eligibility.checked) checkEligibility();
  }

  async function submitReview() {
    if (!eligibility.checked || !eligibility.eligible) return;
    if (rating === 0) {
      setSubmitError("Please select a star rating.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await orderApi.review(eligibility.orderId, {
        product_id: productId,
        rating,
        title: title || undefined,
        review: comment || undefined,
      });
      setSubmitted(true);
      setFormOpen(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  }

  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <div className="space-y-8">
      {submitted && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--mint-50)] bg-[var(--mint-50)]/50 px-4 py-3 text-sm text-[var(--mint-600)]">
          <ShieldCheck size={16} /> Thanks! Your review has been submitted and will appear here once our team approves it.
        </div>
      )}

      {/* Rating breakdown + write-review trigger */}
      <div className="flex flex-col gap-6 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 sm:flex-row sm:items-center">
        <div className="w-full max-w-[220px] space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = breakdown.find((b) => b.rating === star)?.count ?? 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
                <span className="w-8 shrink-0">{star} star</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div className="h-full rounded-full bg-[var(--amber-500)]" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right font-mono-nums">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 sm:border-l sm:border-[var(--line)] sm:pl-6">
          {!isLoggedIn ? (
            <div>
              <p className="mb-2 text-sm text-[var(--ink-soft)]">Purchased this product? Share your experience.</p>
              <Button href={`/login?redirect=/medicines/${slug}`} variant="outline" icon={<PenLine size={15} />}>
                Login to Write a Review
              </Button>
            </div>
          ) : !formOpen ? (
            <div>
              <p className="mb-2 text-sm text-[var(--ink-soft)]">
                Only customers who have received this product can leave a review.
              </p>
              <Button onClick={openForm} variant="outline" icon={<PenLine size={15} />}>
                Write a Review
              </Button>
            </div>
          ) : checkingEligibility ? (
            <p className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <Loader2 size={15} className="animate-spin" /> Checking your order history…
            </p>
          ) : eligibility.checked && !eligibility.eligible ? (
            <div className="text-sm text-[var(--ink-soft)]">
              <p className="mb-2">We couldn&apos;t find a delivered order with this product on your account.</p>
              <Link href="/account/orders" className="font-semibold text-[var(--blue-600)]">Check your orders</Link>
            </div>
          ) : (
            <div className="space-y-3">
              <StarRatingInput value={rating} onChange={setRating} />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your review a title (optional)"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3 text-sm outline-none"
              />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="How was your experience with this product?"
                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm outline-none"
              />
              {submitError && <p className="text-xs text-[var(--coral-500)]">{submitError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={submitReview} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Review"}
                </Button>
                <button onClick={() => setFormOpen(false)} className="text-xs font-medium text-[var(--ink-soft)]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review list */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--blue-500)]" /></div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--ink-soft)]">
          <MessageSquareOff size={24} />
          <p className="text-sm">No reviews yet. Be the first to review this product.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.review_id} className="rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--ink)]">{r.customer_name || "Verified Buyer"}</p>
                <p className="text-xs text-[var(--ink-soft)]">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <Rating value={r.rating} className="mb-2" />
              {r.title && <p className="mb-1 text-sm font-semibold text-[var(--ink)]">{r.title}</p>}
              {r.review && <p className="text-sm text-[var(--ink-soft)]">{r.review}</p>}
              <Badge tone="mint" className="mt-2">Verified Purchase</Badge>
            </div>
          ))}

          {reviews.length < total && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={cn(
                "mx-auto flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-600)]",
                loadingMore && "opacity-60"
              )}
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              Load more reviews
            </button>
          )}
        </div>
      )}
    </div>
  );
}