const razorpayService = require('./razorpay.service');
const payuService = require('./payu.service');

/**
 * Gateway ke upar ek patli layer. Order service ko ye nahi pata hona chahiye
 * ki Razorpay hai ya PayU — bas "payment start karo" / "refund karo" bolna hai.
 *
 * Naya gateway add karna ho (Cashfree, PhonePe) to sirf yahan ek case add
 * karo, baaki app ko farak nahi padega.
 */

const GATEWAYS = { RAZORPAY: 'razorpay', PAYU: 'payu' };

/** .env me default, per-order override bhi ho sakta hai */
function defaultGateway() {
  const g = String(process.env.DEFAULT_PAYMENT_GATEWAY || 'razorpay').toLowerCase();
  return Object.values(GATEWAYS).includes(g) ? g : GATEWAYS.RAZORPAY;
}

/** Kaunse gateways abhi usable hain — checkout page inhi me se choose karega */
function availableGateways() {
  const list = [];
  if (razorpayService.isConfigured?.() ?? !!process.env.RAZORPAY_KEY_ID) {
    list.push({ id: GATEWAYS.RAZORPAY, label: 'Razorpay', type: 'sdk' });
  }
  if (payuService.isConfigured()) {
    list.push({ id: GATEWAYS.PAYU, label: 'PayU', type: 'redirect' });
  }
  return list;
}

function resolve(requested) {
  const g = String(requested || '').toLowerCase();
  if (Object.values(GATEWAYS).includes(g)) return g;
  return defaultGateway();
}

/**
 * Payment session banao.
 *
 * Razorpay: SDK checkout kholne ke liye order_id + key wapas jaata hai.
 * PayU:     form endpoint + signed params wapas jaate hain, client form POST karta hai.
 *
 * Dono cases me `gateway_order_id` return hota hai jo orders table me store hota hai.
 */
async function createPaymentSession(gateway, order, customer) {
  const g = resolve(gateway);

  if (g === GATEWAYS.PAYU) {
    const req = payuService.buildPaymentRequest(order, customer);
    return {
      gateway: GATEWAYS.PAYU,
      type: 'redirect',
      gateway_order_id: req.params.txnid,
      payu: req, // { endpoint, params } — client hidden form POST kare
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

/** Gateway ke hisaab se refund */
async function refund(gateway, { paymentId, amount, txnid }) {
  const g = resolve(gateway);
  if (g === GATEWAYS.PAYU) {
    return payuService.refund(paymentId, amount, txnid);
  }
  return razorpayService.refund(paymentId, amount);
}

/**
 * Server-side status check. Callback/webhook miss ho jaye to isse
 * asli status pata chalta hai.
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

  if (!paymentId) return { paid: false, reason: 'payment id nahi hai' };
  const payment = await razorpayService.fetchPayment(paymentId);
  return {
    paid: payment.status === 'captured',
    paymentId: payment.id,
    raw: payment,
  };
}

module.exports = {
  GATEWAYS, defaultGateway, availableGateways, resolve,
  createPaymentSession, refund, verifyStatus,
};
