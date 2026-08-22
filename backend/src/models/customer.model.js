const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { pickDefined } = require('../utils/helpers');

const SAFE_FIELDS = `customer_id, platform, customer_name, email_id, mobile, address, city, state,
  country, pincode, registration_date, flag, status, is_mobile_verified, last_login, created_at`;

const WRITABLE = ['customer_name', 'email_id', 'mobile', 'address', 'city', 'state', 'country', 'pincode', 'status'];

async function findByMobile(mobile) {
  const [[row]] = await db.query(`SELECT * FROM customers WHERE mobile = ? LIMIT 1`, [mobile]);
  return row || null;
}

async function findByEmail(email) {
  const [[row]] = await db.query(`SELECT * FROM customers WHERE email_id = ? LIMIT 1`, [email]);
  return row || null;
}

/** Without the password — this is what goes into the API response */
async function findById(customerId) {
  const [[row]] = await db.query(`SELECT ${SAFE_FIELDS} FROM customers WHERE customer_id = ?`, [customerId]);
  return row || null;
}

async function create({ customer_name, password, email_id, mobile, address, city, state, country, pincode, platform }) {
  const [result] = await db.query(
    `INSERT INTO customers
      (platform, customer_name, password, email_id, mobile, address, city, state, country, pincode,
       registration_date, status)
     VALUES (?,?,?,?,?,?,?,?,?,?, NOW(), 'Active')`,
    [platform === 'app' ? 'app' : 'web', customer_name, password, email_id || null, mobile,
      address || null, city || null, state || null, country || 'India', pincode || null]
  );
  return result.insertId;
}

async function setOtp(customerId, otp, expiresMinutes = 10) {
  await db.query(
    `UPDATE customers SET otp = ?, otp_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE customer_id = ?`,
    [otp, expiresMinutes, customerId]
  );
}

/** Consumes the OTP once it matches (so it cannot be reused) */
async function verifyOtp(customerId, otp) {
  const [[row]] = await db.query(
    `SELECT customer_id FROM customers WHERE customer_id = ? AND otp = ? AND otp_expires >= NOW()`,
    [customerId, otp]
  );
  if (!row) return false;
  await db.query(
    `UPDATE customers SET otp = NULL, otp_expires = NULL, is_mobile_verified = 1 WHERE customer_id = ?`,
    [customerId]
  );
  return true;
}

async function updatePassword(customerId, hashedPassword) {
  await db.query(`UPDATE customers SET password = ? WHERE customer_id = ?`, [hashedPassword, customerId]);
}

async function updateLastLogin(customerId) {
  await db.query(`UPDATE customers SET last_login = NOW() WHERE customer_id = ?`, [customerId]);
}

async function update(customerId, data) {
  const payload = pickDefined(data, WRITABLE);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE customers SET ? WHERE customer_id = ?`, [payload, customerId]);
  return true;
}

async function setStatus(customerId, status) {
  await db.query(`UPDATE customers SET status = ? WHERE customer_id = ?`, [status, customerId]);
}

/** Admin panel customer list — with order count + lifetime value */
async function list(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('c');
  qb.eq('status', filters.status)
    .eq('platform', filters.platform)
    .eq('city', filters.city)
    .eq('state', filters.state)
    .gte('registration_date', filters.from_date)
    .lte('registration_date', filters.to_date)
    .like(['customer_name', 'mobile', 'email_id'], filters.search);

  const { sql: whereSql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT c.customer_id, c.platform, c.customer_name, c.email_id, c.mobile, c.city, c.state,
            c.pincode, c.registration_date, c.status, c.is_mobile_verified, c.last_login,
            COALESCE(o.order_count, 0) AS order_count,
            COALESCE(o.total_spent, 0) AS total_spent,
            o.last_order_date
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, COUNT(*) AS order_count, SUM(amount) AS total_spent, MAX(order_date) AS last_order_date
       FROM orders WHERE status != 'Cancelled' GROUP BY customer_id
     ) o ON o.customer_id = c.customer_id
     ${whereSql} ORDER BY c.customer_id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM customers c ${whereSql}`, params);
  return { rows, total };
}

/** Admin: full 360 view of one customer */
async function profile(customerId) {
  const customer = await findById(customerId);
  if (!customer) return null;

  const [[orderStats]] = await db.query(
    `SELECT COUNT(*) AS total_orders, COALESCE(SUM(amount),0) AS total_spent,
            COALESCE(AVG(amount),0) AS avg_order_value, MAX(order_date) AS last_order_date
     FROM orders WHERE customer_id = ? AND status != 'Cancelled'`,
    [customerId]
  );
  const [recentOrders] = await db.query(
    `SELECT order_id, databaseOrderID, order_date, amount, status, payment_status, orderFrom
     FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 10`,
    [customerId]
  );
  const [addresses] = await db.query(`SELECT * FROM addresses WHERE user_id = ?`, [customerId]);
  const [[{ prescription_count }]] = await db.query(
    `SELECT COUNT(*) AS prescription_count FROM prescriptions WHERE customer_id = ?`, [customerId]
  );

  return { ...customer, stats: { ...orderStats, prescription_count }, recentOrders, addresses };
}

async function stats() {
  const [[totals]] = await db.query(
    `SELECT COUNT(*) AS total_customers,
            SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) AS active_customers,
            SUM(CASE WHEN platform='app' THEN 1 ELSE 0 END) AS app_customers,
            SUM(CASE WHEN platform='web' THEN 1 ELSE 0 END) AS web_customers,
            SUM(CASE WHEN DATE(registration_date) = CURDATE() THEN 1 ELSE 0 END) AS today_signups
     FROM customers`
  );
  return totals;
}

module.exports = {
  findByMobile, findByEmail, findById, create, setOtp, verifyOtp,
  updatePassword, updateLastLogin, update, setStatus, list, profile, stats,
};
