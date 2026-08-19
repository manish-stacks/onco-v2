"use client";

import { useEffect, useState } from "react";
import { catalogApi } from "@/lib/api";
import { categoryTreeToNode } from "@/lib/adapters";
import type { Category, CategoryTreeNode } from "@/types";

let cache: CategoryTreeNode[] | null = null;

/** Nested parent/child category tree — mega-menu ke liye. `useCategories()` se alag: wo flat list deta hai. */
export function useCategoryTree() {
  const [tree, setTree] = useState<CategoryTreeNode[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let mounted = true;
    catalogApi
      .categoryTree<(Category & { children?: unknown[] })[]>()
      .then((data) => {
        const nodes = (data || []).map(categoryTreeToNode);
        cache = nodes;
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