import { API_BASE } from "@/lib/api";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/robots.txt`, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`backend robots ${res.status}`);
    const txt = await res.text();
    return new Response(txt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
