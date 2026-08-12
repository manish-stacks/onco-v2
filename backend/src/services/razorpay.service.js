const Razorpay = require('razorpay');
const crypto = require('crypto');

let instance = null;
function getInstance() {
  if (!instance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw Object.assign(new Error('Razorpay keys .env me set nahi hain'), { status: 500 });
    }
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
}

/** amount rupees me — paise me convert hoke jaata hai */
async function createOrder(amount, receipt, notes = {}) {
  return getInstance().orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    payment_capture: 1,
    notes,
  });
}

/** checkout.js success callback ke baad ka signature */
function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
  } catch { return false; }
}

/** Webhook ka X-Razorpay-Signature header */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch { return false; }
}

/** amount na do to full refund */
async function refund(paymentId, amount) {
  const payload = amount ? { amount: Math.round(amount * 100), speed: 'normal' } : { speed: 'normal' };
  return getInstance().payments.refund(paymentId, payload);
}

async function fetchPayment(paymentId) {
  return getInstance().payments.fetch(paymentId);
}

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature, refund, fetchPayment };
