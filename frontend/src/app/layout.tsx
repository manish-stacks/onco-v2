import type { Metadata } from "next";
import Script from "next/script";
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
  verification: { google: "KEomxu3Rew_ns8m1HE-yPB31ejcyzwjOKGrpcrlwI5U" },
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
      <head>
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KQ4GPHBC');`}</Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-XDKQNEDG6H" strategy="afterInteractive" />
        <Script id="gtag" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XDKQNEDG6H');`}</Script>
      </head>
      <body className="flex min-h-full flex-col overflow-x-clip">
        <noscript>
          <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KQ4GPHBC" height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
        </noscript>
        <AuthProvider>
          <StoreProvider>
            <Navbar />
            
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