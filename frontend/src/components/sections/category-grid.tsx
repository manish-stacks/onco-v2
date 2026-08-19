"use client";

import Link from "next/link";
import { ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import api from "@/lib/api";
import { Category } from "@/types";

const AUTOPLAY_INTERVAL = 3000;
const GAP = 20; 
const ITEM_WIDTH_CLASS = "w-[45%] sm:w-[31%] lg:w-[16%]"; // ~ 2 / 3 / 6 per view

export function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const [itemWidth, setItemWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const indexRef = useRef(0);
  const isHoveringRef = useRef(false);
  const isDraggingRef = useRef(false);

  // ---- fetch categories -----------------------------------------------
  useEffect(() => {
    let mounted = true;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await api.get("/home");
        const apiCategories: Category[] = response?.data?.categories || [];

        const activeCategories = apiCategories
          .filter((category) => String(category.status || "").toLowerCase() === "active")
          .filter((category) => Number(category.parent_id || 0) === 0);

        if (mounted) setCategories(activeCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        if (mounted) setCategories([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCategories();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- measure item / container width ----------------------------------
  useEffect(() => {
    const measure = () => {
      if (!trackRef.current || !containerRef.current) return;
      const firstItem = trackRef.current.children[0] as HTMLElement | undefined;
      if (firstItem) setItemWidth(firstItem.offsetWidth + GAP);
      setContainerWidth(containerRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [categories]);

  const visibleCount = itemWidth ? Math.max(Math.floor(containerWidth / itemWidth), 1) : 1;
  const maxIndex = Math.max(categories.length - visibleCount, 0);
  const maxDrag = Math.max(itemWidth * categories.length - containerWidth, 0);

  const goTo = useCallback(
    (i: number) => {
      if (!itemWidth || categories.length === 0) return;
      const clamped = Math.max(0, Math.min(i, maxIndex));
      indexRef.current = clamped;
      animate(x, -clamped * itemWidth, { type: "spring", stiffness: 300, damping: 32 });
    },
    [itemWidth, maxIndex, categories.length, x]
  );

  // ---- autoplay ----------------------------------------------------------
  useEffect(() => {
    if (!itemWidth || categories.length <= visibleCount) return; // nothing to slide
    const id = setInterval(() => {
      if (isHoveringRef.current || isDraggingRef.current) return;
      const next = indexRef.current >= maxIndex ? 0 : indexRef.current + 1;
      goTo(next);
    }, AUTOPLAY_INTERVAL);
    return () => clearInterval(id);
  }, [itemWidth, maxIndex, visibleCount, categories.length, goTo]);

  // ---- drag / swipe --------------------------------------------------
  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // let the click-suppression flag clear on next tick, after Link's onClick fires
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);

    const { offset, velocity } = info;
    let dir = 0;
    if (offset.x < -50 || velocity.x < -500) dir = 1;
    else if (offset.x > 50 || velocity.x > 500) dir = -1;

    goTo(indexRef.current + dir);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-10 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            Top Category
          </h2>
          <span className="mt-2 block h-1 w-10 rounded-full bg-[var(--blue-500)]" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goTo(indexRef.current - 1)}
            disabled={indexRef.current === 0}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-gray-50 disabled:opacity-30 sm:flex"
            aria-label="Previous categories"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => goTo(indexRef.current + 1)}
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-gray-50 sm:flex"
            aria-label="Next categories"
          >
            <ChevronRight size={16} />
          </button>
          <Link
            href="/category"
            className="flex items-center gap-1 text-sm font-semibold text-[var(--blue-600)]"
          >
            View More
            <ChevronsRight size={16} />
          </Link>
        </div>
      </Reveal>

      {loading ? (
        <div className="flex gap-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-48 flex-shrink-0 animate-pulse rounded-[var(--radius-md)] bg-gray-100 ${ITEM_WIDTH_CLASS}`}
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No categories available
        </div>
      ) : (
        <div
          ref={containerRef}
          className="overflow-hidden"
          onMouseEnter={() => {
            isHoveringRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveringRef.current = false;
          }}
        >
          <motion.div
            ref={trackRef}
            className="flex cursor-grab gap-5 active:cursor-grabbing"
            style={{ x }}
            drag="x"
            dragConstraints={{ left: -maxDrag, right: 0 }}
            dragElastic={0.08}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {categories.map((category, i) => (
              <Reveal
                key={category.category_id}
                delay={i * 0.05}
                className={`flex-shrink-0 ${ITEM_WIDTH_CLASS}`}
              >
                <Link
                  href={`/category/${category.slug}`}
                  draggable={false}
                  onClick={(e) => {
                    if (isDraggingRef.current) e.preventDefault();
                  }}
                  className="group flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(11,33,48,0.2)]"
                >
                  <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--blue-500)] p-2">
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[var(--blue-500)]">
                      {category.category_image ? (
                        <img
                          src={category.category_image}
                          alt={category.category_name}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-2xl font-bold text-white">
                          {category.category_name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </span>
                  </span>

                  <p className="mt-5 font-display font-bold text-[var(--ink)]">
                    {category.category_name}
                  </p>

                  <p className="mt-1 text-xs font-medium text-[var(--blue-600)]">
                    {category.product_count ?? 0} Items
                  </p>
                </Link>
              </Reveal>
            ))}
          </motion.div>
        </div>
      )}
    </section>
  );
}