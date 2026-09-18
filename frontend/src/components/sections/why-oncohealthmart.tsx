import {
  ShieldCheck,
  FileCheck2,
  Truck,
  Headphones,
  Check,
  ArrowRight,
} from "lucide-react";

import { Reveal } from "@/components/ui/reveal";

const reasons = [
  {
    icon: ShieldCheck,
    number: "01",
    title: "100% Genuine Medicines",
    desc: "Every product is sourced directly from licensed manufacturers and authorised distributors.",
  },
  {
    icon: FileCheck2,
    number: "02",
    title: "Verified Prescriptions",
    desc: "Every prescription order is reviewed by our licensed pharmacy team before dispatch.",
  },
  {
    icon: Truck,
    number: "03",
    title: "Pan-India Cold Chain Delivery",
    desc: "Temperature-controlled, secure and discreet delivery across India, right to your doorstep.",
  },
  {
    icon: Headphones,
    number: "04",
    title: "24/7 Patient Support",
    desc: "Our care team is available for order assistance, refill reminders and medicine-related support.",
  },
];

export function WhyOncoHealthMart() {
  return (
    <section className="relative overflow-hidden bg-[#F7FAFF] py-16 sm:py-20 lg:py-24">
      {/* Decorative backgrounds */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-100/40 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">

          {/* LEFT CONTENT */}
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 shadow-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--blue-500)]" />
                </span>

                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--blue-500)]">
                  Trusted Care, Delivered
                </span>
              </div>

              <h2 className="max-w-lg font-display text-3xl font-bold leading-[1.15] text-[var(--ink)] sm:text-4xl lg:text-[46px]">
                Why patients trust
                <span className="block text-[var(--blue-500)]">
                  OncoHealthMart
                </span>
              </h2>

              <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--ink-soft)] sm:text-[15px]">
                Accessing speciality medicines should feel safe, simple and
                dependable. We combine verified medicines, prescription checks,
                secure delivery and dedicated patient support at every step.
              </p>

              {/* checklist */}
              <div className="mt-8 space-y-3">
                {[
                  "Licensed & trusted sourcing",
                  "Secure medicine handling",
                  "Dedicated patient assistance",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm font-medium text-[var(--ink)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="h-4 w-4 text-emerald-600" />
                    </span>

                    {item}
                  </div>
                ))}
              </div>

              {/* small trust card */}
              <div className="mt-9 flex max-w-md items-center gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_12px_40px_rgba(35,81,150,0.07)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-500)]">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>

                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">
                    Your safety comes first
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">
                    Every order passes through our quality and verification
                    process.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* RIGHT CARDS */}
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {reasons.map(
              ({ icon: Icon, title, desc, number }, index) => (
                <Reveal key={title} delay={index * 0.06}>
                  <div
                    className={`
                      group relative h-full overflow-hidden rounded-[26px]
                      border border-[#E4ECF7] bg-white p-6
                      shadow-[0_10px_40px_rgba(31,70,130,0.06)]
                      transition-all duration-300
                      hover:-translate-y-1
                      hover:border-blue-200
                      hover:shadow-[0_20px_50px_rgba(31,70,130,0.12)]
                      sm:p-7
                      ${index === 1 || index === 3 ? "sm:translate-y-7" : ""}
                    `}
                  >
                    {/* subtle bg */}
                    <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[80px] bg-gradient-to-bl from-blue-50 to-transparent transition-all duration-300 group-hover:h-36 group-hover:w-36" />

                    {/* number */}
                    <span className="absolute right-5 top-4 font-display text-[42px] font-bold leading-none text-blue-50">
                      {number}
                    </span>

                    {/* icon */}
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--blue-50)] transition-all duration-300 group-hover:bg-[var(--blue-500)]">
                      <Icon className="h-6 w-6 text-[var(--blue-500)] transition-colors duration-300 group-hover:text-white" />
                    </div>

                    <div className="relative mt-6">
                      <h3 className="max-w-[240px] font-display text-[17px] font-bold leading-6 text-[var(--ink)] sm:text-lg">
                        {title}
                      </h3>

                      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                        {desc}
                      </p>
                    </div>

                    <div className="relative mt-6 flex items-center gap-2 text-xs font-bold text-[var(--blue-500)] opacity-70 transition-all duration-300 group-hover:gap-3 group-hover:opacity-100">
                      Trusted service
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>

                    {/* bottom accent */}
                    <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-[var(--blue-500)] transition-all duration-500 group-hover:w-full" />
                  </div>
                </Reveal>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}