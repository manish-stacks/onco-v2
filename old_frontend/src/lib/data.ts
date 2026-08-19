/**
 * Static marketing content that has no backend equivalent (blog posts, FAQs,
 * team bios). Product, category, brand, and testimonial data now comes from
 * the real storefront API — see `lib/api.ts`, `lib/home.ts` and
 * `lib/adapters.ts`.
 */
import doctorsRaw from "@/data/doctors.json";
import faqsRaw from "@/data/faqs.json";
import blogsRaw from "@/data/blogs.json";
import type { Doctor, FAQ, BlogPost } from "@/types";

export const doctors = doctorsRaw as Doctor[];
export const faqs = faqsRaw as FAQ[];
export const blogs = blogsRaw as BlogPost[];

export function getBlogBySlug(slug: string) {
  return blogs.find((b) => b.slug === slug);
}
