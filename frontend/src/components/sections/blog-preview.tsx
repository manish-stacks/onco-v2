import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, UserCircle, MessagesSquare } from "lucide-react";
import { blogs } from "@/lib/data";
import { Reveal } from "@/components/ui/reveal";

export function BlogPreview() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-600)]">Our Blog</p>
        <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
          Our Latest News &amp; <span className="text-[var(--blue-500)]">Blog</span>
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {blogs.slice(0, 3).map((b, i) => (
          <Reveal key={b.id} delay={i * 0.05}>
            <div className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-white transition-shadow hover:shadow-[0_20px_45px_-20px_rgba(11,33,48,0.2)]">
              <Link href={`/blog/${b.slug}`} className="relative block aspect-[16/10] overflow-hidden">
                <Image src={b.image} alt={b.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-[var(--blue-500)] px-3 py-1.5 text-xs font-semibold text-white">
                  <CalendarDays size={13} /> {new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-center gap-4 text-xs text-[var(--ink-soft)]">
                  <span className="flex items-center gap-1"><UserCircle size={14} /> By {b.author}</span>
                  <span className="flex items-center gap-1"><MessagesSquare size={14} /> Comments</span>
                </div>
                <h3 className="mb-2 line-clamp-2 flex-1 font-display text-lg font-bold text-[var(--ink)]">
                  <Link href={`/blog/${b.slug}`}>{b.title}</Link>
                </h3>
                <p className="mb-4 line-clamp-2 text-sm text-[var(--ink-soft)]">{b.excerpt}</p>
                <Link
                  href={`/blog/${b.slug}`}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--blue-500)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--blue-600)]"
                >
                  Read More <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
