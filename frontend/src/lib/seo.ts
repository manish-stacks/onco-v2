/**
 * SEO helpers — shared across pages jo `generateMetadata` use karte hain.
 */

export const SITE_URL = "https://oncohealthmart.com";
export const SITE_NAME = "Onco Health Mart";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Meta description ke liye — HTML tags hata ke, Google ki ~160 char limit tak trim */
export function toMetaDescription(html: string | null | undefined, maxLength = 160): string {
  if (!html) return "";
  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}