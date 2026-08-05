"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const slides = [
  {
    ribbon: "EASY HEALTH CARE",
    titleTop: "Medicine & Health Care",
    titleBottom: "For Your Family",
    body: "There are many variations of passages of Lorem Ipsum available but the majority have suffered alteration in some form.",
    price: "₹250",
    image: "https://live.themewild.com/medion/assets/img/hero/02.png",
  },
  {
    ribbon: "TRUSTED BY DOCTORS",
    titleTop: "Genuine Supplements",
    titleBottom: "Delivered Fast",
    body: "Sourced from certified manufacturers with quality checks at every step so your family gets only the best.",
    price: "₹180",
    image: "https://live.themewild.com/medion/assets/img/hero/03.png",
  },
  {
    ribbon: "MEGA HEALTH SALE",
    titleTop: "Up To 40% Off",
    titleBottom: "On Wellness Range",
    body: "Vitamins, skincare and daily essentials at prices that make healthy living affordable.",
    price: "₹99",
    image: "https://live.themewild.com/medion/assets/img/product/05.png",
  },
];

export function Hero() {
  const [active, setActive] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const startSlider = () => {
    if (timer.current) clearInterval(timer.current);

    timer.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 7000);
  };

  useEffect(() => {
    startSlider();

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const nextSlide = () => {
    setActive((prev) => (prev + 1) % slides.length);
    startSlider();
  };

  const prevSlide = () => {
    setActive((prev) => (prev - 1 + slides.length) % slides.length);
    startSlider();
  };

  const goToSlide = (index: number) => {
    setActive(index);
    startSlider();
  };

  const slide = slides[active];

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-sky-50">

        <div className="grid items-center gap-10 px-8 py-10 lg:grid-cols-2 lg:px-16">

          {/* Left */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block rounded-full bg-blue-600 px-5 py-2 text-xs font-bold tracking-widest text-white uppercase">
                {slide.ribbon}
              </span>

              <h1 className="mt-6 text-5xl font-bold leading-tight text-slate-900">
                {slide.titleTop}
                <br />
                <span className="text-blue-600">{slide.titleBottom}</span>
              </h1>

              <p className="mt-6 max-w-lg text-slate-600">
                {slide.body}
              </p>

              <div className="mt-8 flex gap-4">
                <Button href="/category/health-essentials">
                  Shop Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  href="/blog"
                  className="bg-coral-500  hover:bg-orange-600 text-white"
                >
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right */}
          <div className="relative flex justify-center">

            <div className="absolute h-105 w-105 rounded-full bg-blue-200"></div>

            <div className="absolute left-2 top-4 z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-dashed border-white bg-[var(--coral-500)] text-center text-white shadow-lg sm:h-24 sm:w-24">
              <span className="text-xs">Price</span>
              <span className="text-xl font-bold">
                {slide.price}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 0.9, x: 40 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -40 }}
                transition={{ duration: 0.5 }}
                className="relative z-10"
              >
                <Image
                  src={slide.image}
                  alt={slide.titleTop}
                  width={420}
                  height={420}
                  priority
                  className="object-contain drop-shadow-2xl"
                />
              </motion.div>
            </AnimatePresence>

          </div>
        </div>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all ${active === index
                  ? "h-2 w-8 rounded-full bg-blue-600"
                  : "h-2 w-2 rounded-full bg-gray-400"
                }`}
            />
          ))}
        </div>

        {/* Prev */}
        <button
          onClick={prevSlide}
          className="absolute bottom-6 right-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Next */}
        <button
          onClick={nextSlide}
          className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
        >
          <ChevronRight size={20} />
        </button>

      </div>
    </section>
  );
}