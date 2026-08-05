import Image from "next/image";
import { testimonials } from "@/lib/data";
import { Rating } from "@/components/ui/rating";
import { Reveal } from "@/components/ui/reveal";
import { Quote } from "lucide-react";

export function Testimonials() {
  return (
    <section className="bg-[var(--ink)] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Testimonials</p>
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            What Our Client Say&apos;s <span className="text-[var(--blue-500)]">About Us</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.05}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] bg-white p-6">
                <Quote size={40} className="pointer-events-none absolute bottom-4 right-4 text-[var(--blue-50)]" />
                <div className="mb-4 flex items-center gap-3">
                  <Image src={t.avatar} alt={t.name} width={44} height={44} className="rounded-full" />
                  <div>
                    <p className="text-sm font-bold text-[var(--ink)]">{t.name}</p>
                    <p className="text-xs text-[var(--blue-600)]">{t.role}</p>
                  </div>
                </div>
                <p className="relative z-10 mb-4 flex-1 text-sm leading-relaxed text-[var(--ink-soft)]">{t.quote}</p>
                <Rating value={t.rating} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
