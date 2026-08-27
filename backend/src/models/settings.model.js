const db = require('../config/db');
const { pickDefined, money } = require('../utils/helpers');

// ---------------------------------------------------------------------------
// SETTINGS (site-wide config — there is only one row)
// ---------------------------------------------------------------------------
const SETTINGS_FIELDS = ['organization', 'contact_address', 'contact_phone', 'contact_email', 'logo',
  'header_code', 'footer_code', 'copyright', 'mini_banner_1', 'mini_link_1', 'mini_banner_2', 'mini_link_2',
  'event_ad_url', 'event_ad_image', 'facebook_link', 'twitter_link', 'printinterest_link', 'instagram_link',
  'shipping_charge', 'shipping_threshold', 'is_cod', 'cod_fee', 'is_login_rules',
  'default_gst', 'gst_override',
  'is_razorpay', 'is_payu',
  'login_start_time', 'login_end_time', 'status'];

/**
 * Columns that were added later. On an old database they simply do not exist,
 * and then `UPDATE settings SET default_gst = ...` blows up — which is exactly why
 * the "GST is not saving" bug. So on first use we run the ALTER TABLE
 * ourselves (idempotent, only once per process).
 */
const LATE_COLUMNS = {
  default_gst: `DECIMAL(5,2) NOT NULL DEFAULT 0`,
  gst_override: `TINYINT(1) NOT NULL DEFAULT 0`,
  is_razorpay: `TINYINT(1) NOT NULL DEFAULT 1`,
  is_payu: `TINYINT(1) NOT NULL DEFAULT 1`,
};

let columnsReady = null;

async function ensureColumns() {
  if (columnsReady) return columnsReady;
  columnsReady = (async () => {
    try {
      const [cols] = await db.query(`SHOW COLUMNS FROM settings`);
      const have = new Set(cols.map((c) => c.Field));
      for (const [name, ddl] of Object.entries(LATE_COLUMNS)) {
        if (have.has(name)) continue;
        try {
          await db.query(`ALTER TABLE settings ADD COLUMN \`${name}\` ${ddl}`);
          console.log(`[settings] column added: ${name}`);
        } catch (e) {
          console.warn(`[settings] could not add column ${name}:`, e.message);
        }
      }
    } catch (e) {
      console.warn('[settings] ensureColumns skipped:', e.message);
    }
  })();
  return columnsReady;
}

async function get() {
  const [[row]] = await db.query(`SELECT * FROM settings ORDER BY id ASC LIMIT 1`);
  return row || null;
}

