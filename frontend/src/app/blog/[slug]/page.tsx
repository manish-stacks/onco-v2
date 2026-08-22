import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, UserCircle, Clock } from "lucide-react";
import { getBlogs, getBlogBySlug } from "@/lib/blog";
import { Badge } from "@/components/ui/badge";
import { toMetaDescription, absoluteUrl, SITE_NAME } from "@/lib/seo";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { posts } = await getBlogs({ limit: 30 });
  return posts.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogBySlug(slug);
  if (!post) return { title: `Article Not Found | ${SITE_NAME}` };

  const title = `${post.title} | ${SITE_NAME} Blog`;
  const description = toMetaDescription(post.excerpt, 160);
  const url = absoluteUrl(`/blog/${post.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: SITE_NAME, type: "article",
      images: post.image ? [{ url: post.image, width: 1200, height: 630, alt: post.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: post.image ? [post.image] : undefined },
  };
}

function fmtDate(d: string) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Content HTML comes from the admin CMS — if it is plain text we build paragraphs */
function toHtml(content: string) {
  const looksHtml = /<\/?(p|div|br|h[1-6]|ul|ol|li|img|table|strong|em|a)\b/i.test(content);
  if (looksHtml) return content;
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogBySlug(slug);
  if (!post) notFound();

  const { posts } = await getBlogs({ limit: 8 });
  const more = posts.filter((b) => b.id !== post.id).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    image: post.image ? [post.image] : undefined,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="mb-6 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/blog">Blog</Link> / <span className="text-[var(--ink)]">{post.category}</span>
      </p>
      <Badge tone="mint" className="mb-4">{post.category}</Badge>
      <h1 className="mb-4 font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">{post.title}</h1>
      <p className="mb-8 flex flex-wrap items-center gap-4 text-sm text-[var(--ink-soft)]">
        <span className="flex items-center gap-1.5"><UserCircle size={14} /> {post.author}</span>
        <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {fmtDate(post.date)}</span>
        <span className="flex items-center gap-1.5"><Clock size={14} /> {post.readTime}</span>
      </p>

      <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)]">
        <Image src={post.image} alt={post.title} fill className="object-cover" />
      </div>

      {post.excerpt && (
        <p className="mb-6 text-lg leading-relaxed text-[var(--ink)]">{post.excerpt}</p>
      )}

      <article
        className="blog-content leading-relaxed text-[var(--ink-soft)] [&_a]:text-[var(--blue-600)] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[var(--ink)] [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-[var(--ink)] [&_img]:my-6 [&_img]:rounded-[var(--radius-md)] [&_li]:mb-1.5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:text-[var(--ink)] [&_table]:w-full [&_td]:border [&_td]:border-[var(--line)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--line)] [&_th]:p-2 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: toHtml(post.content) }}
      />

      <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--blue-50)]/50 p-5 text-sm text-[var(--ink-soft)]">
        This article is for general information only and is not a substitute for professional medical advice. Always consult your doctor.
      </div>

      {more.length > 0 && (
        <div className="mt-14">
          <p className="mb-5 font-semibold text-[var(--ink)]">More from the blog</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {more.map((b) => (
              <Link key={b.id} href={`/blog/${b.slug}`} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-white">
                <div className="relative aspect-[4/3]">
                  <Image src={b.image} alt={b.title} fill className="object-cover" />
                </div>
                <p className="line-clamp-2 p-4 text-sm font-medium text-[var(--ink)]">{b.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
