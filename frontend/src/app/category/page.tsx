// app/(site)/categories/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { catalogApi } from "@/lib/api";
import { categoryToTag } from "@/lib/adapters";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { CategoriesGrid } from "@/components/sections/CategoriesGrid";
import type { Category } from "@/types";

export const revalidate = 60; // categories change from admin fairly often (position/status)

const title = `All Categories | ${SITE_NAME}`;
const description = `Browse every medicine category at ${SITE_NAME} — from oncology and cardiac care to everyday essentials. Find genuine medicines fast.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/categories") },
  openGraph: { title, description, url: absoluteUrl("/categories"), siteName: SITE_NAME, type: "website" },
};

export default async function CategoriesPage() {
  const categories = await catalogApi.categories<Category[]>().catch(() => []);
  const tags = (categories ?? []).map(categoryToTag);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
        <Link href="/" className="hover:text-[var(--blue-600)]">Home</Link>
        <ChevronRight size={12} />
        <span className="text-[var(--ink)]">All Categories</span>
      </p>

      <div className="mb-6 text-center sm:mb-8">
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)] sm:mb-4 sm:h-14 sm:w-14">
          <LayoutGrid size={24} />
        </span>
        <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl lg:text-4xl">All Categories</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)] sm:text-base">
          {tags.length > 0 ? `${tags.length} categories to explore` : "Browse our full range of medicines"}
        </p>
      </div>

      <CategoriesGrid categories={tags} />
    </div>
  );
}