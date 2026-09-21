/**
 * Sitemap.xml aur robots.txt — dono DB se live generate hote hain (static file
 * nahi), isliye naya product/category add hote hi agli baar sitemap khulne pe
 * khud-ba-khud shamil ho jaata hai, kisi cron/manual regenerate ki zarurat nahi.
 *
 * 15 minute ke liye Redis me cache hota hai (getOrSet) taaki Google/Bing baar-baar
 * crawl kare to har baar poori DB scan na ho — naya product bhi 15 min me sitemap
 * me aa jaata hai, jo SEO ke liye kaafi tez hai.
 *
 * URL PATTERNS: agar frontend ke route naam alag hon (jaise /products/:slug ki
 * jagah /shop/:slug), to bas neeche PATHS object badal do — baaki sab wahi rahega.
 */

const db = require('../config/db');
const cache = require('../utils/cache');
const settingsModel = require('../models/settings.model');

const PATHS = {
  product: (id, slug) => `/product-details/${id}/${slug}`,
  category: (slug) => `/products/${slug}`,
  page: (slug) => `/${slug}`,
};

const SITEMAP_CACHE_KEY = 'seo:sitemap:xml';
const SITEMAP_TTL = 15 * 60; // 15 min

function escapeXml(str) {
  return String(str || '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function toW3CDate(d) {
  const date = d ? new Date(d) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function urlTag(loc, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n`
    + `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function buildSitemapXml() {
  const base = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');

  const [[categories], [products], [pages]] = await Promise.all([
    db.query(`SELECT slug, updated_at FROM categories WHERE status = 'Active' AND slug IS NOT NULL AND slug <> ''`),
    db.query(`SELECT product_id, slug, updated_at FROM products WHERE status = 'Active' AND slug IS NOT NULL AND slug <> ''`),
    db.query(`SELECT slug FROM pages WHERE status = 'Active' AND slug IS NOT NULL AND slug <> ''`),
  ]);

  const urls = [
    urlTag(`${base}/`, toW3CDate(), 'daily', '1.0'),
    // Static routes that always exist on this frontend
    ...['/shop', '/products', '/brands', '/about', '/contact', '/track'].map(
      (p) => urlTag(`${base}${p}`, toW3CDate(), 'monthly', '0.5')
    ),
  ];

  for (const c of categories) urls.push(urlTag(`${base}${PATHS.category(c.slug)}`, toW3CDate(c.updated_at), 'weekly', '0.7'));
  for (const p of products) urls.push(urlTag(`${base}${PATHS.product(p.product_id, p.slug)}`, toW3CDate(p.updated_at), 'weekly', '0.8'));
  // CMS pages (privacy-policy, terms-and-conditions, etc.) — now that the
  // frontend has a /[slug] route to render them (see app/[slug]/page.tsx).
  for (const pg of pages) urls.push(urlTag(`${base}${PATHS.page(pg.slug)}`, toW3CDate(), 'yearly', '0.3'));

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

async function getSitemapXml() {
  return cache.getOrSet(SITEMAP_CACHE_KEY, SITEMAP_TTL, buildSitemapXml);
}

/** Naya product/category add/update/delete hone pe admin panel se cache turant clear kar sakte hain (optional call) */
async function invalidateSitemap() {
  try { await require('../config/redis').del(SITEMAP_CACHE_KEY); } catch { /* redis down — cache apne aap 15 min me expire ho jayega */ }
}

const DEFAULT_ROBOTS = (base) => `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${base}/sitemap.xml\n`;

async function getRobotsTxt() {
  const base = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const settings = await settingsModel.get();
  const custom = settings?.robots_txt?.trim();
  return custom || DEFAULT_ROBOTS(base);
}

module.exports = { getSitemapXml, getRobotsTxt, invalidateSitemap };
