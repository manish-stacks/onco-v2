const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { pickDefined, money } = require('../utils/helpers');

const WRITABLE = ['coupon_code', 'discount_amount', 'discount_percentage', 'minimum_amount',
  'max_discount_amount', 'expiry_date', 'start_date', 'number_of_total_uses',
  'per_customer_limit', 'coupon_applicable', 'discount_type', 'status'];

async function findByCode(code, conn = db) {
  const [[row]] = await conn.query(`SELECT * FROM coupons WHERE coupon_code = ? LIMIT 1`, [code]);
  return row || null;
}

async function findById(id) {
  const [[row]] = await db.query(`SELECT * FROM coupons WHERE coupon_id = ?`, [id]);
  if (!row) return null;
  const [options] = await db.query(`SELECT * FROM coupon_options WHERE coupon_id = ?`, [id]);
  return { ...row, options };
}

async function list(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('c');
  qb.eq('status', filters.status)
    .eq('discount_type', filters.discount_type)
    .like(['coupon_code'], filters.search);

  if (filters.expired === 'true') qb.raw('c.`expiry_date` < CURDATE()');
  if (filters.expired === 'false') qb.raw('(c.`expiry_date` IS NULL OR c.`expiry_date` >= CURDATE())');

  const { sql: whereSql, params } = qb.build();
  const [rows] = await db.query(
    `SELECT c.* FROM coupons c ${whereSql} ORDER BY c.coupon_id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM coupons c ${whereSql}`, params);
  return { rows, total };
}

/**
 * Coupon valid hai ya nahi — cart apply karte waqt aur checkout dono jagah.
 * Returns { valid, reason, coupon, discount }
 */
async function validateForCart({ code, customerId, subtotal, productIds = [] }) {
  const coupon = await findByCode(code);
  if (!coupon) return { valid: false, reason: 'Coupon code galat hai' };
  if (coupon.status !== 'Active') return { valid: false, reason: 'Ye coupon abhi active nahi hai' };

  const today = new Date().toISOString().slice(0, 10);
  if (coupon.start_date && String(coupon.start_date).slice(0, 10) > today) {
    return { valid: false, reason: 'Ye coupon abhi shuru nahi hua' };
  }
  if (coupon.expiry_date && String(coupon.expiry_date).slice(0, 10) < today) {
    return { valid: false, reason: 'Ye coupon expire ho chuka hai' };
  }
  if (coupon.minimum_amount && subtotal < coupon.minimum_amount) {
    return { valid: false, reason: `Minimum ₹${coupon.minimum_amount} ka order chahiye` };
  }
  if (coupon.number_of_total_uses !== null && coupon.number_of_total_uses <= 0) {
    return { valid: false, reason: 'Ye coupon poori tarah use ho chuka hai' };
  }

  if (coupon.per_customer_limit && customerId) {
    const [[{ used }]] = await db.query(
      `SELECT COUNT(*) AS used FROM coupon_usages WHERE coupon_id = ? AND customer_id = ?`,
      [coupon.coupon_id, customerId]
    );
    if (used >= coupon.per_customer_limit) {
      return { valid: false, reason: 'Aap ye coupon pehle hi use kar chuke ho' };
    }
  }

  // product/category restriction (coupon_options)
  const [options] = await db.query(`SELECT * FROM coupon_options WHERE coupon_id = ?`, [coupon.coupon_id]);
  if (options.length && productIds.length) {
    const allowedProducts = options.filter((o) => o.item_type === 'Product').map((o) => o.item_id);
    const allowedCategories = options.filter((o) => o.item_type === 'Category').map((o) => o.item_id);

    let matches = productIds.some((pid) => allowedProducts.includes(Number(pid)));
    if (!matches && allowedCategories.length) {
      const [rows] = await db.query(
        `SELECT 1 FROM product_categories
         WHERE product_id IN (${productIds.map(() => '?').join(',')})
           AND category_id IN (${allowedCategories.map(() => '?').join(',')}) LIMIT 1`,
        [...productIds, ...allowedCategories]
      );
      matches = rows.length > 0;
    }
    if (!matches) return { valid: false, reason: 'Ye coupon in products pe apply nahi hota' };
  }

  return { valid: true, coupon, discount: calculateDiscount(coupon, subtotal) };
}

function calculateDiscount(coupon, subtotal) {
  let discount = coupon.discount_type === 'Percentage'
    ? (subtotal * (coupon.discount_percentage || 0)) / 100
    : (coupon.discount_amount || 0);

  if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
    discount = coupon.max_discount_amount;
  }
  return money(Math.min(discount, subtotal)); // discount kabhi subtotal se zyada na ho
}

