/**
 * Link company_name (free text) to the brands table.
 *
 *   npm run map-brands                      # dry run — report only, no changes
 *   npm run map-brands -- --apply           # actually link them
 *   npm run map-brands -- --apply --min=2   # only names present in 2+ products
 *   npm run map-brands -- --apply --no-cleanup   # do not remove orphan brands
 *
 * RE-RUNNING IS SAFE. If the first run produced wrong names (such as "Gls"
 * instead of "GLS"), fix normalize/display and run it again — the products
 * will shift to the new brands and the old empty brands are removed during cleanup
 * would be removed. Homepage brands (with an image or is_featured) are never removed.
 *
 * What it does:
 *   1. Reads the distinct values of products.company_name
 *   2. Normalizes them — "CIPLA", "Cipla ", "cipla ltd." become one brand
 *   3. Matches against existing rows in the brands table, otherwise creates a new one
 *   4. Sets products.brand_id
 *
 * The company_name column is NOT deleted — it stays for auditing, and whatever
 * products that could not be mapped keep their fallback.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  });
  return args;
}

/**
 * Do alag regex — jaan-boojh ke.
 *
 * MATCH_SUFFIXES is aggressive: it exists only to decide whether two names
 * are the same company or not. "Sun Pharmaceuticals Industries Ltd" and
 * "Sun Pharmaceutical Ind.Ltd." both reduce to "sun" -> one brand.
 *
 * DISPLAY_SUFFIXES is conservative: it only strips the legal form. Otherwise
 * the display name would stay bare like "Sun", which is useless for the admin.
 */
const MATCH_SUFFIXES = /\b(pvt|private|ltd|limited|inc|llp|co|company|corp|corporation|india|indian|healthcare|health|pharma|pharmaceutical|pharmaceuticals|laboratories|laboratory|labs|lab|industries|industry|ind|internationals|international|remedies|formulations|biotech|biotec)\b/gi;

const DISPLAY_SUFFIXES = /\b(pvt|private|ltd|limited|inc|llp|corp|corporation)\b/gi;

/**
 * Matching key — for comparison only, never displayed.
 * Apostrophes are removed so that "Dr Reddy's" and "Dr Reddys" match.
 */
