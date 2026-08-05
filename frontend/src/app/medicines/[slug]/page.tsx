import { notFound } from "next/navigation";
import { medicines, getMedicineBySlug } from "@/lib/data";
import { ProductDetail } from "@/components/sections/product-detail";

export function generateStaticParams() {
  return medicines.map((m) => ({ slug: m.slug }));
}

export default async function MedicinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const medicine = getMedicineBySlug(slug);
  if (!medicine) notFound();

  return <ProductDetail medicine={medicine} />;
}
