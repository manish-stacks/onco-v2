const db = require('../config/db');
const { QueryBuilder, orderBy } = require('../utils/queryBuilder');
const { slugify, pickDefined } = require('../utils/helpers');

const SORTABLE = ['product_id', 'product_name', 'product_sp', 'product_mrp', 'stock_quantity', 'total_sold', 'adding_date', 'created_at'];

/** Columns we accept from the client — everything else is ignored (mass-assignment protection) */
const WRITABLE = [
  'product_name', 'short_description', 'long_description', 'sku', 'hsn_code',
  'company_name', 'brand_id',
  'about_product', 'key_features', 'benifits', 'other_information', 'how_to_use', 'specification',
  'caution', 'side_effects', 'slug', 'meta_title', 'meta_description',
  'image_1', 'image_2', 'image_3', 'image_4', 'image_5', 'alt_text_1', 'category',
  'product_mrp', 'product_sp', 'product_gst', 'weight_quantity', 'stock', 'stock_quantity',
  'low_stock_alert', 'allow_backorder', 'batch_number', 'expiry_date',
  'discount_type', 'discount_amount', 'salt', 'presciption_required',
  'deal_of_the_day', 'top_selling', 'latest_product', 'is_featured',
  'storage', 'isCOD', 'status',
];

/** Merchandising flags — the admin toggles these from the list page */
const FLAGS = ['is_featured', 'deal_of_the_day', 'top_selling', 'latest_product'];

function buildFilters(filters = {}) {
  const qb = new QueryBuilder('p');
  qb.eq('status', filters.status)
    .eq('stock', filters.stock)
    .eq('presciption_required', filters.prescription_required)
    .like(['product_name', 'sku', 'salt', 'company_name'], filters.search)
    .gte('product_sp', filters.min_price)
    .lte('product_sp', filters.max_price)
    .in('product_id', filters.product_ids)
    .eq('brand_id', filters.brand_id)
    .flag('deal_of_the_day', filters.deal_of_the_day)
    .flag('top_selling', filters.top_selling)
    .flag('latest_product', filters.latest_product)
    .flag('is_featured', filters.is_featured);

  // "any flag set" / "no flags set" — for merchandising cleanup
  if (filters.has_flag === 'true') {
    qb.raw("(p.`is_featured`='1' OR p.`deal_of_the_day`='1' OR p.`top_selling`='1' OR p.`latest_product`='1')");
  }
  if (filters.has_flag === 'false') {
    qb.raw("(p.`is_featured`='0' AND p.`deal_of_the_day`='0' AND p.`top_selling`='0' AND p.`latest_product`='0')");
  }
  if (filters.no_brand === 'true') qb.raw('p.`brand_id` IS NULL');

  if (filters.low_stock) qb.raw('p.`stock_quantity` <= p.`low_stock_alert`');
  if (filters.out_of_stock) qb.raw('p.`stock_quantity` <= 0');
  if (filters.in_stock) qb.raw("(p.`stock_quantity` > 0 OR p.`allow_backorder` = '1')");
  if (filters.expiring_soon) qb.raw('p.`expiry_date` IS NOT NULL AND p.`expiry_date` <= DATE_ADD(CURDATE(), INTERVAL ? DAY)', parseInt(filters.expiring_soon, 10) || 90);

  return qb;
}

