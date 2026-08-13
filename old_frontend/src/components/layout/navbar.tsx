"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Heart,
  ShoppingBag,
  User,
  Menu,
  X,
  ChevronDown,
  Mail,
  Phone,
  HelpCircle,
  Clock3,
  List,
  Truck,
} from "lucide-react";
import { categories } from "@/lib/data";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { FaFacebookF, FaXTwitter, FaInstagram, FaLinkedinIn } from "react-icons/fa6";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const { cartCount, cartSubtotal, wishlist , cart } = useStore();
  console.log("cartCount", cart);

  const { user, isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="relative z-50 bg-white">
      {/* Top info bar */}
      <div className="hidden border-b border-line bg-ink md:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 text-xs text-ink-soft sm:px-6 lg:px-8">
          <div className="flex items-center gap-5 text-paper">
            <span className="flex items-center gap-1.5"><Mail size={13} /> support@oncohealthmart.com</span>
            <span className="flex items-center gap-1.5"><Phone size={13} /> +91 9289008182</span>
            <span className="flex items-center gap-1.5"><HelpCircle size={13} /> Need Help?</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 font-medium text-paper">
              <Clock3 size={13} />
              Daily Deal
            </span>

            <span className="flex items-center gap-2 text-paper">
              Follow Us:

              {[
                FaFacebookF,
                FaXTwitter,
                FaInstagram,
                FaLinkedinIn,
              ].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white"
                >
                  <Icon size={12} />
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* Main navbar: logo + search + account icons */}
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 bg-white px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/logo.png" alt="Onco Health Mart" width={200} height={63} className="h-14 w-auto object-contain" priority />
        </Link>

        <form onSubmit={handleSearch} className="ml-6 hidden max-w-xl flex-1 items-center lg:flex">
          <div className="flex h-11 w-full items-center overflow-hidden rounded-full border-2 border-blue-500">
            <button type="button" className="flex h-full shrink-0 items-center gap-1 whitespace-nowrap border-r border-line bg-paper px-4 text-sm font-medium text-ink-soft">
              All Category <ChevronDown size={14} className="shrink-0" />
            </button>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Here..."
              className="w-full bg-transparent px-4 text-sm outline-none placeholder:text-ink-soft"
            />
            <button type="submit" className="flex h-full w-14 shrink-0 items-center justify-center bg-blue-500 text-white">
              <Search size={17} />
            </button>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-5">
          {isLoggedIn ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/profile" className="flex items-center gap-2">
                <User size={22} className="text-blue-600" />
                <span className="text-xs leading-tight text-ink-soft">
                  Hi, {(user?.customer_name as string) || "there"}
                  <br />
                  <span className="font-semibold text-ink">My Account</span>
                </span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="ml-1 text-xs font-medium text-ink-soft hover:text-blue-600"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link href="/login" className="hidden items-center gap-2 sm:flex">
              <User size={22} className="text-blue-600" />
              <span className="text-xs leading-tight text-ink-soft">
                Sign In<br /><span className="font-semibold text-ink">Account</span>
              </span>
            </Link>
          )}
          <Link href="/wishlist" className="hidden items-center gap-2 sm:flex">
            <span className="relative">
              <Heart size={22} className="text-blue-600" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-mint-500 text-[10px] font-bold text-white">
                {wishlist.length}
              </span>
            </span>
            <span className="text-xs leading-tight text-ink-soft">
              Wishlist<br /><span className="font-semibold text-ink">My Items</span>
            </span>
          </Link>
          <Link href="/cart" className="flex items-center gap-2">
            <span className="relative">
              <ShoppingBag size={22} className="text-blue-600" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-mint-500 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            </span>
            <span className="text-xs leading-tight text-ink-soft">
              ₹{cartSubtotal.toFixed(2)}<br /><span className="font-semibold text-ink">My Cart</span>
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

      {/* Dark category bar */}
      <div className="sticky top-0 hidden bg-paper shadow-md lg:block">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button className="flex h-14 items-center gap-2 bg-blue-500 px-5 text-sm font-semibold text-white">
              <List size={16} /> All Categories
            </button>
            <AnimatePresence>
              {megaOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-0 top-full w-72 pt-0"
                >
                  <div className="rounded-b-xl bg-white p-2 shadow-2xl">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        href={`/category/${c.slug}`}
                        className="block rounded-lg px-4 py-2.5 text-sm text-ink hover:bg-blue-50"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium hover:text-blue-500",
                  i === 0 ? "text-blue-500" : "text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-6 text-sm font-medium text-ink">
           
            <Link href="/profile" className="flex items-center gap-1.5 hover:text-blue-500">
              <Truck size={15} /> Track My Order
            </Link>
          </div>
        </div>
      </div>

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
              className="ml-auto flex h-full w-80 flex-col bg-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-lg font-bold">Menu</span>
                <button onClick={() => setMobileOpen(false)}>
                  <X size={22} />
                </button>
              </div>
              <form onSubmit={handleSearch} className="mb-6 flex h-11 items-center gap-2 rounded-full border text-ink-soft px-4">
                <Search size={16} className="text-ink-soft" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Here..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </form>
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map((l) => (
                  <Link key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-black/5">
                    {l.label}
                  </Link>
                ))}
                <div className="mt-2 border-t border-line pt-2">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase text-ink-soft">Categories</p>
                  {categories.slice(0, 6).map((c) => (
                    <Link key={c.id} href={`/category/${c.slug}`} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-black/5">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
