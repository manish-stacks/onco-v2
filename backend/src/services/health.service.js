const db = require('../config/db');
const redis = require('../config/redis');
const storage = require('./storage.service');
const dtdc = require('./dtdc.service');
const payu = require('./payu.service');
const sms = require('./sms.service');
const wa = require('./whatsapp.service');
const push = require('./firebase.service');
const events = require('./events.service');

/**
 * Dashboard pe "kya chalu hai, kya nahi" dikhane ke liye.
 *
 * Do tarah ke checks hain:
 *   • CRITICAL — na chale to site down (DB, storage)
 *   • OPTIONAL — na chale to feature band, site chalti rahegi (WhatsApp, DTDC)
 *
 * Jo check network call karta hai (S3, DB) wo `deep=true` pe hi chalta hai —
 * dashboard har 60s poll karta hai, har baar S3 ping karna zaroori nahi.
 */

async function checkDatabase() {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    const [[v]] = await db.query('SELECT VERSION() AS version');
    return {
      ok: true,
      latency_ms: Date.now() - start,
      detail: v.version,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    let keys = null;
    try {
      const info = await redis.info('keyspace');
      const m = info.match(/keys=(\d+)/);
      keys = m ? parseInt(m[1], 10) : 0;
    } catch { /* keyspace info optional */ }

    return {
      ok: pong === 'PONG',
      latency_ms: Date.now() - start,
      detail: keys !== null ? `${keys} keys cached` : 'connected',
    };
  } catch (err) {
    // Redis down = slow site, but not broken — cache layer fail-open hai
    return { ok: false, error: err.message, degraded: true };
  }
}

async function checkStorage(deep) {
  const c = storage.config();
  if (!storage.isS3Enabled()) {
    return {
      ok: false,
      configured: false,
      detail: 'Local disk use ho rahi hai — S3 configure nahi hai',
    };
  }
  if (!deep) {
    return { ok: true, configured: true, detail: `${c.bucket} (${c.region})` };
  }
  const ping = await storage.ping();
  return {
    ok: ping.ok,
    configured: true,
    detail: ping.ok ? `${c.bucket} (${c.region})` : ping.reason,
    error: ping.ok ? undefined : ping.reason,
  };
}

function checkRazorpay() {
  const configured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return {
    ok: configured,
    configured,
    detail: configured
      ? `${process.env.RAZORPAY_KEY_ID.startsWith('rzp_live') ? 'LIVE' : 'TEST'} mode${process.env.RAZORPAY_WEBHOOK_SECRET ? ' · webhook set' : ' · webhook secret missing'}`
      : 'Keys .env me nahi hain',
    warning: configured && !process.env.RAZORPAY_WEBHOOK_SECRET
      ? 'Webhook secret set nahi hai — payment confirmation miss ho sakta hai'
      : undefined,
  };
}

function checkPayu() {
  const configured = payu.isConfigured();
  const c = payu.config();
  return {
    ok: configured,
    configured,
    detail: configured ? `${c.mode.toUpperCase()} mode` : 'Merchant key/salt .env me nahi hain',
    warning: configured && (!c.successUrl || !c.failureUrl)
      ? 'PAYU_SUCCESS_URL / PAYU_FAILURE_URL set nahi hain'
      : undefined,
  };
}

function checkDtdc() {
  const configured = dtdc.isConfigured();
  const c = dtdc.config();
  return {
    ok: configured,
    configured,
    detail: configured
      ? `${c.mode.toUpperCase()} · ${c.customerCode}`
      : 'API key / customer code .env me nahi hain',
    warning: configured && !c.trackingToken
      ? 'Tracking token nahi hai — live tracking kaam nahi karegi'
      : undefined,
  };
}

function checkSms() {
  const configured = sms.isConfigured();
  return {
    ok: configured,
    configured,
    detail: configured
      ? `Fast2SMS · route=${process.env.FAST2SMS_ROUTE || 'otp'}`
      : 'API key nahi hai — OTP console pe print ho raha hai',
  };
}

