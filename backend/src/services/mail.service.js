const nodemailer = require('nodemailer');
const db = require('../config/db');
const settingsModel = require('../models/settings.model');
const { isChannelEnabled } = require('../utils/notify-toggles');

/**
 * Plain SMTP mailer (nodemailer). Configure from admin → Settings (SMTP
 * section) — those DB values take priority. .env vars (SMTP_HOST, SMTP_PORT,
 * SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM) are only used as a fallback
 * for whatever the admin panel hasn't set.
 *
 * If nothing is configured either way, isConfigured() is false and every
 * send() call is a silent no-op (logged) — same "never break the main flow"
 * pattern as whatsapp.service.js.
 */

/**
 * SMTP config — DB (admin panel → Settings) takes priority, .env is only the
 * fallback for whatever the admin hasn't set yet. This lets SMTP be fixed
 * and test-sent from the admin panel without touching the server at all.
 * No transporter caching on purpose — creating one is cheap, and caching it
 * meant a saved change in admin wouldn't take effect until a server restart.
 */
async function getConfig() {
  const s = (await settingsModel.get()) || {};
  return {
    host: s.smtp_host || process.env.SMTP_HOST,
    port: Number(s.smtp_port || process.env.SMTP_PORT || 587),
    secure: s.smtp_host
      ? !!Number(s.smtp_secure)
      : String(process.env.SMTP_SECURE || 'false') === 'true',
    user: s.smtp_user || process.env.SMTP_USER,
    pass: s.smtp_host ? s.smtp_pass : process.env.SMTP_PASS,
    from: s.smtp_from || process.env.SMTP_FROM || s.smtp_user || process.env.SMTP_USER,
  };
}

async function isConfigured() {
  const c = await getConfig();
  return !!c.host;
}

async function getTransporter() {
  const c = await getConfig();
  // Port 465 is implicit TLS and MUST have secure:true, or the handshake
  // fails silently on every single send (this was exactly the ".env has
  // SMTP_PORT=465 with SMTP_SECURE=false" bug — self-correct it here so a
  // wrong config value can't quietly kill every outgoing email again).
  const secure = c.port === 465 ? true : c.secure;
  return { transporter: nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
  }), from: c.from };
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

  if (!(await isChannelEnabled('email'))) {
    await log({ to, subject, ...meta, success: false, error: 'email notifications disabled in admin settings' });
    return { success: false, error: 'email disabled in settings' };
  }

  return sendRaw(to, subject, html, meta);
}

/**
 * Admin operational alerts (new order, payment failed, etc.) must NOT be
 * silenced by the "Email notifications" toggle — that toggle is explicitly
 * documented, in the admin UI itself, as controlling CUSTOMER notifications
 * only ("Only controls customer notifications like order/prescription
 * updates"). Routing admin alerts through the gated send() meant turning
 * that toggle off to quiet customer spam would also silently kill the
 * admin's own new-order emails — use this for anything addressed to the
 * store/admin, not the customer.
 */
async function sendAdminAlert(to, subject, html, meta = {}) {
  if (!to) return { success: false, error: 'no recipient email' };
  return sendRaw(to, subject, html, meta);
}

async function sendRaw(to, subject, html, meta = {}) {
  if (!(await isConfigured())) {
    console.warn('[mail] SMTP not configured — skipping email:', subject);
    await log({ to, subject, ...meta, success: false, error: 'SMTP not configured' });
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const { transporter, from } = await getTransporter();
    await transporter.sendMail({ from, to, subject, html });
    await log({ to, subject, ...meta, success: true });
    return { success: true };
  } catch (error) {
    console.error('[mail] send fail:', error.message);
    await log({ to, subject, ...meta, success: false, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Admin "Test SMTP" button — send() skips the whole thing if `email`
 * notifications are toggled off, which would make the test button silently
 * do nothing even with correct SMTP creds. This bypasses that one check
 * only (still requires host/creds to actually be configured) so the test
 * button always tells the truth about the SMTP connection itself.
 */
async function sendTest(to) {
  if (!to) return { success: false, error: 'no recipient email' };
  if (!(await isConfigured())) return { success: false, error: 'SMTP not configured — fill in host/port/user first' };

  try {
    const { transporter, from } = await getTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from,
      to,
      subject: 'SMTP test email',
      html: `<p>This is a test email from your admin panel's SMTP settings. If you received this, SMTP is working.</p>`,
    });
    await log({ to, subject: 'SMTP test email', success: true });
    return { success: true };
  } catch (error) {
    await log({ to, subject: 'SMTP test email', success: false, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { send, sendAdminAlert, sendTest, isConfigured };
