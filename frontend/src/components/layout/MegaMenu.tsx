"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, LayoutGrid, UploadCloud, ArrowRight, Package, Loader2 } from "lucide-react";
import { useCategoryTree } from "@/hooks/use-category-tree";
import { catalogApi } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import { formatINR, cn } from "@/lib/utils";
import type { ApiProduct, CategoryTreeNode, Medicine } from "@/types";

/**
 * Root category ke liye koi real icon data backend se nahi aati, isliye
 * neutral icons ka pool rakha hai — index ke hisaab se cycle karte hain,
 * sirf visual variety ke liye, kisi specific meaning ke liye nahi.
 */
const ROOT_ICONS = [
  LayoutGrid, Package, LayoutGrid, Package, LayoutGrid, Package, LayoutGrid, Package,
];

function countAll(nodes: CategoryTreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countAll(n.children), 0);
}

export function MegaMenu() {
  const { tree } = useCategoryTree();
  const [activeId, setActiveId] = useState<string | null>(null);

  const roots = tree;
  const active = useMemo(
    () => roots.find((r) => r.id === activeId) ?? roots[0] ?? null,
    [roots, activeId]
  );

  // Active root ke koi sub-categories nahi hain to uske products dikhao —
  // generic "browse products" text ki jagah asli preview.
  const [products, setProducts] = useState<Medicine[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    if (!active || active.children.length > 0) {
      setProducts([]);
      return;
    }
    let mounted = true;
    setProductsLoading(true);
    catalogApi
      .products<ApiProduct[]>({ category_id: active.id, limit: 8 })
      .then((res) => {
        if (mounted) setProducts((res?.data ?? []).map(productToMedicine));
      })
      .catch(() => {
        if (mounted) setProducts([]);
      })
      .finally(() => {
        if (mounted) setProductsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [active]);

  if (roots.length === 0) return null;

  const totalCount = countAll(roots);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className="absolute left-0 top-full w-[880px] max-w-[92vw] pt-2"
    >
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="grid grid-cols-[220px_1fr]">
          {/* Left — root categories. Click seedha category page kholta hai,
              hover sirf right panel ka preview badalta hai. */}
          <div className="max-h-[480px] overflow-y-auto border-r border-line bg-[#F7F9FC] p-3">
            {roots.map((r, i) => {
              const Icon = ROOT_ICONS[i % ROOT_ICONS.length];
              const isActive = active?.id === r.id;
              return (
                <Link
                  key={r.id}
                  href={`/category/${r.slug}`}
                  onMouseEnter={() => setActiveId(r.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    isActive ? "bg-white font-semibold text-blue-600 shadow-sm" : "text-ink hover:bg-white/70"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={15} className={isActive ? "text-blue-500" : "text-ink-soft"} />
                    {r.name}
                  </span>
                  <ChevronRight size={13} className={isActive ? "text-blue-400" : "text-ink-soft/60"} />
                </Link>
              );
            })}
          </div>

          {/* Right — active root's children, or its products if it has none */}
          <div className="max-h-[480px] overflow-y-auto p-5">
            {active && (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{active.name}</p>
                  <Link
                    href={`/category/${active.slug}`}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View All <ArrowRight size={12} />
                  </Link>
                </div>

                {active.children.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-4">
                    {active.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/category/${child.slug}`}
                        className="group flex items-start gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-blue-50/60"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                          <Package size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink group-hover:text-blue-600">
                            {child.name}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {child.blurb || (child.productCount ? `${child.productCount} products` : "Browse products")}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : productsLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center text-ink-soft">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : products.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {products.map((p) => (
                      <Link
                        key={p.id}
                        href={`/medicines/${p.slug}`}
                        className="group rounded-lg border border-line/60 p-2 transition-colors hover:border-blue-500 hover:bg-blue-50/40"
                      >
                        <div className="relative mb-2 aspect-square overflow-hidden rounded-md bg-blue-50">
                          <Image src={p.image} alt={p.name} fill className="object-contain p-1.5" />
                        </div>
                        <p className="line-clamp-2 text-xs font-medium text-ink group-hover:text-blue-600">{p.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-ink">{formatINR(p.price)}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    href={`/category/${active.slug}`}
                    className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-center text-sm text-ink-soft hover:border-blue-500 hover:text-blue-600"
                  >
                    <Package size={22} />
                    Browse {active.name} products
                  </Link>
                )}

                {/* Prescription CTA — corner card, always visible */}
                <Link
                  href="/prescription-upload"
                  className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-blue-50 bg-blue-50/50 p-4 transition-colors hover:border-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-500 shadow-sm">
                      <UploadCloud size={17} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">Can&apos;t find what you need?</p>
                      <p className="text-xs text-ink-soft">
                        <span className="font-medium text-blue-600">Upload Prescription</span> — we&apos;ll find it for you
                      </p>
                    </div>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                    <ArrowRight size={14} />
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>

        <Link
          href="/categories"
          className="flex items-center justify-center gap-1.5 border-t border-line bg-[#F7F9FC] py-3 text-xs font-medium text-ink-soft hover:text-blue-600"
        >
          {totalCount} categories to explore
        </Link>
      </div>
    </motion.div>
  );
}