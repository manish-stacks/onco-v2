
import { Accordion } from "../ui/accordion";
import { Reveal } from "../ui/reveal";

const faqs = [
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
  {
    question: "Do you offer home delivery?",
    answer:
      "Yes, we offer home delivery for all orders placed on our platform. You can choose the delivery option at checkout.",
  },
  {
    question: "How can I contact customer support?",
    answer:
      "You can contact our customer support team at [email or phone number]. We are available 24/7 to assist you with any questions or concerns.",  
  },
  {
    question: "Are the medicines on your platform genuine?",
    answer:
      "Yes, we source our medicines from licensed pharmacies and ensure that all products are genuine and safe for consumption.",  
  },
  {
    question: "Do you provide prescription medicines?",
    answer:
      "Yes, we offer prescription medicines for certain conditions. Please contact our customer support team for more information.",
  }
]
export function FAQSection() {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
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
