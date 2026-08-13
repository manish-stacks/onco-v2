// Small shared helper so a coupon applied on the Cart page is remembered on
// the Checkout page without needing a global store. Lives in localStorage,
// scoped to this browser only — cleared explicitly on remove or after order
// placement (call clearStoredCoupon() once the order goes through).

const COUPON_STORAGE_KEY = "onco:applied_coupon";

export interface StoredCoupon {
  code: string;
  discount: number;
}

export function readStoredCoupon(): StoredCoupon | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COUPON_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.code === "string" && typeof parsed?.discount === "number") {
      return parsed as StoredCoupon;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredCoupon(coupon: StoredCoupon | null): void {
  if (typeof window === "undefined") return;
  try {
    if (coupon) {
      window.localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
    } else {
      window.localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  } catch {
    // private browsing / quota exceeded — non-critical, just skip persistence
  }
}

export function clearStoredCoupon(): void {
  writeStoredCoupon(null);
}