async function update(id, data) {
  await ensureColumns();

  const payload = pickDefined(data, SETTINGS_FIELDS);

  // Checkbox/toggle fields — 0 is a valid value here, so they are normalised
  // separately (pickDefined drops '' but keeps 0).
  ['gst_override', 'is_cod', 'is_razorpay', 'is_payu', 'is_login_rules'].forEach((k) => {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
      payload[k] = (data[k] === true || data[k] === 1 || data[k] === '1' || data[k] === 'true') ? 1 : 0;
    }
  });

  if (data.default_gst !== undefined && data.default_gst !== null && data.default_gst !== '') {
    payload.default_gst = parseFloat(data.default_gst) || 0;
  }

  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE settings SET ? WHERE id = ?`, [payload, id]);
  return true;
}

/**
 * Work out the shipping charge — free above the threshold, otherwise a flat charge.
 * If it is COD, add cod_fee as well.
 */
async function calcCharges(subtotal, paymentMode = 'online') {
  const s = await get();
  if (!s) return { shipping_charge: 0, cod_fee: 0 };

  const threshold = parseFloat(s.shipping_threshold) || 0;
  const flat = parseFloat(s.shipping_charge) || 0;

  const shipping = threshold > 0 && subtotal >= threshold ? 0 : flat;
  const codFee = paymentMode === 'cod' ? (parseInt(s.cod_fee, 10) || 0) : 0;

  return { shipping_charge: money(shipping), cod_fee: money(codFee) };
}

/**
 * Tax configuration set by the admin under Settings.
 *
 *   default_gst   the GST percent to fall back on (e.g. 12 or 18)
 *   gst_override  1 = force this rate on every product, ignoring product_gst
 *                 0 = only use it when a product has no rate of its own
 *
 * Falls back to { default_gst: 0, gst_override: 0 } when the columns are absent,
 * so the pricing code keeps working on an un-migrated database.
 */
async function getTaxConfig() {
  await ensureColumns();
  const s = await get();
  return {
    default_gst: parseFloat(s?.default_gst) || 0,
    gst_override: Number(s?.gst_override) === 1,
  };
}

/**
 * Resolve the GST percent for one product against the tax config.
 * Pass the config in so a loop over cart items does not re-query settings.
 */
function resolveGstPercent() {
  // Product prices are GST-inclusive, so GST is never added on top separately.
  // Kept as a function (instead of removing every call site) so nothing else
  // needs to change — every caller now always gets 0.
  return 0;
}

async function isCodEnabled() {
  const s = await get();
  return !!(s && s.is_cod);
}

/**
 * Which payment options the checkout page should show.
 * A missing / NULL column defaults to ON — the admin can turn it off any time.
 */
async function getPaymentConfig() {
  await ensureColumns();
  const s = await get();
  const on = (v) => v === undefined || v === null ? true : !!Number(v);
  return {
    cod: !!(s && Number(s.is_cod)),
    razorpay: on(s?.is_razorpay),
    payu: on(s?.is_payu),
  };
}


// ---------------------------------------------------------------------------
// BANNERS
// ---------------------------------------------------------------------------

const BANNER_FIELDS = [
  'banner_type',
  'banner_image',
  'banner_link',
  'ribbon',
  'title_top',
  'title_bottom',
  'body',
  'price',
  'status',
];

async function listBanners(status) {
  const where = status ? `WHERE status = ?` : '';
  const params = status ? [status] : [];

  const [rows] = await db.query(
    `
      SELECT
        banner_id,
        banner_type,
        banner_image,
        banner_link,
        ribbon,
        title_top,
        title_bottom,
        body,
        price,
        status,
        created_at,
        updated_at
      FROM banners
      ${where}
      ORDER BY banner_id DESC
    `,
    params
  );

  return rows;
}

async function getBannerById(id) {
  const [[row]] = await db.query(
    `
      SELECT
        banner_id,
        banner_type,
        banner_image,
        banner_link,
        ribbon,
        title_top,
        title_bottom,
        body,
        price,
        status,
        created_at,
        updated_at
      FROM banners
      WHERE banner_id = ?
      LIMIT 1
    `,
    [id]
  );

  return row || null;
}

async function createBanner(data) {
  const payload = pickDefined(data, BANNER_FIELDS);

  // Default banner type
  if (!payload.banner_type) {
    payload.banner_type = 'normal';
  }

  // Validate banner type
  if (!['normal', 'rich'].includes(payload.banner_type)) {
    throw Object.assign(
      new Error('Invalid banner_type. Allowed values: normal, rich'),
      { status: 422 }
    );
  }

  const [result] = await db.query(
    `INSERT INTO banners SET ?`,
    [payload]
  );

  return result.insertId;
}

async function updateBanner(id, data) {
  const payload = pickDefined(data, BANNER_FIELDS);

  if (!Object.keys(payload).length) {
    return false;
  }

  if (
    payload.banner_type !== undefined &&
    !['normal', 'rich'].includes(payload.banner_type)
  ) {
    throw Object.assign(
      new Error('Invalid banner_type. Allowed values: normal, rich'),
      { status: 422 }
    );
  }

  await db.query(
    `
      UPDATE banners
      SET ?
      WHERE banner_id = ?
    `,
    [payload, id]
  );

  return true;
}

async function removeBanner(id) {
  const [result] = await db.query(
    `DELETE FROM banners WHERE banner_id = ?`,
    [id]
  );

  return result.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// BRANDS (shop by brand)
// ---------------------------------------------------------------------------
const BRAND_FIELDS = ['image_url', 'title', 'status', 'category_id'];

async function listBrands({
  title = '',
  status = '',
  is_featured = '',
  page = 1,
  limit = 10,
}) {
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  // Title search
  if (title) {
    conditions.push(`b.title LIKE ?`);
    params.push(`%${title}%`);
  }

  if (
    is_featured !== '' &&
    is_featured !== null &&
    is_featured !== undefined
  ) {
    conditions.push(`b.is_featured = ?`);
    params.push(Number(is_featured));
  }
  // Status filter
  if (status) {
    conditions.push(`b.status = ?`);
    params.push(status);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Data
  const [rows] = await db.query(
    `
      SELECT
        b.*,
        c.category_name,
        c.slug AS category_slug
      FROM brands b
      LEFT JOIN categories c
        ON c.category_id = b.category_id
      ${where}
      ORDER BY b.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  // Total
  const [countRows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM brands b
      ${where}
    `,
    params
  );

  return {
    rows,
    total: Number(countRows[0]?.total || 0),
  };
}
/**
 * Public brand list for the storefront — every brand, no LIMIT.
 *
 * Old rows have status NULL / '' / 'Active' / 'active', so filtering on
 * status = 'active' silently hid most of them and /brands only showed a
 * handful. Here we only exclude rows explicitly marked inactive.
 * live_product_count is computed so the storefront can show "N products".
 */
async function listPublicBrands() {
  const [rows] = await db.query(
    `
      SELECT
        b.*,
        c.category_name,
        c.slug AS category_slug,
        (
          SELECT COUNT(*) FROM products p
          WHERE p.brand_id = b.id AND p.status = 'Active'
        ) AS live_product_count
      FROM brands b
      LEFT JOIN categories c ON c.category_id = b.category_id
      WHERE b.status IS NULL OR b.status = '' OR LOWER(b.status) <> 'inactive'
      ORDER BY b.title ASC
    `
  );
  return { rows, total: rows.length };
}

async function createBrand(data) {
  const [result] = await db.query(`INSERT INTO brands SET ?`, [pickDefined(data, BRAND_FIELDS)]);
  return result.insertId;
}

async function updateBrand(id, data) {
  const payload = pickDefined(data, BRAND_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE brands SET ? WHERE id = ?`, [payload, id]);
  return true;
}

