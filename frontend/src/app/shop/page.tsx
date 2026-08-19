import { Shop } from '@/components/layout/Shop'
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { Metadata } from 'next';
import React from 'react'

const title = `Shop All Medicines Online | ${SITE_NAME}`;
const description =
  `Browse thousands of genuine medicines, healthcare products and prescription drugs. Filter by category, brand and price at ${SITE_NAME}.`;
 
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/shop") },
  openGraph: { title, description, url: absoluteUrl("/shop"), siteName: SITE_NAME, type: "website" },
};
const page = () => {
  return <Shop/>
}

export default page