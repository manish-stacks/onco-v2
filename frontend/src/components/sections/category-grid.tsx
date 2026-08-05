import Link from "next/link";
import * as Icons from "lucide-react";
import { ChevronsRight } from "lucide-react";
import { categories } from "@/lib/data";
import { Reveal } from "@/components/ui/reveal";

export function CategoryGrid() {
  const items = categories.slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-10 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Top Category</h2>
          <span className="mt-2 block h-1 w-10 rounded-full bg-[var(--blue-500)]" />
        </div>
        <Link href="/category/health-essentials" className="flex items-center gap-1 text-sm font-semibold text-[var(--blue-600)]">
          View More <ChevronsRight size={16} />
        </Link>
      </Reveal>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((c, i) => {
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Icons.Pill;
          return (
            <Reveal key={c.id} delay={i * 0.05}>
              <Link
                href={`/category/${c.slug}`}
                className="group flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-8 text-center transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(11,33,48,0.2)]"
              >
                <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-[var(--blue-500)] p-2">
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--blue-500)] text-white">
                    <Icon size={30} strokeWidth={1.5} />
                  </span>
                </span>
                <p className="mt-5 font-display font-bold text-[var(--ink)]">{c.name}</p>
                <p className="mt-1 text-xs font-medium text-[var(--blue-600)]">{c.productCount} Items</p>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
