/**
 * Blog / News data layer.
 *
 * Comes from the backend `/news` + `/news/:id` (managed in the admin panel
 * under CMS > News). The news table has no `slug` column, only `id` —
 * so to build an SEO-friendly URL we use the `title-slug-<id>` format
 * and the detail page extracts the id from the last segment.
 */
import { contentApi, mediaUrl } from "@/lib/api";
import type { BlogPost } from "@/types";

export interface ApiNews {
  id: number | string;
  title: string;
  category?: string | null;
  excerpt?: string | null;
  image?: string | null;
  content?: string | null;
  date?: string | null;
  status?: string | null;
}

export function slugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function stripHtml(html: string | null | undefined): string {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readTimeOf(content: string | null | undefined): string {
  const words = stripHtml(content).split(" ").filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** Backend news row -> UI BlogPost shape */
export function newsToBlog(n: ApiNews): BlogPost {
  const plain = stripHtml(n.content);
  return {
    id: String(n.id),
    slug: `${slugify(n.title) || "post"}-${n.id}`,
    title: n.title || "Untitled",
    excerpt: (n.excerpt && stripHtml(n.excerpt)) || plain.slice(0, 180),
    content: n.content || "",
    category: n.category || "Health",
    image: mediaUrl(n.image, "/placeholder.png"),
    author: "Onco Health Mart",
    date: n.date || new Date().toISOString(),
    readTime: readTimeOf(n.content),
  };
}

/** The numeric id at the end of the slug is the news id */
export function idFromSlug(slug: string): string | null {
  const m = String(slug || "").match(/(\d+)$/);
  return m ? m[1] : null;
}

export async function getBlogs(
  { page = 1, limit = 12, category }: { page?: number; limit?: number; category?: string } = {}
): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
  try {
    const res = await contentApi.news<ApiNews[]>({ page, limit, category });
    const rows = res?.data ?? [];
    return {
      posts: rows.map(newsToBlog),
      total: res?.pagination?.total ?? rows.length,
      totalPages: res?.pagination?.totalPages ?? 1,
    };
  } catch {
    return { posts: [], total: 0, totalPages: 0 };
  }
}

export async function getBlogBySlug(slug: string): Promise<BlogPost | null> {
  const id = idFromSlug(slug);
  if (id) {
    try {
      const item = await contentApi.newsDetail<ApiNews>(id);
      if (item) return newsToBlog(item);
    } catch {
      /* fall through to the fallback below */
    }
  }
  // Fallback for old / id-less URLs — match the slug against the list
  const { posts } = await getBlogs({ limit: 50 });
  return posts.find((p) => p.slug === slug || slugify(p.title) === slug) ?? null;
}
