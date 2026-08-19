import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function MegaSaleBanner() {
  return (
    <section className="mx-auto max-w-7xl py-6 ">
      <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
        <Image
          src="https://live.themewild.com/medion/assets/img/banner/big-banner.jpg"
          alt="Mega Sale — Up to 40% Off"
          width={1320}
          height={320}
          className="h-48 w-full object-cover sm:h-64 lg:h-80"
          priority={false}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink-soft)]">
            mega collections
          </p>
          <h2 className="font-display text-2xl font-black text-[var(--ink)] sm:text-4xl lg:text-5xl">
            HUGE SALE UP TO 40% OFF
          </h2>
          <div className="my-3 h-px w-32 bg-[var(--ink-soft)]/40" />
          <p className="mb-5 text-xs tracking-wide text-[var(--ink-soft)] underline underline-offset-4">
            at our outlet stores
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--blue-500)] px-7 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(46,159,227,0.55)] transition hover:bg-[var(--blue-600)]"
          >
            Shop Now <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
