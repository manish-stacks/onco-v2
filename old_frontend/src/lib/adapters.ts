import { mediaUrl } from "@/lib/api";
import type {
  ApiProduct,
  Category,
  ApiBrand,
  BrandTag,
  CategoryTag,
  ApiTestimonial,
  TestimonialTag,
  Medicine,
  Review,
} from "@/types";

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

/** Backend Product -> UI Medicine shape used by ProductCard / rails / listing / detail */
export function productToMedicine(p: ApiProduct): Medicine {
  const mrp = num(p.product_mrp);
  const price = num(p.product_sp, mrp);
  const discountPercent = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const images = [p.image_1, p.image_2, p.image_3, p.image_4, p.image_5]
    .filter((img): img is string => !!img)
    .map((img) => mediaUrl(img));

  const stockQty = num(p.stock_quantity, 0);
  const backorder = String(p.allow_backorder) === "1" || p.allow_backorder === true;
  const inStock = stockQty > 0 || backorder || String(p.stock || "").toLowerCase() === "in stock";

  const reviews: Review[] = [];

  return {
    id: String(p.product_id),
    slug: p.slug,
    name: p.product_name,
    manufacturer: p.brand_name || "",
    brandId: p.brand_id !== undefined ? String(p.brand_id) : "",
    categoryId: p.categories?.[0] ? String(p.categories[0].category_id) : "",
    image: images[0] || "/placeholder.png",
    images: images.length ? images : ["/placeholder.png"],
    mrp,
    price,
    discountPercent,
    rating: num(p.avg_rating, 0),
    reviewCount: num(p.review_count, 0),
    prescriptionRequired: String(p.presciption_required).toLowerCase() === "yes",
    inStock,
    packSize: p.weight_quantity || "",
    composition: p.salt || "",
    benefits: (p.benifits || "").split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean),
    uses: (p.key_features || "").split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean),
    dosage: p.how_to_use || "",
    sideEffects: (p.side_effects || "").split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean),
    storage: p.storage || "",
    tags: [],
    reviews,
    faqs: [],
  };
}

export function categoryToTag(c: Category): CategoryTag {
  return {
    id: String(c.category_id),
    name: c.category_name,
    slug: c.slug,
    image: c.category_image ? mediaUrl(c.category_image) : null,
    productCount: c.product_count ?? 0,
    description: c.footer_description || undefined,
  };
}

export function brandToTag(b: ApiBrand): BrandTag {
  return {
    id: String(b.id),
    name: b.title,
    slug: b.slug,
    logo: mediaUrl(b.image_url),
  };
}

export function testimonialToTag(t: ApiTestimonial, i = 0): TestimonialTag {
  return {
    id: String(t.review_id ?? i),
    name: t.name,
    role: t.profession || "Verified Buyer",
    quote: t.review,
    rating: num(t.stars, 5),
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(t.name || "U")}`,
  };
}
