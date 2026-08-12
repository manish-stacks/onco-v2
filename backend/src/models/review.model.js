const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { pickDefined } = require('../utils/helpers');

// ---------------------------------------------------------------------------
// PRODUCT REVIEWS (customer ne diye hue — moderation ke saath)
// ---------------------------------------------------------------------------
async function listByProduct(productId, { limit = 10, offset = 0 } = {}) {
  const [rows] = await db.query(
    `SELECT pr.review_id, pr.rating, pr.title, pr.review, pr.created_at, c.customer_name
     FROM product_reviews pr
     LEFT JOIN customers c ON c.customer_id = pr.customer_id
     WHERE pr.product_id = ? AND pr.status = 'Approved'
     ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`,
    [productId, limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM product_reviews WHERE product_id = ? AND status = 'Approved'`,
    [productId]
  );
  const [breakdown] = await db.query(
    `SELECT rating, COUNT(*) AS count FROM product_reviews
     WHERE product_id = ? AND status = 'Approved' GROUP BY rating ORDER BY rating DESC`,
    [productId]
  );
  return { rows, total, breakdown };
}

async function listAll(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('pr');
  qb.eq('status', filters.status)
    .eq('product_id', filters.product_id)
    .eq('rating', filters.rating);

  const { sql: whereSql, params } = qb.build();
  const [rows] = await db.query(
    `SELECT pr.*, p.product_name, c.customer_name, c.mobile
     FROM product_reviews pr
     LEFT JOIN products p ON p.product_id = pr.product_id
     LEFT JOIN customers c ON c.customer_id = pr.customer_id
     ${whereSql} ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM product_reviews pr ${whereSql}`, params);
  return { rows, total };
}

async function create({ product_id, customer_id, order_id, rating, title, review }) {
  const [result] = await db.query(
    `INSERT INTO product_reviews (product_id, customer_id, order_id, rating, title, review, status)
     VALUES (?,?,?,?,?,?, 'Pending')
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), title = VALUES(title),
       review = VALUES(review), status = 'Pending'`,
    [product_id, customer_id, order_id || null, rating, title || null, review || null]
  );
  return result.insertId;
}

async function setStatus(reviewId, status) {
  await db.query(`UPDATE product_reviews SET status = ? WHERE review_id = ?`, [status, reviewId]);
}

async function remove(reviewId) {
  await db.query(`DELETE FROM product_reviews WHERE review_id = ?`, [reviewId]);
}

async function findByCustomerAndProduct(customerId, productId) {
  const [[row]] = await db.query(
    `SELECT * FROM product_reviews WHERE customer_id = ? AND product_id = ?`, [customerId, productId]
  );
  return row || null;
}

// ---------------------------------------------------------------------------
// TESTIMONIALS (homepage pe manually daale hue — customer reviews se alag)
// ---------------------------------------------------------------------------
const TESTIMONIAL_FIELDS = ['name', 'profession', 'review', 'stars', 'status'];

async function listTestimonials(status) {
  const where = status ? `WHERE status = ?` : '';
  const [rows] = await db.query(
    `SELECT * FROM testimonials ${where} ORDER BY review_id DESC`, status ? [status] : []
  );
  return rows;
}

async function createTestimonial(data) {
  const [result] = await db.query(`INSERT INTO testimonials SET ?`, [pickDefined(data, TESTIMONIAL_FIELDS)]);
  return result.insertId;
}

async function updateTestimonial(id, data) {
  const payload = pickDefined(data, TESTIMONIAL_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE testimonials SET ? WHERE review_id = ?`, [payload, id]);
  return true;
}

async function removeTestimonial(id) {
  await db.query(`DELETE FROM testimonials WHERE review_id = ?`, [id]);
}

module.exports = {
  listByProduct, listAll, create, setStatus, remove, findByCustomerAndProduct,
  listTestimonials, createTestimonial, updateTestimonial, removeTestimonial,
};