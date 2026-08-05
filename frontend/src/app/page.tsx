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
import { medicines } from "@/lib/data";
import { FAQSection } from "@/components/sections/FAQSection";
import { MegaSaleBanner } from "@/components/sections/mega-sale-banner";

export default function Home() {
  const featured = medicines.slice(0, 8);
  const bestSelling = [...medicines].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 8);
  const flashDeals = [...medicines].sort((a, b) => b.discountPercent - a.discountPercent).slice(0, 4);

  return (
    <>
      <Hero />
      <CategoryGrid />
      <PromoBanners />
      <ProductRail title="Trending Items" medicines={featured} href="/category/health-essentials" />
      <WhyChooseUs />
      <PopularItemsTabs medicines={medicines} />
      <FlashSale medicines={flashDeals} />
      <Brands />
      <MegaSaleBanner />
      <ProductRail title="Featured Items" medicines={bestSelling} href="/category/health-essentials" />
      <Testimonials />
      <BlogPreview />
      <Newsletter />
      <FAQSection />
    </>
  );
}
