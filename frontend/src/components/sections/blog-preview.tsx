import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import { getBlogs } from "@/lib/blog";
import { Reveal } from "@/components/ui/reveal";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });

export async function BlogPreview() {
  const { posts } = await getBlogs({ limit: 3 });
  if (posts.length === 0) return null;
  const [main, ...rest] = posts;

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Reveal className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-600)]">Health Insights</p>
          <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            Our Latest News &amp; <span className="text-[var(--blue-500)]">Blog</span>
          </h2>
        </div>
        <Link href="/blog" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--blue-600)] hover:gap-2">
          View all articles <ArrowRight size={15} />
        </Link>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Featured */}
        <Reveal>
          <Link href={`/blog/${main.slug}`} className="group relative block h-full min-h-[320px] overflow-hidden rounded-3xl">
            <Image src={main.image} alt={main.title} fill sizes="(max-width:1024px) 100vw, 60vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071C35] via-[#071C35]/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                <CalendarDays size={12} /> {fmt(main.date)} · <Clock size={12} /> {main.readTime}
              </span>
              <h3 className="line-clamp-2 font-display text-xl font-bold text-white sm:text-2xl">{main.title}</h3>
              <p className="mt-2 line-clamp-2 max-w-xl text-sm text-white/75">{main.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:gap-2.5">Read article <ArrowRight size={15} /></span>
            </div>
          </Link>
        </Reveal>

        {/* Side list */}
        <div className="flex flex-col gap-6">
          {rest.map((b, i) => (
            <Reveal key={b.id} delay={(i + 1) * 0.06} className="flex-1">
              <Link href={`/blog/${b.slug}`} className="group flex h-full gap-4 rounded-2xl border border-[var(--line)] bg-white p-3 transition-shadow hover:shadow-[0_20px_45px_-20px_rgba(11,33,48,0.25)]">
                <span className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-36">
                  <Image src={b.image} alt={b.title} fill sizes="150px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className="mb-1 flex items-center gap-3 text-xs text-[var(--ink-soft)]">
                    <span className="flex items-center gap-1"><CalendarDays size={12} /> {fmt(b.date)}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {b.readTime}</span>
                  </span>
                  <span className="line-clamp-2 font-display text-base font-bold text-[var(--ink)]">{b.title}</span>
                  <span className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">{b.excerpt}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
