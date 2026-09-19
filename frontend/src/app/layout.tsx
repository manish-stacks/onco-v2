import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { StoreProvider } from "@/hooks/use-store";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ToastHost } from "@/components/ui/toast-host";
import { HeaderFooterScripts } from "@/components/HeaderFooterScripts";
import { contentApi } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  // Every page's relative OG/twitter image URL resolves through this —
  // without it Next.js emits a build-time warning and the social preview
  // the image sometimes fails to load.
  metadataBase: new URL(SITE_URL),
  title: "Onco Healthmart: Online Medicine Supplier in Delhi, India",
  description:
    "Buy online medicines from the best emergency & anti-cancer medicine supplier in Delhi, India. ✓70% OFF ✓Free-Fast-Delivery ✓100% Original Medicines.",
  icons: {
    icon: "/favicon.jpg",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Onco Healthmart: Online Medicine Supplier in Delhi, India",
    description:
      "Buy online medicines from the best emergency & anti-cancer medicine supplier in Delhi, India. ✓70% OFF ✓Free-Fast-Delivery ✓100% Original Medicines.",
    url: "https://oncohealthmart.com/",
    siteName: "Onco Healthmart",
    images: [
      {
        url: "/og-image.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Onco Healthmart: Online Medicine Supplier in Delhi, India",
    description:
      "Buy online medicines from the best emergency & anti-cancer medicine supplier in Delhi, India. ✓70% OFF ✓Free-Fast-Delivery ✓100% Original Medicines.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin Settings > Header/footer scripts (GTM, analytics etc.) — settings load
  // fail ho jaaye to bhi site chalti rahe, isliye chup-chaap khaali fallback.
  const settings = await contentApi
    .settings<{ header_code?: string; footer_code?: string; maintenance_mode?: boolean; maintenance_message?: string }>({
      // Maintenance is a toggle the admin expects to take effect immediately,
      // not after the usual 15-minute settings cache — check it fresh every time.
      cache: "no-store",
    })
    .catch(() => null);

  if (settings?.maintenance_mode) {
    return (
      <html lang="en" className="h-full antialiased">
        <body className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--paper)] px-6 text-center">
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">
            We&apos;ll be right back
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-[var(--ink-soft)]">
            {settings.maintenance_message
              || "We're currently doing some scheduled maintenance. Please check back shortly."}
          </p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <StoreProvider>
            <Navbar />
            {/* pb-16: mobile bottom nav ke peeche content na chhupe */}
            <main className="flex-1 bg-white pb-16 lg:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
            <ToastHost />
            <HeaderFooterScripts headerCode={settings?.header_code} footerCode={settings?.footer_code} />
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}