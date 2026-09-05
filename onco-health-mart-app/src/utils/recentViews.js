import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Recently viewed" — like Flipkart's home screen rail. Stored locally on the
 * device (not per-account), most-recent-first, capped at MAX items.
 */
const KEY = 'ohm_recent_views';
const MAX = 12;

export async function getRecentViews() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Call this whenever a product detail page is opened. */
export async function addRecentView(product) {
  if (!product?.product_id) return;
  try {
    const list = await getRecentViews();
    const next = [product, ...list.filter((p) => p.product_id !== product.product_id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* best-effort — a storage failure shouldn't break the product page */
  }
}

export async function removeRecentView(productId) {
  try {
    const list = await getRecentViews();
    await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((p) => p.product_id !== productId)));
  } catch {
    /* ignore */
  }
}

export async function clearRecentViews() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}