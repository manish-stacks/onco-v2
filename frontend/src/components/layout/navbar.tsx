"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Heart,
  ShoppingBag,
  Package,
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
  LogOut,
} from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import { orderApi } from "@/lib/api";
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
  const { user, isLoggedIn, logout } = useAuth();
  const { categories } = useCategories();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [orderCount, setOrderCount] = useState(0);

  function handleSearch() {
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  // Header badge ke liye lightweight order count — poori list nahi, sirf total
  useEffect(() => {
    if (!isLoggedIn) {
      setOrderCount(0);
      return;
    }
    orderApi
      .list({ limit: 1 })
      .then((res) => setOrderCount(res?.pagination?.total ?? 0))
      .catch(() => setOrderCount(0));
  }, [isLoggedIn]);

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
          <div className="flex h-12 w-full items-stretch overflow-visible rounded-full border border-line">
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-l-full border-r border-line bg-blue-50/60 px-4 text-sm font-medium text-ink-soft hover:bg-blue-50"
            >
              All Categories <ChevronDown size={14} className="shrink-0" />
            </button>
            <div className="relative flex-1">
              <SearchSuggest
                value={query}
                onChange={setQuery}
                onSubmit={(term) => router.push(`/search?q=${encodeURIComponent(term)}`)}
                inputClassName="h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-ink-soft"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="flex w-14 shrink-0 items-center justify-center rounded-r-full bg-blue-500 text-white transition hover:bg-blue-600"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-5">
          {isLoggedIn ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/account" className="flex items-center gap-2">
                <User size={22} className="text-blue-600" />
                <span className="text-xs leading-tight text-ink-soft">
                  Hi, {user?.customer_name?.split(" ")[0] || "Account"}
                  <br />
                  <span className="flex items-center gap-0.5 font-semibold text-ink">My Account <ChevronDown size={12} /></span>
                </span>
              </Link>
              <button onClick={logout} title="Logout" className="text-ink-soft hover:text-coral-500">
                <LogOut size={16} />
              </button>
            </div>
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

          <Link href="/account/orders" className="hidden items-center gap-2 sm:flex">
            <span className="relative">
              <Package size={22} className="text-blue-600" />
              {orderCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                  {orderCount}
                </span>
              )}
            </span>
            <span className="text-xs leading-tight text-ink-soft">
              My
              <br />
              <span className="font-semibold text-ink">Orders</span>
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
            onSubmit={(term) => router.push(`/search?q=${encodeURIComponent(term)}`)}
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

      {/* Feature strip */}
      <div className="hidden border-t border-line bg-blue-50/30 lg:block">
        <div className="mx-auto grid max-w-7xl grid-cols-5 divide-x divide-line px-4 py-4 sm:px-6 lg:px-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-center gap-3 px-4 first:pl-0">
              <f.icon size={26} className="shrink-0 text-blue-500" strokeWidth={1.75} />
              <div className="leading-tight">
                <p className="text-sm font-bold text-ink">{f.title}</p>
                <p className="text-xs text-ink-soft">{f.sub}</p>
              </div>
            </div>
          ))}
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
                  <>
                    <Link href="/account" onClick={() => setMobileOpen(false)} className="flex flex-1 items-center gap-2 text-sm font-medium">
                      <User size={16} /> {user?.customer_name || "My Account"}
                    </Link>
                    <button onClick={logout} className="text-ink-soft">
                      <LogOut size={16} />
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium">
                    <User size={16} /> Sign In / Register
                  </Link>
                )}
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 border-b border-line pb-4">
                <Link href="/wishlist" onClick={() => setMobileOpen(false)} className="flex flex-col items-center gap-1 rounded-lg py-2 text-center hover:bg-black/5">
                  <span className="relative">
                    <Heart size={20} className="text-blue-600" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                      {wishlistIds.length}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-ink-soft">Wishlist</span>
                </Link>
                <Link href="/account/orders" onClick={() => setMobileOpen(false)} className="flex flex-col items-center gap-1 rounded-lg py-2 text-center hover:bg-black/5">
                  <Package size={20} className="text-blue-600" />
                  <span className="text-[11px] font-medium text-ink-soft">Orders</span>
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