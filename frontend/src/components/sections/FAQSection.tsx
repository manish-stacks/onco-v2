import { Accordion } from "../ui/accordion";
import { Reveal } from "../ui/reveal";

export interface FaqItem {
  question: string;
  answer: string;
}

// Backend se koi FAQ na aaye (naya setup, admin ne abhi kuch add nahi kiya)
// to bhi page khaali na dikhe — isliye ek chhota fallback set rakha hai.
const FALLBACK_FAQS: FaqItem[] = [
  {
    question: "How do I get started with OncoHealthMart?",
    answer:
      "To get started with OncoHealthMart, you need to create an account and add your medicines to your cart. You can then proceed to checkout and complete your purchase.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept various payment methods including credit/debit cards, net banking, UPI, and cash on delivery.",
  },
  {
    question: "Can I track my order?",
    answer:
      "Yes, you can track your order by logging into your account and clicking on the 'My Orders' section. You will be able to see the status of your order and the estimated delivery date.",
  },
  {
    question: "What is your return policy?",
    answer:
      "We have a 7-day return policy for all medicines. If you are not satisfied with your purchase, you can return the product within 7 days of delivery for a full refund.",
  },
];

export function FAQSection({ faqs }: { faqs?: FaqItem[] }) {
  const items = faqs && faqs.length ? faqs : FALLBACK_FAQS;

  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Got Questions?</p>
        <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Frequently asked questions</h2>
      </Reveal>
      <Reveal>
        <Accordion items={items} columns={2} />
      </Reveal>
    </section>
  );
}
