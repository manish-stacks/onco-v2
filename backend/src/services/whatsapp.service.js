const axios = require('axios');
const db = require('../config/db');
const { normalizeMobile } = require('../utils/helpers');

/**
 * WhatsApp via BuzWap (hoverbusinessservices gateway).
 *
 *   GET .../sendmsgutil.php?user=&pass=&sender=BUZWAP&phone=&text=<template>
 *       &priority=wa&stype=normal&Params=v1,v2,v3
 *
 * `text` = approved template ka naam, `Params` = comma-separated values.
 *
 * ⚠ Params are joined with commas — so if any value contains a comma
 * the gateway will read it as two separate params and the whole message shifts.
 * Commas are very common in addresses ("Office no 2, Second Floor"), so
 * every value is sanitized (comma -> " -", newline -> " ").
 */

const TEMPLATES = {
  // Customer ko — order place hone pe (app se aaya order)
  ORDER_SUCCESS: {
    name: 'order_success',
    params: ['customer_name', 'order_id', 'order_date', 'order_status', 'ship_name',
      'ship_address', 'pincode', 'mobile', 'items', 'subtotal', 'shipping',
      'discount', 'total', 'payment_method'],
  },
  // Customer ko — order place hone pe (web se aaya order, COD charges alag)
  WEB_ORDER_SUCCESS: {
    name: 'web_order_success',
    params: ['customer_name', 'order_id', 'order_date', 'order_status', 'ship_name',
      'ship_address', 'pincode', 'mobile', 'items', 'subtotal', 'shipping',
      'cod_charges', 'discount', 'total', 'payment_method'],
  },
  // Customer ko — payment confirm
  PAYMENT_SUCCESS: {
    name: 'payment_success',
    params: ['customer_name', 'order_number', 'items', 'total', 'payment_method'],
  },
  // Customer ko — status badla
  ORDER_STATUS_UPDATE: {
    name: 'order_status_update',
    params: ['customer_name', 'order_id', 'status'],
  },
  // Customer ko — ship details
  ORDER_SHIPPED: {
    name: 'order_shipped',
    params: ['customer_name', 'order_id', 'courier', 'awb', 'tracking_url'],
  },
  // To the admin — payment verification failed (detailed alert)
  PAYMENT_FAILED_ALERT: {
    name: 'payment_failed',
    params: ['payment_id', 'gateway_order_id', 'system_order_id', 'customer_name',
      'customer_phone', 'amount', 'context', 'error_message', 'time'],
  },
  // To the admin — payment issue (small alert)
  PAYMENT_FAIL_ALERT: {
    name: 'payment_fail',
    params: ['payment_id', 'order_id', 'customer_name', 'amount', 'issue'],
  },
  OTP: {
    name: 'otp',
    params: ['otp'],
  },
  // Customer ko — prescription approve
  // NOTE: 'prescription_approved' template must be pre-approved on the BuzWap/WhatsApp
  // Business dashboard before this will actually deliver (same as every other template here).
  PRESCRIPTION_APPROVED: {
    name: 'prescription_approved',
    params: ['customer_name', 'reference_code'],
  },
  // Customer ko — prescription reject
  PRESCRIPTION_REJECTED: {
    name: 'prescription_rejected',
    params: ['customer_name', 'reference_code', 'reason'],
  },
};

function isConfigured() {
  return !!(process.env.WA_USER && process.env.WA_PASS);
}

/** Commas/newlines break the params — strip them */
function sanitize(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/,/g, ' -')
    .replace(/\s+/g, ' ')
    .trim();
}

async function log({ template, recipient, customerId, orderId, params, success, response, error }) {
  try {
    await db.query(
      `INSERT INTO notification_logs
        (channel, template, recipient, customer_id, order_id, params, success, response, error)
       VALUES ('whatsapp',?,?,?,?,?,?,?,?)`,
      [template, recipient, customerId || null, orderId || null,
        JSON.stringify(params || []), success ? 1 : 0,
        String(response || '').slice(0, 2000), String(error || '').slice(0, 500)]
    );
  } catch (err) {
    console.error('[whatsapp] log fail:', err.message);
  }
}

/**
 * Send a template message.
 * @param {string} mobile
 * @param {object} template  TEMPLATES me se ek
 * @param {object} values    { customer_name: 'Ram', order_id: 'OHM-1' }
 * @param {object} meta      { customerId, orderId } — logging ke liye
 */
async function sendTemplate(mobile, template, values = {}, meta = {}) {
  if (!mobile) return { skipped: 'no mobile number' };

  // arrange the values according to the template's param order
  const params = template.params.map((key) => sanitize(values[key]));
  const phone = normalizeMobile(mobile);

  if (!isConfigured()) {
    console.log(`[whatsapp] DEV MODE — ${phone} | ${template.name} |`, params);
    await log({ template: template.name, recipient: phone, ...meta, params, success: false, error: 'dev mode' });
    return { dev: true, params };
  }

  const url = process.env.WA_BASE_URL || 'http://waapi.hoverbusinessservices.com/api/sendmsgutil.php';

  try {
    const { data } = await axios.get(url, {
      params: {
        user: process.env.WA_USER,
        pass: process.env.WA_PASS,
        sender: process.env.WA_SENDER || 'BUZWAP',
        phone,
        text: template.name,
        priority: 'wa',
        stype: 'normal',
        Params: params.join(','),
      },
      timeout: 15000,
    });

    await log({ template: template.name, recipient: phone, ...meta, params, success: true, response: data });
    return { success: true, response: data };
  } catch (err) {
    const msg = err.response?.data || err.message;
    console.error(`[whatsapp] ${template.name} fail:`, msg);
    await log({ template: template.name, recipient: phone, ...meta, params, success: false, error: msg });
    // A failed notification must never stop the order flow
    return { success: false, error: msg };
  }
}

/** Admin alerts — .env me comma-separated numbers */
function adminNumbers() {
  return (process.env.WA_ADMIN_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

async function alertAdmins(template, values, meta = {}) {
  const numbers = adminNumbers();
  if (!numbers.length) return { skipped: 'WA_ADMIN_NUMBERS is not set' };
  return Promise.all(numbers.map((n) => sendTemplate(n, template, values, meta)));
}

module.exports = { TEMPLATES, sendTemplate, alertAdmins, isConfigured, sanitize };
