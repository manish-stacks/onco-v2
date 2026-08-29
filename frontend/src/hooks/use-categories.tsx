"use client";

import { useEffect, useState } from "react";
import { catalogApi } from "@/lib/api";
import { categoryToTag } from "@/lib/adapters";
import type { Category, CategoryTag } from "@/types";

// Once fetched, this stayed in memory for the whole tab session with no
// expiry, so admin changes (e.g. category position) never showed up in the
// mega menu / category lists until a hard reload. Give it a short TTL instead.
const CACHE_TTL_MS = 60_000;
let cache: CategoryTag[] | null = null;
let cachedAt = 0;

export function useCategories() {
  const isFresh = cache && Date.now() - cachedAt < CACHE_TTL_MS;
  const [categories, setCategories] = useState<CategoryTag[]>(isFresh ? cache! : []);
  const [loading, setLoading] = useState(!isFresh);

  useEffect(() => {
    if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return;
    let mounted = true;
    catalogApi
      .categories<Category[]>()
      .then((data) => {
        const tags = (data || [])
          .filter((c) => String(c.status || "").toLowerCase() === "active")
          .map(categoryToTag);
        cache = tags;
        cachedAt = Date.now();
        if (mounted) setCategories(tags);
      })
      .catch(() => {
        if (mounted) setCategories([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { categories, loading };
}
