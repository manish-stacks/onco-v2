const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { INVENTORY_CHANGE_TYPE } = require('../config/constants');

/**
 * Har stock change yahi se hoti hai, taaki inventory_logs me hamesha
 * audit trail bane. Seedha `UPDATE products SET stock_quantity` kahin
 * nahi karna.
 */

/**
 * Stock ghatao (order place hone pe). Row lock leta hai taaki do simultaneous
 * orders same last unit na le jaayen. Transaction ke andar `conn` pass karna zaroori.
 */
async function decrementStock(conn, { productId, quantity, referenceType, referenceId, changedBy, note }) {
  const [[product]] = await conn.query(
    `SELECT product_id, product_name, stock_quantity, allow_backorder FROM products WHERE product_id = ? FOR UPDATE`,
    [productId]
  );
  if (!product) throw Object.assign(new Error(`Product ${productId} nahi mila`), { status: 404 });

  const before = product.stock_quantity;
  const after = before - quantity;

  if (after < 0 && !product.allow_backorder) {
    throw Object.assign(
      new Error(`"${product.product_name}" ka sirf ${before} stock bacha hai (${quantity} maanga gaya)`),
      { status: 409 }
    );
  }

  await conn.query(
    `UPDATE products SET stock_quantity = ?, stock = ? WHERE product_id = ?`,
    [after, after > 0 ? 'In Stock' : 'Out of Stock', productId]
  );

  await logMovement(conn, {
    productId,
    changeType: INVENTORY_CHANGE_TYPE.SALE,
    quantityChange: -quantity,
    quantityBefore: before,
    quantityAfter: after,
    referenceType, referenceId, changedBy, note,
  });

  return after;
}

/** Stock badhao — purchase, return, ya order cancel hone pe */
async function incrementStock(conn, { productId, quantity, changeType, referenceType, referenceId, changedBy, note }) {
  const [[product]] = await conn.query(
    `SELECT stock_quantity FROM products WHERE product_id = ? FOR UPDATE`, [productId]
  );
  if (!product) throw Object.assign(new Error(`Product ${productId} nahi mila`), { status: 404 });

  const before = product.stock_quantity;
  const after = before + quantity;

  await conn.query(
    `UPDATE products SET stock_quantity = ?, stock = ? WHERE product_id = ?`,
    [after, after > 0 ? 'In Stock' : 'Out of Stock', productId]
  );

  await logMovement(conn, {
    productId,
    changeType: changeType || INVENTORY_CHANGE_TYPE.PURCHASE,
    quantityChange: quantity,
    quantityBefore: before,
    quantityAfter: after,
    referenceType, referenceId, changedBy, note,
  });

  return after;
}

/**
 * Admin manual adjustment — exact quantity set kar do (stock count ke baad).
 * Difference automatically log ho jaata hai.
 */
async function setStock(productId, newQuantity, { changedBy, note, changeType } = {}) {
  return db.withTransaction(async (conn) => {
    const [[product]] = await conn.query(
      `SELECT stock_quantity FROM products WHERE product_id = ? FOR UPDATE`, [productId]
    );
    if (!product) throw Object.assign(new Error('Product nahi mila'), { status: 404 });

    const before = product.stock_quantity;
    const after = Math.max(0, parseInt(newQuantity, 10));

    await conn.query(
      `UPDATE products SET stock_quantity = ?, stock = ? WHERE product_id = ?`,
      [after, after > 0 ? 'In Stock' : 'Out of Stock', productId]
    );

    await logMovement(conn, {
      productId,
      changeType: changeType || INVENTORY_CHANGE_TYPE.ADJUSTMENT,
      quantityChange: after - before,
      quantityBefore: before,
      quantityAfter: after,
      referenceType: 'manual',
      referenceId: null,
      changedBy,
      note,
    });

    return { before, after };
  });
}