async function removeBrand(id) {
  await db.query(`DELETE FROM brands WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// DEALS (homepage promotional strips)
// ---------------------------------------------------------------------------
const DEAL_FIELDS = ['title', 'description', 'image', 'public_id', 'bgColor', 'textColor', 'active_status', 'position','cta','link'];

async function listDeals(activeOnly = false) {
  const where = activeOnly ? `WHERE active_status = 1` : '';
  const [rows] = await db.query(`SELECT * FROM deals ${where} ORDER BY position ASC, id DESC`);
  return rows;
}

async function createDeal(data) {
  const [result] = await db.query(`INSERT INTO deals SET ?`, [pickDefined(data, DEAL_FIELDS)]);
  return result.insertId;
}

async function updateDeal(id, data) {
  const payload = pickDefined(data, DEAL_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE deals SET ? WHERE id = ?`, [payload, id]);
  return true;
}

async function removeDeal(id) {
  await db.query(`DELETE FROM deals WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// OFFERS (app ke offer cards)
// ---------------------------------------------------------------------------
const OFFER_FIELDS = ['title', 'CODE', 'desc_code', 'percenatge_off', 'discount_type',
  'min_order_value', 'maxDiscount', 'theme', 'status'];

async function listOffers(activeOnly = false) {
  const where = activeOnly ? `WHERE status = 1` : '';
  const [rows] = await db.query(`SELECT * FROM offers ${where} ORDER BY id DESC`);
  return rows;
}

async function createOffer(data) {
  const [result] = await db.query(`INSERT INTO offers SET ?`, [pickDefined(data, OFFER_FIELDS)]);
  return result.insertId;
}

async function updateOffer(id, data) {
  const payload = pickDefined(data, OFFER_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE offers SET ? WHERE id = ?`, [payload, id]);
  return true;
}

async function removeOffer(id) {
  await db.query(`DELETE FROM offers WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// SERVICEABLE CITIES (delivery pincode/city check)
// ---------------------------------------------------------------------------
async function listCities(activeOnly = false) {
  const where = activeOnly ? `WHERE status = 1` : '';
  const [rows] = await db.query(`SELECT * FROM serviceable_cities ${where} ORDER BY city ASC`);
  return rows;
}

async function checkCity(city) {
  const [[row]] = await db.query(
    `SELECT * FROM serviceable_cities WHERE LOWER(city) = LOWER(?) AND status = 1 LIMIT 1`, [city]
  );
  return row || null;
}

async function createCity(data) {
  const [result] = await db.query(`INSERT INTO serviceable_cities SET ?`,
    [pickDefined(data, ['city', 'E_T_D', 'status'])]);
  return result.insertId;
}

async function updateCity(id, data) {
  const payload = pickDefined(data, ['city', 'E_T_D', 'status']);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE serviceable_cities SET ? WHERE id = ?`, [payload, id]);
  return true;
}

async function removeCity(id) {
  await db.query(`DELETE FROM serviceable_cities WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// STATES / COUNTRIES (dropdowns)
// ---------------------------------------------------------------------------
async function listStates() {
  const [rows] = await db.query(`SELECT * FROM states WHERE status = 'Active' ORDER BY state_name ASC`);
  return rows;
}

async function listCountries() {
  const [rows] = await db.query(`SELECT * FROM countries WHERE status = 'Active' ORDER BY country_name ASC`);
  return rows;
}

module.exports = {
  getTaxConfig, resolveGstPercent, ensureColumns, getPaymentConfig,
  get, update, calcCharges, isCodEnabled,
  listBanners, createBanner, updateBanner, removeBanner,
  listBrands, listPublicBrands, createBrand, updateBrand, removeBrand,
  listDeals, createDeal, updateDeal, removeDeal,
  listOffers, createOffer, updateOffer, removeOffer,
  listCities, checkCity, createCity, updateCity, removeCity,
  listStates, listCountries,
};
