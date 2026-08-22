/**
 * WhatsApp/SMS templates ke liye formatting.
 *
 * Both the ₹ symbol and commas cause trouble in WhatsApp params — a comma
 * is the separator, and ₹ sometimes breaks in encoding. So plain
 * we send plain numbers; the template already contains ₹.
 */

/** 1234.5 -> "1234.50" (no ₹, no comma) */
function inrPlain(value) {
  return Number(value || 0).toFixed(2);
}

/**
 * Order items ko ek line me.
 * Commas cannot be used (they are the param separator), so we join with " | ".
 * If there are more than 3 items we add "+N more" — WhatsApp params have their own length limit.
 */
function formatItems(items = [], max = 3) {
  if (!items.length) return 'Items';

  const parts = items.slice(0, max).map((it) => {
    const name = String(it.product_name || 'Item').replace(/,/g, ' ').slice(0, 40);
    return `${name} x${it.unit_quantity}`;
  });

  if (items.length > max) parts.push(`+${items.length - max} more`);
  return parts.join(' | ');
}

/** Address ko single line — commas hata ke */
function formatAddress(order) {
  return [
    order.customer_shipping_address || order.customer_address,
    order.customer_shipping_city || order.customer_city,
    order.customer_shipping_state || order.customer_state,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/,/g, ' -')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { inrPlain, formatItems, formatAddress };
