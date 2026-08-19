import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { blogs, getBlogBySlug } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { toMetaDescription, absoluteUrl, SITE_NAME } from "@/lib/seo";

export function generateStaticParams() {
  return blogs.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogBySlug(slug);
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

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogBySlug(slug);
  if (!post) notFound();

  const more = blogs.filter((b) => b.id !== post.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-6 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/blog">Blog</Link> / <span className="text-[var(--ink)]">{post.category}</span>
      </p>
      <Badge tone="mint" className="mb-4">{post.category}</Badge>
      <h1 className="mb-4 font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">{post.title}</h1>
      <p className="mb-8 text-sm text-[var(--ink-soft)]">{post.author} · {post.date} · {post.readTime}</p>

      <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)]">
        <Image src={post.image} alt={post.title} fill className="object-cover" />
      </div>

      <p className="mb-6 text-lg leading-relaxed text-[var(--ink)]">{post.excerpt}</p>
      <p className="leading-relaxed text-[var(--ink-soft)]">{post.content}</p>

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