import { NextResponse, type NextRequest } from "next/server";

/**
 * Site maintenance gate.
 *
 * Deliberately NOT in the root layout — a layout runs during `next build`'s
 * static prerendering too, so a live API call there can hang the entire
 * build if the API is briefly unreachable (this happened once — every page
 * timed out after 60s x 3 retries). Middleware only ever runs at request
 * time on the deployed server, never at build time, so it's safe here.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "https://www.api.oncohealthmart.com").replace(/\/$/, "");

// Small in-memory cache so we're not hitting the API on every single
// request — the admin's maintenance toggle only needs to take effect within
// a few seconds, not instantly. Lives for the life of this Node process
// (each PM2 instance keeps its own copy, which is fine).
let cached: { on: boolean; message?: string; expires: number } | null = null;
const CACHE_MS = 10_000;
const FETCH_TIMEOUT_MS = 2_500;

async function isInMaintenance(): Promise<{ on: boolean; message?: string }> {
  if (cached && cached.expires > Date.now()) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/api/app/settings`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`settings ${res.status}`);
    const json = await res.json();
    const data = json?.data ?? json;
    cached = { on: !!data?.maintenance_mode, message: data?.maintenance_message, expires: Date.now() + CACHE_MS };
    return cached;
  } catch {
    // Fail OPEN — if the maintenance check itself is slow/down, that must
    // never be the reason the whole site goes down for everyone.
    return { on: false };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/maintenance") return NextResponse.next();

  const { on, message } = await isInMaintenance();
  if (!on) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  if (message) url.searchParams.set("m", message);
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except static assets, images, and Next's own internals —
  // API routes/webhooks live on the separate backend, not in this app.
  matcher: ["/((?!_next/static|_next/image|favicon|apple-touch-icon|og-image|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)"],
};
