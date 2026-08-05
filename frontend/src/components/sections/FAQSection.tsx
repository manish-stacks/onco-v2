import { faqs } from "@/lib/data";
import { Accordion } from "../ui/accordion";
import { Reveal } from "../ui/reveal";

export function FAQSection() {
  return (
    <section id="faq" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Got Questions?</p>
        <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Frequently asked questions</h2>
      </Reveal>
      <Reveal>
        <Accordion items={faqs} columns={2} />
      </Reveal>
    </section>
  );
}
