export function num(v, fallback = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

export function money(v) {
  const n = num(v, 0);
  return `\u20B9${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function discountPercent(mrp, sp) {
  const m = num(mrp);
  const s = num(sp, m);
  if (!m || m <= s) return 0;
  return Math.round(((m - s) / m) * 100);
}

export function isRx(product) {
  return String(product?.presciption_required || '').toLowerCase() === 'yes';
}

export function inStock(product) {
  const qty = num(product?.stock_quantity, 0);
  const backorder = String(product?.allow_backorder) === '1';
  return qty > 0 || backorder || String(product?.stock || '').toLowerCase() === 'in stock';
}

/** Strip HTML tags out of the admin's rich-text fields */
export function plain(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDate(value, withTime = false) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function timeOnly(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function cleanMobile(v) {
  return String(v || '').replace(/\D/g, '').slice(-10);
}

const STATUS_TONE = {
  Delivered: 'success',
  Shipped: 'info',
  'Out for Delivery': 'warn',
  New: 'info',
  Processing: 'info',
  Packed: 'info',
  Pending: 'warn',
  Cancelled: 'danger',
  Returned: 'danger',
  Refunded: 'danger',
  Approved: 'success',
  Verified: 'success',
  Rejected: 'danger',
  'Under Review': 'warn',
  Paid: 'success',
  Unpaid: 'warn',
  Failed: 'danger',
};

export function statusTone(status) {
  return STATUS_TONE[status] || 'info';
}
