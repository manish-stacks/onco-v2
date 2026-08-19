import { catalogApi } from "@/lib/api";
import type { HomeData } from "@/types";

const EMPTY_HOME: HomeData = {
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

/** Fetch the complete homepage payload in a single call (backend caches it). */
export async function getHomeData(): Promise<HomeData> {
  try {
    const data = await catalogApi.home<HomeData>();
    return data ?? EMPTY_HOME;
  } catch (error) {
    console.error("Failed to fetch home data:", error);
    return EMPTY_HOME;
  }
}

export type { HomeData };
