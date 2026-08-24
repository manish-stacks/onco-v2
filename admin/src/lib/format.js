export const inr = (n) => {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

/** Shorten large numbers — for the dashboard cards */
export const compactInr = (n) => {
  const num = Number(n || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toFixed(0)}`;
};

export const num = (n) => Number(n || 0).toLocaleString('en-IN');

export const date = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const dateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** Relative time such as "2 hours ago" */
export const ago = (d) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date(d);
};

/** <input type="date"> ke liye */
export const inputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const pct = (part, whole) => {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
};

export const truncate = (s, n = 40) =>
  (s && s.length > n ? `${s.slice(0, n)}…` : s || '');

export const titleCase = (s) =>
  String(s || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// The one canonical order reference shown across admin, the user dashboard and
// every SMS/WhatsApp — ORD/<year>/<order_id padded>. order_id is the table PK.
export const orderRef = (o) => {
  if (!o) return '';
  const id = o.order_id ?? o.orderId;
  if (!id) return o.databaseOrderID || '';
  const d = o.order_date || o.created_at;
  const year = d ? new Date(d).getFullYear() : new Date().getFullYear();
  return `ORD/${year}/${String(id).padStart(6, '0')}`;
};
