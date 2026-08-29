"use client";

import { useEffect, useState } from "react";
import { catalogApi } from "@/lib/api";
import { categoryTreeToNode } from "@/lib/adapters";
import type { Category, CategoryTreeNode } from "@/types";

// Same reasoning as use-categories.tsx — a permanent in-memory cache hid
// admin edits (position, name, status) for the whole tab session.
const CACHE_TTL_MS = 60_000;
let cache: CategoryTreeNode[] | null = null;
let cachedAt = 0;

/** Nested parent/child category tree — for the mega menu. Different from `useCategories()`, which returns a flat list. */
export function useCategoryTree() {
  const isFresh = cache && Date.now() - cachedAt < CACHE_TTL_MS;
  const [tree, setTree] = useState<CategoryTreeNode[]>(isFresh ? cache! : []);
  const [loading, setLoading] = useState(!isFresh);

  useEffect(() => {
    if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return;
    let mounted = true;
    catalogApi
      .categoryTree<(Category & { children?: unknown[] })[]>()
      .then((data) => {
        const nodes = (data || []).map(categoryTreeToNode);
        cache = nodes;
        cachedAt = Date.now();
        if (mounted) setTree(nodes);
      })
      .catch(() => {
        if (mounted) setTree([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { tree, loading };
}