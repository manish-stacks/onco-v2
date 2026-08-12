const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');

/**
 * Saare reports yahan. Har function apna date-range + orderFrom filter leta hai
 * taaki admin panel me "web vs app" comparison bhi ho sake.
 */

function dateFilter(alias, filters = {}) {
  const qb = new QueryBuilder(alias);
  qb.gte('order_date', filters.from_date)
    .lte('order_date', filters.to_date)
    .eq('orderFrom', filters.orderFrom);
  if (!filters.include_cancelled) qb.neq('status', 'Cancelled');
  return qb.build();
}

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------
async function salesSummary(filters = {}) {
  const { sql, params } = dateFilter('o', filters);
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(o.amount),0)          AS revenue,
            COALESCE(SUM(o.subtotal),0)        AS subtotal,
            COALESCE(SUM(o.order_gst),0)       AS gst_collected,
            COALESCE(SUM(o.shipping_charge),0) AS shipping_collected,
            COALESCE(SUM(o.coupon_discount),0) AS discount_given,
            COALESCE(SUM(o.refund_amount),0)   AS refunded,
            COALESCE(AVG(o.amount),0)          AS avg_order_value,
            COUNT(DISTINCT o.customer_id)      AS unique_customers
     FROM orders o ${sql}`,
    params
  );
  return row;
}

/** Time-series — chart ke liye. groupBy: day | week | month */
async function salesTrend(filters = {}, groupBy = 'day') {
  const formats = { day: '%Y-%m-%d', week: '%x-W%v', month: '%Y-%m' };
  const format = formats[groupBy] || formats.day;

  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(o.order_date, ?) AS period,
            COUNT(*) AS orders,
            COALESCE(SUM(o.amount),0) AS revenue,
            COUNT(DISTINCT o.customer_id) AS customers
     FROM orders o ${sql}
     GROUP BY period ORDER BY period ASC`,
    [format, ...params]
  );
  return rows;
}

/** Web vs App comparison */
async function salesBySource(filters = {}) {
  const f = { ...filters, orderFrom: undefined };
  const { sql, params } = dateFilter('o', f);
  const [rows] = await db.query(
    `SELECT o.orderFrom AS source, COUNT(*) AS orders,
            COALESCE(SUM(o.amount),0) AS revenue,
            COALESCE(AVG(o.amount),0) AS avg_order_value
     FROM orders o ${sql} GROUP BY o.orderFrom`,
    params
  );
  return rows;
}

async function salesByStatus(filters = {}) {
  const { sql, params } = dateFilter('o', { ...filters, include_cancelled: true });
  const [rows] = await db.query(
    `SELECT o.status, COUNT(*) AS orders, COALESCE(SUM(o.amount),0) AS revenue
     FROM orders o ${sql} GROUP BY o.status`,
    params
  );
  return rows;
}

async function salesByPaymentMode(filters = {}) {
  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT COALESCE(o.payment_mode,'unknown') AS payment_mode, o.payment_status,
            COUNT(*) AS orders, COALESCE(SUM(o.amount),0) AS revenue
     FROM orders o ${sql} GROUP BY o.payment_mode, o.payment_status`,
    params
  );
  return rows;
}

/** Sabse zyada order kis city/state se */
async function salesByLocation(filters = {}, by = 'city', limit = 20) {
  const column = by === 'state' ? 'customer_state' : 'customer_city';
  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT o.\`${column}\` AS location, COUNT(*) AS orders, COALESCE(SUM(o.amount),0) AS revenue
     FROM orders o ${sql}
     ${sql ? 'AND' : 'WHERE'} o.\`${column}\` IS NOT NULL AND o.\`${column}\` != ''
     GROUP BY o.\`${column}\` ORDER BY revenue DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------
async function topProducts(filters = {}, limit = 20) {
  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT oi.product_id, oi.product_name, oi.sku,
            SUM(oi.unit_quantity) AS units_sold,
            COALESCE(SUM(oi.line_total),0) AS revenue,
            COUNT(DISTINCT oi.order_id) AS order_count,
            p.stock_quantity
     FROM order_items oi
     INNER JOIN orders o ON o.order_id = oi.order_id
     LEFT JOIN products p ON p.product_id = oi.product_id
     ${sql}
     GROUP BY oi.product_id, oi.product_name, oi.sku, p.stock_quantity
     ORDER BY units_sold DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

/** Jo bilkul nahi bik rahe — dead stock */
async function nonMovingProducts(days = 90, limit = 50) {
  const [rows] = await db.query(
    `SELECT p.product_id, p.product_name, p.sku, p.stock_quantity, p.product_sp,
            (p.stock_quantity * p.product_sp) AS stock_value, p.adding_date
     FROM products p
     WHERE p.status = 'Active' AND p.stock_quantity > 0
       AND p.product_id NOT IN (
         SELECT DISTINCT oi.product_id FROM order_items oi
         INNER JOIN orders o ON o.order_id = oi.order_id
         WHERE o.order_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
       )
     ORDER BY stock_value DESC LIMIT ?`,
    [days, limit]
  );
  return rows;
}

async function categoryPerformance(filters = {}, limit = 20) {
  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT c.category_id, c.category_name,
            SUM(oi.unit_quantity) AS units_sold,
            COALESCE(SUM(oi.line_total),0) AS revenue,
            COUNT(DISTINCT oi.order_id) AS order_count
     FROM order_items oi
     INNER JOIN orders o ON o.order_id = oi.order_id
     INNER JOIN product_categories pc ON pc.product_id = oi.product_id
     INNER JOIN categories c ON c.category_id = pc.category_id
     ${sql}
     GROUP BY c.category_id, c.category_name
     ORDER BY revenue DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------
async function topCustomers(filters = {}, limit = 20) {
  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT o.customer_id, c.customer_name, c.mobile, c.email_id, c.platform,
            COUNT(*) AS orders, COALESCE(SUM(o.amount),0) AS total_spent,
            COALESCE(AVG(o.amount),0) AS avg_order_value, MAX(o.order_date) AS last_order
     FROM orders o
     LEFT JOIN customers c ON c.customer_id = o.customer_id
     ${sql}
     GROUP BY o.customer_id, c.customer_name, c.mobile, c.email_id, c.platform
     ORDER BY total_spent DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

/** Naye vs repeat customers */
async function customerRetention(filters = {}) {
  const { sql, params } = dateFilter('o', filters);
  const [[row]] = await db.query(
    `SELECT
       SUM(CASE WHEN order_count = 1 THEN 1 ELSE 0 END) AS one_time_customers,
       SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) AS repeat_customers,
       COUNT(*) AS total_customers,
       COALESCE(AVG(order_count),0) AS avg_orders_per_customer
     FROM (
       SELECT o.customer_id, COUNT(*) AS order_count FROM orders o ${sql} GROUP BY o.customer_id
     ) t`,
    params
  );
  return row;
}

async function customerGrowth(groupBy = 'month', limit = 12) {
  const formats = { day: '%Y-%m-%d', week: '%x-W%v', month: '%Y-%m' };
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(registration_date, ?) AS period,
            COUNT(*) AS signups,
            SUM(CASE WHEN platform='app' THEN 1 ELSE 0 END) AS app_signups,
            SUM(CASE WHEN platform='web' THEN 1 ELSE 0 END) AS web_signups
     FROM customers
     WHERE registration_date IS NOT NULL
     GROUP BY period ORDER BY period DESC LIMIT ?`,
    [formats[groupBy] || formats.month, limit]
  );
  return rows.reverse();
}

