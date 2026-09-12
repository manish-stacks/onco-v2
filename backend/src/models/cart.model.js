const db = require('../config/db');
const { money } = require('../utils/helpers');
const { isProductCodEligible } = require('../utils/cod-eligibility');
const settingsModel = require('./settings.model');

/**
 * The cart is always recalculated from server-side prices — the price stored in the cart
 * is only a reference; the fresh product price is taken at checkout.
 */

async function getItems(customerId) {
  const [rows] = await db.query(
    `SELECT ci.cart_id, ci.product_id, ci.product_quantity,
            p.product_name, p.slug, p.image_1, p.sku, p.product_sp, p.product_mrp, p.product_gst,
            p.stock, p.stock_quantity, p.presciption_required, p.isCOD, p.storage, p.status AS product_status
     FROM cart_items ci
     INNER JOIN products p ON p.product_id = ci.product_id
     WHERE ci.customer_id = ?
     ORDER BY ci.cart_id DESC`,
    [String(customerId)]
  );
  return rows;
}

/** Cart + live totals — this is what the frontend needs */
async function getCartWithTotals(customerId) {
  const items = await getItems(customerId);
  // Admin-controlled GST — read once for the whole cart
  const taxConfig = await settingsModel.getTaxConfig();

  let subtotal = 0;
  let totalGst = 0;
  let requiresPrescription = false;
  let codAllowed = true;

  const detailed = items.map((it) => {
    const lineSubtotal = money(it.product_sp * it.product_quantity);
    const taxPercent = settingsModel.resolveGstPercent(it.product_gst, taxConfig);
    const taxAmount = money((lineSubtotal * taxPercent) / 100);

    subtotal += lineSubtotal;
    totalGst += taxAmount;
    if (it.presciption_required === 'Yes') requiresPrescription = true;

    const itemCodEligible = isProductCodEligible(it);
    if (!itemCodEligible) codAllowed = false;

    return {
      ...it,
      line_subtotal: lineSubtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      line_total: money(lineSubtotal + taxAmount),
      in_stock: it.stock_quantity >= it.product_quantity,
      available_quantity: it.stock_quantity,
      // Frontend ko batane ke liye ki YE specific item COD block kar raha
      // (for example to show a "Cold chain — prepaid only" badge)
      cod_eligible: itemCodEligible,
    };
  });

  const outOfStockItems = detailed.filter((i) => !i.in_stock);

  return {
    items: detailed,
    summary: {
      item_count: detailed.length,
      total_quantity: detailed.reduce((s, i) => s + i.product_quantity, 0),
      subtotal: money(subtotal),
      gst: money(totalGst),
      total: money(subtotal + totalGst),
      requires_prescription: requiresPrescription,
      cod_allowed: codAllowed,
      has_out_of_stock: outOfStockItems.length > 0,
      out_of_stock_items: outOfStockItems.map((i) => i.product_name),
    },
  };
}

async function addItem(customerId, { product_id, quantity = 1 }) {
  const [[product]] = await db.query(
    `SELECT product_sp, product_gst, stock_quantity, status FROM products WHERE product_id = ?`, [product_id]
  );
  if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
  if (product.status !== 'Active') throw Object.assign(new Error('This product is not available right now'), { status: 409 });

  const [[existing]] = await db.query(
    `SELECT cart_id, product_quantity FROM cart_items WHERE customer_id = ? AND product_id = ?`,
    [String(customerId), product_id]
  );

  const newQty = (existing?.product_quantity || 0) + quantity;
  if (newQty > product.stock_quantity) {
    throw Object.assign(new Error(`Only ${product.stock_quantity} pieces are available`), { status: 409 });
  }

  const subTotal = money(product.product_sp * newQty);
  const taxConfig = await settingsModel.getTaxConfig();
  const gst = money((subTotal * settingsModel.resolveGstPercent(product.product_gst, taxConfig)) / 100);

  if (existing) {
    await db.query(
      `UPDATE cart_items SET product_quantity = ?, product_price = ?, sub_total = ?, gst = ?,
         total_price = ?, updated = NOW() WHERE cart_id = ?`,
      [newQty, product.product_sp, subTotal, gst, money(subTotal + gst), existing.cart_id]
    );
    return existing.cart_id;
  }

  const [result] = await db.query(
    `INSERT INTO cart_items
      (customer_id, product_id, product_price, product_quantity, sub_total, gst, total_price, added, updated)
     VALUES (?,?,?,?,?,?,?, NOW(), NOW())`,
    [String(customerId), product_id, product.product_sp, newQty, subTotal, gst, money(subTotal + gst)]
  );
  return result.insertId;
}

