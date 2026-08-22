/**
 * Applied-coupon storage.
 *
 * The backend's `POST /cart/apply-coupon` endpoint only *validates* a code — it does
 * not store it anywhere. The code has to travel with the checkout payload, so we keep
 * the last successfully validated coupon on the client and read it back on the
 * checkout page. Without this the coupon entered on the cart page was silently
 * dropped and the order was always created without a discount.
 */

const KEY = "ohm_coupon";

export interface AppliedCoupon {
  code: string;
  discount: number;
}

const isBrowser = () => typeof window !== "undefined";

export function getAppliedCoupon(): AppliedCoupon | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppliedCoupon;
    return parsed?.code ? { code: parsed.code, discount: Number(parsed.discount) || 0 } : null;
  } catch {
    return null;
  }
}

export function saveAppliedCoupon(code: string, discount = 0): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ code, discount }));
  } catch {
    /* private browsing mode */
  }
}

export function clearAppliedCoupon(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
