import Image from "next/image";
import type { Metadata } from "next";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import {
  Truck, RefreshCw, Wallet, Headphones,
  ShieldCheck, HeartPulse, FlaskConical, Users,
  ArrowRight, Quote,
} from "lucide-react";

export const metadata: Metadata = {
  title: `About Us | ${SITE_NAME}`,
  description:
    `Learn about ${SITE_NAME} — India's trusted online pharmacy for genuine medicines, fast delivery, and verified prescriptions.`,
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: {
    title: `About Us | ${SITE_NAME}`,
    description: `Learn about ${SITE_NAME} — India's trusted online pharmacy for genuine medicines, fast delivery, and verified prescriptions.`,
    url: absoluteUrl("/about"),
    siteName: SITE_NAME,
    type: "website",
  },
};

const stats = [
  { value: "15K+", label: "Happy Customers" },
  { value: "5K+", label: "Products Listed" },
  { value: "98%", label: "Order Accuracy" },
  { value: "24/7", label: "Customer Support" },
];

const values = [
  { icon: ShieldCheck,   title: "Certified & Safe",      desc: "Every product is sourced from licensed manufacturers and passes multiple quality checks before reaching you." },
  { icon: HeartPulse,    title: "Patient First",         desc: "We build our services around patient wellbeing, not just transactions — from prescription uploads to doorstep delivery." },
  { icon: FlaskConical,  title: "Evidence-Based",        desc: "Our pharmacy team curates only medicines backed by clinical evidence and approved by health regulators." },
  { icon: Users,         title: "Community Trust",       desc: "Over 15,000 families trust Onco Health Mart for their everyday healthcare needs across the country." },
];

const perks = [
  { icon: Truck,        title: "Free Delivery",    desc: "Orders Over 1500" },
  { icon: RefreshCw,    title: "Easy Returns",     desc: "Hassle-free return policy" },
  { icon: Wallet,       title: "Safe Payment",     desc: "100% Secure" },
  { icon: Headphones,   title: "24/7 Support",     desc: "Always Here For You" },
];

const team = [
  { name: "Dr. Sarah Allen",    role: "Chief Pharmacist",        img: "https://picsum.photos/seed/team-sarah/400/400" },
  { name: "James Carter",       role: "Operations Manager",      img: "https://picsum.photos/seed/team-james/400/400" },
  { name: "Dr. Priya Mehta",    role: "Medical Advisor",         img: "https://picsum.photos/seed/team-priya/400/400" },
  { name: "Lena Brooks",        role: "Customer Experience Lead",img: "https://picsum.photos/seed/team-lena/400/400" },
];

export default function AboutPage() {
  return (
    <div className="bg-[var(--paper)]">

      {/* ── Hero ── */}
      <div className="bg-[var(--ink)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Who We Are</p>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Bringing Specialised Medicines Closer to You</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
            At Onco Health Mart, we are committed to making specialised medicines more accessible, reliable, and convenient for patients and their families.
          </p>
        </div>
      </div>

      {/* ── Story ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative">
              <Image
                src="https://picsum.photos/seed/about-pharmacy/800/600"
                alt="Our pharmacy team"
                width={800} height={600}
                className="rounded-[var(--radius-lg)] object-cover shadow-xl"
              />
              {/* floating badge */}
              <span className="absolute -bottom-5 -right-5 hidden flex-col items-center justify-center rounded-full border-4 border-white bg-[var(--blue-500)] p-5 text-center text-white shadow-lg sm:flex">
                <span className="text-2xl font-black leading-none">10+</span>
                <span className="mt-0.5 text-[10px] font-medium leading-tight">Years<br />Experience</span>
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">Our Story</p>
            <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
              Specialised Medicines,<br />
              <span className="text-[var(--blue-500)]">Delivered With Care</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-[var(--ink-soft)]">
              Our goal is to simplify the journey of finding the right medicine — providing a trusted platform for sourcing and delivering genuine medicines with care, right to your doorstep.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              We focus on specialised medicines, oncology-related medicines, and other critical healthcare requirements, while maintaining a strong commitment to quality, authenticity, and responsible handling. Your health matters to us, and every medicine we provide is handled with responsibility, care, and trust.
            </p>
            <div className="mt-8">
              <Button href="/contact" size="lg" icon={<ArrowRight size={17} />}>
                Get In Touch
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Mission / Vision / Purpose ── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { label: "Our Mission", title: "Bringing Specialised Medicines Closer to Every Patient", icon: HeartPulse },
            { label: "Our Vision", title: "Creating a Smarter, More Accessible Healthcare Experience", icon: FlaskConical },
            { label: "Our Purpose", title: "Making Specialised Healthcare Simpler, Safer & More Connected", icon: ShieldCheck },
          ].map(({ label, title, icon: Icon }, i) => (
            <Reveal key={label} delay={i * 0.07}>
              <div className="flex h-full flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-50)]">
                  <Icon size={22} className="text-[var(--blue-500)]" />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">{label}</p>
                <p className="font-display text-sm font-bold leading-relaxed text-[var(--ink)]">{title}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-[var(--blue-600)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map(({ value, label }) => (
            <Reveal key={label}>
              <div className="flex flex-col items-center py-12 text-center">
                <span className="font-display text-4xl font-black text-white">{value}</span>
                <span className="mt-1 text-xs font-medium uppercase tracking-wide text-white/70">{label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Values ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">What Drives Us</p>
          <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Our Core Values</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="flex h-full flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 shadow-sm">
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

      {/* ── Team ── */}
      <section className="bg-[var(--ink)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-500)]">The People Behind It</p>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Meet Our <span className="text-[var(--blue-500)]">Team</span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map(({ name, role, img }, i) => (
              <Reveal key={name} delay={i * 0.07}>
                <div className="group overflow-hidden rounded-[var(--radius-md)] bg-white/5 border border-white/10 text-center">
                  <div className="relative h-56 overflow-hidden">
                    <Image src={img} alt={name} fill sizes="300px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-transparent to-transparent opacity-60" />
                  </div>
                  <div className="p-5">
                    <p className="font-display text-sm font-bold text-white">{name}</p>
                    <p className="mt-0.5 text-xs text-[var(--blue-500)]">{role}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Perks bar ── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Reveal className="rounded-[var(--radius-lg)] bg-[var(--ink)] px-8 py-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--blue-500)] text-white"
                  style={{ borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%" }}
                >
                  <Icon size={22} />
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-white">{title}</p>
                  <p className="text-xs text-white/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

    </div>
  );
}