async function updateQuantity(cartId, customerId, quantity) {
  const [[item]] = await db.query(
    `SELECT ci.cart_id, ci.product_id, p.product_sp, p.product_gst, p.stock_quantity
     FROM cart_items ci INNER JOIN products p ON p.product_id = ci.product_id
     WHERE ci.cart_id = ? AND ci.customer_id = ?`,
    [cartId, String(customerId)]
  );
  if (!item) return false;

  if (quantity <= 0) {
    await db.query(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
    return true;
  }
  if (quantity > item.stock_quantity) {
    throw Object.assign(new Error(`Only ${item.stock_quantity} pieces are available`), { status: 409 });
  }

  const subTotal = money(item.product_sp * quantity);
  const taxConfig = await settingsModel.getTaxConfig();
  const gst = money((subTotal * settingsModel.resolveGstPercent(item.product_gst, taxConfig)) / 100);

  await db.query(
    `UPDATE cart_items SET product_quantity = ?, product_price = ?, sub_total = ?, gst = ?,
       total_price = ?, updated = NOW() WHERE cart_id = ?`,
    [quantity, item.product_sp, subTotal, gst, money(subTotal + gst), cartId]
  );
  return true;
}

async function removeItem(cartId, customerId) {
  const [result] = await db.query(`DELETE FROM cart_items WHERE cart_id = ? AND customer_id = ?`,
    [cartId, String(customerId)]);
  return result.affectedRows > 0;
}

async function clear(customerId, conn = db) {
  await conn.query(`DELETE FROM cart_items WHERE customer_id = ?`, [String(customerId)]);
}

/** The app was offline; merge the local cart on the server */
async function mergeCart(customerId, items = []) {
  for (const it of items) {
    try {
      await addItem(customerId, { product_id: it.product_id, quantity: it.quantity || 1 });
    } catch (err) {
      console.warn('[cart-merge] skip product', it.product_id, err.message);
    }
  }
  return getCartWithTotals(customerId);
}

async function count(customerId) {
  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(product_quantity),0) AS count FROM cart_items WHERE customer_id = ?`,
    [String(customerId)]
  );
  return row.count;
}

/** ADMIN — every customer who currently has items sitting in their cart,
 * with item count + cart value, so support/marketing can see who to nudge. */
async function adminListCarts({ search } = {}, { limit = 25, offset = 0 } = {}) {
  const params = [];
  let searchSql = '';
  if (search) {
    searchSql = ' AND (c.customer_name LIKE ? OR c.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await db.query(
    `SELECT c.customer_id, c.customer_name, c.mobile, c.email_id,
            COUNT(ci.cart_id) AS item_count,
            COALESCE(SUM(ci.product_quantity), 0) AS total_quantity,
            COALESCE(SUM(ci.product_quantity * p.product_sp), 0) AS cart_value,
            MAX(ci.updated) AS last_updated
     FROM cart_items ci
     INNER JOIN customers c ON c.customer_id = ci.customer_id
     INNER JOIN products p ON p.product_id = ci.product_id
     WHERE 1=1 ${searchSql}
     GROUP BY c.customer_id, c.customer_name, c.mobile, c.email_id
     ORDER BY last_updated DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(DISTINCT ci.customer_id) AS total
     FROM cart_items ci
     INNER JOIN customers c ON c.customer_id = ci.customer_id
     WHERE 1=1 ${searchSql}`,
    params
  );

  return { rows, total };
}

module.exports = {
  getItems, getCartWithTotals, addItem, updateQuantity, removeItem, clear, mergeCart, count,
  adminListCarts,
};