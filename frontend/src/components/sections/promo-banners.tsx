"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "@/components/ui/reveal";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Deals } from "@/types";



export function PromoBanners() {
  const [dealsBanner, setDealsBanner] = useState<Deals[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchDeals = async () => {
      try {
        setLoading(true);

        const response = await api.get("/home");
        let deals: Deals[] = [];
        if (response?.data?.deals) {
          deals = response?.data?.deals || [];
        }


        if (mounted) {
          const activeDeals = deals
            .filter((deal: Deals) => deal.active_status === 1)
            .sort(
              (a: Deals, b: Deals) => a.position - b.position
            );

          setDealsBanner(activeDeals);
        }
      } catch (error) {
        console.error("Error fetching deals:", error);

        if (mounted) {
          setDealsBanner([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDeals();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-62 animate-pulse rounded-sm bg-gray-100"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!dealsBanner.length) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {dealsBanner.map((deal, i) => (
          <Reveal key={deal.id} delay={i * 0.05}>
            <Link
              href={deal.link || "#"}
              className="group relative flex h-62 flex-col justify-center overflow-hidden rounded-sm px-7"
              style={{
                backgroundColor:  "#f5f5f5",
              }}
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{
                  backgroundImage: `url(${deal.image})`,
                }}
              />

              {/* Optional overlay for readability */}
              <div className="absolute inset-0 bg-black/5 transition-colors group-hover:bg-black/10" />

              {/* Content */}
              <div className="relative z-10 w-50">
                {deal.cta && (
                  <span
                    className="mb-3 inline-block w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor:"#003873",
                      color:  "#ffffff",
                    }}
                  >
                    {deal.cta}
                  </span>
                )}

                <h3
                  className="max-w-[65%] font-display text-xl font-bold leading-snug"
                  style={{
                    color: deal.textColor || "#111827",
                  }}
                >
                  {deal.title}
                </h3>

                <span
                  className="mt-3 inline-block border-b-2 pb-0.5 text-xs font-bold uppercase tracking-wide transition-colors"
                  style={{
                    color: deal.textColor || "#111827",
                    borderColor: deal.textColor || "#111827",
                  }}
                >
                  {deal.cta || "Shop now"}
                </span>
              </div>

              {/* Glow */}
              <motion.span
                className="pointer-events-none absolute -right-6 bottom-0 h-40 w-40 rounded-full bg-white/40 blur-2xl"
                aria-hidden
              />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}