/**
 * Use consume karo — checkout transaction ke andar `conn` ke saath.
 * Atomic hai: do simultaneous checkouts last use nahi le sakte.
 */
async function consumeUse(conn, couponId, customerId, orderId, discountAmount) {
  const [[coupon]] = await conn.query(
    `SELECT number_of_total_uses FROM coupons WHERE coupon_id = ? FOR UPDATE`, [couponId]
  );
  if (!coupon) return false;

  if (coupon.number_of_total_uses !== null) {
    const [result] = await conn.query(
      `UPDATE coupons SET number_of_total_uses = number_of_total_uses - 1, used_count = used_count + 1
       WHERE coupon_id = ? AND number_of_total_uses > 0`,
      [couponId]
    );
    if (result.affectedRows === 0) return false;
  } else {
    await conn.query(`UPDATE coupons SET used_count = used_count + 1 WHERE coupon_id = ?`, [couponId]);
  }

  await conn.query(
    `INSERT INTO coupon_usages (coupon_id, customer_id, order_id, discount_amount) VALUES (?,?,?,?)`,
    [couponId, customerId, orderId, discountAmount || 0]
  );
  return true;
}

/** Order cancel hone pe use wapas de do */
async function refundUse(couponId, orderId, conn = db) {
  await conn.query(
    `UPDATE coupons SET
       number_of_total_uses = IF(number_of_total_uses IS NULL, NULL, number_of_total_uses + 1),
       used_count = GREATEST(used_count - 1, 0)
     WHERE coupon_id = ?`,
    [couponId]
  );
  if (orderId) await conn.query(`DELETE FROM coupon_usages WHERE coupon_id = ? AND order_id = ?`, [couponId, orderId]);
}

async function create(data) {
  const { options, ...rest } = data;
  return db.withTransaction(async (conn) => {
    const payload = pickDefined(rest, WRITABLE);
    const [result] = await conn.query(`INSERT INTO coupons SET ?`, [payload]);
    const couponId = result.insertId;
    if (Array.isArray(options) && options.length) {
      await conn.query(`INSERT INTO coupon_options (coupon_id, item_id, item_type) VALUES ?`,
        [options.map((o) => [couponId, o.item_id, o.item_type])]);
    }
    return couponId;
  });
}

async function update(id, data) {
  const { options, ...rest } = data;
  return db.withTransaction(async (conn) => {
    const payload = pickDefined(rest, WRITABLE);
    if (Object.keys(payload).length) {
      await conn.query(`UPDATE coupons SET ? WHERE coupon_id = ?`, [payload, id]);
    }
    if (Array.isArray(options)) {
      await conn.query(`DELETE FROM coupon_options WHERE coupon_id = ?`, [id]);
      if (options.length) {
        await conn.query(`INSERT INTO coupon_options (coupon_id, item_id, item_type) VALUES ?`,
          [options.map((o) => [id, o.item_id, o.item_type])]);
      }
    }
  });
}

async function remove(id) {
  await db.query(`DELETE FROM coupon_options WHERE coupon_id = ?`, [id]);
  await db.query(`DELETE FROM coupons WHERE coupon_id = ?`, [id]);
}

/** Kaunsa coupon kitna chala — reports ke liye */
async function usageReport(couponId) {
  const [rows] = await db.query(
    `SELECT cu.*, c.customer_name, c.mobile, o.databaseOrderID, o.amount AS order_amount
     FROM coupon_usages cu
     LEFT JOIN customers c ON c.customer_id = cu.customer_id
     LEFT JOIN orders o ON o.order_id = cu.order_id
     WHERE cu.coupon_id = ? ORDER BY cu.created_at DESC`,
    [couponId]
  );
  const [[totals]] = await db.query(
    `SELECT COUNT(*) AS times_used, COALESCE(SUM(discount_amount),0) AS total_discount_given
     FROM coupon_usages WHERE coupon_id = ?`, [couponId]
  );
  return { usages: rows, ...totals };
}

/** App/web pe "available offers" dikhane ke liye */
async function activeCoupons() {
  const [rows] = await db.query(
    `SELECT coupon_id, coupon_code, discount_type, discount_amount, discount_percentage,
            minimum_amount, max_discount_amount, expiry_date
     FROM coupons
     WHERE status = 'Active'
       AND (expiry_date IS NULL OR expiry_date >= CURDATE())
       AND (start_date IS NULL OR start_date <= CURDATE())
       AND (number_of_total_uses IS NULL OR number_of_total_uses > 0)
     ORDER BY minimum_amount ASC`
  );
  return rows;
}

module.exports = {
  findByCode, findById, list, validateForCart, calculateDiscount,
  consumeUse, refundUse, create, update, remove, usageReport, activeCoupons,
};
