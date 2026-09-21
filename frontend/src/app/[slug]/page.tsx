import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { contentApi } from "@/lib/api";
import { toMetaDescription, absoluteUrl, SITE_NAME } from "@/lib/seo";

export const revalidate = 900;

interface CmsPage {
  page_id: number;
  name: string;
  seo_title?: string;
  seo_description?: string;
  slug: string;
  content: string;
  status: string;
  type?: string;
}

// Route segments that already have their own dedicated page — never let this
// catch-all shadow them. Next.js resolves static routes before dynamic ones,
// so this is just a fast bail-out, not the thing keeping them safe.
const RESERVED = new Set([
  "category", "medicines", "product-details", "products", "shop", "cart",
  "wishlist", "checkout", "login", "register", "account", "profile",
  "search", "blog", "brands", "track", "track-shipment", "contact", "about",
  "payment", "order-success", "prescription-upload", "maintenance", "api",
]);

const getPage = cache(async (slug: string): Promise<CmsPage | null> => {
  try {
    return await contentApi.page<CmsPage>(slug);
  } catch {
    return null;
  }
});

/** Content from the admin CMS — wrap as paragraphs if it isn't already HTML */
function toHtml(content: string) {
  const looksHtml = /<\/?(p|div|br|h[1-6]|ul|ol|li|img|table|strong|em|a)\b/i.test(content || "");
  if (looksHtml) return content;
  return (content || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED.has(slug)) return {};

  const page = await getPage(slug);
  if (!page) return { title: `Page Not Found | ${SITE_NAME}` };

  const title = page.seo_title?.trim() || `${page.name} | ${SITE_NAME}`;
  const description = toMetaDescription(page.seo_description) || `${page.name} — ${SITE_NAME}`;
  const url = absoluteUrl(`/${page.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
  };
}

export default async function CmsPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RESERVED.has(slug)) return notFound();

  const page = await getPage(slug);
  if (!page) return notFound();

  return (
    <div className="bg-[var(--paper)]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-[var(--ink)] sm:text-3xl">{page.name}</h1>
        <div
          className="prose prose-sm sm:prose-base mt-6 max-w-none text-[var(--ink-soft)] prose-headings:text-[var(--ink)] prose-a:text-[var(--blue-600)]"
          dangerouslySetInnerHTML={{ __html: toHtml(page.content) }}
        />
      </div>
    </div>
  );
}
