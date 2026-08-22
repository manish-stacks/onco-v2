const db = require('../config/db');

/**
 * Firebase Cloud Messaging — customer app aur admin dono ke liye.
 *
 * Setup:
 *   1. Firebase console > Project settings > Service accounts > Generate new
 *      private key. A JSON file will be downloaded.
 *   2. .env me path do:  FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
 *      Or the whole JSON on one line: FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
 *
 * If it is not configured everything is logged to the console — in local dev the app flow
 * does not break.
 */

let admin = null;
let initialized = false;
let initError = null;

function init() {
  if (initialized) return admin;
  initialized = true;

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!jsonEnv && !pathEnv) {
    initError = 'FIREBASE_SERVICE_ACCOUNT is not set';
    return null;
  }

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    admin = require('firebase-admin');

    let credential;
    if (jsonEnv) {
      credential = admin.credential.cert(JSON.parse(jsonEnv));
    } else {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const serviceAccount = require(require('path').resolve(pathEnv));
      credential = admin.credential.cert(serviceAccount);
    }

    if (!admin.apps.length) admin.initializeApp({ credential });
    console.log('[fcm] Firebase initialized');
    return admin;
  } catch (err) {
    initError = err.message;
    console.error('[fcm] init fail:', err.message);
    admin = null;
    return null;
  }
}

function isConfigured() {
  return !!init();
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/** Register the token on app/panel login */
async function registerToken({ token, customerId, adminId, platform, deviceInfo }) {
  if (!token) return null;

  // If the same device logs in again, update the old row instead of creating a new one
  await db.query(
    `INSERT INTO device_tokens (token, customer_id, admin_id, platform, device_info, is_active, last_used_at)
     VALUES (?,?,?,?,?,1,NOW())
     ON DUPLICATE KEY UPDATE
       customer_id = VALUES(customer_id),
       admin_id    = VALUES(admin_id),
       platform    = VALUES(platform),
       device_info = VALUES(device_info),
       is_active   = 1,
       last_used_at = NOW()`,
    [token, customerId || null, adminId || null, platform || 'android', deviceInfo || null]
  );
  return true;
}

/** Logout pe deactivate */
async function removeToken(token) {
  await db.query(`UPDATE device_tokens SET is_active = 0 WHERE token = ?`, [token]);
}

async function tokensForCustomer(customerId) {
  const [rows] = await db.query(
    `SELECT token FROM device_tokens WHERE customer_id = ? AND is_active = 1`, [customerId]
  );
  return rows.map((r) => r.token);
}

async function tokensForAdmins() {
  const [rows] = await db.query(
    `SELECT token FROM device_tokens WHERE admin_id IS NOT NULL AND is_active = 1`
  );
  return rows.map((r) => r.token);
}

/** FCM reported the token is dead — remove it from the DB, otherwise it fails every time */
async function deactivateTokens(tokens = []) {
  if (!tokens.length) return;
  await db.query(
    `UPDATE device_tokens SET is_active = 0 WHERE token IN (${tokens.map(() => '?').join(',')})`,
    tokens
  );
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function logPush({ recipient, template, customerId, orderId, success, response, error }) {
  try {
    await db.query(
      `INSERT INTO notification_logs
        (channel, template, recipient, customer_id, order_id, success, response, error)
       VALUES ('push',?,?,?,?,?,?,?)`,
      [template, recipient, customerId || null, orderId || null,
        success ? 1 : 0, String(response || '').slice(0, 2000), String(error || '').slice(0, 500)]
    );
  } catch (err) {
    console.error('[fcm] log fail:', err.message);
  }
}

/**
 * Send a notification to the tokens.
 * @param {string[]} tokens
 * @param {object} notification { title, body, image }
 * @param {object} data         extra payload — app deep-link ke liye
 */
async function sendToTokens(tokens, notification, data = {}, meta = {}) {
  const clean = [...new Set((tokens || []).filter(Boolean))];
  if (!clean.length) return { skipped: 'no active tokens' };

  const fb = init();
  if (!fb) {
    console.log('[fcm] DEV MODE —', notification.title, '|', clean.length, 'tokens');
    await logPush({ ...meta, template: notification.title, recipient: `${clean.length} tokens`, success: false, error: initError });
    return { dev: true, tokens: clean.length };
  }

  // Every value in an FCM data payload must be a string
  const stringData = {};
  Object.entries(data).forEach(([k, v]) => {
    stringData[k] = v === null || v === undefined ? '' : String(v);
  });

  try {
    const res = await fb.messaging().sendEachForMulticast({
      tokens: clean,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.image ? { imageUrl: notification.image } : {}),
      },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          channelId: notification.channel || 'orders',
          sound: 'default',
        },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    // clean up dead tokens
    const dead = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') {
        dead.push(clean[i]);
      }
    });
    if (dead.length) await deactivateTokens(dead);

    await logPush({
      ...meta,
      template: notification.title,
      recipient: `${clean.length} tokens`,
      success: res.successCount > 0,
      response: `sent ${res.successCount}, failed ${res.failureCount}, removed ${dead.length}`,
    });

    return { sent: res.successCount, failed: res.failureCount, removed: dead.length };
  } catch (err) {
    console.error('[fcm] send fail:', err.message);
    await logPush({ ...meta, template: notification.title, recipient: `${clean.length} tokens`, success: false, error: err.message });
    return { failed: true, error: err.message };
  }
}

async function sendToCustomer(customerId, notification, data = {}, meta = {}) {
  const tokens = await tokensForCustomer(customerId);
  return sendToTokens(tokens, notification, data, { customerId, ...meta });
}

async function sendToAdmins(notification, data = {}, meta = {}) {
  const tokens = await tokensForAdmins();
  return sendToTokens(tokens, notification, data, meta);
}

/** Topic broadcast — sab app users ko (offers wagairah) */
async function sendToTopic(topic, notification, data = {}) {
  const fb = init();
  if (!fb) {
    console.log(`[fcm] DEV MODE — topic ${topic}:`, notification.title);
    return { dev: true };
  }
  const stringData = {};
  Object.entries(data).forEach(([k, v]) => { stringData[k] = String(v ?? ''); });

  try {
    const id = await fb.messaging().send({
      topic,
      notification: { title: notification.title, body: notification.body },
      data: stringData,
    });
    return { messageId: id };
  } catch (err) {
    console.error('[fcm] topic send fail:', err.message);
    return { failed: true, error: err.message };
  }
}

module.exports = {
  isConfigured, registerToken, removeToken,
  tokensForCustomer, tokensForAdmins,
  sendToTokens, sendToCustomer, sendToAdmins, sendToTopic,
};
