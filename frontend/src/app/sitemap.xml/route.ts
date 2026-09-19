import { API_BASE } from "@/lib/api";

/**
 * Google sitemap.xml ko usi domain pe dhoondta hai jis domain ke URLs usme
 * likhe hain (oncohealthmart.com) — backend alag subdomain (api.oncohealthmart.com)
 * pe hai, isliye backend ka /sitemap.xml seedha kaam nahi karega. Ye route
 * usi backend sitemap ko yahan (website ke apne domain pe) serve kar deta hai.
 */
export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/sitemap.xml`, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`backend sitemap ${res.status}`);
    const xml = await res.text();
    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch {
    // Backend down ho to khaali (lekin valid) sitemap do, 500 error se behtar
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { headers: { "Content-Type": "application/xml; charset=utf-8" } }
    );
  }
}
