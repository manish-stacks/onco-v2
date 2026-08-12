import { withToken } from "@/lib/api";
import type { Medicine } from "@/types";
import { cookies } from "next/headers";

export type HomeProductData = {
  deal_of_the_day: Medicine[];
  latest_products: Medicine[];
  top_selling: Medicine[];
};

/** Server-side call: cookie se token nikal ke request me bhejta hai. */
async function getServerApi() {
  const token = (await cookies()).get("ohm_token")?.value ?? null;
  return withToken(token);
}

export async function getHomeProducts(): Promise<HomeProductData> {
  try {
    const serverApi = await getServerApi();

    const home = await serverApi.data<{
      deal_of_the_day?: Medicine[];
      latest_products?: Medicine[];
      top_selling?: Medicine[];
    }>("/home");

    return {
      deal_of_the_day: home?.deal_of_the_day || [],
      latest_products: home?.latest_products || [],
      top_selling: home?.top_selling || [],
    };
  } catch (error) {
    console.error("Failed to fetch homepage products:", error);

    return {
      deal_of_the_day: [],
      latest_products: [],
      top_selling: [],
    };
  }
}

/** Product detail — fetched fresh (not cached) so cart/wishlist/stock stay accurate. */
export async function getHomeProductBySlug(slug: string): Promise<Medicine | null> {
  try {
    const serverApi = await getServerApi();
    const product = await serverApi.data<Medicine>(`/products/${slug}`);
    return product ?? null;
  } catch (error) {
    console.error("Failed to fetch product by slug:", error);
    return null;
  }
}