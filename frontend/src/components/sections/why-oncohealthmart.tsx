import { ShieldCheck, FileCheck2, Truck, Headphones } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const reasons = [
  { icon: ShieldCheck, title: "100% Genuine Medicines", desc: "Sourced directly from licensed manufacturers and authorised distributors." },
  { icon: FileCheck2, title: "Verified Prescriptions", desc: "Every prescription order is reviewed by our licensed pharmacists before dispatch." },
  { icon: Truck, title: "Cold Chain Delivery", desc: "Temperature-controlled, secure and discreet delivery across India." },
  { icon: Headphones, title: "24/7 Patient Support", desc: "Help with orders, refills and medicine queries whenever you need it." },
];

const stats = [
  { value: "10+", label: "Years of experience" },
  { value: "PAN India", label: "Delivery network" },
  { value: "100%", label: "Genuine products" },
  { value: "24/7", label: "Patient support" },
];

export function WhyOncoHealthMart() {
  return (
    <section className="bg-[#071C35] py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Trusted Care, Delivered</p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Why patients trust <span className="text-blue-300">Onco Health Mart</span>
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/65">
            Safe, simple and dependable access to super speciality medicines, with checks and support at every step.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.06] p-6 transition-colors hover:bg-white/10">
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--blue-500)] text-white">
                  <Icon size={22} />
                </span>
                <h3 className="font-display text-base font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8">
          <div className="grid grid-cols-2 divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] py-5 lg:grid-cols-4 lg:divide-x">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-2 text-center">
                <p className="font-display text-2xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-xs text-white/55">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
