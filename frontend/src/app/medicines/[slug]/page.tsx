import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/sections/product-detail";
import { getHomeProductBySlug } from "@/lib/productapi";

export default async function MedicinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const medicine = await getHomeProductBySlug(slug);
  console.log("medicine", medicine);
  if (!medicine) notFound();

  return <ProductDetail medicine={medicine} />;
}
