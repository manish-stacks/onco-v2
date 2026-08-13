import Image from "next/image";
import Link from "next/link";
import { blogs } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

export default function BlogListPage() {
  const [featured, ...rest] = blogs;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">Health Blog</h1>
        <p className="mx-auto mt-2 max-w-md text-[var(--ink-soft)]">Health tips, disease information and medicine guides from real doctors.</p>
      </div>

      <Link href={`/blog/${featured.slug}`} className="group mb-10 grid grid-cols-1 gap-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white md:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto">
          <Image src={featured.image} alt={featured.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <Badge tone="mint" className="mb-3 w-fit">{featured.category}</Badge>
          <h2 className="mb-3 font-display text-2xl font-bold text-[var(--ink)]">{featured.title}</h2>
          <p className="mb-4 text-sm leading-relaxed text-[var(--ink-soft)]">{featured.excerpt}</p>
          <p className="text-xs text-[var(--ink-soft)]">{featured.author} · {featured.readTime}</p>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((b) => (
          <Link key={b.id} href={`/blog/${b.slug}`} className="group overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-white">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src={b.image} alt={b.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="p-5">
              <Badge tone="blue" className="mb-3">{b.category}</Badge>
              <h3 className="mb-2 line-clamp-2 font-semibold text-[var(--ink)]">{b.title}</h3>
              <p className="line-clamp-2 text-sm text-[var(--ink-soft)]">{b.excerpt}</p>
              <p className="mt-3 text-xs text-[var(--ink-soft)]">{b.author} · {b.readTime}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
