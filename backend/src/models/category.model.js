const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { pickDefined, slugify } = require('../utils/helpers');

const WRITABLE = ['category_name', 'slug', 'parent_id', 'meta_title', 'meta_keyword',
  'meta_description', 'category_banner', 'category_image', 'footer_description', 'status'];

async function list(filters = {}, { limit, offset } = {}) {
  const qb = new QueryBuilder('c');

  qb.eq('status', filters.status)
    .eq('parent_id', filters.parent_id)
    .like(['category_name'], filters.search);

  const {
    sql: whereSql,
    params,
  } = qb.build();

  const pagination =
    limit !== undefined
      ? 'LIMIT ? OFFSET ?'
      : '';

  const pageParams =
    limit !== undefined
      ? [Number(limit), Number(offset) || 0]
      : [];

  const [rows] = await db.query(
    `
      SELECT
        c.*,
        (
          SELECT COUNT(*)
          FROM product_categories pc
          WHERE pc.category_id = c.category_id
        ) AS product_count
      FROM categories c
      ${whereSql}
      ORDER BY c.category_name ASC
      ${pagination}
    `,
    [...params, ...pageParams]
  );

  const [[{ total }]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM categories c
      ${whereSql}
    `,
    params
  );

  return {
    rows,
    total: Number(total || 0),
  };
}

/** Nested tree — frontend mega-menu ke liye */
async function tree(status = 'Active') {
  const [rows] = await db.query(
    `SELECT c.*, (SELECT COUNT(*) FROM product_categories pc WHERE pc.category_id = c.category_id) AS product_count
     FROM categories c WHERE c.status = ? ORDER BY c.category_name ASC`,
    [status]
  );

  const map = {};
  rows.forEach((r) => { map[r.category_id] = { ...r, children: [] }; });

  const roots = [];
  rows.forEach((r) => {
    const node = map[r.category_id];
    if (r.parent_id && map[r.parent_id]) map[r.parent_id].children.push(node);
    else roots.push(node);
  });
  return roots;
}

async function findById(id) {
  const [[row]] = await db.query(`SELECT * FROM categories WHERE category_id = ?`, [id]);
  return row || null;
}

async function findBySlug(slug) {
  const [[row]] = await db.query(`SELECT * FROM categories WHERE slug = ? AND status = 'Active'`, [slug]);
  return row || null;
}

async function create(data) {
  const payload = pickDefined(data, WRITABLE);
  if (!payload.slug && payload.category_name) payload.slug = slugify(payload.category_name);
  const [result] = await db.query(`INSERT INTO categories SET ?`, [payload]);
  return result.insertId;
}

async function update(id, data) {
  const payload = pickDefined(data, WRITABLE);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE categories SET ? WHERE category_id = ?`, [payload, id]);
  return true;
}

async function remove(id) {
  const [[{ children }]] = await db.query(`SELECT COUNT(*) AS children FROM categories WHERE parent_id = ?`, [id]);
  if (children > 0) throw Object.assign(new Error('Is category ke sub-categories hain, pehle unhe hatao'), { status: 409 });

  await db.query(`DELETE FROM product_categories WHERE category_id = ?`, [id]);
  await db.query(`DELETE FROM categories WHERE category_id = ?`, [id]);
}

module.exports = { list, tree, findById, findBySlug, create, update, remove };
