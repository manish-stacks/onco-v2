import type { Metadata } from "next";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { MapPin, Truck, ShieldCheck, HeartPulse, Target, Eye, Compass, ArrowRight } from "lucide-react";

const DESC = `Learn about ${SITE_NAME} — bringing specialised medicines closer to patients with genuine products, safe delivery and care.`;

export const metadata: Metadata = {
  title: `About Us | ${SITE_NAME}`,
  description: DESC,
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: { title: `About Us | ${SITE_NAME}`, description: DESC, url: absoluteUrl("/about"), siteName: SITE_NAME, type: "website" },
};

const highlights = [
  { icon: MapPin, title: "10K+ Pincodes Covered", desc: "Serving customers across multiple locations" },
  { icon: Truck, title: "Fast & Safe Delivery", desc: "Reliable delivery right to your doorstep" },
  { icon: ShieldCheck, title: "Trusted Quality", desc: "Genuine medicines you can rely on" },
  { icon: HeartPulse, title: "Patient-Focused Care", desc: "Making specialised medicines easier to access" },
];

const pillars = [
  { icon: Target, label: "Our Mission", title: "Bringing Specialised Medicines Closer to Every Patient" },
  { icon: Eye, label: "Our Vision", title: "Creating a Smarter, More Accessible Healthcare Experience" },
  { icon: Compass, label: "Our Purpose", title: "Making Specialised Healthcare Simpler, Safer & More Connected" },
];

export default function AboutPage() {
  return (
    <div className="bg-[var(--paper)]">
      {/* Hero */}
      <div className="bg-[var(--ink)]">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">About Us</p>
          <h1 className="font-display mx-auto max-w-3xl text-3xl font-bold text-white sm:text-5xl">
            Bringing Specialised Medicines <span className="text-[var(--blue-500)]">Closer to You</span>
          </h1>
        </div>
      </div>

      {/* Intro */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-lg leading-8 text-[var(--ink)]">
            At Onco Healthmart, we are committed to making specialised medicines more accessible, reliable, and convenient for patients and their families. Our goal is to simplify that journey by providing a trusted platform for sourcing and delivering genuine medicines with care.
          </p>
          <p className="mt-5 text-base leading-8 text-[var(--ink-soft)]">
            We focus on specialised medicines, oncology-related medicines, and other critical healthcare requirements, while maintaining a strong commitment to quality, authenticity, and responsible handling.
          </p>
          <blockquote className="mt-8 border-l-4 border-[var(--blue-500)] bg-[var(--blue-50)] px-6 py-4 font-display text-base font-semibold text-[var(--ink)]">
            Your health matters to us, and every medicine we provide is handled with responsibility, care, and trust.
          </blockquote>
        </Reveal>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="flex h-full flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 text-center shadow-sm">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--blue-50)]">
                  <Icon size={24} className="text-[var(--blue-500)]" />
                </span>
                <p className="font-display text-sm font-bold text-[var(--ink)]">{title}</p>
                <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Mission / Vision / Purpose */}
      <section className="bg-[var(--ink)] py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {pillars.map(({ icon: Icon, label, title }, i) => (
            <Reveal key={label} delay={i * 0.07}>
              <div className="flex h-full flex-col gap-4 rounded-[var(--radius-md)] border border-white/10 bg-white/5 p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-500)] text-white">
                  <Icon size={22} />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">{label}</p>
                <p className="font-display text-lg font-bold leading-snug text-white">{title}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <Button href="/contact" size="lg" icon={<ArrowRight size={17} />}>Get In Touch</Button>
      </section>
    </div>
  );
}
