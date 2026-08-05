import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/hooks/use-store";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ToastHost } from "@/components/ui/toast-host";

export const metadata: Metadata = {
  title: "Onco Healthmart: Online Medicine Supplier in Delhi, India",
  description:
    "Buy online medicines from the best emergency & anti-cancer medicine supplier in Delhi, India. ✓70% OFF ✓Free-Fast-Delivery ✓100% Original Medicines.",
  icons: {
    icon: "/favicon.ico",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <StoreProvider>
          <Navbar />
          <main className="flex-1 bg-white">{children}</main>
          <Footer />
          <ToastHost />
        </StoreProvider>
      </body>
    </html>
  );
}
