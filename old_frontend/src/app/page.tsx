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

import { getHomeProducts } from "@/lib/productapi";

export default async function Home() {
  const {
    deal_of_the_day,
    latest_products,
    top_selling,
  } = await getHomeProducts();

  console.log("Home page products:", {
   
    latest_products,
    
  });
  return (
    <>
      <Hero />

      <CategoryGrid />

      <PromoBanners />

      <ProductRail
        title="Latest Products"
        medicines={latest_products}
        href="/shop"
      />

      <WhyChooseUs />

      <PopularItemsTabs
        medicines={top_selling}
      />

      <FlashSale
        medicines={deal_of_the_day}
      />

      <Brands />

      <MegaSaleBanner />

      <ProductRail
        title="Top Selling Products"
        medicines={top_selling}
        href="/shop"
      />

      <Testimonials />

      <BlogPreview />

      <Newsletter />

      <FAQSection />
    </>
  );
}