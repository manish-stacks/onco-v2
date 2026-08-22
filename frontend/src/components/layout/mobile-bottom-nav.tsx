"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingBag, Heart, User } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom tab bar. Desktop navbar already has these actions in
 * the header, so this only renders at `lg:hidden`.
 *
 * Bottom padding on `<main>` is added in layout.tsx so that the last
 * content does not get hidden behind the bar.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount, wishlistIds } = useStore();
  const { isLoggedIn } = useAuth();

  const items = [
    { label: "Home", href: "/", icon: Home, match: (p: string) => p === "/" },
    { label: "Shop", href: "/shop", icon: LayoutGrid, match: (p: string) => p.startsWith("/shop") || p.startsWith("/category") },
    { label: "Cart", href: "/cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/cart"), badge: cartCount },
    { label: "Wishlist", href: "/wishlist", icon: Heart, match: (p: string) => p.startsWith("/wishlist"), badge: wishlistIds.length },
    {
      label: "Account",
      href: isLoggedIn ? "/account" : "/login",
      icon: User,
      match: (p: string) => p.startsWith("/account") || p.startsWith("/login"),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                active ? "text-[var(--blue-600)]" : "text-[var(--ink-soft)]"
              )}
            >
              <span className="relative">
                <item.icon size={20} className={active ? "fill-[var(--blue-50)]" : ""} strokeWidth={active ? 2.25 : 1.75} />
                {!!item.badge && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--blue-500)] text-[9px] font-bold text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
