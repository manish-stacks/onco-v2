export const inr = (n) => {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

/** Bade numbers ko chhota karo — dashboard cards ke liye */
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

/** "2 ghante pehle" type relative time */
export const ago = (d) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'abhi';
  if (mins < 60) return `${mins}m pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h pehle`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d pehle`;
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
