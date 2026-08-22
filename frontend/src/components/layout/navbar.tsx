"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Heart,
  ShoppingBag,
  User,
  Menu,
  X,
  ChevronDown,
  Percent,
  Truck as TruckIcon,
  ShieldCheck,
  Stethoscope,
  Tag,
  FileText,
  Headphones,
  Home,
  Users,
  Newspaper,
  Phone,
  List,
  Check,
} from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MegaMenu } from "./MegaMenu";

import { SearchSuggest } from "../sections/SearchSuggest";

const NAV_LINKS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shop", href: "/shop", icon: List },
  { label: "About Us", href: "/about", icon: Users },
  { label: "Blog", href: "/blog", icon: Newspaper },
  { label: "Contact", href: "/contact", icon: Phone },
];

const FEATURES = [
  { icon: ShieldCheck, title: "100% Genuine Medicines", sub: "Quality You Can Trust" },
  { icon: TruckIcon, title: "Fast & Safe Delivery", sub: "Across India" },
  { icon: Stethoscope, title: "Healthcare Essentials", sub: "One Stop Health Store" },
  { icon: Tag, title: "Best Prices", sub: "Save More on Medicines" },
  { icon: FileText, title: "Prescription Support", sub: "Upload & Order Easily" },
];

export function Navbar() {
  const { cartCount, cartSubtotal, wishlistIds } = useStore();
  const { user, isLoggedIn } = useAuth();
  const { categories } = useCategories();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [query, setQuery] = useState("");

  // The "All Categories" dropdown to the left of the search box
  const [catOpen, setCatOpen] = useState(false);
  const [catSlug, setCatSlug] = useState<string>("");
  const catRef = useRef<HTMLDivElement>(null);

  const selectedCat = categories.find((c) => c.slug === catSlug) || null;

  // close the dropdown on an outside click
  useEffect(() => {
    if (!catOpen) return;
    function onDocClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [catOpen]);

  /** Respects both the search term and the selected category */
  function runSearch(term?: string) {
    const q = (term ?? query).trim();
    if (!q && !catSlug) return;
    if (!q && catSlug) {
      router.push(`/category/${catSlug}`);
      return;
    }
    const params = new URLSearchParams({ q });
    if (catSlug) params.set("category", catSlug);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <header className="relative z-50 bg-white">
      {/* Promo strip */}
      <div className="bg-blue-900">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-3 overflow-x-auto px-4 text-xs text-white sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="flex items-center gap-1 rounded-full bg-mint-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <Percent size={11} /> FLAT 20% OFF
            </span>
            <span className="hidden text-white/90 sm:inline">on First Medicine Order</span>
            <span className="hidden text-white/40 md:inline">|</span>
            <span className="hidden text-white/90 md:inline">Free Delivery on Orders Above ₹499</span>
            <span className="hidden text-white/40 lg:inline">|</span>
            <span className="hidden text-white/90 lg:inline">Genuine Medicines • Trusted by 50K+ Customers</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium">
            <Headphones size={13} />
            <span>Need Help? +91 98765 43210</span>
          </div>
        </div>
      </div>

      {/* Main row: logo + search + account icons */}
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 bg-white px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/logo.png" alt="Onco Health Mart" width={200} height={63} className="h-12 w-auto object-contain md:h-14" priority />
        </Link>

        <div className="ml-6 hidden max-w-xl flex-1 items-center lg:flex">
          <div className="flex h-12 w-full items-stretch rounded-full border border-line">
            {/* ---- Category dropdown ---- */}
            <div ref={catRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setCatOpen((s) => !s)}
                className={cn(
                  "flex h-full max-w-[190px] items-center gap-1 whitespace-nowrap rounded-l-full border-r border-line px-4 text-sm font-medium",
                  catSlug ? "bg-blue-50 text-blue-700" : "bg-blue-50/60 text-ink-soft hover:bg-blue-50"
                )}
              >
                <span className="truncate">{selectedCat ? selectedCat.name : "All Categories"}</span>
                <ChevronDown size={14} className={cn("shrink-0 transition-transform", catOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {catOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-80 w-64 overflow-y-auto rounded-xl border border-line bg-white py-2 shadow-[0_20px_45px_-20px_rgba(11,33,48,0.35)]"
                  >
                    <button
                      type="button"
                      onClick={() => { setCatSlug(""); setCatOpen(false); }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-ink hover:bg-blue-50"
                    >
                      All Categories
                      {!catSlug && <Check size={14} className="text-blue-600" />}
                    </button>

                    {categories.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-ink-soft">Loading categories…</p>
                    ) : (
                      categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCatSlug(c.slug); setCatOpen(false); }}
                          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-blue-50"
                        >
                          <span className="truncate">{c.name}</span>
                          {catSlug === c.slug && <Check size={14} className="shrink-0 text-blue-600" />}
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative flex-1">
              <SearchSuggest
                value={query}
                onChange={setQuery}
                onSubmit={(term) => runSearch(term)}
                inputClassName="h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-ink-soft"
              />
            </div>
            <button
              type="button"
              onClick={() => runSearch()}
              className="flex w-14 shrink-0 items-center justify-center rounded-r-full bg-blue-500 text-white transition hover:bg-blue-600"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-5">
          {isLoggedIn ? (
            <Link href="/account" className="hidden items-center gap-2 sm:flex">
              <User size={22} className="text-blue-600" />
              <span className="text-xs leading-tight text-ink-soft">
                Hi, {user?.customer_name?.split(" ")[0] || "Account"}
                <br />
                <span className="flex items-center gap-0.5 font-semibold text-ink">My Account <ChevronDown size={12} /></span>
              </span>
            </Link>
          ) : (
            <Link href="/login" className="hidden items-center gap-2 sm:flex">
              <User size={22} className="text-blue-600" />
              <span className="text-xs leading-tight text-ink-soft">
                Sign In
                <br />
                <span className="font-semibold text-ink">Account</span>
              </span>
            </Link>
          )}

          <Link href="/wishlist" className="hidden items-center gap-2 sm:flex">
            <span className="relative">
              <Heart size={22} className="text-blue-600" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {wishlistIds.length}
              </span>
            </span>
            <span className="text-xs leading-tight text-ink-soft">
              My
              <br />
              <span className="font-semibold text-ink">Wishlist</span>
            </span>
          </Link>

          <Link href="/cart" className="flex items-center gap-2">
            <span className="relative">
              <ShoppingBag size={22} className="text-blue-600" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            </span>
            <span className="hidden text-xs leading-tight text-ink-soft sm:inline">
              My
              <br />
              <span className="font-semibold text-ink">Cart</span>
              <br />
              <span className="text-[11px] text-ink-soft">{formatINR(cartSubtotal)}</span>
            </span>
          </Link>

          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 lg:hidden"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile search row */}
      <div className="border-t border-line bg-white px-4 py-2.5 sm:px-6 lg:hidden">
        <div className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-ink-soft">
          <Search size={16} />
          <SearchSuggest
            value={query}
            onChange={setQuery}
            onSubmit={(term) => runSearch(term)}
            inputClassName="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
          />
        </div>
      </div>

      {/* Category bar */}
      <div className="sticky top-0 hidden bg-blue-50/50 lg:block">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button className="flex h-11 items-center gap-2 rounded-lg bg-blue-900 px-5 text-sm font-semibold text-white">
              <List size={16} /> All Categories
            </button>
            <AnimatePresence>
              {megaOpen && categories.length > 0 && <MegaMenu />}
            </AnimatePresence>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold hover:text-blue-500",
                  i === 0 ? "text-blue-500" : "text-ink"
                )}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto">
            <Link
              href="/track"
              className="flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
            >
              <TruckIcon size={16} /> Track My Order <ChevronDown size={14} className="-rotate-90" />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="ml-auto flex h-full w-80 flex-col overflow-y-auto bg-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-lg font-bold">Menu</span>
                <button onClick={() => setMobileOpen(false)}>
                  <X size={22} />
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
                {isLoggedIn ? (
                  <Link href="/account" onClick={() => setMobileOpen(false)} className="flex flex-1 items-center gap-2 text-sm font-medium">
                    <User size={16} /> {user?.customer_name || "My Account"}
                  </Link>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium">
                    <User size={16} /> Sign In / Register
                  </Link>
                )}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 border-b border-line pb-4">
                <Link href="/wishlist" onClick={() => setMobileOpen(false)} className="flex flex-col items-center gap-1 rounded-lg py-2 text-center hover:bg-black/5">
                  <span className="relative">
                    <Heart size={20} className="text-blue-600" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                      {wishlistIds.length}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-ink-soft">Wishlist</span>
                </Link>
                <Link href="/cart" onClick={() => setMobileOpen(false)} className="flex flex-col items-center gap-1 rounded-lg py-2 text-center hover:bg-black/5">
                  <span className="relative">
                    <ShoppingBag size={20} className="text-blue-600" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                      {cartCount}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-ink-soft">Cart</span>
                </Link>
              </div>

              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium hover:bg-black/5"
                  >
                    <l.icon size={16} /> {l.label}
                  </Link>
                ))}
                <Link
                  href="/track"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium hover:bg-black/5"
                >
                  <TruckIcon size={16} /> Track My Order
                </Link>
                <div className="mt-2 border-t border-line pt-2">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase text-ink-soft">Categories</p>
                  {categories.slice(0, 8).map((c) => (
                    <Link key={c.id} href={`/category/${c.slug}`} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-black/5">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </nav>

              <div className="mt-4 space-y-2 border-t border-line pt-4">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex items-center gap-3">
                    <f.icon size={20} className="shrink-0 text-blue-500" strokeWidth={1.75} />
                    <div className="leading-tight">
                      <p className="text-xs font-bold text-ink">{f.title}</p>
                      <p className="text-[11px] text-ink-soft">{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
