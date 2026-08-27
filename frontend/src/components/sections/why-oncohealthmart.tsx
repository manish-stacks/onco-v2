import {
  ShieldCheck, PackageSearch, HeartHandshake, Truck, FileCheck2, Headphones,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const reasons = [
  {
    icon: ShieldCheck,
    title: "100% Genuine Medicines",
    desc: "Every product is sourced directly from licensed manufacturers and distributors, so what you order is what you get.",
  },
  {
    icon: FileCheck2,
    title: "Verified Prescriptions",
    desc: "Our in-house licensed pharmacists review every prescription order before it ships, for your safety.",
  },
  {
    icon: Truck,
    title: "Pan-India Cold Chain Delivery",
    desc: "Temperature-controlled, discreet packaging with fast delivery across India — right to your doorstep.",
  },
  {
    icon: Headphones,
    title: "24/7 Patient Support",
    desc: "Our care team is available round the clock for order help, refill reminders and medical queries.",
  },
];

export function WhyOncoHealthMart() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Reveal className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Trusted Care, Delivered</p>
        <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Why OncoHealthMart?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--ink-soft)]">
          We make it simple to get genuine, speciality medicines — with the care and support that comes with them.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
        {reasons.map(({ icon: Icon, title, desc }, i) => (
          <Reveal key={title} delay={i * 0.06}>
            <div className="flex h-full flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-50)]">
                <Icon size={22} className="text-[var(--blue-500)]" />
              </span>
              <p className="font-display text-sm font-bold text-[var(--ink)]">{title}</p>
              <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
