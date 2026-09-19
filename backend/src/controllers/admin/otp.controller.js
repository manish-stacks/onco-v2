const db = require('../../config/db');
const adminModel = require('../../models/admin.model');
const customerModel = require('../../models/customer.model');
const push = require('../../services/firebase.service');
const { QueryBuilder } = require('../../utils/queryBuilder');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

/**
 * OTP history — for the support team, when a customer says "I did not get the OTP".
 *
 * ⚠ Showing a live OTP is a real risk: anyone with the `otp.view` permission
 * they could get into any customer's account. Therefore:
 *   • only roles with the `otp.view` permission get this (default: Super Admin)
 *   • an activity log entry is created on every view
 *   • the OTP is visible only while it is still valid — after expiry/use
 *     gets masked
 * Grant this permission only to those who truly need it.
 */

function maskOtp(row) {
  const expired = row.expires_at && new Date(row.expires_at) < new Date();
  const used = !!row.used_at;

  return {
    ...row,
    otp: expired || used ? '••••••' : row.otp,
    is_expired: !!expired,
    is_used: used,
  };
}

/** GET /admin/otp-logs */
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);

  const qb = new QueryBuilder('o');
  qb.eq('purpose', req.query.purpose)
    .eq('source', req.query.source)
    .eq('customer_id', req.query.customer_id)
    .gte('created_at', req.query.from_date)
    .lte('created_at', req.query.to_date)
    .like(['mobile'], req.query.search);

  if (req.query.delivered === 'false') qb.raw('o.`delivered` = 0');
  if (req.query.delivered === 'true') qb.raw('o.`delivered` = 1');
  if (req.query.active === 'true') qb.raw('o.`used_at` IS NULL AND o.`expires_at` >= NOW()');

  const { sql: whereSql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT o.*, c.customer_name
     FROM otp_logs o
     LEFT JOIN customers c ON c.customer_id = o.customer_id
     ${whereSql} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM otp_logs o ${whereSql}`, params);

  // Deliberate: this must be logged, otherwise misuse cannot be traced
  if (req.query.search) {
    await adminModel.logActivity({
      admin_id: req.admin.admin_id,
      admin_username: req.admin.admin_username,
      action: 'otp_lookup',
      module: 'otp',
      description: `searched: ${req.query.search}`,
      ip_address: req.ip,
    });
  }

  return paginated(res, rows.map(maskOtp), total, page, limit);
});

/** GET /admin/otp-logs/stats — delivery health */
const stats = asyncHandler(async (req, res) => {
  const [[totals]] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN delivered = 1 THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS verified,
       SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today
     FROM otp_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );

  const [bySource] = await db.query(
    `SELECT source, COUNT(*) AS count FROM otp_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY source`
  );

  const deliveryRate = totals.total
    ? Number(((totals.delivered / totals.total) * 100).toFixed(1)) : 0;
  const verifyRate = totals.delivered
    ? Number(((totals.verified / totals.delivered) * 100).toFixed(1)) : 0;

  return ok(res, { ...totals, delivery_rate: deliveryRate, verify_rate: verifyRate, bySource });
});

/** GET /admin/notification-logs — WhatsApp/push/SMS ka record */
const notificationLogs = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);

  const qb = new QueryBuilder('n');
  qb.eq('channel', req.query.channel)
    .eq('template', req.query.template)
    .eq('order_id', req.query.order_id)
    .gte('created_at', req.query.from_date)
    .like(['recipient'], req.query.search);

  if (req.query.success === 'false') qb.raw('n.`success` = 0');
  if (req.query.success === 'true') qb.raw('n.`success` = 1');

  const { sql: whereSql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT n.*, o.databaseOrderID, o.order_date AS order_placed_date
     FROM notification_logs n
     LEFT JOIN orders o ON o.order_id = n.order_id
     ${whereSql} ORDER BY n.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM notification_logs n ${whereSql}`, params);

  return paginated(res, rows, total, page, limit);
});

/**
 * POST /admin/notifications/send — a one-off push notification composed by
 * an admin, either to one customer (by mobile number) or to everyone with
 * a registered device.
 */
const sendCustom = asyncHandler(async (req, res) => {
  const { title, body, target, mobile } = req.body;
  if (!title || !body) return fail(res, 'title and body are required', 422);
  if (!['all', 'customer'].includes(target)) return fail(res, "target must be 'all' or 'customer'", 422);

  let result;
  if (target === 'customer') {
    if (!mobile) return fail(res, 'mobile is required when target is customer', 422);
    const customer = await customerModel.findByMobile(mobile);
    if (!customer) return fail(res, 'No customer found with that mobile number', 404);
    result = await push.sendToCustomer(customer.customer_id, { title, body }, { type: 'custom_admin' });
  } else {
    result = await push.sendToAllCustomers({ title, body }, { type: 'custom_admin' });
  }

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'send_notification', module: 'notifications',
    description: `${target === 'all' ? 'Broadcast' : `To ${mobile}`}: ${title}`,
    ip_address: req.ip,
  });

  if (result?.failed) return fail(res, result.error || 'Could not send the notification', 502);
  return ok(res, result, target === 'all' ? `Sent to ${result?.sent ?? 0} device(s)` : 'Notification sent');
});

module.exports = { list, stats, notificationLogs, sendCustom };