async function list(
  filters = {},
  { limit = 20, offset = 0 } = {},
  sort = {}
) {
  const qb = buildFilters(filters);

  let join = '';

  if (filters.category_id) {
    join = `
      INNER JOIN product_categories pc
        ON pc.product_id = p.product_id
    `;

    qb.raw('pc.`category_id` = ?', filters.category_id);
  }

  const { sql: whereSql, params } = qb.build();

  const sortCol = SORTABLE.includes(sort.column)
    ? sort.column
    : 'product_id';

  const order = orderBy(
    sortCol,
    sort.direction || 'DESC',
    'p'
  );

  const [rows] = await db.query(
    `
    SELECT DISTINCT
      p.*,

      (
        SELECT b.title
        FROM brands b
        WHERE b.id = p.brand_id
        LIMIT 1
      ) AS brand_name

    FROM products p

    ${join}

    ${whereSql}

    ${order}

    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.query(
    `
    SELECT COUNT(DISTINCT p.product_id) AS total
    FROM products p
    ${join}
    ${whereSql}
    `,
    params
  );

  console.log('PRODUCT LIST SQL PARAMS:', params);
  console.log('PRODUCT LIST ROW COUNT:', rows.length);
  console.log(
    'PRODUCT IDS:',
    rows.map(r => r.product_id)
  );

  return {
    rows,
    total: Number(total || 0),
  };
}

/**
 * Dedicated category-page query — every Active product in a category, no
 * limit/offset. Kept separate from `list()` on purpose: `list()` backs the
 * shared /products endpoint (shop, search, admin) and its page size is
 * capped there deliberately; a category can run into the hundreds of
 * products and the category page needs the full set in one shot for its
 * client-side price/brand filters to work correctly.
 */
async function listAllByCategory(categoryId) {
  const [rows] = await db.query(
    `
    SELECT DISTINCT
      p.*,
      (SELECT b.title FROM brands b WHERE b.id = p.brand_id LIMIT 1) AS brand_name
    FROM products p
    INNER JOIN product_categories pc ON pc.product_id = p.product_id
    WHERE pc.category_id = ? AND p.status = 'Active'
    ORDER BY p.product_id DESC
    LIMIT 5000
    `,
    [categoryId]
  );
  return rows;
}

async function findById(productId) {
  const [[product]] = await db.query(
    `SELECT p.*, b.title AS brand_name FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.product_id = ?`,
    [productId]
  );
  if (!product) return null;

  const [categories] = await db.query(
    `SELECT c.category_id, c.category_name, c.slug FROM product_categories pc
     INNER JOIN categories c ON c.category_id = pc.category_id
     WHERE pc.product_id = ?`,
    [productId]
  );
  return { ...product, categories };
}

async function findBySlug(slug) {
  const [[product]] = await db.query(
    `SELECT * FROM products WHERE slug = ? AND status = 'Active' LIMIT 1`, [slug]
  );
  if (!product) return null;

  const [categories] = await db.query(
    `SELECT c.category_id, c.category_name, c.slug FROM product_categories pc
     INNER JOIN categories c ON c.category_id = pc.category_id WHERE pc.product_id = ?`,
    [product.product_id]
  );

  const [[ratings]] = await db.query(
    `SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count
     FROM product_reviews WHERE product_id = ? AND status = 'Approved'`,
    [product.product_id]
  );

  return { ...product, categories, ...ratings };
}

/** For pricing at checkout — we never trust a price sent by the client */
async function getPricingInfo(productId, conn = db) {
  const [[row]] = await conn.query(
    `SELECT product_id, product_name, sku, hsn_code, image_1, product_sp, product_mrp, product_gst,
            stock, stock_quantity, allow_backorder, presciption_required, isCOD, storage, status
     FROM products WHERE product_id = ?`,
    [productId]
  );
  return row || null;
}

async function findByIds(productIds = []) {
  if (!productIds.length) return [];
  const [rows] = await db.query(
    `SELECT * FROM products WHERE product_id IN (${productIds.map(() => '?').join(',')})`,
    productIds
  );
  return rows;
}

async function slugExists(slug, excludeId = null) {
  const [rows] = excludeId
    ? await db.query(`SELECT 1 FROM products WHERE slug = ? AND product_id != ? LIMIT 1`, [slug, excludeId])
    : await db.query(`SELECT 1 FROM products WHERE slug = ? LIMIT 1`, [slug]);
  return rows.length > 0;
}

/** Make the slug unique — on a collision it appends -2, -3 and so on */
async function generateUniqueSlug(name, excludeId = null) {
  const base = slugify(name);
  let slug = base;
  let i = 2;
  /* eslint-disable no-await-in-loop */
  while (await slugExists(slug, excludeId)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

async function create(data, conn = db) {
  const payload = pickDefined(data, WRITABLE);
  const [result] = await conn.query(
    `INSERT INTO products SET ?, adding_date = NOW()`, [payload]
  );
  return result.insertId;
}

async function update(productId, data, conn = db) {
  const payload = pickDefined(data, WRITABLE);
  if (!Object.keys(payload).length) return false;
  await conn.query(`UPDATE products SET ? WHERE product_id = ?`, [payload, productId]);
  return true;
}

async function remove(productId) {
  await db.query(`DELETE FROM product_categories WHERE product_id = ?`, [productId]);
  await db.query(`DELETE FROM products WHERE product_id = ?`, [productId]);
}

/** Soft delete — deleting products with history could break orders */
async function setStatus(productId, status) {
  await db.query(`UPDATE products SET status = ? WHERE product_id = ?`, [status, productId]);
}

async function bulkSetStatus(productIds = [], status) {
  if (!productIds.length) return;
  await db.query(
    `UPDATE products SET status = ? WHERE product_id IN (${productIds.map(() => '?').join(',')})`,
    [status, ...productIds]
  );
}

/**
 * Bulk flag toggle — lets an admin mark 20 products as "top selling" at once.
 * Only columns in the FLAGS list are accepted.
 */
async function bulkSetFlags(productIds = [], flags = {}) {
  const keys = Object.keys(flags).filter((k) => FLAGS.includes(k));
  if (!productIds.length || !keys.length) return 0;

  const sets = keys.map((k) => `\`${k}\` = ?`).join(', ');
  const values = keys.map((k) => (flags[k] ? '1' : '0'));

  const [res] = await db.query(
    `UPDATE products SET ${sets} WHERE product_id IN (${productIds.map(() => '?').join(',')})`,
    [...values, ...productIds]
  );
  return res.affectedRows;
}

