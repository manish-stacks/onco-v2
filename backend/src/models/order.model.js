const db = require('../config/db');
const { QueryBuilder, orderBy } = require('../utils/queryBuilder');
const { parseJson } = require('../utils/helpers');

const SORTABLE = ['order_id', 'order_date', 'amount', 'status', 'created_at'];

/**
 * ONE order table. No temp/staging table.
 * An unpaid online order also stays here with `payment_status = 'Unpaid'` —
 * only the status is updated when payment arrives, no data moves anywhere.
 */

async function create(conn, o) {
  const [result] = await conn.query(
    `INSERT INTO orders SET ?`,
    [{
      databaseOrderID: o.databaseOrderID,
      razorpayOrderID: o.razorpayOrderID || null,
      order_date: o.order_date || new Date(),
      prescription_id: o.prescription_id || null,
      transaction_number: o.transaction_number || null,
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      patient_name: o.patient_name || null,
      doctor_name: o.doctor_name || null,
      hospital_name: o.hospital_name || null,
      customer_email: o.customer_email || null,
      customer_phone: o.customer_phone,
      customer_address: o.customer_address,
      customer_country: o.customer_country || 'India',
      customer_city: o.customer_city || null,
      customer_state: o.customer_state || null,
      customer_pincode: o.customer_pincode || null,
      amount: o.amount,
      subtotal: o.subtotal,
      order_gst: o.order_gst || 0,
      coupon_code: o.coupon_code || null,
      coupon_id: o.coupon_id || null,
      coupon_discount: o.coupon_discount || 0,
      shipping_charge: o.shipping_charge || 0,
      additional_charge: o.additional_charge || 0,
      comment: o.comment || null,
      payment_mode: o.payment_mode || null,
      payment_option: o.payment_option || o.payment_mode || null,
      payment_status: o.payment_status || 'Unpaid',
      prescription_notes: o.prescription_notes || null,
      customer_shipping_name: o.customer_shipping_name,
      customer_shipping_phone: o.customer_shipping_phone,
      customer_shipping_address: o.customer_shipping_address,
      customer_shipping_country: o.customer_shipping_country || 'India',
      customer_shipping_city: o.customer_shipping_city || null,
      customer_shipping_state: o.customer_shipping_state || null,
      customer_shipping_pincode: o.customer_shipping_pincode || null,
      status: o.status || 'Pending',
      orderFrom: o.orderFrom === 'app' ? 'app' : 'web',
    }]
  );
  return result.insertId;
}

async function addItems(conn, orderId, items = []) {
  if (!items.length) return;
  const values = items.map((it) => [
    orderId, it.product_id, it.product_name, it.product_image, it.sku, it.hsn_code,
    it.unit_price, it.unit_mrp || it.unit_price, it.unit_quantity,
    it.line_subtotal, it.tax_percent, it.tax_amount, it.line_total,
  ]);
  await conn.query(
    `INSERT INTO order_items
      (order_id, product_id, product_name, product_image, sku, hsn_code,
       unit_price, unit_mrp, unit_quantity, line_subtotal, tax_percent, tax_amount, line_total)
     VALUES ?`,
    [values]
  );
}

async function logStatus(conn, orderId, oldStatus, newStatus, changedBy, note) {
  await conn.query(
    `INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, note) VALUES (?,?,?,?,?)`,
    [orderId, oldStatus, newStatus, changedBy || 'system', note || null]
  );
}

async function findById(orderId, { withItems = true, withHistory = true } = {}) {
  const [[order]] = await db.query(`SELECT * FROM orders WHERE order_id = ?`, [orderId]);
  if (!order) return null;

  if (withItems) {
    const [items] = await db.query(`SELECT * FROM order_items WHERE order_id = ? ORDER BY item_id ASC`, [orderId]);
    order.items = items;
  }
  if (withHistory) {
    const [history] = await db.query(
      `SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC`, [orderId]
    );
    order.history = history;
  }
  if (order.prescription_id) {
    const [[presc]] = await db.query(
      `SELECT prescription_id, images, status, reference_code, patient_name, doctor_name,
              hospital_name, notes, rejection_reason, contact_number, created_at
         FROM prescriptions WHERE prescription_id = ?`,
      [order.prescription_id]
    );
    if (presc) presc.images = parseJson(presc.images, []);
    order.prescription = presc || null;
  }
  return order;
}

async function findByRazorpayOrderId(razorpayOrderId) {
  const [[order]] = await db.query(`SELECT * FROM orders WHERE razorpayOrderID = ? LIMIT 1`, [razorpayOrderId]);
  return order || null;
}

