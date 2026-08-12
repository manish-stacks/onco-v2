const razorpayService = require('../../services/razorpay.service');
const payuService = require('../../services/payu.service');
const paymentService = require('../../services/payment.service');
const orderService = require('../../services/order.service');
const orderModel = require('../../models/order.model');
const notify = require('../../services/notification.service');
const db = require('../../config/db');
const { ok, fail, asyncHandler } = require('../../utils/response');

/** GET /payments/gateways — checkout page ko batao kaunse options hain */
const gateways = asyncHandler(async (req, res) => ok(res, {
  available: paymentService.availableGateways(),
  default: paymentService.defaultGateway(),
}));

// ---------------------------------------------------------------------------
// RAZORPAY
// ---------------------------------------------------------------------------

/**
 * POST /api/app/payments/razorpay/webhook
 *
 * Razorpay Dashboard > Settings > Webhooks me URL daalo, events:
 * payment.captured, payment.failed, refund.processed
 *
 * Raw body chahiye HMAC verify ke liye — server.js me is path pe
 * express.raw() laga hai.
 */
async function razorpayWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;

    if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
      console.warn('[webhook:razorpay] signature invalid');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const entity = event?.payload?.payment?.entity || event?.payload?.refund?.entity;
    const gatewayOrderId = entity?.order_id;
    const paymentId = entity?.id;

    console.log(`[webhook:razorpay] ${event.event} order=${gatewayOrderId}`);
    if (!gatewayOrderId) return res.status(200).json({ success: true });

    const order = await orderModel.findByRazorpayOrderId(gatewayOrderId);
    if (!order) {
      console.warn('[webhook:razorpay] order nahi mila:', gatewayOrderId);
      return res.status(200).json({ success: true });
    }

    switch (event.event) {
      case 'payment.captured':
        await orderService.markOrderPaid(order.order_id, paymentId, 'razorpay-webhook');
        break;
      case 'payment.failed':
        await orderService.markOrderPaymentFailed(order.order_id, paymentId);
        notify.paymentFailedAlert({
          order,
          paymentId,
          gatewayOrderId,
          context: 'razorpay webhook',
          error: entity?.error_description || 'payment failed',
        });
        break;
      case 'refund.processed':
        await orderModel.updatePayment(order.order_id, {
          payment_status: 'Refunded', refund_reference: paymentId,
        });
        break;
      default:
        break;
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    // 200 hi bhejo — warna Razorpay hamari bug pe retries hammer karega
    console.error('[webhook:razorpay] error:', err);
    return res.status(200).json({ success: false });
  }
}

// ---------------------------------------------------------------------------
// PAYU
// ---------------------------------------------------------------------------

/**
 * PayU form-POST se wapas aata hai (browser redirect), JSON se nahi.
 * Isliye ye do routes HTML redirect karte hain, JSON nahi.
 */
function redirectToApp(res, path, params = {}) {
  const base = process.env.PUBLIC_SITE_URL || '';
  const qs = new URLSearchParams(params).toString();
  return res.redirect(`${base}${path}${qs ? `?${qs}` : ''}`);
}

/** POST /api/app/payments/payu/success — PayU ka surl */
async function payuSuccess(req, res) {
  try {
    const result = payuService.verifyCallback(req.body);

    if (!result.valid) {
      // Hash match nahi hua — koi fake POST kar raha hai. Paid mark mat karo.
      console.error('[payu] hash mismatch, txnid:', result.txnid);
      notify.paymentFailedAlert({
        order: { databaseOrderID: result.txnid },
        paymentId: result.paymentId,
        gatewayOrderId: result.txnid,
        context: 'payu success callback',
        error: 'Hash verification fail — possible tampering',
      });
      return redirectToApp(res, '/payment/failed', { reason: 'verification_failed' });
    }

    const [[order]] = await db.query(
      `SELECT * FROM orders WHERE gateway_order_id = ? OR databaseOrderID = ? LIMIT 1`,
      [result.txnid, result.txnid]
    );
    if (!order) {
      console.error('[payu] order nahi mila:', result.txnid);
      return redirectToApp(res, '/payment/failed', { reason: 'order_not_found' });
    }

    if (result.success) {
      await orderService.markOrderPaid(order.order_id, result.paymentId, 'payu-callback');
      return redirectToApp(res, '/payment/success', {
        order_id: order.order_id,
        ref: order.databaseOrderID,
      });
    }

    await orderService.markOrderPaymentFailed(order.order_id, result.paymentId);
    return redirectToApp(res, '/payment/failed', { reason: result.status });
  } catch (err) {
    console.error('[payu] success handler error:', err);
    return redirectToApp(res, '/payment/failed', { reason: 'server_error' });
  }
}

/** POST /api/app/payments/payu/failure — PayU ka furl */
async function payuFailure(req, res) {
  try {
    const result = payuService.verifyCallback(req.body);

    if (result.orderId || result.txnid) {
      const [[order]] = await db.query(
        `SELECT * FROM orders WHERE gateway_order_id = ? OR databaseOrderID = ? LIMIT 1`,
        [result.txnid, result.txnid]
      );
      if (order) {
        await orderService.markOrderPaymentFailed(order.order_id, result.paymentId);
        notify.paymentFailedAlert({
          order,
          paymentId: result.paymentId,
          gatewayOrderId: result.txnid,
          context: 'payu failure callback',
          error: result.error || result.status || 'payment failed',
        });
      }
    }

    return redirectToApp(res, '/payment/failed', {
      reason: result.error || result.status || 'failed',
    });
  } catch (err) {
    console.error('[payu] failure handler error:', err);
    return redirectToApp(res, '/payment/failed', { reason: 'server_error' });
  }
}

/**
 * POST /payments/payu/verify — client-side confirmation.
 *
 * Mobile app me browser redirect handle karna mushkil hai, isliye app
 * PayU se wapas aake seedha ye call karta hai. Ye server-to-server
 * verify karta hai, client ki baat pe bharosa nahi karta.
 */
const payuVerify = asyncHandler(async (req, res) => {
  const { txnid } = req.body;
  if (!txnid) return fail(res, 'txnid chahiye', 422);

  const [[order]] = await db.query(
    `SELECT * FROM orders WHERE (gateway_order_id = ? OR databaseOrderID = ?) AND customer_id = ? LIMIT 1`,
    [txnid, txnid, req.customer.customer_id]
  );
  if (!order) return fail(res, 'Order nahi mila', 404);

  if (order.payment_status === 'Paid') {
    return ok(res, await orderModel.findById(order.order_id), 'Payment pehle hi confirm hai');
  }

  const status = await paymentService.verifyStatus('payu', { gatewayOrderId: txnid });

  if (!status.paid) {
    await orderService.markOrderPaymentFailed(order.order_id, status.paymentId);
    return fail(res, 'Payment abhi tak confirm nahi hua', 409);
  }

  const updated = await orderService.markOrderPaid(order.order_id, status.paymentId, 'payu-verify');
  return ok(res, updated, 'Payment confirm ho gaya');
});

module.exports = {
  gateways,
  razorpayWebhook,
  payuSuccess,
  payuFailure,
  payuVerify,
  // purana naam bhi export — routes na tootein
  handleWebhook: razorpayWebhook,
};
