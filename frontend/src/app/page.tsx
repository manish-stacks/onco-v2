import { Hero } from "@/components/sections/hero";
import { PromoBanners } from "@/components/sections/promo-banners";
import { CategoryGrid } from "@/components/sections/category-grid";
import { ProductRail } from "@/components/sections/product-rail";
import { WhyChooseUs } from "@/components/sections/why-choose-us";
import { WhyOncoHealthMart } from "@/components/sections/why-oncohealthmart";
import { PopularItemsTabs } from "@/components/sections/popular-items-tabs";
import { FlashSale } from "@/components/sections/flash-sale";
import { Brands } from "@/components/sections/brands";
import { Testimonials } from "@/components/sections/testimonials";
import { AppDownload } from "@/components/sections/app-download";
import { BlogPreview } from "@/components/sections/blog-preview";
import { FAQSection } from "@/components/sections/FAQSection";
import { MegaSaleBanner } from "@/components/sections/mega-sale-banner";
import { getHomeData } from "@/lib/home";
import { productToMedicine, categoryToTag, brandToTag, testimonialToTag } from "@/lib/adapters";
import { contentApi } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

export default async function Home() {
  const [home, faqs] = await Promise.all([
    getHomeData(),
    contentApi.faqs<{ question: string; answer: string }[]>().catch(() => []),
  ]);

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
      <Hero banners={home.banners} />
      <CategoryGrid categories={categories} />
      <PromoBanners deals={home.deals} />
      <ProductRail title="Newly Added Medicines" medicines={featured.slice(0, 8)} href="/shop" />
      <WhyChooseUs />
      <PopularItemsTabs medicines={topSelling.length ? topSelling : latest} categories={categories} />
      {flashDeals.length > 0 && <FlashSale medicines={flashDeals.slice(0, 4)} />}
      <Brands brands={brands} />
      {/* <MegaSaleBanner /> */}
      <ProductRail title="Most Prescribed Medicines" medicines={topSelling.slice(0, 8)} href="/shop" />
      <Testimonials testimonials={testimonials} />
      <AppDownload />
      <BlogPreview />
      <WhyOncoHealthMart />
      <FAQSection faqs={faqs ?? undefined} />
    </>
  );
}