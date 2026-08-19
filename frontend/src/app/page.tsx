import { Hero } from "@/components/sections/hero";
import { PromoBanners } from "@/components/sections/promo-banners";
import { CategoryGrid } from "@/components/sections/category-grid";
import { ProductRail } from "@/components/sections/product-rail";
import { WhyChooseUs } from "@/components/sections/why-choose-us";
import { PopularItemsTabs } from "@/components/sections/popular-items-tabs";
import { FlashSale } from "@/components/sections/flash-sale";
import { Brands } from "@/components/sections/brands";
import { Testimonials } from "@/components/sections/testimonials";
import { BlogPreview } from "@/components/sections/blog-preview";
import { Newsletter } from "@/components/sections/newsletter-faq";
import { FAQSection } from "@/components/sections/FAQSection";
import { MegaSaleBanner } from "@/components/sections/mega-sale-banner";
import { getHomeData } from "@/lib/home";
import { productToMedicine, categoryToTag, brandToTag, testimonialToTag } from "@/lib/adapters";
import { SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 300;

// Root layout ke title/description homepage ke liye hi likhe gaye hain,
// isliye yahan sirf canonical URL explicit karte hain — duplicate-content
// signals (trailing slash, query params) se bachne ke liye.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

export default async function Home() {
  const home = await getHomeData();

  const topSelling = home.top_selling.map(productToMedicine);
  const latest = home.latest_products.map(productToMedicine);
  const dealOfDay = home.deal_of_the_day.map(productToMedicine);
  const categories = home.categories.map(categoryToTag);
  const brands = home?.brands?.map(brandToTag);
  const testimonials = home.testimonials.map(testimonialToTag);

  const featured = latest.length ? latest : topSelling;
  const flashDeals = dealOfDay.length ? dealOfDay : topSelling.slice(0, 4);

  return (
    <>
      <Hero />
      <CategoryGrid />
      <PromoBanners />
      <ProductRail title="Trending Items" medicines={featured.slice(0, 8)} href="/search" />
      <WhyChooseUs />
      <PopularItemsTabs medicines={topSelling.length ? topSelling : latest} categories={categories} />
      {flashDeals.length > 0 && <FlashSale medicines={flashDeals.slice(0, 4)} />}
      <Brands brands={brands} />
      <MegaSaleBanner />
      <ProductRail title="Featured Items" medicines={topSelling.slice(0, 8)} href="/search" />
      <Testimonials testimonials={testimonials} />
      <BlogPreview />
      <Newsletter />
      <FAQSection />
    </>
  );
}