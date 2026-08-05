import medicinesRaw from "@/data/medicines.json";
import categoriesRaw from "@/data/categories.json";
import brandsRaw from "@/data/brands.json";
import doctorsRaw from "@/data/doctors.json";
import testimonialsRaw from "@/data/testimonials.json";
import faqsRaw from "@/data/faqs.json";
import offersRaw from "@/data/offers.json";
import blogsRaw from "@/data/blogs.json";
import type { Medicine, Category, Brand, Doctor, Testimonial, FAQ, Offer, BlogPost } from "@/types";

export const medicines = medicinesRaw as Medicine[];
export const categories = categoriesRaw as Category[];
export const brands = brandsRaw as Brand[];
export const doctors = doctorsRaw as Doctor[];
export const testimonials = testimonialsRaw as Testimonial[];
export const faqs = faqsRaw as FAQ[];
export const offers = offersRaw as Offer[];
export const blogs = blogsRaw as BlogPost[];

export function getMedicineBySlug(slug: string) {
  return medicines.find((m) => m.slug === slug);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}

export function getMedicinesByCategory(categoryId: string) {
  return medicines.filter((m) => m.categoryId === categoryId);
}

export function getBrandById(id: string) {
  return brands.find((b) => b.id === id);
}

export function getCategoryById(id: string) {
  return categories.find((c) => c.id === id);
}

export function getRelatedMedicines(medicine: Medicine, count = 4) {
  return medicines
    .filter((m) => m.categoryId === medicine.categoryId && m.id !== medicine.id)
    .slice(0, count);
}

export function getBlogBySlug(slug: string) {
  return blogs.find((b) => b.slug === slug);
}

export function searchMedicines(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return medicines.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.manufacturer.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
  );
}
