"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Banner } from "@/types";

const fallbackSlides: Banner[] = [
  {
    banner_id: 1,
    banner_type: "rich",
    banner_image:
      "https://live.themewild.com/medion/assets/img/hero/02.png",
    banner_link: "/category/health-essentials",
    ribbon: "EASY HEALTH CARE",
    title_top: "Medicine & Health Care",
    title_bottom: "For Your Family",
    body:
      "There are many variations of passages of Lorem Ipsum available but the majority have suffered alteration in some form.",
    price: "₹250",
    status: "Active",
  },
  {
    banner_id: 2,
    banner_type: "rich",
    banner_image:
      "https://live.themewild.com/medion/assets/img/hero/03.png",
    banner_link: "/category/health-essentials",
    ribbon: "TRUSTED BY DOCTORS",
    title_top: "Genuine Supplements",
    title_bottom: "Delivered Fast",
    body:
      "Sourced from certified manufacturers with quality checks at every step so your family gets only the best.",
    price: "₹180",
    status: "Active",
  },
  {
    banner_id: 3,
    banner_type: "rich",
    banner_image:
      "https://live.themewild.com/medion/assets/img/product/05.png",
    banner_link: "/category/health-essentials",
    ribbon: "MEGA HEALTH SALE",
    title_top: "Up To 40% Off",
    title_bottom: "On Wellness Range",
    body:
      "Vitamins, skincare and daily essentials at prices that make healthy living affordable.",
    price: "₹99",
    status: "Active",
  },
];

