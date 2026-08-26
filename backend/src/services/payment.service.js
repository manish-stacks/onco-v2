const razorpayService = require('./razorpay.service');
const payuService = require('./payu.service');

/**
 * A thin layer over the gateways. The order service should not have to know
 * whether it is Razorpay or PayU — it just says "start payment" / "refund".
 *
 * To add a new gateway (Cashfree, PhonePe) just add one case here
 * and the rest of the app is unaffected.
 */

const GATEWAYS = { RAZORPAY: 'razorpay', PAYU: 'payu' };

/** Default in .env, can also be overridden per order */
function defaultGateway() {
  const g = String(process.env.DEFAULT_PAYMENT_GATEWAY || 'payu').toLowerCase();
  return Object.values(GATEWAYS).includes(g) ? g : GATEWAYS.PAYU;
}

/**
 * Which gateways are currently usable — the checkout page picks from these.
 * Two conditions: (1) the keys are configured in .env, and (2) the admin has
 * not disabled that gateway in Settings. Both are ON by default.
 */
function availableGateways(toggles) {
  const t = toggles || { razorpay: true, payu: true };
  const list = [];
  if ((razorpayService.isConfigured?.() ?? !!process.env.RAZORPAY_KEY_ID) && t.razorpay !== false) {
    list.push({ id: GATEWAYS.RAZORPAY, label: 'Razorpay', type: 'sdk' });
  }
  if (payuService.isConfigured() && t.payu !== false) {
    list.push({ id: GATEWAYS.PAYU, label: 'PayU', type: 'redirect' });
  }
  return list;
}

/** Same list, but reads the admin toggles from settings itself */
async function availableGatewaysLive() {
  const settingsModel = require('../models/settings.model');
  let cfg = { razorpay: true, payu: true };
  try {
    cfg = await settingsModel.getPaymentConfig();
  } catch (e) {
    console.warn('[payment] settings read fail, defaulting gateways ON:', e.message);
  }
  return { list: availableGateways(cfg), cfg };
}

function resolve(requested) {
  const g = String(requested || '').toLowerCase();
  if (Object.values(GATEWAYS).includes(g)) return g;
  return defaultGateway();
}

/**
 * Create a payment session.
 *
 * Razorpay: order_id + key are returned so the SDK checkout can be opened.
 * PayU:     the form endpoint + signed params are returned, the client POSTs the form.
 *
 * In both cases a `gateway_order_id` is returned and stored in the orders table.
 */
async function createPaymentSession(gateway, order, customer) {
  const g = resolve(gateway);

  if (g === GATEWAYS.PAYU) {
    const req = payuService.buildPaymentRequest(order, customer);
    return {
      gateway: GATEWAYS.PAYU,
      type: 'redirect',
      gateway_order_id: req.params.txnid,
      payu: req, // { endpoint, params } — the client POSTs a hidden form
    };
  }

  const rzp = await razorpayService.createOrder(order.amount, order.databaseOrderID, {
    order_id: String(order.order_id),
    customer_id: String(order.customer_id || ''),
  });

  return {
    gateway: GATEWAYS.RAZORPAY,
    type: 'sdk',
    gateway_order_id: rzp.id,
    razorpay: {
      key_id: process.env.RAZORPAY_KEY_ID,
      order_id: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      prefill: {
        name: order.customer_name,
        contact: order.customer_phone,
        email: order.customer_email || '',
      },
    },
  };
}

/** Refund through whichever gateway was used */
async function refund(gateway, { paymentId, amount, txnid }) {
  const g = resolve(gateway);
  if (g === GATEWAYS.PAYU) {
    return payuService.refund(paymentId, amount, txnid);
  }
  return razorpayService.refund(paymentId, amount);
}

/**
 * Server-side status check. If a callback/webhook is missed, this reveals
 * the real status becomes known.
 */
async function verifyStatus(gateway, { gatewayOrderId, paymentId }) {
  const g = resolve(gateway);

  if (g === GATEWAYS.PAYU) {
    const res = await payuService.verifyPayment(gatewayOrderId);
    return {
      paid: String(res.status).toLowerCase() === 'success',
      paymentId: res.paymentId,
      raw: res.raw,
    };
  }

  if (!paymentId) return { paid: false, reason: 'no payment id' };
  const payment = await razorpayService.fetchPayment(paymentId);
  return {
    paid: payment.status === 'captured',
    paymentId: payment.id,
    raw: payment,
  };
}

module.exports = {
  GATEWAYS, defaultGateway, availableGateways, availableGatewaysLive, resolve,
  createPaymentSession, refund, verifyStatus,
};