// ---------------------------------------------------------------------------
// PRESCRIPTIONS
// ---------------------------------------------------------------------------
async function prescriptionStats(filters = {}) {
  const qb = new QueryBuilder('p');
  qb.gte('created_at', filters.from_date).lte('created_at', filters.to_date).eq('source', filters.source);
  const { sql, params } = qb.build();

  const [byStatus] = await db.query(
    `SELECT p.status, COUNT(*) AS count FROM prescriptions p ${sql} GROUP BY p.status`, params
  );
  const [bySource] = await db.query(
    `SELECT p.source, COUNT(*) AS count FROM prescriptions p ${sql} GROUP BY p.source`, params
  );
  const [[totals]] = await db.query(
    `SELECT COUNT(*) AS total,
            AVG(TIMESTAMPDIFF(HOUR, p.created_at, p.reviewed_at)) AS avg_review_hours
     FROM prescriptions p ${sql}`, params
  );
  return { ...totals, byStatus, bySource };
}

// ---------------------------------------------------------------------------
// COUPONS
// ---------------------------------------------------------------------------
async function couponPerformance(filters = {}, limit = 20) {
  const qb = new QueryBuilder('cu');
  qb.gte('created_at', filters.from_date).lte('created_at', filters.to_date);
  const { sql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT c.coupon_id, c.coupon_code, c.discount_type,
            COUNT(cu.id) AS times_used,
            COALESCE(SUM(cu.discount_amount),0) AS total_discount,
            COALESCE(SUM(o.amount),0) AS revenue_generated
     FROM coupon_usages cu
     INNER JOIN coupons c ON c.coupon_id = cu.coupon_id
     LEFT JOIN orders o ON o.order_id = cu.order_id
     ${sql}
     GROUP BY c.coupon_id, c.coupon_code, c.discount_type
     ORDER BY times_used DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// GST / TAX (accountant ke liye)
// ---------------------------------------------------------------------------
async function gstReport(filters = {}) {
  const { sql, params } = dateFilter('o', filters);
  const [rows] = await db.query(
    `SELECT oi.hsn_code, oi.tax_percent,
            COUNT(DISTINCT o.order_id) AS orders,
            COALESCE(SUM(oi.line_subtotal),0) AS taxable_value,
            COALESCE(SUM(oi.tax_amount),0) AS tax_amount
     FROM order_items oi
     INNER JOIN orders o ON o.order_id = oi.order_id
     ${sql}
     GROUP BY oi.hsn_code, oi.tax_percent
     ORDER BY tax_amount DESC`,
    params
  );
  return rows;
}

module.exports = {
  salesSummary, salesTrend, salesBySource, salesByStatus, salesByPaymentMode, salesByLocation,
  topProducts, nonMovingProducts, categoryPerformance,
  topCustomers, customerRetention, customerGrowth,
  prescriptionStats, couponPerformance, gstReport,
};
