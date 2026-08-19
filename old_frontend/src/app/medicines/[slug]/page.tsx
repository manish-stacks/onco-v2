import { notFound } from "next/navigation";
import { catalogApi } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import { ProductDetail } from "@/components/sections/product-detail";
import type { ApiProduct } from "@/types";

export const revalidate = 300;

export default async function MedicinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let product: ApiProduct | null = null;
  try {
    product = await catalogApi.product<ApiProduct>(slug);
  } catch {
    product = null;
  }

  if (!product) notFound();

  const medicine = productToMedicine(product);
  const related = (product.related ?? []).map(productToMedicine);

  return <ProductDetail medicine={medicine} related={related} />;
}
