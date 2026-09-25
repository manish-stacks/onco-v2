const db = require('../config/db');

/**
 * Auto-purge of log tables.
 *
 *  - otp_logs             (OTP history)             — kept 7 days   (LOG_RETENTION_DAYS)
 *  - notification_logs    (WhatsApp/SMS/push record) — kept 7 days   (LOG_RETENTION_DAYS)
 *  - inventory_logs       (stock movement audit)     — kept 180 days (INVENTORY_LOG_RETENTION_DAYS)
 *  - admin_activity_logs  (admin audit trail)        — kept 90 days  (ADMIN_LOG_RETENTION_DAYS)
 *
 * order_status_logs is NOT purged here — it's an order's own history (shown
 * on the order detail / tracking timeline for the life of the order), not a
 * disposable diagnostic log, so it stays as long as the order does.
 *
 * Audit trail ko jaan-bujh kar zyada der rakha jaata hai (support/dispute me
 * "kisne kya badla" dekhne ke kaam aata hai) — isiliye alag, lambi retention.
 * Runs once on boot and then every 24 hours. No cron dependency — a plain
 * interval is enough for a cleanup job.
 */
const RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 7;
const ADMIN_LOG_RETENTION_DAYS = parseInt(process.env.ADMIN_LOG_RETENTION_DAYS, 10) || 90;
const INVENTORY_LOG_RETENTION_DAYS = parseInt(process.env.INVENTORY_LOG_RETENTION_DAYS, 10) || 180;
const DAY_MS = 24 * 60 * 60 * 1000;

async function purgeOldLogs() {
  const jobs = [
    ['otp_logs', RETENTION_DAYS],
    ['notification_logs', RETENTION_DAYS],
    ['inventory_logs', INVENTORY_LOG_RETENTION_DAYS],
    ['admin_activity_logs', ADMIN_LOG_RETENTION_DAYS],
  ];
  for (const [table, days] of jobs) {
    try {
      const [r] = await db.query(
        `DELETE FROM \`${table}\` WHERE created_at < (NOW() - INTERVAL ? DAY)`,
        [days]
      );
      if (r.affectedRows) {
        console.log(`[cleanup] ${table}: removed ${r.affectedRows} rows older than ${days} day(s)`);
      }
    } catch (err) {
      // Table may not exist yet on a fresh DB — never crash the app for this.
      console.error(`[cleanup] ${table} purge failed:`, err.message);
    }
  }
}

let timer = null;

/** Call once from server startup. */
function startLogCleanup() {
  // First run shortly after boot so startup isn't blocked, then daily.
  setTimeout(() => { purgeOldLogs(); }, 30 * 1000);
  timer = setInterval(purgeOldLogs, DAY_MS);
  if (timer.unref) timer.unref(); // don't keep the process alive just for this
  console.log(`[cleanup] log auto-purge scheduled (every 24h, keep ${RETENTION_DAYS}d logs / ${INVENTORY_LOG_RETENTION_DAYS}d inventory / ${ADMIN_LOG_RETENTION_DAYS}d admin audit)`);
}

function stopLogCleanup() {
  if (timer) clearInterval(timer);
}

module.exports = { startLogCleanup, stopLogCleanup, purgeOldLogs };