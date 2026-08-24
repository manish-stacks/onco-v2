import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// The one canonical order reference shown across the user dashboard, admin panel
// and every SMS/WhatsApp — ORD/<year>/<order_id padded>. The number is the orders
// table primary key, so /account/orders/<order_id> links straight to it.
export function orderRef(o?: { order_id?: number | string; order_date?: string; created_at?: string; databaseOrderID?: string } | null): string {
  if (!o) return "";
  const id = o.order_id;
  if (!id) return o.databaseOrderID || "";
  const d = o.order_date || o.created_at;
  const year = d ? new Date(d).getFullYear() : new Date().getFullYear();
  return `ORD/${year}/${String(id).padStart(6, "0")}`;
}
