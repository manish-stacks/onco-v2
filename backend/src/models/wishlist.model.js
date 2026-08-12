const db = require('../config/db');

// ---------------------------------------------------------------------------
// WISHLIST
// ---------------------------------------------------------------------------
async function list(customerId) {
  const [rows] = await db.query(
    `SELECT w.id, w.created_at, p.product_id, p.product_name, p.slug, p.image_1,
            p.product_sp, p.product_mrp, p.stock, p.stock_quantity, p.status
     FROM wishlists w
     INNER JOIN products p ON p.product_id = w.product_id
     WHERE w.customer_id = ? ORDER BY w.created_at DESC`,
    [customerId]
  );
  return rows;
}

async function add(customerId, productId) {
  try {
    const [result] = await db.query(
      `INSERT INTO wishlists (customer_id, product_id) VALUES (?,?)`, [customerId, productId]
    );
    return result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null; // pehle se hai, koi baat nahi
    throw err;
  }
}

async function remove(customerId, productId) {
  const [result] = await db.query(
    `DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?`, [customerId, productId]
  );
  return result.affectedRows > 0;
}

/** Add ho to hata do, na ho to daal do — heart icon toggle ke liye */
async function toggle(customerId, productId) {
  const removed = await remove(customerId, productId);
  if (removed) return { added: false };
  await add(customerId, productId);
  return { added: true };
}

async function has(customerId, productId) {
  const [[row]] = await db.query(
    `SELECT 1 AS ok FROM wishlists WHERE customer_id = ? AND product_id = ? LIMIT 1`,
    [customerId, productId]
  );
  return !!row;
}

async function count(customerId) {
  const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM wishlists WHERE customer_id = ?`, [customerId]);
  return row.count;
}

module.exports = { list, add, remove, toggle, has, count };
