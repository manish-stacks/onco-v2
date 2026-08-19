"use client";

import { useEffect, useState } from "react";
import { catalogApi } from "@/lib/api";
import { categoryToTag } from "@/lib/adapters";
import type { Category, CategoryTag } from "@/types";

let cache: CategoryTag[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<CategoryTag[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let mounted = true;
    catalogApi
      .categories<Category[]>()
      .then((data) => {
        const tags = (data || [])
          .filter((c) => String(c.status || "").toLowerCase() === "active")
          .map(categoryToTag);
        cache = tags;
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
