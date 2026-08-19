import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { catalogApi, mediaUrl } from "@/lib/api";
import { productToMedicine, categoryToTag, brandToTag } from "@/lib/adapters";
import { getHomeData } from "@/lib/home";
import { toMetaDescription, absoluteUrl, SITE_NAME } from "@/lib/seo";
import { CategoryListing } from "@/components/sections/category-listing";
import type { ApiProduct, Category } from "@/types";

export const revalidate = 300;

const getCategory = cache(async (slug: string): Promise<Category | null> => {
  try {
    return await catalogApi.category<Category>(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: `Category Not Found | ${SITE_NAME}` };

  const title = category.meta_title?.trim() || `${category.category_name} Medicines Online | ${SITE_NAME}`;
  const description =
    toMetaDescription(category.meta_description) ||
    toMetaDescription(category.footer_description) ||
    `Shop genuine ${category.category_name} medicines online at ${SITE_NAME}. Fast delivery, verified prescriptions, best prices.`;
  const url = absoluteUrl(`/category/${category.slug}`);
  const image = category.category_image ? mediaUrl(category.category_image) : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: SITE_NAME, type: "website",
      images: image ? [{ url: image, width: 1200, height: 630, alt: category.category_name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const [productsRes, home] = await Promise.all([
    catalogApi.products<ApiProduct[]>({ category_id: category.category_id, limit: 100 }),
    getHomeData(),
  ]);

  const medicines = (productsRes?.data ?? []).map(productToMedicine);
  const brands = home.brands.map(brandToTag);

  return <CategoryListing category={categoryToTag(category)} medicines={medicines} brands={brands} />;
}