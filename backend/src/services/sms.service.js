const axios = require('axios');
const db = require('../config/db');
const { normalizeMobile } = require('../utils/helpers');

/**
 * SMS via Fast2SMS.
 *
 * Two routes are supported:
 *   route=otp  — Fast2SMS ka built-in OTP route. Sirf `variables_values` me
 *                only the OTP is sent, no DLT template ID needed.
 *                Message is fixed: "Your OTP: 123456"
 *   route=dlt  — use this when you have your own DLT-approved template. Then
 *                FAST2SMS_DLT_TEMPLATE_ID and sender_id are required.
 *
 * .env:
 *   FAST2SMS_API_KEY=
 *   FAST2SMS_ROUTE=otp            (ya 'dlt')
 *   FAST2SMS_SENDER_ID=OHMART     (dlt route ke liye)
 *   FAST2SMS_DLT_TEMPLATE_ID=     (dlt route ke liye)
 *
 * Without a key the OTP is printed to the console — the local dev flow keeps working.
 */
const BASE = 'https://www.fast2sms.com/dev/bulkV2';

function isConfigured() {
  return !!process.env.FAST2SMS_API_KEY;
}

/** Fast2SMS accepts 10-digit numbers, without a country code */
function toTenDigit(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.slice(-10);
}

async function post(payload) {
  const { data } = await axios.post(BASE, payload, {
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
  return data;
}

/**
 * Send an OTP and record it in otp_logs (visible in the admin panel).
 *
 * @param {string} mobile
 * @param {string} otp
 * @param {object} meta { customerId, purpose, source, ip, expiresAt }
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
    provider = 'fast2sms';
    const route = process.env.FAST2SMS_ROUTE || 'otp';

    try {
      const payload = route === 'dlt'
        ? {
          route: 'dlt',
          sender_id: process.env.FAST2SMS_SENDER_ID,
          message: process.env.FAST2SMS_DLT_TEMPLATE_ID,
          variables_values: String(otp),
          numbers: number,
          flash: 0,
        }
        : {
          route: 'otp',
          variables_values: String(otp),
          numbers: number,
          flash: 0,
        };

      result = await post(payload);
      delivered = result?.return === true;

      if (!delivered) {
        console.error('[sms] Fast2SMS rejected it:', result);
      }
    } catch (err) {
      const msg = err.response?.data || err.message;
      console.error('[sms] OTP send fail:', msg);
      result = { error: msg };
    }
  }

  await logOtp({
    mobile: number,
    otp,
    provider,
    delivered,
    response: result,
    ...meta,
  });

  if (isConfigured() && !delivered) {
    throw Object.assign(
      new Error('There was a problem sending the OTP, please try again shortly'),
      { status: 502 }
    );
  }

  return result;
}

/** Transactional SMS — order updates etc. A DLT template is mandatory. */
async function sendTransactional(mobile, templateId, variables = []) {
  if (!isConfigured() || !templateId) {
    console.log(`[sms] DEV MODE — ${toTenDigit(mobile)} | template ${templateId} |`, variables);
    return { dev: true };
  }
  try {
    return await post({
      route: 'dlt',
      sender_id: process.env.FAST2SMS_SENDER_ID,
      message: templateId,
      variables_values: variables.join('|'),
      numbers: toTenDigit(mobile),
      flash: 0,
    });
  } catch (err) {
    // A failed SMS must not stop the main flow
    console.error('[sms] transactional fail:', err.response?.data || err.message);
    return { failed: true };
  }
}

/**
 * OTP history — the admin support team checks this when a customer says
 * "OTP not received". This is stored deliberately, so it
 * is kept behind the `otp.view` permission.
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