function buildFilters(filters = {}) {
  const qb = new QueryBuilder('o');
  qb.eq('customer_id', filters.customer_id)
    .eq('status', filters.status)
    .eq('payment_status', filters.payment_status)
    .eq('payment_mode', filters.payment_mode)
    .eq('orderFrom', filters.orderFrom)
    .eq('customer_city', filters.city)
    .eq('customer_state', filters.state)
    .gte('order_date', filters.from_date)
    .lte('order_date', filters.to_date)
    .gte('amount', filters.min_amount)
    .lte('amount', filters.max_amount)
    .in('status', filters.statuses);

  if (filters.search) {
    // Pasting a full ref like "ORD/2026/036154" (or "#36154") should still find
    // the order — match the trailing number against order_id.
    const trailing = String(filters.search).match(/(\d+)\s*$/);
    const orderIdEq = trailing ? parseInt(trailing[1], 10) : (Number(filters.search) || 0);
    qb.raw(
      '(o.`customer_name` LIKE ? OR o.`customer_phone` LIKE ? OR o.`databaseOrderID` LIKE ? OR o.`order_id` = ? OR o.`awb_number` LIKE ?)',
      `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`,
      orderIdEq, `%${filters.search}%`
    );
  }
  return qb;
}

async function list(filters = {}, { limit = 20, offset = 0 } = {}, sort = {}) {
  const { sql: whereSql, params } = buildFilters(filters).build();
  const sortCol = SORTABLE.includes(sort.column) ? sort.column : 'order_date';
  const order = orderBy(sortCol, sort.direction || 'DESC', 'o');

  const [rows] = await db.query(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count
     FROM orders o ${whereSql} ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM orders o ${whereSql}`, params);
  return { rows, total };
}

/** For export — flat rows with items, no pagination */
async function listForExport(filters = {}, maxRows = 5000) {
  const { sql: whereSql, params } = buildFilters(filters).build();
  const [rows] = await db.query(
    `SELECT o.order_id, o.databaseOrderID, o.order_date, o.customer_name, o.customer_phone,
            o.customer_city, o.customer_state, o.customer_pincode, o.status, o.payment_status,
            o.payment_mode, o.orderFrom, o.subtotal, o.order_gst, o.coupon_code, o.coupon_discount,
            o.shipping_charge, o.amount, o.awb_number, o.courier_name,
            oi.product_name, oi.sku, oi.unit_price, oi.unit_quantity, oi.line_total
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.order_id
     ${whereSql} ORDER BY o.order_date DESC LIMIT ?`,
    [...params, maxRows]
  );
  return rows;
}

async function updateStatus(orderId, newStatus, changedBy, note) {
  return db.withTransaction(async (conn) => {
    const [[order]] = await conn.query(`SELECT status FROM orders WHERE order_id = ? FOR UPDATE`, [orderId]);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

    const extra = newStatus === 'Completed' ? ', delivered_at = NOW()' : '';
    await conn.query(`UPDATE orders SET status = ?${extra} WHERE order_id = ?`, [newStatus, orderId]);
    await logStatus(conn, orderId, order.status, newStatus, changedBy, note);
    return { from: order.status, to: newStatus };
  });
}

async function updateTracking(orderId, t) {
  await db.query(
    `UPDATE orders SET awb_number = ?, courier_name = ?, tracking_status = ?,
       tracking_location = ?, tracking_datetime = ?, tracking_details = COALESCE(?, tracking_details)
     WHERE order_id = ?`,
    [t.awb_number || null, t.courier_name || null, t.tracking_status || null,
      t.tracking_location || null, t.tracking_datetime || null, t.tracking_details || null, orderId]
  );
}

async function updatePayment(orderId, { payment_status, transaction_number, refund_amount, refund_reference }, conn = db) {
  await conn.query(
    `UPDATE orders SET
       payment_status = COALESCE(?, payment_status),
       transaction_number = COALESCE(?, transaction_number),
       refund_amount = COALESCE(?, refund_amount),
       refund_reference = COALESCE(?, refund_reference)
     WHERE order_id = ?`,
    [payment_status || null, transaction_number || null,
      refund_amount ?? null, refund_reference || null, orderId]
  );
}

async function setInvoiceNumber(orderId, invoiceNumber) {
  await db.query(`UPDATE orders SET invoice_number = ? WHERE order_id = ?`, [invoiceNumber, orderId]);
}

/** Original invoice PDF uploaded by admin (usually while booking DTDC shipment). */
async function setOriginalInvoice(orderId, url) {
  await db.query(`UPDATE orders SET original_invoice_url = ? WHERE order_id = ?`, [url, orderId]);
}

async function updateFields(orderId, data) {
  const allowed = ['comment', 'cancellation_note', 'prescription_notes', 'gst_invoice',
    'customer_phone', 'customer_address',
    'customer_shipping_name', 'customer_shipping_phone', 'customer_shipping_address',
    'customer_shipping_city', 'customer_shipping_state', 'customer_shipping_pincode'];
  const payload = {};
  allowed.forEach((k) => { if (data[k] !== undefined) payload[k] = data[k]; });
  if (!Object.keys(payload).length) return false;
await db.query(`UPDATE orders SET ? WHERE order_id = ?`, [payload, orderId]);
  return true;
}

async function getItems(orderId, conn = db) {
  const [rows] = await conn.query(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);
  return rows;
}

/** Has the customer bought this product — checked before posting a review */
async function customerHasPurchased(customerId, productId) {
  const [[row]] = await db.query(
    `SELECT 1 AS ok FROM orders o INNER JOIN order_items oi ON oi.order_id = o.order_id
     WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'Completed' LIMIT 1`,
    [customerId, productId]
  );
  return !!row;
}

/** Dashboard/report stats */
async function stats(filters = {}) {
  const { sql: whereSql, params } = buildFilters(filters).build();

  const [[totals]] = await db.query(
    `SELECT COUNT(*) AS total_orders,
            COALESCE(SUM(amount),0) AS total_revenue,
            COALESCE(AVG(amount),0) AS avg_order_value,
            COALESCE(SUM(coupon_discount),0) AS total_discount,
            COALESCE(SUM(shipping_charge),0) AS total_shipping,
            COALESCE(SUM(order_gst),0) AS total_gst
     FROM orders o ${whereSql}`, params
  );

  const [byStatus] = await db.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue
     FROM orders o ${whereSql} GROUP BY status`, params
  );
  const [bySource] = await db.query(
    `SELECT orderFrom AS source, COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue
     FROM orders o ${whereSql} GROUP BY orderFrom`, params
  );
  const [byPayment] = await db.query(
    `SELECT payment_mode, payment_status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue
     FROM orders o ${whereSql} GROUP BY payment_mode, payment_status`, params
  );

  return { ...totals, byStatus, bySource, byPayment };
}

