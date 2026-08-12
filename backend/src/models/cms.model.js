const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { pickDefined, slugify } = require('../utils/helpers');

// ---------------------------------------------------------------------------
// PAGES (about us, privacy policy, terms, etc.)
// ---------------------------------------------------------------------------
const PAGE_FIELDS = ['name', 'seo_title', 'seo_description', 'slug', 'content', 'status', 'type'];

async function listPages(filters = {}) {
  const qb = new QueryBuilder('p');
  qb.eq('status', filters.status).eq('type', filters.type).like(['name'], filters.search);
  const { sql: whereSql, params } = qb.build();
  const [rows] = await db.query(`SELECT * FROM pages p ${whereSql} ORDER BY p.page_id DESC`, params);
  return rows;
}

async function findPageBySlug(slug) {
  const [[row]] = await db.query(`SELECT * FROM pages WHERE slug = ? AND status = 'Active'`, [slug]);
  return row || null;
}

async function findPageById(id) {
  const [[row]] = await db.query(`SELECT * FROM pages WHERE page_id = ?`, [id]);
  return row || null;
}

async function createPage(data) {
  const payload = pickDefined(data, PAGE_FIELDS);
  if (!payload.slug && payload.name) payload.slug = slugify(payload.name);
  const [result] = await db.query(`INSERT INTO pages SET ?`, [payload]);
  return result.insertId;
}

async function updatePage(id, data) {
  const payload = pickDefined(data, PAGE_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE pages SET ? WHERE page_id = ?`, [payload, id]);
  return true;
}

async function removePage(id) {
  await db.query(`DELETE FROM pages WHERE page_id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// NEWS / BLOG
// ---------------------------------------------------------------------------
const NEWS_FIELDS = ['title', 'category', 'excerpt', 'image', 'content', 'date', 'status'];

async function listNews(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('n');
  qb.eq('status', filters.status)
    .eq('category', filters.category)
    .like(['title', 'excerpt'], filters.search);

  const { sql: whereSql, params } = qb.build();
  const [rows] = await db.query(
    `SELECT * FROM news n ${whereSql} ORDER BY n.date DESC, n.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM news n ${whereSql}`, params);
  return { rows, total };
}

async function findNewsById(id) {
  const [[row]] = await db.query(`SELECT * FROM news WHERE id = ?`, [id]);
  return row || null;
}

async function createNews(data) {
  const [result] = await db.query(`INSERT INTO news SET ?`, [pickDefined(data, NEWS_FIELDS)]);
  return result.insertId;
}

async function updateNews(id, data) {
  const payload = pickDefined(data, NEWS_FIELDS);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE news SET ? WHERE id = ?`, [payload, id]);
  return true;
}

async function removeNews(id) {
  await db.query(`DELETE FROM news WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// CONTACT ENQUIRIES
// ---------------------------------------------------------------------------
async function listEnquiries(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('c');
  qb.eq('issue_solved', filters.issue_solved)
    .gte('date', filters.from_date)
    .lte('date', filters.to_date)
    .like(['name', 'email', 'issue'], filters.search);

  const { sql: whereSql, params } = qb.build();
  const [rows] = await db.query(
    `SELECT * FROM contact_enquiries c ${whereSql} ORDER BY c.date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM contact_enquiries c ${whereSql}`, params);
  return { rows, total };
}

async function createEnquiry({ name, email, issue, message, number }) {
  const [result] = await db.query(
    `INSERT INTO contact_enquiries (name, email, issue, message, number, issue_solved) VALUES (?,?,?,?,?, 0)`,
    [name, email, issue || '', message || '', number || 0]
  );
  return result.insertId;
}

async function markEnquirySolved(id, solved = 1) {
  await db.query(`UPDATE contact_enquiries SET issue_solved = ? WHERE id = ?`, [solved, id]);
}

async function removeEnquiry(id) {
  await db.query(`DELETE FROM contact_enquiries WHERE id = ?`, [id]);
}

module.exports = {
  listPages, findPageBySlug, findPageById, createPage, updatePage, removePage,
  listNews, findNewsById, createNews, updateNews, removeNews,
  listEnquiries, createEnquiry, markEnquirySolved, removeEnquiry,
};
