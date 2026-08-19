import type { Metadata } from "next";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import ContactPage from "@/components/layout/contact";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
 
// contact/page.tsx client component hai (form state), isliye layout se metadata.
const title = `Contact Us | ${SITE_NAME}`;
const description =
  `Get in touch with ${SITE_NAME} for order support, prescription queries, or general questions. We're here to help 24/7.`;
 
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/contact") },
  openGraph: { title, description, url: absoluteUrl("/contact"), siteName: SITE_NAME, type: "website" },
};
 
const page = () => {
  return <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="animate-spin text-[var(--blue-500)]" /></div>}><ContactPage /></Suspense>;
}

export default page