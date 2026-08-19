"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Phone, MapPin, Mail, Clock3, ChevronRight, ShieldCheck, ClipboardCheck,
  Truck, RotateCcw, Headphones,
} from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { BackToTop } from "@/components/ui/back-to-top";
import { FaFacebookF, FaXTwitter, FaLinkedinIn, FaYoutube } from "react-icons/fa6";

const quickLinks = [
  { label: "About Us", href: "/about" },
  { label: "Delivery Info", href: "/#" },
  { label: "Contact Us", href: "/contact" },
  { label: "Update News", href: "/blog" },
  { label: "Our Testimonials", href: "/#" },
  { label: "Terms Of Service", href: "/pages/terms-of-service" },
  { label: "Privacy policy", href: "/pages/privacy-policy" },
];

const supportLinks = [
  { label: "FAQ's", href: "/#faq" },
  { label: "How To Buy", href: "/#" },
  { label: "Support Center", href: "/contact" },
  { label: "Track Your Order", href: "/track" },
  { label: "Returns Policy", href: "/#" },
  { label: "Our Affiliates", href: "/#" },
  { label: "Sitemap", href: "/#" },
];

const contactItems = [
  { icon: Phone, text: "91 9289008182" },
  { icon: MapPin, text: "4958/18, Netaji Subhash Marg, Daryaganj, Delhi-110002" },
  { icon: Mail, text: "support@oncohealthmart.com" },
  { icon: Clock3, text: "Mon-Fri (9.00AM - 8.00PM)\nSat (9.00AM - 6.00PM)" },
];

const socials = [
  { Icon: FaFacebookF, href: "#" },
  { Icon: FaXTwitter, href: "#" },
  { Icon: FaLinkedinIn, href: "#" },
  { Icon: FaYoutube, href: "#" },
];

const trustStrip = [
  { icon: ShieldCheck, title: "100% Genuine Medicines", desc: "Sourced directly from licensed pharmacies" },
  { icon: ClipboardCheck, title: "Prescription Verified", desc: "All prescriptions are verified by experts" },
  { icon: Truck, title: "Fast & Safe Delivery", desc: "Medicines delivered safely to your doorstep" },
  { icon: RotateCcw, title: "Easy Returns", desc: "Hassle-free return policy" },
  { icon: Headphones, title: "Dedicated Support", desc: "We're here to help you 24x7" },
];

const paymentIcons = ["visa", "mastercard", "amex", "discover"];

export function Footer() {
  const { categories } = useCategories();

  return (
    <footer className="border-t border-[var(--line)] bg-[#F7F9FC]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand + contact */}
          <div className="col-span-2 md:col-span-2 lg:col-span-1">
            <Link href="/" className="mb-4 flex w-fit items-center">
              <Image src="/logo.png" alt="Onco Health Mart" width={200} height={63} className="h-12 w-auto object-contain" />
            </Link>
            <p className="mb-5 max-w-xs text-sm leading-relaxed text-[var(--ink-soft)]">
              We are many variations of the passages available but the majority have suffered alteration injected.
            </p>
            <ul className="space-y-3.5 text-sm text-[var(--ink)]">
              {contactItems.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                    <Icon size={14} />
                  </span>
                  <span className="whitespace-pre-line pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <p className="mb-1.5 font-display text-base font-bold text-[var(--ink)]">Quick Links</p>
            <span className="mb-4 block h-0.5 w-7 bg-[var(--blue-500)]" />
            <ul className="space-y-3">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="flex items-center gap-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--blue-600)]">
                    <ChevronRight size={12} className="text-[var(--blue-400)]" /> {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Browse Category */}
          <div>
            <p className="mb-1.5 font-display text-base font-bold text-[var(--ink)]">Browse Category</p>
            <span className="mb-4 block h-0.5 w-7 bg-[var(--blue-500)]" />
            <ul className="space-y-3">
              {categories.slice(0, 10).map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="flex items-center gap-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--blue-600)]">
                    <ChevronRight size={12} className="text-[var(--blue-400)]" /> {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Center */}
          <div>
            <p className="mb-1.5 font-display text-base font-bold text-[var(--ink)]">Support Center</p>
            <span className="mb-4 block h-0.5 w-7 bg-[var(--blue-500)]" />
            <ul className="space-y-3">
              {supportLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="flex items-center gap-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:text-[var(--blue-600)]">
                    <ChevronRight size={12} className="text-[var(--blue-400)]" /> {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* App + payments */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <p className="mb-1.5 font-display text-base font-bold text-[var(--ink)]">Get Mobile App</p>
            <span className="mb-4 block h-0.5 w-7 bg-[var(--blue-500)]" />
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              <span className="font-medium text-[var(--blue-600)]">Onco App</span> is now available on App Store &amp; Google Play.
            </p>
            <div className="mb-6 flex flex-nowrap gap-2">
              <a href="#" className="flex items-center gap-2 rounded-lg bg-[var(--ink)] px-3 py-2 text-white transition-colors hover:bg-black">
                <svg viewBox="0 0 512 512" className="h-5 w-5 shrink-0" fill="currentColor"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c17.6-11.7 17.6-46.9-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" /></svg>
                <span className="leading-tight">
                  <span className="block text-[8px] uppercase text-white/70">Get It On</span>
                  <span className="block whitespace-nowrap text-[11px] font-bold">Google Play</span>
                </span>
              </a>
              <a href="#" className="flex items-center gap-2 rounded-lg bg-[var(--ink)] px-3 py-2 text-white transition-colors hover:bg-black">
                <svg viewBox="0 0 384 512" className="h-5 w-5 shrink-0" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 0 184.4 0 272.9c0 26.5 4.9 53.9 14.6 82.2 13 37.7 59.6 130.1 108.2 128.6 25.4-.6 43.4-18.1 76.5-18.1 32.1 0 48.7 18.1 77 18.1 49 .8 91.1-83.7 103.5-121.5-65.9-31.1-61.1-91-61.1-93.5zM256.7 90.4c27.5-32.5 25-62.1 24.2-72.7-24.3 1.4-52.4 16.4-68.5 34.9-17.7 19.9-28.2 44.6-25.9 72.4 26.4 2 50.4-11.2 70.2-34.6z" /></svg>
                <span className="leading-tight">
                  <span className="block text-[8px] uppercase text-white/70">Download on the</span>
                  <span className="block whitespace-nowrap text-[11px] font-bold">App Store</span>
                </span>
              </a>
            </div>

            <p className="mb-3 font-display text-sm font-bold text-[var(--ink)]">We Accept</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {paymentIcons.map((c) => (
                <span key={c} className="flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-2">
                  <Image src={`https://live.themewild.com/medion/assets/img/payment/${c}.svg`} alt={c} width={40} height={16} className="h-5 w-auto object-contain" />
                </span>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--blue-50)] bg-[var(--blue-50)]/50 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--blue-500)] text-white">
                <ShieldCheck size={15} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">100% Secure Payments</p>
                <p className="text-xs text-[var(--ink-soft)]">Your payment details are safe with us.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-10 grid grid-cols-2 gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 sm:grid-cols-3 lg:grid-cols-5">
          {trustStrip.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-600)]">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
                <p className="text-xs text-[var(--ink-soft)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative bg-[var(--blue-600)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-white/80 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p>© 2026 <span className="font-semibold text-white">Onco Health Mart</span>. All Rights Reserved.</p>
              <p className="text-white/60">Trusted medicines. Better health. Brighter tomorrow.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            Follow Us:
            {socials.map(({ Icon, href }, i) => (
              <a key={i} href={href} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25">
                <Icon size={13} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <BackToTop />
    </footer>
  );
}