const nodemailer = require('nodemailer');
const db = require('../config/db');

/**
 * Plain SMTP mailer (nodemailer). Configure via .env:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE (true/false), SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If SMTP_HOST is not set, isConfigured() is false and every send() call is a
 * silent no-op (logged) — same "never break the main flow" pattern as whatsapp.service.js.
 */

let transporter = null;

function isConfigured() {
  return !!process.env.SMTP_HOST;
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function log({ to, subject, customerId, orderId, success, error }) {
  try {
    await db.query(
      `INSERT INTO notification_logs
        (channel, template, recipient, customer_id, order_id, params, success, response, error)
       VALUES ('email',?,?,?,?,?,?,?,?)`,
      [subject, to, customerId || null, orderId || null, '[]',
        success ? 1 : 0, '', String(error || '').slice(0, 500)]
    );
  } catch (err) {
    console.error('[mail] log fail:', err.message);
  }
}

/**
 * Send a plain HTML email.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @param {object} meta { customerId, orderId }
 */
async function send(to, subject, html, meta = {}) {
  if (!to) return { success: false, error: 'no recipient email' };

  if (!isConfigured()) {
    console.warn('[mail] SMTP not configured — skipping email:', subject);
    await log({ to, subject, ...meta, success: false, error: 'SMTP not configured' });
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    await log({ to, subject, ...meta, success: true });
    return { success: true };
  } catch (error) {
    console.error('[mail] send fail:', error.message);
    await log({ to, subject, ...meta, success: false, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { send, isConfigured };
