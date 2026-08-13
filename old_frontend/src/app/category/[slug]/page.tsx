import { notFound } from "next/navigation";
import { categories, getCategoryBySlug, getMedicinesByCategory } from "@/lib/data";
import { CategoryListing } from "@/components/sections/category-listing";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();
  const medicines = getMedicinesByCategory(category.id);

  return <CategoryListing category={category} medicines={medicines} />;
}
