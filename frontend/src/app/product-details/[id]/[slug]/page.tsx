import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { catalogApi, mediaUrl } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import { SITE_NAME, absoluteUrl, toMetaDescription } from "@/lib/seo";
import { ProductDetail } from "@/components/sections/product-detail";
import type { ApiProduct } from "@/types";

export const revalidate = 300;

// Both `generateMetadata` and the page component call this same function
// — `cache()` lets both share one result within a single request, so the network
// so the call is not made twice.
const getProduct = cache(async (slug: string): Promise<ApiProduct | null> => {
  try {
    return await catalogApi.product<ApiProduct>(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: `Product Not Found | ${SITE_NAME}` };
  }

  const title = product.meta_title?.trim() || `${product.product_name} | ${SITE_NAME}`;
  const description =
    toMetaDescription(product.meta_description) ||
    toMetaDescription(product.short_description) ||
    toMetaDescription(product.long_description) ||
    `Buy ${product.product_name} online at ${SITE_NAME}. 100% genuine medicines, fast delivery.`;

  const image = product.image_1 ? mediaUrl(product.image_1) : undefined;
  const url = absoluteUrl(`/product-details/${product.product_id}/${product.slug}`);
  const isActive = (product.status ?? "Active") === "Active";

  return {
    title,
    description,
    alternates: { canonical: url },
    // If an inactive/discontinued product somehow resolves (edge case) then
    // Keep Google from indexing it — 404 pages are already handled by notFound().
    robots: isActive ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: image ? [{ url: image, width: 800, height: 800, alt: product.product_name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * Google ko product ka structured data — price, stock, rating, brand.
 * This is what gives search results a chance to show price/rating stars
 * (rich snippets), which plain SEO tags alone do not provide.
 */
function ProductJsonLd({ product }: { product: ApiProduct }) {
  const price = Number(product.product_sp ?? product.product_mrp ?? 0);
  const inStock = Number(product.stock_quantity ?? 0) > 0 || String(product.stock).toLowerCase() === "in stock";
  const reviewCount = Number(product.review_count ?? 0);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.product_name,
    description: toMetaDescription(product.short_description || product.long_description, 500) || undefined,
    sku: product.sku || undefined,
    image: [product.image_1, product.image_2, product.image_3].filter(Boolean).map((img) => mediaUrl(img as string)),
    ...(product.brand_name ? { brand: { "@type": "Brand", name: product.brand_name } } : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product-details/${product.product_id}/${product.slug}`),
      priceCurrency: "INR",
      price: price.toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.avg_rating ?? 0).toFixed(1),
            reviewCount,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function MedicinePage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const medicine = productToMedicine(product);
  const related = (product.related ?? []).map(productToMedicine);

  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetail medicine={medicine} related={related} />
    </>
  );
}