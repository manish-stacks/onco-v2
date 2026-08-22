/**
 * "Add to Cart" must work before login too — otherwise the user reaches checkout
 * they hit a login wall before reaching it, which hurts conversion
 * The cart is tied to customer_id on the backend (customerAuth required), so
 * we keep a local cart for guests and merge it on the server as soon as they log in
 * on the server (`cartApi.merge`).
 *
 * The snapshot also carries the product's basic display data (name, image, price)
 * so the guest cart page can render without a separate product
 * fetch na karni pade.
 */

const KEY = "ohm_guest_cart";

export interface GuestProductSnapshot {
  product_id: string | number;
  product_name: string;
  slug: string;
  image_1: string | null;
  product_sp: number;
  product_mrp: number;
  sku?: string;
  presciption_required?: string;
  stock_quantity?: number;
  in_stock: boolean;
}

export interface GuestCartItem {
  product_id: string | number;
  quantity: number;
  snapshot: GuestProductSnapshot;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function readGuestCart(): GuestCartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — non-critical */
  }
}

export function clearGuestCart(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function guestCartAdd(snapshot: GuestProductSnapshot, quantity: number): GuestCartItem[] {
  const items = readGuestCart();
  const existing = items.find((i) => String(i.product_id) === String(snapshot.product_id));

  if (existing) {
    existing.quantity += quantity;
    existing.snapshot = snapshot; // refresh price/stock etc.
  } else {
    items.push({ product_id: snapshot.product_id, quantity, snapshot });
  }

  writeGuestCart(items);
  return items;
}

export function guestCartSetQuantity(productId: string | number, quantity: number): GuestCartItem[] {
  let items = readGuestCart();
  if (quantity <= 0) {
    items = items.filter((i) => String(i.product_id) !== String(productId));
  } else {
    const existing = items.find((i) => String(i.product_id) === String(productId));
    if (existing) existing.quantity = quantity;
  }
  writeGuestCart(items);
  return items;
}

export function guestCartRemove(productId: string | number): GuestCartItem[] {
  const items = readGuestCart().filter((i) => String(i.product_id) !== String(productId));
  writeGuestCart(items);
  return items;
}
