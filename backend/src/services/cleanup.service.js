const db = require('../config/db');

/**
 * Auto-purge of log tables.
 *
 *  - otp_logs           (OTP history)
 *  - notification_logs  (every WhatsApp / SMS / push record)
 *
 * Both are only kept for support/debugging, so anything older than a week is
 * deleted. Runs once on boot and then every 24 hours. No cron dependency —
 * a plain interval is enough for a cleanup job.
 *
 * Override the window with LOG_RETENTION_DAYS (default 7).
 */
const RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 7;
const DAY_MS = 24 * 60 * 60 * 1000;

async function purgeOldLogs() {
  for (const table of ['otp_logs', 'notification_logs']) {
    try {
      const [r] = await db.query(
        `DELETE FROM \`${table}\` WHERE created_at < (NOW() - INTERVAL ? DAY)`,
        [RETENTION_DAYS]
      );
      if (r.affectedRows) {
        console.log(`[cleanup] ${table}: removed ${r.affectedRows} rows older than ${RETENTION_DAYS} day(s)`);
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
  console.log(`[cleanup] log auto-purge scheduled (every 24h, keep ${RETENTION_DAYS} day(s))`);
}

function stopLogCleanup() {
  if (timer) clearInterval(timer);
}

module.exports = { startLogCleanup, stopLogCleanup, purgeOldLogs };