/** Ek product ka ek flag on/off */
async function toggleFlag(productId, flag) {
  if (!FLAGS.includes(flag)) {
    throw Object.assign(new Error(`Unknown flag: ${flag}`), { status: 422 });
  }
  await db.query(
    `UPDATE products SET \`${flag}\` = IF(\`${flag}\` = '1', '0', '1') WHERE product_id = ?`,
    [productId]
  );
  const [[row]] = await db.query(
    `SELECT \`${flag}\` AS value FROM products WHERE product_id = ?`, [productId]
  );
  return row?.value === '1';
}

/** How many products carry each flag — an overview for the admin */
async function flagCounts() {
  const [[row]] = await db.query(
    `SELECT
       SUM(is_featured = '1')     AS is_featured,
       SUM(deal_of_the_day = '1') AS deal_of_the_day,
       SUM(top_selling = '1')     AS top_selling,
       SUM(latest_product = '1')  AS latest_product,
       SUM(brand_id IS NULL)      AS no_brand,
       COUNT(*)                   AS total
     FROM products WHERE status = 'Active'`
  );
  return row;
}

async function setCategories(productId, categoryIds = [], conn = db) {
  await conn.query(`DELETE FROM product_categories WHERE product_id = ?`, [productId]);
  if (categoryIds.length) {
    const values = categoryIds.map((c) => [productId, c]);
    await conn.query(`INSERT INTO product_categories (product_id, category_id) VALUES ?`, [values]);
  }
}

/**
 * "Similar Products" — same salt/composition as the given product first
 * (that's what actually makes two medicines substitutable), falling back
 * to same category when the product has no salt on file or no salt-matches exist.
 */
async function related(productId, limit = 8) {
  const [[current]] = await db.query(`SELECT salt FROM products WHERE product_id = ?`, [productId]);
  const salt = current?.salt?.trim();

  if (salt) {
    const [bySalt] = await db.query(
      `SELECT DISTINCT p.* FROM products p
       WHERE p.salt = ? AND p.product_id != ? AND p.status = 'Active'
       LIMIT ?`,
      [salt, productId, limit]
    );
    if (bySalt.length) return bySalt;
  }

  const [byCategory] = await db.query(
    `SELECT DISTINCT p.* FROM products p
     INNER JOIN product_categories pc ON pc.product_id = p.product_id
     WHERE pc.category_id IN (SELECT category_id FROM product_categories WHERE product_id = ?)
       AND p.product_id != ? AND p.status = 'Active'
     LIMIT ?`,
    [productId, productId, limit]
  );
  return byCategory;
}

async function incrementSold(productId, qty, conn = db) {
  await conn.query(`UPDATE products SET total_sold = total_sold + ? WHERE product_id = ?`, [qty, productId]);
}

module.exports = {
  list, listAllByCategory, findById, findBySlug, findByIds, getPricingInfo,
  create, update, remove, setStatus, bulkSetStatus, setCategories,
  generateUniqueSlug, slugExists, related, incrementSold,
  bulkSetFlags, toggleFlag, flagCounts,
  SORTABLE, WRITABLE, FLAGS,
};