/**
 * Public tracking — an order can be found without logging in, but only
 * only when the order reference + registered phone number match. This makes random
 * it is impossible to view someone else's order by enumerating order IDs.
 * The phone is matched against both the billing and shipping phone, because
 * a confused customer may forget which number they gave.
 */
async function findByRefAndPhone(ref, phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!ref || cleanPhone.length !== 10) return null;

  const raw = String(ref).trim();
  // "ORD/2026/036154" / "#36154" -> the trailing number is the order_id
  const trailing = raw.match(/(\d+)\s*$/);
  const orderIdEq = trailing ? parseInt(trailing[1], 10) : 0;

  const [[order]] = await db.query(
    `SELECT * FROM orders
     WHERE (databaseOrderID = ? OR invoice_number = ? OR awb_number = ? OR order_id = ?)
       AND (RIGHT(customer_phone, 10) = ? OR RIGHT(customer_shipping_phone, 10) = ?)
     LIMIT 1`,
    [raw, raw, raw, orderIdEq, cleanPhone, cleanPhone]
  );
  if (!order) return null;

  const [items] = await db.query(
    `SELECT product_name, unit_quantity, unit_price, line_total FROM order_items
     WHERE order_id = ? ORDER BY item_id ASC`,
    [order.order_id]
  );
  const [history] = await db.query(
    `SELECT old_status, new_status, note, created_at FROM order_status_logs
     WHERE order_id = ? ORDER BY created_at ASC`,
    [order.order_id]
  );

  // Only the fields tracking needs — the full address/email/payment
  // we do not expose details in an anonymous lookup.
  return {
    order_id: order.order_id,
    databaseOrderID: order.databaseOrderID,
    order_date: order.order_date,
    status: order.status,
    payment_status: order.payment_status,
    payment_mode: order.payment_mode,
    amount: order.amount,
    customer_city: order.customer_shipping_city || order.customer_city,
    customer_state: order.customer_shipping_state || order.customer_state,
    awb_number: order.awb_number,
    courier_name: order.courier_name,
    tracking_status: order.tracking_status,
    tracking_location: order.tracking_location,
    tracking_datetime: order.tracking_datetime,
    delivered_at: order.delivered_at,
    items,
    history,
  };
}

module.exports = {
  create, addItems, logStatus, findById, findByRazorpayOrderId,
  list, listForExport, updateStatus, updateTracking, updatePayment,
  setInvoiceNumber, setOriginalInvoice, updateFields, getItems, customerHasPurchased, stats,
  buildFilters, SORTABLE, findByRefAndPhone,
};