import type { Metadata } from "next";
import { BrandsDirectory } from "@/components/sections/brands-directory";
import { catalogApi } from "@/lib/api";
import { brandToTag } from "@/lib/adapters";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import type { ApiBrand, BrandTag } from "@/types";

const title = `All Brands | ${SITE_NAME}`;
const description = `Browse every pharmaceutical brand available at ${SITE_NAME}. Find genuine medicines and healthcare products from trusted manufacturers.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/brands") },
  openGraph: { title, description, url: absoluteUrl("/brands"), siteName: SITE_NAME, type: "website" },
};

export const revalidate = 600;

async function getBrands(): Promise<BrandTag[]> {
  try {
    // Dedicated endpoint — the home feed only returns 6 brands, this page needs them all
    const data = await catalogApi.brands<ApiBrand[]>();
    return (data ?? []).map(brandToTag);
  } catch {
    return [];
  }
}

export default async function BrandsPage() {
  const brands = await getBrands();
  return <BrandsDirectory brands={brands} />;
}
