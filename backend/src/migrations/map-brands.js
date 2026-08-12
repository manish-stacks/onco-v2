/**
 * company_name (free text) ko brands table se link karo.
 *
 *   npm run map-brands                      # dry run — sirf report, kuch change nahi
 *   npm run map-brands -- --apply           # actually link karo
 *   npm run map-brands -- --apply --min=2   # sirf wo naam jo 2+ products me hain
 *   npm run map-brands -- --apply --no-cleanup   # orphan brands mat hatao
 *
 * DOBARA CHALANA SAFE HAI. Pehle run me galat naam ban gaye ho (jaise "Gls"
 * ki jagah "GLS"), to normalize/display theek karke dobara chala do — products
 * naye brands pe shift ho jaayenge aur purane khaali brands cleanup me hat
 * jaayenge. Homepage wale brands (image ya is_featured wale) kabhi nahi hatte.
 *
 * Kya karta hai:
 *   1. products.company_name ke distinct values uthata hai
 *   2. Normalize karta hai — "CIPLA", "Cipla ", "cipla ltd." ek hi brand banti hai
 *   3. brands table me jo pehle se hai usse match karta hai, warna nayi banata hai
 *   4. products.brand_id set karta hai
 *
 * company_name column delete NAHI hota — audit ke liye rehta hai, aur jo
 * products map na ho payein unka fallback bana rehta hai.
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
 * MATCH_SUFFIXES aggressive hai: sirf ye decide karne ke liye ki do naam
 * ek hi company hain ya nahi. "Sun Pharmaceuticals Industries Ltd" aur
 * "Sun Pharmaceutical Ind.Ltd." dono "sun" ban jaate hain -> ek brand.
 *
 * DISPLAY_SUFFIXES conservative hai: sirf legal form hatata hai. Warna
 * display naam "Sun" jaisa bare reh jaata, jo admin ke liye bekaar hai.
 */
const MATCH_SUFFIXES = /\b(pvt|private|ltd|limited|inc|llp|co|company|corp|corporation|india|indian|healthcare|health|pharma|pharmaceutical|pharmaceuticals|laboratories|laboratory|labs|lab|industries|industry|ind|internationals|international|remedies|formulations|biotech|biotec)\b/gi;

const DISPLAY_SUFFIXES = /\b(pvt|private|ltd|limited|inc|llp|corp|corporation)\b/gi;

/**
 * Matching key — sirf comparison ke liye, kabhi dikhta nahi.
 * Apostrophe hata dete hain taaki "Dr Reddy's" aur "Dr Reddys" match karein.
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
 * Normalized key se NAHI banate — wo lowercase hai, to "GLS" -> "Gls" aur
 * "Dr Reddy's" -> "Dr Reddy S" ban jaata tha. Iske bajaye jo naam DB me
 * sabse zyada baar likha gaya hai usko saaf karke use karte hain.
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
   * ALL-CAPS naam ko title case karo, lekin chhote acronyms chhodo:
   *   "INTAS PHARMACEUTICALS" -> "Intas Pharmaceuticals"
   *   "GLS" -> "GLS"  (3 chars, acronym hai)
   *   "BDR PHARMA" -> "BDR Pharma"
   */
  const words = out.split(' ');
  const hasLongCapsWord = words.some((w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w));

  if (hasLongCapsWord) {
    out = words
      .map((w) => {
        if (w.length <= 3) return w; // GLS, BDR, RPG waise hi
        if (w !== w.toUpperCase()) return w; // pehle se mixed case hai
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

  console.log(`\n[brands] ${apply ? 'APPLY MODE' : 'DRY RUN — kuch change nahi hoga'}\n`);

  // -------------------------------------------------------------------------
  // 1. Existing brands ko normalized key se index karo
  // -------------------------------------------------------------------------
  const [existingBrands] = await conn.query(`SELECT id, title FROM brands`);
  const brandByKey = new Map();
  existingBrands.forEach((b) => {
    const key = normalize(b.title);
    if (key && !brandByKey.has(key)) brandByKey.set(key, b);
  });

  console.log(`  brands table me pehle se: ${existingBrands.length}\n`);

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

  // Normalized key pe group karo — variants ek saath aa jayenge
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
  console.log(`  brands table me pehle se     : ${toLink.length}`);
  console.log(`  nayi brands banengi          : ${toCreate.length}`);
  if (skipped) console.log(`  skip (min=${minProducts} se kam)         : ${skipped}`);
  console.log('  ─────────────────────────────────────────────────────\n');

  if (merged.length) {
    console.log('  MERGE HONE WALE VARIANTS (ye ek hi brand ban jayenge):\n');
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
    console.log('  Ye sirf report thi. Sahi lage to chalao:');
    console.log('    npm run map-brands -- --apply\n');
    await conn.end();
    return;
  }

  // -------------------------------------------------------------------------
  // 4. Apply
  // -------------------------------------------------------------------------
  console.log('  Apply kar rahe hain...\n');

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
      // Slug missing ho to bhar do
      await conn.query(
        `UPDATE brands SET slug = COALESCE(NULLIF(slug,''), ?), product_count = ? WHERE id = ?`,
        [slugify(g.existing.title), g.products, brandId]
      );
      linked += 1;
    }

    // Is brand ke saare naam variants wale products link karo
    const names = g.variants.map((v) => v.name);
    const [upd] = await conn.query(
      `UPDATE products SET brand_id = ?
       WHERE company_name IN (${names.map(() => '?').join(',')})`,
      [brandId, ...names]
    );
    productsUpdated += upd.affectedRows;
  }

  // product_count refresh — kuch products already linked ho sakte the
  await conn.query(
    `UPDATE brands b
     SET product_count = (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id)`
  );

  /**
   * Orphan cleanup.
   *
   * Script dobara chalane pe products naye (sahi naam wale) brands pe shift
   * ho jaate hain, aur pichhle run ke brands khaali reh jaate hain. Unko
   * hata dete hain — warna Brands page me 200 junk entries dikhengi.
   *
   * Homepage wale brands SAFE hain: jinke paas image hai ya is_featured=1
   * hai, wo chhode jaate hain chahe unpe koi product na ho.
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
  console.log(`  existing se link kiya  : ${linked}`);
  console.log(`  products update hue    : ${productsUpdated}`);
  if (cleaned) console.log(`  khaali brands hataye   : ${cleaned}`);
  console.log(`  ab bhi unmapped        : ${unmapped}  (min filter se skip hue honge)`);
  console.log(`  company_name khaali    : ${noBrand}`);
  console.log('  ─────────────────────────────────────────────────────\n');
  console.log('  Ho gaya. Admin panel > Brands me product counts dikh jayenge.');
  console.log('  Galat merge dikhe to Brands page se rename/split kar sakte ho —');
  console.log('  company_name column waise ka waisa hai, kuch khoya nahi.\n');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[brands] FAILED:', err.sqlMessage || err.message);
  process.exit(1);
});