export function Hero() {
  const [active, setActive] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  const timer = useRef<NodeJS.Timeout | null>(null);

  /*
   * ============================================================
   * FETCH BANNERS
   * ============================================================
   */

  useEffect(() => {
    let mounted = true;

    const fetchBanners = async () => {
      try {
        setLoading(true);
        const response = await api.get("/home");
        const apiBanners: Banner[] =
          response?.data?.banners || [];
        /*
         * Only Active banners
         *
         * API currently returns "Active", but this also
         * handles "active".
         */
        const activeBanners = apiBanners.filter(
          (banner) =>
            String(banner.status || "").toLowerCase() ===
            "active"
        );

        if (mounted) {
          setBanners(
            activeBanners.length
              ? activeBanners
              : fallbackSlides
          );

          setActive(0);
        }
      } catch (error) {
        console.error(
          "Error fetching banners:",
          error
        );

        if (mounted) {
          setBanners(fallbackSlides);
          setActive(0);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchBanners();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ============================================================
   * CURRENT SLIDES
   * ============================================================
   */

  const slides =
    banners.length > 0
      ? banners
      : fallbackSlides;

  const slide =
    slides[active] || slides[0];

  /*
   * ============================================================
   * SLIDER TIMER
   * ============================================================
   */

  const startSlider = () => {
    if (timer.current) {
      clearInterval(timer.current);
    }

    if (slides.length <= 1) {
      return;
    }

    timer.current = setInterval(() => {
      setActive((prev) => {
        return (prev + 1) % slides.length;
      });
    }, 7000);
  };

  useEffect(() => {
    if (!slides.length) {
      return;
    }

    /*
     * If current index became invalid after API response
     */
    if (active >= slides.length) {
      setActive(0);
      return;
    }

    startSlider();

    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [slides.length, active]);

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  const nextSlide = () => {
    if (slides.length <= 1) return;

    setActive(
      (prev) => (prev + 1) % slides.length
    );
  };

  const prevSlide = () => {
    if (slides.length <= 1) return;

    setActive(
      (prev) =>
        (prev - 1 + slides.length) %
        slides.length
    );
  };

  const goToSlide = (index: number) => {
    if (
      index < 0 ||
      index >= slides.length
    ) {
      return;
    }

    setActive(index);
  };

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading && !banners.length) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-sky-50">
          <div className="grid min-h-[460px] place-items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  /*
   * ============================================================
   * NO SLIDE
   * ============================================================
   */

  if (!slide) {
    return null;
  }

  /*
   * ============================================================
   * NORMAL / RICH
   * ============================================================
   */

  const bannerType =
    String(slide.banner_type || "normal")
      .trim()
      .toLowerCase();

  const isRich = bannerType === "rich";

  const image =
    slide.banner_image ||
    "/images/banner-placeholder.png";

  const link =
    slide.banner_link?.trim() || "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-sky-50">

        {/* =====================================================
            RICH BANNER
        ===================================================== */}

        {isRich ? (
          <div className="grid min-h-[460px] items-center gap-10 px-8 py-10 lg:grid-cols-2 lg:px-16">

            {/* LEFT CONTENT */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${slide.banner_id}`}
                initial={{
                  opacity: 0,
                  x: -40,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: 40,
                }}
                transition={{
                  duration: 0.5,
                }}
              >

                {/* Ribbon */}
                {slide.ribbon && (
                  <span className="inline-block rounded-full bg-blue-600 px-5 py-2 text-xs font-bold tracking-widest text-white uppercase">
                    {slide.ribbon}
                  </span>
                )}

                {/* Title */}
                {(slide.title_top ||
                  slide.title_bottom) && (
                    <h1 className="mt-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">

                      {slide.title_top && (
                        <>
                          {slide.title_top}
                        </>
                      )}

                      {slide.title_bottom && (
                        <>
                          <br />

                          <span className="text-blue-600">
                            {slide.title_bottom}
                          </span>
                        </>
                      )}
                    </h1>
                  )}

                {/* Body */}
                {slide.body && (
                  <p className="mt-6 max-w-lg text-slate-600">
                    {slide.body}
                  </p>
                )}

                {/* Buttons */}
                <div className="mt-8 flex flex-wrap gap-4">

                  {link ? (
                    <Button href={link}>
                      Shop Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button href="/category/health-essentials">
                      Shop Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    href="/blog"
                    className="bg-coral-500 text-white hover:bg-orange-600"
                  >
                    Learn More
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* RIGHT IMAGE */}
            <div className="relative flex justify-center">

              {/* Circle */}
              <div className="absolute h-72 w-72 rounded-full bg-blue-200 sm:h-96 sm:w-96 lg:h-[420px] lg:w-[420px]" />

              {/* Price */}
              {slide.price && (
                <div className="absolute left-0 top-4 z-20 flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-dashed border-white bg-[var(--coral-500)] text-center text-white shadow-lg sm:h-24 sm:w-24">
                  <span className="text-xs">
                    Price
                  </span>

                  <span className="text-xl font-bold">
                    {slide.price}
                  </span>
                </div>
              )}

              {/* Image */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`image-${slide.banner_id}`}
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    x: 40,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    x: -40,
                  }}
                  transition={{
                    duration: 0.5,
                  }}
                  className="relative z-10"
                >
                  <Image
                    src={image}
                    alt={
                      slide.title_top ||
                      slide.ribbon ||
                      "Banner"
                    }
                    width={420}
                    height={420}
                    priority={active === 0}
                    unoptimized
                    className="h-auto max-h-[420px] w-auto object-contain drop-shadow-2xl"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (

          /* =====================================================
             NORMAL BANNER
          ===================================================== */

          <AnimatePresence mode="wait">
            <motion.div
              key={`normal-${slide.banner_id}`}
              initial={{
                opacity: 0,
                scale: 1.02,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.98,
              }}
              transition={{
                duration: 0.5,
              }}
             className="relative w-full aspect-[1920/720] overflow-hidden"
            >
              {link ? (
                <a
                  href={link}
                  className="block h-full w-full"
                >
                  <Image
                    src={image}
                    alt="Banner"
                    fill
                    priority={active === 0}
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 1200px"
                    className="object-cover"
                  />
                </a>
              ) : (
                <Image
                  src={image}
                  alt="Banner"
                  fill
                  priority={active === 0}
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="object-cover"
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* =====================================================
            DOTS
        ===================================================== */}

        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2">
            {slides.map((banner, index) => (
              <button
                key={banner.banner_id}
                type="button"
                aria-label={`Go to banner ${index + 1}`}
                onClick={() =>
                  goToSlide(index)
                }
                className={`transition-all ${active === index
                    ? "h-2 w-8 rounded-full bg-blue-600"
                    : "h-2 w-2 rounded-full bg-gray-400"
                  }`}
              />
            ))}
          </div>
        )}

        {/* =====================================================
            PREVIOUS
        ===================================================== */}

        {slides.length > 1 && (
          <button
            type="button"
            aria-label="Previous banner"
            onClick={prevSlide}
            className="absolute bottom-6 right-20 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* =====================================================
            NEXT
        ===================================================== */}

        {slides.length > 1 && (
          <button
            type="button"
            aria-label="Next banner"
            onClick={nextSlide}
            className="absolute bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </section>
  );
}