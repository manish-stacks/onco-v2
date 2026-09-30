import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock, ArrowRight, ArrowLeft, ListOrdered, Pill, FileUp } from "lucide-react";
import { FaWhatsapp, FaFacebookF, FaXTwitter, FaLinkedinIn } from "react-icons/fa6";
import { getBlogs, getBlogBySlug } from "@/lib/blog";
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

  const title = `${post.metaTitle} | ${SITE_NAME}`;
  const description = toMetaDescription(post.metaDescription, 160);
  const url = absoluteUrl(`/blog/${post.slug}`);

  return {
    title,
    description,
    keywords: post.keywords.length ? post.keywords : undefined,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: SITE_NAME, type: "article",
      publishedTime: post.date,
      images: post.image ? [{ url: post.image, width: 1200, height: 630, alt: post.imageAlt }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: post.image ? [post.image] : undefined },
  };
}

function fmtDate(d: string) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Content HTML comes from the admin CMS. Plain text gets wrapped into paragraphs. */
function toHtml(content: string) {
  const looksHtml = /<\/?(p|div|br|h[1-6]|ul|ol|li|img|table|strong|em|a)\b/i.test(content);
  if (looksHtml) return content;
  return content.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
}

/** Adds ids to <h2> tags and returns a table of contents */
function withToc(html: string) {
  const toc: { id: string; text: string }[] = [];
  const out = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs, inner) => {
    const text = String(inner).replace(/<[^>]*>/g, "").trim();
    const id = `s${toc.length + 1}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)}`;
    toc.push({ id, text });
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogBySlug(slug);
  if (!post) notFound();

  const { posts } = await getBlogs({ limit: 8 });
  const more = posts.filter((b) => b.id !== post.id).slice(0, 3);
  const { html, toc } = withToc(toHtml(post.content));
  const url = absoluteUrl(`/blog/${post.slug}`);
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(post.title);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription,
      image: post.image ? [post.image] : undefined,
      datePublished: post.date,
      dateModified: post.date,
      keywords: post.keywords.join(", ") || undefined,
      author: { "@type": "Organization", name: post.author },
      publisher: { "@type": "Organization", name: SITE_NAME },
      mainEntityOfPage: url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  const share = [
    { label: "WhatsApp", icon: FaWhatsapp, href: `https://wa.me/?text=${encTitle}%20${enc}` },
    { label: "Facebook", icon: FaFacebookF, href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
    { label: "X", icon: FaXTwitter, href: `https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}` },
    { label: "LinkedIn", icon: FaLinkedinIn, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}` },
  ];

  return (
    <div className="bg-[var(--paper)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="bg-[#071C35]">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:py-16">
          <nav aria-label="Breadcrumb" className="mb-5 text-xs text-white/60">
            <Link href="/" className="hover:text-white">Home</Link> / <Link href="/blog" className="hover:text-white">Blog</Link> / <span className="text-white/90">{post.category}</span>
          </nav>
          <span className="mb-4 inline-block rounded-full bg-[var(--blue-500)] px-3 py-1 text-xs font-semibold text-white">{post.category}</span>
          <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[44px]">{post.title}</h1>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/70">
            <span>By {post.author}</span>
            <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {fmtDate(post.date)}</span>
            <span className="flex items-center gap-1.5"><Clock size={14} /> {post.readTime}</span>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-8 mb-10 aspect-[16/8] overflow-hidden rounded-3xl bg-white shadow-xl sm:-mt-12">
          <Image src={post.image} alt={post.imageAlt} fill priority sizes="(max-width:1152px) 100vw, 1152px" className="object-cover" />
        </div>

        <div className="grid gap-10 pb-16 lg:grid-cols-[1fr_300px]">
          {/* Article */}
          <div className="min-w-0">
            {post.excerpt && (
              <p className="mb-8 border-l-4 border-[var(--blue-500)] bg-white py-3 pl-5 pr-4 text-lg leading-relaxed text-[var(--ink)]">{post.excerpt}</p>
            )}

            <article
              className="blog-content rounded-3xl bg-white p-6 text-[17px] leading-8 text-[var(--ink-soft)] shadow-sm sm:p-10 [&_a]:text-[var(--blue-600)] [&_a]:underline [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--blue-500)] [&_blockquote]:bg-[var(--blue-50)] [&_blockquote]:px-5 [&_blockquote]:py-3 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-[var(--ink)] [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[var(--ink)] [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_li]:mb-2 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-5 [&_strong]:text-[var(--ink)] [&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-[var(--line)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--line)] [&_th]:bg-[var(--blue-50)] [&_th]:p-2 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {post.keywords.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.keywords.map((k) => (
                  <span key={k} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--ink-soft)]">#{k}</span>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="text-sm font-semibold text-[var(--ink)]">Share this article</span>
              {share.map(({ label, icon: Icon, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)] transition-colors hover:bg-[var(--blue-500)] hover:text-white">
                  <Icon size={15} />
                </a>
              ))}
            </div>

            <p className="mt-6 rounded-2xl border border-[var(--line)] bg-white/60 p-4 text-xs leading-6 text-[var(--ink-soft)]">
              This article is for general information only and is not a substitute for professional medical advice. Always consult your doctor.
            </p>

            <Link href="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue-600)]">
              <ArrowLeft size={15} /> Back to all articles
            </Link>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-40 lg:self-start">
            {toc.length > 1 && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-[var(--ink)]"><ListOrdered size={16} /> In this article</p>
                <ul className="space-y-2 text-sm">
                  {toc.map((t) => (
                    <li key={t.id}><a href={`#${t.id}`} className="text-[var(--ink-soft)] hover:text-[var(--blue-600)]">{t.text}</a></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl bg-[#071C35] p-5 text-white">
              <p className="font-display text-base font-bold">Need your medicines?</p>
              <p className="mt-1 text-sm text-white/70">Genuine super speciality medicines with PAN India delivery.</p>
              <div className="mt-4 flex flex-col gap-2">
                <Link href="/shop" className="flex items-center justify-center gap-2 rounded-lg bg-[var(--blue-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue-600)]"><Pill size={15} /> Shop medicines</Link>
                <Link href="/prescription-upload" className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"><FileUp size={15} /> Upload prescription</Link>
              </div>
            </div>
          </aside>
        </div>

        {more.length > 0 && (
          <section className="border-t border-[var(--line)] pb-16 pt-10">
            <h2 className="mb-6 font-display text-2xl font-bold text-[var(--ink)]">Keep reading</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {more.map((b) => (
                <Link key={b.id} href={`/blog/${b.slug}`} className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image src={b.image} alt={b.imageAlt} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-4">
                    <p className="mb-1 text-xs text-[var(--ink-soft)]">{fmtDate(b.date)} · {b.readTime}</p>
                    <p className="line-clamp-2 font-display text-base font-bold text-[var(--ink)]">{b.title}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--blue-600)]">Read more <ArrowRight size={12} /></span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
