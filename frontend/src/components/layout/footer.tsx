import Link from "next/link";
import Image from "next/image";
import { Phone, MapPin, Mail, Clock3 } from "lucide-react";
import { categories } from "@/lib/data";
import { BackToTop } from "@/components/ui/back-to-top";
import { FaFacebookF, FaXTwitter, FaLinkedinIn, FaYoutube } from "react-icons/fa6";

const quickLinks = [
  { label: "About Us", href: "/#" },
  { label: "Delivery Info", href: "/#" },
  { label: "Contact Us", href: "/#" },
  { label: "Update News", href: "/blog" },
  { label: "Our Testimonials", href: "/#" },
  { label: "Terms Of Service", href: "/#" },
  { label: "Privacy policy", href: "/#" },
];

const supportLinks = [
  { label: "FAQ's", href: "/#faq" },
  { label: "How To Buy", href: "/#" },
  { label: "Support Center", href: "/#" },
  { label: "Track Your Order", href: "/profile" },
  { label: "Returns Policy", href: "/#" },
  { label: "Our Affiliates", href: "/#" },
  { label: "Sitemap", href: "/#" },
];

const contactItems = [
  { icon: Phone, text: "91 9289008182" },
  { icon: MapPin, text: "4958/18, Netaji Subhash Marg, Daryaganj, Delhi-110002" },
  { icon: Mail, text: "support@oncohealthmart.com" },
  { icon: Clock3, text: "Mon-Fri (9.00AM - 8.00PM)" },
];

const socials = [
  { Icon: FaFacebookF, href: "#" },
  { Icon: FaXTwitter, href: "#" },
  { Icon: FaLinkedinIn, href: "#" },
  { Icon: FaYoutube, href: "#" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-[#241C4D] via-[#1B2A4A] to-[var(--ink)]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-left mix-blend-soft-light"
        style={{ backgroundImage: "url(https://live.themewild.com/medion/assets/img/shape/02.png)" }}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-4 lg:grid-cols-5 lg:px-8">
        <div className="col-span-2 md:col-span-2 lg:col-span-1">
          <Link href="/" className="mb-5 flex w-fit items-center rounded-lg bg-white px-3 py-2">
            <Image src="/logo.png" alt="Onco Health Mart" width={168} height={63} className="h-12 w-auto object-contain" />
          </Link>
          <p className="mb-5 max-w-xs text-sm leading-relaxed text-white/60">
            We are many variations of the passages available but the majority have suffered alteration injected.
          </p>
          <ul className="space-y-3.5 text-sm text-white/80">
            {contactItems.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mint-500)] text-white">
                  <Icon size={14} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 font-display text-base font-bold text-white">Quick Links</p>
          <span className="mb-4 block h-0.5 w-7 bg-[var(--mint-500)]" />
          <ul className="space-y-3">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-sm text-white/60 transition-colors hover:text-[var(--mint-500)]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 font-display text-base font-bold text-white">Browse Category</p>
          <span className="mb-4 block h-0.5 w-7 bg-[var(--mint-500)]" />
          <ul className="space-y-3">
            {categories.slice(0, 7).map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="text-sm text-white/60 transition-colors hover:text-[var(--mint-500)]">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 font-display text-base font-bold text-white">Support Center</p>
          <span className="mb-4 block h-0.5 w-7 bg-[var(--mint-500)]" />
          <ul className="space-y-3">
            {supportLinks.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-sm text-white/60 transition-colors hover:text-[var(--mint-500)]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 md:col-span-4 lg:col-span-1">
          <p className="mb-1.5 font-display text-base font-bold text-white">Get Mobile App</p>
          <span className="mb-4 block h-0.5 w-7 bg-[var(--mint-500)]" />
          <p className="mb-4 text-sm text-white/60">
            Onco App is now available on App Store &amp; Google Play.
          </p>
          <p className="mb-3 font-display text-sm font-bold text-white">Download Our Mobile App</p>
          <div className="mb-6 flex flex-nowrap gap-2">
            <a href="#" className="flex items-center gap-2 rounded-lg bg-[var(--mint-500)] px-3 py-2 text-white transition-colors hover:bg-[var(--mint-600)]">
              <svg viewBox="0 0 512 512" className="h-5 w-5 shrink-0" fill="currentColor"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c17.6-11.7 17.6-46.9-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" /></svg>
              <span className="leading-tight">
                <span className="block text-[8px] uppercase text-white/80">Get It On</span>
                <span className="block text-[11px] font-bold whitespace-nowrap">Google Play</span>
              </span>
            </a>
            <a href="#" className="flex items-center gap-2 rounded-lg bg-[var(--mint-500)] px-3 py-2 text-white transition-colors hover:bg-[var(--mint-600)]">
              <svg viewBox="0 0 384 512" className="h-5 w-5 shrink-0" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 0 184.4 0 272.9c0 26.5 4.9 53.9 14.6 82.2 13 37.7 59.6 130.1 108.2 128.6 25.4-.6 43.4-18.1 76.5-18.1 32.1 0 48.7 18.1 77 18.1 49 .8 91.1-83.7 103.5-121.5-65.9-31.1-61.1-91-61.1-93.5zM256.7 90.4c27.5-32.5 25-62.1 24.2-72.7-24.3 1.4-52.4 16.4-68.5 34.9-17.7 19.9-28.2 44.6-25.9 72.4 26.4 2 50.4-11.2 70.2-34.6z" /></svg>
              <span className="leading-tight">
                <span className="block text-[8px] uppercase text-white/80">Get It On</span>
                <span className="block text-[11px] font-bold whitespace-nowrap">App Store</span>
              </span>
            </a>
          </div>

          <p className="mb-3 font-display text-sm font-bold text-white">We Accept</p>
          <div className="flex flex-wrap gap-2">
            {["visa", "mastercard", "amex", "discover"].map((c) => (
              <span key={c} className="flex h-7 items-center bg-white px-1.5">
                <Image src={`https://live.themewild.com/medion/assets/img/payment/${c}.svg`} alt={c} width={40} height={16} className="h-5 w-auto object-contain" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-white/60 sm:flex-row">
          <p>
            © 2026 <span className="font-semibold text-white">Onco Health Mart</span>. All Rights Reserved.
          </p>
          <div className="flex items-center gap-3">
            Follow Us:
            {socials.map(({ Icon, href }, i) => (
              <a key={i} href={href} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-[var(--mint-500)]">
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