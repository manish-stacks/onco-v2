/** ?page=&limit= -> { page, limit, offset } */
function getPagination(query = {}, defaultLimit = 20, maxLimit = 100) {
  let page = parseInt(query.page, 10) || 1;
  let limit = parseInt(query.limit, 10) || defaultLimit;
  if (page < 1) page = 1;
  if (limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

/** Whitelist se hi sort column lo — SQL injection se bachne ke liye */
function getSort(query = {}, allowed = [], fallback = null) {
  const col = allowed.includes(query.sort_by) ? query.sort_by : fallback;
  const dir = String(query.sort_dir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { column: col, direction: dir };
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** OHM-LX8K2M-A7B3C9 type unique reference */
function genRef(prefix = 'OHM') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function genInvoiceNumber(orderId) {
  const year = new Date().getFullYear();
  return `INV/${year}/${String(orderId).padStart(6, '0')}`;
}

function genOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min)));
}

/** Float rounding errors se bachne ke liye — hamesha 2 decimals */
function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** 10-digit -> 91XXXXXXXXXX */
function normalizeMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/** MySQL DATETIME format */
function toMysqlDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

/** Report filters ke liye — 'today' | 'week' | 'month' | 'year' -> {from, to} */
function dateRangeFromPreset(preset) {
  const now = new Date();
  const to = toMysqlDate(now);
  const start = new Date(now);

  switch (preset) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case 'yesterday':
      start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      return { from: toMysqlDate(start), to: toMysqlDate(new Date(start.getTime() + 86399000)) };
    case 'week': start.setDate(start.getDate() - 7); break;
    case 'month': start.setMonth(start.getMonth() - 1); break;
    case 'quarter': start.setMonth(start.getMonth() - 3); break;
    case 'year': start.setFullYear(start.getFullYear() - 1); break;
    default: return { from: null, to: null };
  }
  return { from: toMysqlDate(start), to };
}

/** Drop undefined/null/'' keys so that junk does not reach `SET ?` */
function pickDefined(obj, allowedKeys = null) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    if (allowedKeys && !allowedKeys.includes(k)) return;
    if (obj[k] === undefined || obj[k] === null || obj[k] === '') return;
    out[k] = obj[k];
  });
  return out;
}

/** Safely parse a MySQL JSON column — the driver returns a string sometimes and an object other times */
function parseJson(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

/** Array ko CSV string me — reports export ke liye */
function toCsv(rows, columns) {
  if (!rows.length) return '';
  const cols = columns || Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/**
 * The single canonical, human-friendly order identifier shown everywhere —
 * admin panel, user dashboard and every SMS/WhatsApp message — so one order
 * looks the same in all three places and is easy to search.
 *   order_id 36154, placed 2026  ->  "ORD/2026/036154"
 * The number is the orders table primary key, so /account/orders/<order_id>
 * links straight to it.
 */
function orderRef(order) {
  if (!order) return '';
  const id = order.order_id ?? order.orderId;
  if (!id) return order.databaseOrderID || '';
  const d = order.order_date || order.created_at;
  const year = d ? new Date(d).getFullYear() : new Date().getFullYear();
  return `ORD/${year}/${String(id).padStart(6, '0')}`;
}

module.exports = {
  getPagination, getSort, slugify, genRef, genInvoiceNumber, genOtp, orderRef,
  money, normalizeMobile, toMysqlDate, dateRangeFromPreset,
  pickDefined, parseJson, toCsv,
};
