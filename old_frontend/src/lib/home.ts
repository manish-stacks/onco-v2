import api from "@/lib/api";
import { Banner, Category, Brand, Medicine, Testimonial } from "@/types";

export interface HomeData {
  banners: Banner[];
  categories: Category[];
  brands: Brand[];
  deals: any[];
  offers: any[];
  testimonials: Testimonial[];

  top_selling: Medicine[];
  latest_products: Medicine[];
  deal_of_the_day: Medicine[];

  settings: {
    organization?: string;
    logo?: string;
    contact_phone?: string;
    contact_email?: string;
    contact_address?: string;
    facebook_link?: string;
    instagram_link?: string;
    twitter_link?: string;
    shipping_charge?: number;
    shipping_threshold?: number;
    is_cod?: string | number | boolean;
    cod_fee?: number;
  } | null;
}

/**
 * Fetch complete homepage data only once.
 */
export async function getHomeData(): Promise<HomeData> {
  try {
    const response = await api.get("/home");

    return (
      response?.data ?? {
        banners: [],
        categories: [],
        brands: [],
        deals: [],
        offers: [],
        testimonials: [],
        top_selling: [],
        latest_products: [],
        deal_of_the_day: [],
        settings: null,
      }
    );
  } catch (error) {
    console.error("Failed to fetch home data:", error);

    return {
      banners: [],
      categories: [],
      brands: [],
      deals: [],
      offers: [],
      testimonials: [],
      top_selling: [],
      latest_products: [],
      deal_of_the_day: [],
      settings: null,
    };
  }
}