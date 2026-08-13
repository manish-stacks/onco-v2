import { notFound } from "next/navigation";
import { catalogApi } from "@/lib/api";
import { productToMedicine, categoryToTag, brandToTag } from "@/lib/adapters";
import { getHomeData } from "@/lib/home";
import { CategoryListing } from "@/components/sections/category-listing";
import type { ApiProduct, Category } from "@/types";

export const revalidate = 300;

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let category: Category | null = null;
  try {
    category = await catalogApi.category<Category>(slug);
  } catch {
    category = null;
  }
  if (!category) notFound();

  const [productsRes, home] = await Promise.all([
    catalogApi.products<ApiProduct[]>({ category_id: category.category_id, limit: 100 }),
    getHomeData(),
  ]);

  const medicines = (productsRes?.data ?? []).map(productToMedicine);
  const brands = home.brands.map(brandToTag);

  return <CategoryListing category={categoryToTag(category)} medicines={medicines} brands={brands} />;
}
