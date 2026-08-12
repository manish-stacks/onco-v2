/**
 * WhatsApp/SMS templates ke liye formatting.
 *
 * WhatsApp params me ₹ symbol aur comma dono dikkat karte hain — comma param
 * separator hai, aur ₹ kabhi-kabhi encoding me gadbad karta hai. Isliye plain
 * numbers bhejte hain; template me ₹ pehle se likha hua hai.
 */

/** 1234.5 -> "1234.50" (no ₹, no comma) */
function inrPlain(value) {
  return Number(value || 0).toFixed(2);
}

/**
 * Order items ko ek line me.
 * Comma use nahi kar sakte (param separator hai), isliye " | " se jodte hain.
 * 3 se zyada items ho to "+N more" — WhatsApp params ki apni length limit hai.
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