function checkWhatsapp() {
  const configured = wa.isConfigured();
  const admins = (process.env.WA_ADMIN_NUMBERS || '').split(',').filter(Boolean).length;
  return {
    ok: configured,
    configured,
    detail: configured ? `BuzWap · ${admins} admin alert number(s)` : 'WA_USER / WA_PASS nahi hain',
    warning: configured && admins === 0
      ? 'WA_ADMIN_NUMBERS khaali hai — payment fail alerts kahin nahi jayenge'
      : undefined,
  };
}

function checkPush() {
  const configured = push.isConfigured();
  return {
    ok: configured,
    configured,
    detail: configured ? 'Firebase ready' : 'Service account JSON set nahi hai',
  };
}

async function checkPushTokens() {
  try {
    const [[row]] = await db.query(
      `SELECT
         SUM(customer_id IS NOT NULL AND is_active = 1) AS customers,
         SUM(admin_id IS NOT NULL AND is_active = 1) AS admins
       FROM device_tokens`
    );
    return { customers: Number(row.customers || 0), admins: Number(row.admins || 0) };
  } catch {
    return { customers: 0, admins: 0 };
  }
}

/** Recent notification delivery — kaam kar raha hai ya silently fail ho raha hai */
async function recentDelivery() {
  try {
    const [rows] = await db.query(
      `SELECT channel,
              COUNT(*) AS total,
              SUM(success = 1) AS sent
       FROM notification_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY channel`
    );
    return rows.map((r) => ({
      channel: r.channel,
      total: Number(r.total),
      sent: Number(r.sent),
      rate: r.total ? Number(((r.sent / r.total) * 100).toFixed(1)) : null,
    }));
  } catch {
    return [];
  }
}

async function mediaStatus() {
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'done') AS done,
              SUM(status = 'pending') AS pending,
              SUM(status = 'failed') AS failed
       FROM media_migration_items`
    );
    return {
      total: Number(row.total || 0),
      done: Number(row.done || 0),
      pending: Number(row.pending || 0),
      failed: Number(row.failed || 0),
    };
  } catch {
    // table abhi bani nahi hai
    return null;
  }
}

/**
 * @param {boolean} deep — network calls bhi karo (S3 ping wagairah)
 */
async function fullHealth({ deep = false } = {}) {
  const [database, redisHealth, storageHealth, tokens, delivery, media] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(deep),
    checkPushTokens(),
    recentDelivery(),
    mediaStatus(),
  ]);

  const services = {
    database: { label: 'Database', critical: true, ...database },
    redis: { label: 'Redis cache', critical: false, ...redisHealth },
    storage: { label: 'Media storage (S3)', critical: false, ...storageHealth },
    razorpay: { label: 'Razorpay', critical: false, ...checkRazorpay() },
    payu: { label: 'PayU', critical: false, ...checkPayu() },
    dtdc: { label: 'DTDC shipping', critical: false, ...checkDtdc() },
    sms: { label: 'Fast2SMS (OTP)', critical: false, ...checkSms() },
    whatsapp: { label: 'WhatsApp', critical: false, ...checkWhatsapp() },
    push: { label: 'Firebase push', critical: false, ...checkPush() },
  };

  const list = Object.values(services);
  const criticalDown = list.filter((s) => s.critical && !s.ok);
  const optionalDown = list.filter((s) => !s.critical && !s.ok);
  const warnings = list.filter((s) => s.warning);

  let overall = 'healthy';
  if (criticalDown.length) overall = 'down';
  else if (optionalDown.length || warnings.length) overall = 'degraded';

  return {
    overall,
    checked_at: new Date().toISOString(),
    summary: {
      total: list.length,
      up: list.filter((s) => s.ok).length,
      down: list.filter((s) => !s.ok).length,
      warnings: warnings.length,
    },
    services,
    push_tokens: tokens,
    delivery_24h: delivery,
    media_migration: media,
    live_connections: events.clientCount(),
    // At least one payment gateway zaroori hai — warna online order le hi nahi sakte
    payments_usable: services.razorpay.ok || services.payu.ok,
  };
}

module.exports = { fullHealth, checkDatabase, checkRedis, checkStorage };
