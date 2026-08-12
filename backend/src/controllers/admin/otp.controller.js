const db = require('../../config/db');
const adminModel = require('../../models/admin.model');
const { QueryBuilder } = require('../../utils/queryBuilder');
const { ok, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

/**
 * OTP history — support team ke liye, jab customer bole "OTP nahi aaya".
 *
 * ⚠ Live OTP dikhana ek real risk hai: jiske paas `otp.view` permission hai
 * wo kisi bhi customer ke account me ghus sakta hai. Isliye:
 *   • ye sirf `otp.view` permission wale role ko milta hai (default: Super Admin)
 *   • har baar dekhne pe activity log banta hai
 *   • OTP sirf tab dikhta hai jab wo abhi valid ho — expire/use hone ke baad
 *     masked ho jaata hai
 * Ye permission bas usi ko do jise sach me chahiye.
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

  // Search karke dekha — ye log hona chahiye, warna misuse trace nahi hoga
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
    `SELECT n.*, o.databaseOrderID
     FROM notification_logs n
     LEFT JOIN orders o ON o.order_id = n.order_id
     ${whereSql} ORDER BY n.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM notification_logs n ${whereSql}`, params);

  return paginated(res, rows, total, page, limit);
});

module.exports = { list, stats, notificationLogs };
