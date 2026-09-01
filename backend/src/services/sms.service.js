const axios = require('axios');
const db = require('../config/db');

/**
 * SMS via 2Factor.in (same provider + templates as the old OncoHealthMart site).
 *
 * The old site sent every SMS through 2Factor's TSMS route with DLT-approved
 * templates, e.g. OTP -> "RegistrationConfirmation", order placed ->
 * "OrderPlacementNotification". We keep exactly those template names so no new
 * DLT approval is needed.
 *
 *   POST https://2factor.in/API/V1/<API_KEY>/ADDON_SERVICES/SEND/TSMS
 *   body: { From, To, TemplateName, VAR1, VAR2, ... }
 *
 * .env:
 *   TWOFACTOR_API_KEY=          (falls back to the existing 2FACTOR_API_KEY value,
 *                                which already holds the 2Factor key)
 *   TWOFACTOR_SENDER=ONCOHM     (DLT header / From)
 *   TWOFACTOR_OTP_TEMPLATE=RegistrationConfirmation
 *
 * Without a key the OTP is printed to the console so local dev keeps working.
 */

function apiKey() {
  // The current .env stores the 2Factor key under 2FACTOR_API_KEY — accept both.
  return process.env.TWOFACTOR_API_KEY || process.env.2FACTOR_API_KEY || '';
}

function senderId() {
  return process.env.TWOFACTOR_SENDER || process.env.2FACTOR_SENDER_ID || 'ONCOHM';
}

function otpTemplate() {
  return process.env.TWOFACTOR_OTP_TEMPLATE || 'RegistrationConfirmation';
}

function isConfigured() {
  return !!apiKey();
}

/** 2Factor accepts the 10-digit number; the old site prefixed it with +91 */
function toTenDigit(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.slice(-10);
}

function receiver(mobile) {
  return `+91${toTenDigit(mobile)}`;
}

/** Send a TSMS (transactional) message on a DLT-approved template. */
async function sendTsms(mobile, templateName, variables = []) {
  const url = `https://2factor.in/API/V1/${apiKey()}/ADDON_SERVICES/SEND/TSMS`;

  const body = {
    From: senderId(),
    To: receiver(mobile),
    TemplateName: templateName,
  };
  // 2Factor reads VAR1, VAR2, VAR3 ... in order.
  variables.forEach((v, i) => { body[`VAR${i + 1}`] = String(v ?? ''); });

  const { data } = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return data;
}

/**
 * Send an OTP and record it in otp_logs (visible in the admin panel).
 *
 * @param {string} mobile
 * @param {string} otp
 * @param {object} meta { customerId, purpose, source, ip, expiresAt, channel }
 */
async function sendOtp(mobile, otp, meta = {}) {
  const number = toTenDigit(mobile);
  let result;
  let provider = 'dev';
  let delivered = false;

  if (!isConfigured()) {
    console.log(`[sms] DEV MODE — OTP for ${number}: ${otp}`);
    result = { dev: true, otp };
  } else {
    provider = '2factor';
    try {
      result = await sendTsms(number, otpTemplate(), [otp]);
      delivered = String(result?.Status).toLowerCase() === 'success';
      if (!delivered) console.error('[sms] 2Factor rejected OTP:', result);
    } catch (err) {
      const msg = err.response?.data || err.message;
      console.error('[sms] OTP send fail:', msg);
      result = { error: msg };
    }
  }

  await logOtp({ mobile: number, otp, provider, delivered, response: result, ...meta });

  if (isConfigured() && !delivered) {
    throw Object.assign(
      new Error('There was a problem sending the OTP, please try again shortly'),
      { status: 502 }
    );
  }

  return result;
}

/**
 * Transactional SMS — order updates etc.
 * @param {string} mobile
 * @param {string} templateName  DLT template name (e.g. 'OrderPlacementNotification')
 * @param {Array}  variables     [VAR1, VAR2, ...]
 */
async function sendTransactional(mobile, templateName, variables = []) {
  if (!isConfigured() || !templateName) {
    console.log(`[sms] DEV MODE — ${toTenDigit(mobile)} | template ${templateName} |`, variables);
    return { dev: true };
  }
  const vars = Array.isArray(variables) ? variables : [variables];
  try {
    return await sendTsms(mobile, templateName, vars);
  } catch (err) {
    // A failed SMS must not stop the main flow
    console.error('[sms] transactional fail:', err.response?.data || err.message);
    return { failed: true };
  }
}

/**
 * OTP history — the admin support team checks this when a customer says
 * "OTP not received". Kept behind the `otp.view` permission.
 */
async function logOtp({ mobile, otp, customerId, purpose, channel, provider, delivered, response, source, ip, expiresAt }) {
  try {
    await db.query(
      `INSERT INTO otp_logs
        (mobile, otp, purpose, customer_id, channel, provider, delivered,
         provider_response, source, ip_address, expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        mobile, otp, purpose || 'login', customerId || null,
        channel || 'sms', provider || null, delivered ? 1 : 0,
        JSON.stringify(response || {}).slice(0, 2000),
        source === 'app' ? 'app' : 'web', ip || null,
        expiresAt || null,
      ]
    );
  } catch (err) {
    console.error('[sms] otp log fail:', err.message);
  }
}

/** OTP verify hone pe mark kar do */
async function markOtpUsed(mobile, otp) {
  try {
    await db.query(
      `UPDATE otp_logs SET used_at = NOW()
       WHERE mobile = ? AND otp = ? AND used_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [toTenDigit(mobile), otp]
    );
  } catch (err) {
    console.error('[sms] otp mark used fail:', err.message);
  }
}

module.exports = { sendOtp, sendTransactional, logOtp, markOtpUsed, isConfigured, toTenDigit };