/** Bulk stock update — CSV import / stock-taking ke liye */
async function bulkSetStock(updates = [], changedBy) {
  return db.withTransaction(async (conn) => {
    const results = [];
    for (const u of updates) {
      const [[product]] = await conn.query(
        `SELECT stock_quantity FROM products WHERE product_id = ? FOR UPDATE`, [u.product_id]
      );
      if (!product) { results.push({ product_id: u.product_id, ok: false, error: 'not found' }); continue; }

      const before = product.stock_quantity;
      const after = Math.max(0, parseInt(u.stock_quantity, 10));

      await conn.query(
        `UPDATE products SET stock_quantity = ?, stock = ? WHERE product_id = ?`,
        [after, after > 0 ? 'In Stock' : 'Out of Stock', u.product_id]
      );
      await logMovement(conn, {
        productId: u.product_id,
        changeType: INVENTORY_CHANGE_TYPE.ADJUSTMENT,
        quantityChange: after - before,
        quantityBefore: before,
        quantityAfter: after,
        referenceType: 'bulk',
        changedBy,
        note: u.note || 'Bulk stock update',
      });
      results.push({ product_id: u.product_id, ok: true, before, after });
    }
    return results;
  });
}

async function logMovement(conn, {
  productId, changeType, quantityChange, quantityBefore, quantityAfter,
  referenceType, referenceId, changedBy, note,
}) {
  await conn.query(
    `INSERT INTO inventory_logs
      (product_id, change_type, quantity_change, quantity_before, quantity_after,
       reference_type, reference_id, note, changed_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [productId, changeType, quantityChange, quantityBefore, quantityAfter,
      referenceType || null, referenceId || null, note || null, changedBy || 'system']
  );
}

/** Stock movement history — product-wise ya global */
async function listMovements(filters = {}, { limit = 50, offset = 0 } = {}) {
  const qb = new QueryBuilder('il');
  qb.eq('product_id', filters.product_id)
    .eq('change_type', filters.change_type)
    .eq('reference_type', filters.reference_type)
    .gte('created_at', filters.from_date)
    .lte('created_at', filters.to_date);

  const { sql: whereSql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT il.*, p.product_name, p.sku
     FROM inventory_logs il
     LEFT JOIN products p ON p.product_id = il.product_id
     ${whereSql} ORDER BY il.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM inventory_logs il ${whereSql}`, params
  );
  return { rows, total };
}

/** Low stock alerts — dashboard aur inventory page dono use karte hain */
async function lowStockProducts(limit = 50) {
  const [rows] = await db.query(
    `SELECT product_id, product_name, sku, stock_quantity, low_stock_alert, product_sp
     FROM products
     WHERE status = 'Active' AND stock_quantity <= low_stock_alert
     ORDER BY stock_quantity ASC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function outOfStockProducts(limit = 50) {
  const [rows] = await db.query(
    `SELECT product_id, product_name, sku, stock_quantity, product_sp
     FROM products WHERE status = 'Active' AND stock_quantity <= 0
     ORDER BY product_name ASC LIMIT ?`,
    [limit]
  );
  return rows;
}

/** Expiry ke kareeb products — pharma ke liye zaroori */
async function expiringProducts(days = 90, limit = 50) {
  const [rows] = await db.query(
    `SELECT product_id, product_name, sku, batch_number, expiry_date, stock_quantity
     FROM products
     WHERE status = 'Active' AND expiry_date IS NOT NULL
       AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY expiry_date ASC LIMIT ?`,
    [days, limit]
  );
  return rows;
}

/** Poore inventory ki summary — dashboard card ke liye */
async function summary() {
  const [[stats]] = await db.query(
    `SELECT
       COUNT(*) AS total_products,
       SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
       SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_alert THEN 1 ELSE 0 END) AS low_stock,
       COALESCE(SUM(stock_quantity), 0) AS total_units,
       COALESCE(SUM(stock_quantity * product_sp), 0) AS stock_value
     FROM products WHERE status = 'Active'`
  );
  const [[{ expiring_soon }]] = await db.query(
    `SELECT COUNT(*) AS expiring_soon FROM products
     WHERE status='Active' AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`
  );
  return { ...stats, expiring_soon };
}

module.exports = {
  decrementStock, incrementStock, setStock, bulkSetStock, logMovement,
  listMovements, lowStockProducts, outOfStockProducts, expiringProducts, summary,
};
