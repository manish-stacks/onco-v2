const db = require('../config/db');
const { pickDefined, money } = require('../utils/helpers');

// ---------------------------------------------------------------------------
// SETTINGS (site-wide config — ek hi row hoti hai)
// ---------------------------------------------------------------------------
const SETTINGS_FIELDS = ['organization', 'contact_address', 'contact_phone', 'contact_email', 'logo',
  'header_code', 'footer_code', 'copyright', 'mini_banner_1', 'mini_link_1', 'mini_banner_2', 'mini_link_2',
  'event_ad_url', 'event_ad_image', 'facebook_link', 'twitter_link', 'printinterest_link', 'instagram_link',
  'shipping_charge', 'shipping_threshold', 'is_cod', 'cod_fee', 'is_login_rules',
  'login_start_time', 'login_end_time', 'status'];

async function get() {
  const [[row]] = await db.query(`SELECT * FROM settings ORDER BY id ASC LIMIT 1`);
  return row || null;
}

async function update(id, data) {
  const payload = pickDefined(data, SETTINGS_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE settings SET ? WHERE id = ?`, [payload, id]);
  return true;
}

/**
 * Shipping charge nikalo — threshold se upar free, warna flat charge.
 * COD ho to cod_fee bhi add.
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

async function isCodEnabled() {
  const s = await get();
  return !!(s && s.is_cod);
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
  get, update, calcCharges, isCodEnabled,
  listBanners, createBanner, updateBanner, removeBanner,
  listBrands, createBrand, updateBrand, removeBrand,
  listDeals, createDeal, updateDeal, removeDeal,
  listOffers, createOffer, updateOffer, removeOffer,
  listCities, checkCity, createCity, updateCity, removeCity,
  listStates, listCountries,
};
