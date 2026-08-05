const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");

// Real SMTP transport (Nodemailer) — works as-is once SMTP_USER/PASS are set in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

// Replaces {{variable}} placeholders in a template string with values from `vars`.
function fillTemplate(str, vars = {}) {
  return str.replace(/{{\s*(\w+)\s*}}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : ""));
}

// Looks up an EmailTemplate/SmsTemplate row by key in the admin-editable templates table;
// falls back to the given default subject/body if no row exists yet (so the app works
// out of the box before an admin has customized anything).
async function renderEmailTemplate(key, vars, fallback) {
  const template = await prisma.emailTemplate.findUnique({ where: { key } }).catch(() => null);
  if (template) return { subject: fillTemplate(template.subject, vars), html: fillTemplate(template.bodyHtml, vars) };
  return { subject: fillTemplate(fallback.subject, vars), html: fillTemplate(fallback.html, vars) };
}

async function renderSmsTemplate(key, vars, fallbackBody) {
  const template = await prisma.smsTemplate.findUnique({ where: { key } }).catch(() => null);
  if (template) return fillTemplate(template.body, vars);
  return fillTemplate(fallbackBody, vars);
}

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL:STUB] to=${to} subject="${subject}"`);
    return;
  }
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
}

// Same as sendEmail, but looks up the subject/body from the admin-editable EmailTemplate
// table by key first (e.g. "ORDER_CONFIRMATION", "OTP"), falling back to hardcoded defaults.
async function sendTemplatedEmail(to, key, vars, fallback) {
  const { subject, html } = await renderEmailTemplate(key, vars, fallback);
  await sendEmail(to, subject, html);
}

// OTP/SMS: stubbed to console until a real provider (MSG91 / Twilio / Gupshup) is plugged in.
// Keep this function signature — swap the body only — so callers never change.
async function sendSms(phone, message) {
  if (process.env.OTP_PROVIDER === "console" || !process.env.OTP_PROVIDER) {
    console.log(`[SMS:STUB] to=${phone} msg="${message}"`);
    return;
  }
  // TODO: real provider call here, e.g.:
  // await axios.post('https://api.msg91.com/api/v5/otp', {...})
  throw new Error(`SMS provider "${process.env.OTP_PROVIDER}" not implemented yet`);
}

// Same as sendSms, but looks up the body from the admin-editable SmsTemplate table by key first.
async function sendTemplatedSms(phone, key, vars, fallbackBody) {
  const body = await renderSmsTemplate(key, vars, fallbackBody);
  await sendSms(phone, body);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { sendEmail, sendSms, sendTemplatedEmail, sendTemplatedSms, generateOtp };
