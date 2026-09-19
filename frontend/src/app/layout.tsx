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
  // NOTE: this must stay a normal cached fetch (default revalidate), never
  // cache:"no-store" — this runs in the ROOT layout, which every single page
  // depends on, so a no-store fetch here means every page's build has to wait
  // on a live API call. If that call is slow/unreachable during `next build`,
  // EVERY page times out and the whole build fails (this happened once —
  // don't reintroduce it). Maintenance mode is handled by middleware.ts
  // instead, which only runs at request time, never at build time.
  const settings = await contentApi
    .settings<{ header_code?: string; footer_code?: string }>()
    .catch(() => null);

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