function normalize(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[.,"()\-\u2013\u2014&]/g, ' ')
    .replace(MATCH_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Jo brand naam admin ko dikhega.
 *
 * We do NOT build it from the normalized key — that is lowercase, so "GLS" -> "Gls" and
 * "Dr Reddy's" used to become "Dr Reddy S". Instead, the name stored in the DB
 * we take the most frequently written form and clean it up.
 */
function displayName(variants) {
  const primary = [...variants].sort((a, b) => b.count - a.count)[0].name;

  let out = String(primary)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(DISPLAY_SUFFIXES, ' ')
    .replace(/[.,]+/g, ' ')      // "Ltd." ka dot, "Ind.Ltd" ka dot
    .replace(/\s+/g, ' ')
    .replace(/[\s&]+$/, '')       // trailing "&" ya space
    .trim();

  if (!out) out = primary.trim();

  /**
   * Title-case ALL-CAPS names, but leave short acronyms alone:
   *   "INTAS PHARMACEUTICALS" -> "Intas Pharmaceuticals"
   *   "GLS" -> "GLS"  (3 chars, it is an acronym)
   *   "BDR PHARMA" -> "BDR Pharma"
   */
  const words = out.split(' ');
  const hasLongCapsWord = words.some((w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w));

  if (hasLongCapsWord) {
    out = words
      .map((w) => {
        if (w.length <= 3) return w; // GLS, BDR, RPG waise hi
        if (w !== w.toUpperCase()) return w; // already mixed case
        return w.charAt(0) + w.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return out;
}

function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

async function main() {
  const args = parseArgs();
  const apply = !!args.apply;
  const minProducts = parseInt(args.min, 10) || 1;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log(`\n[brands] ${apply ? 'APPLY MODE' : 'DRY RUN — nothing will change'}\n`);

  // -------------------------------------------------------------------------
  // 1. Index existing brands by their normalized key
  // -------------------------------------------------------------------------
  const [existingBrands] = await conn.query(`SELECT id, title FROM brands`);
  const brandByKey = new Map();
  existingBrands.forEach((b) => {
    const key = normalize(b.title);
    if (key && !brandByKey.has(key)) brandByKey.set(key, b);
  });

  console.log(`  already in the brands table: ${existingBrands.length}\n`);

  // -------------------------------------------------------------------------
  // 2. products.company_name ke distinct values
  // -------------------------------------------------------------------------
  const [rows] = await conn.query(
    `SELECT company_name, COUNT(*) AS products
     FROM products
     WHERE company_name IS NOT NULL AND TRIM(company_name) <> ''
     GROUP BY company_name
     ORDER BY products DESC`
  );

  // Group by normalized key — the variants end up together
  const groups = new Map();
  rows.forEach((r) => {
    const key = normalize(r.company_name);
    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, { key, variants: [], products: 0, existing: brandByKey.get(key) || null });
    }
    const g = groups.get(key);
    g.variants.push({ name: r.company_name, count: r.products });
    g.products += r.products;
  });

  const all = [...groups.values()].sort((a, b) => b.products - a.products);
  const eligible = all.filter((g) => g.products >= minProducts);
  const skipped = all.length - eligible.length;

  // -------------------------------------------------------------------------
  // 3. Report
  // -------------------------------------------------------------------------
  const merged = eligible.filter((g) => g.variants.length > 1);
  const toCreate = eligible.filter((g) => !g.existing);
  const toLink = eligible.filter((g) => g.existing);

  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  distinct company_name values : ${rows.length}`);
  console.log(`  normalize ke baad brands     : ${all.length}`);
  console.log(`  jinke variants merge honge   : ${merged.length}`);
  console.log(`  already in the brands table  : ${toLink.length}`);
  console.log(`  nayi brands banengi          : ${toCreate.length}`);
  if (skipped) console.log(`  skip (min=${minProducts} se kam)         : ${skipped}`);
  console.log('  ─────────────────────────────────────────────────────\n');

  if (merged.length) {
    console.log('  VARIANTS THAT WILL BE MERGED (these become one brand):\n');
    merged.slice(0, 25).forEach((g) => {
      console.log(`    ${displayName(g.variants).padEnd(32)} ${String(g.products).padStart(5)} products`);
      g.variants.forEach((v) => console.log(`      · "${v.name}" (${v.count})`));
    });
    if (merged.length > 25) console.log(`    …aur ${merged.length - 25} brands\n`);
    console.log('');
  }

  console.log('  TOP 20 BRANDS:\n');
  eligible.slice(0, 20).forEach((g) => {
    const tag = g.existing ? '[link]  ' : '[naya]  ';
    console.log(`    ${tag}${displayName(g.variants).padEnd(34)} ${String(g.products).padStart(5)} products`);
  });
  console.log('');

  if (!apply) {
    console.log('  ─────────────────────────────────────────────────────');
    console.log('  That was a report only. If it looks right, run:');
    console.log('    npm run map-brands -- --apply\n');
    await conn.end();
    return;
  }

  // -------------------------------------------------------------------------
  // 4. Apply
  // -------------------------------------------------------------------------
  console.log('  Applying...\n');

  let created = 0;
  let linked = 0;
  let productsUpdated = 0;

  for (const g of eligible) {
    let brandId = g.existing?.id;

    if (!brandId) {
      const title = displayName(g.variants);
      const [res] = await conn.query(
        `INSERT INTO brands (title, slug, status, is_featured, product_count)
         VALUES (?,?, 'active', 0, ?)`,
        [title, slugify(title), g.products]
      );
      brandId = res.insertId;
      created += 1;
    } else {
      // Fill in the slug if it is missing
      await conn.query(
        `UPDATE brands SET slug = COALESCE(NULLIF(slug,''), ?), product_count = ? WHERE id = ?`,
        [slugify(g.existing.title), g.products, brandId]
      );
      linked += 1;
    }

    // Link every product carrying a name variant of this brand
    const names = g.variants.map((v) => v.name);
    const [upd] = await conn.query(
      `UPDATE products SET brand_id = ?
       WHERE company_name IN (${names.map(() => '?').join(',')})`,
      [brandId, ...names]
    );
    productsUpdated += upd.affectedRows;
  }

  // refresh product_count — some products may already have been linked
  await conn.query(
    `UPDATE brands b
     SET product_count = (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id)`
  );

  /**
   * Orphan cleanup.
   *
   * On a re-run, products shift to the new (correctly named) brands
   * and the previous run's brands are left empty. Those
   * are removed — otherwise the Brands page would show 200 junk entries.
   *
   * Homepage brands are SAFE: those that have an image or is_featured=1
   * they are kept even if no product belongs to them.
   */
  let cleaned = 0;
  if (args.cleanup !== false && !args['no-cleanup']) {
    const [orphans] = await conn.query(
      `SELECT id, title FROM brands
       WHERE product_count = 0
         AND is_featured = 0
         AND (image_url IS NULL OR image_url = '')`
    );

    if (orphans.length) {
      await conn.query(
        `DELETE FROM brands WHERE id IN (${orphans.map(() => '?').join(',')})`,
        orphans.map((o) => o.id)
      );
      cleaned = orphans.length;
    }
  }

  const [[{ unmapped }]] = await conn.query(
    `SELECT COUNT(*) AS unmapped FROM products
     WHERE brand_id IS NULL AND company_name IS NOT NULL AND TRIM(company_name) <> ''`
  );
  const [[{ noBrand }]] = await conn.query(
    `SELECT COUNT(*) AS noBrand FROM products
     WHERE company_name IS NULL OR TRIM(company_name) = ''`
  );

  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  nayi brands banayi     : ${created}`);
  console.log(`  linked to existing    : ${linked}`);
  console.log(`  products update hue    : ${productsUpdated}`);
  if (cleaned) console.log(`  khaali brands hataye   : ${cleaned}`);
  console.log(`  ab bhi unmapped        : ${unmapped}  (min filter se skip hue honge)`);
  console.log(`  company_name khaali    : ${noBrand}`);
  console.log('  ─────────────────────────────────────────────────────\n');
  console.log('  Done. The product counts will show under Admin panel > Brands.');
  console.log('  If a merge looks wrong you can rename/split it from the Brands page —');
  console.log('  the company_name column is untouched, nothing was lost.\n');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[brands] FAILED:', err.sqlMessage || err.message);
  process.exit(1);
});