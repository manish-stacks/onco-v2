import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, ShoppingBag, Package } from "lucide-react";
import { catalogApi, mediaUrl } from "@/lib/api";
import { stripInlineFormatting } from "@/lib/html";
import { toMetaDescription, absoluteUrl, SITE_NAME } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types";

export const revalidate = 300;

async function getCategory(slug: string): Promise<Category | null> {
  try {
    return await catalogApi.category<Category>(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: `Category Not Found | ${SITE_NAME}` };

  const title = `About ${category.category_name} | ${SITE_NAME}`;
  const description =
    toMetaDescription(category.footer_description) ||
    `Learn about ${category.category_name} medicines available at ${SITE_NAME}.`;
  const url = absoluteUrl(`/category/${slug}/about`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
  };
}

export default async function CategoryAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const description = category.footer_description ? stripInlineFormatting(category.footer_description) : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-6 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/" className="hover:text-[var(--blue-600)]">Home</Link>
        <ChevronRight size={12} />
        <Link href={`/category/${slug}`} className="hover:text-[var(--blue-600)]">{category.category_name}</Link>
        <ChevronRight size={12} />
        <span className="text-[var(--ink)]">About</span>
      </p>

      {category.category_image && (
        <div className="relative mb-6 h-48 w-full overflow-hidden rounded-[var(--radius-lg)] sm:h-64">
          <Image src={mediaUrl(category.category_image)} alt={category.category_name} fill className="object-cover" priority />
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-[var(--ink)]">{category.category_name}</h1>
        {!!category.product_count && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--blue-50)] px-3 py-1 text-xs font-semibold text-[var(--blue-600)]">
            <Package size={12} /> {category.product_count} products
          </span>
        )}
      </div>

      {description ? (
        <div
          className="prose prose-sm mt-6 max-w-none text-[var(--ink-soft)] [&_p]:mb-4 [&_a]:text-[var(--blue-600)] [&_strong]:text-[var(--ink)] [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[var(--ink)]"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      ) : (
        <p className="mt-6 text-[var(--ink-soft)]">No additional information available for this category.</p>
      )}

      <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--line)] pt-6">
        <Button href={`/category/${slug}`} icon={<ShoppingBag size={16} />}>
          Browse {category.category_name} Products
        </Button>
        <Button href="/shop" variant="outline">Shop All Medicines</Button>
      </div>
    </div>
  );
}