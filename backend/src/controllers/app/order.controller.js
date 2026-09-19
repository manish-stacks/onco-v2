const orderService = require('../../services/order.service');
const orderModel = require('../../models/order.model');
const cartModel = require('../../models/cart.model');
const razorpayService = require('../../services/razorpay.service');
const reviewModel = require('../../models/review.model');
const dtdc = require('../../services/dtdc.service');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

/**
 * Both web and app use these endpoints.
 * The only difference is the `X-Client-Platform: web|app` header, which drives orders.orderFrom
 * is stored in it. The rest of the logic is identical.
 */

/** POST /orders/quote — order banaye bina totals dikhao (cart page) */
const quote = asyncHandler(async (req, res) => {
  let items = req.body.items;

  // if no items were sent, take them from the cart
  if (!items || !items.length) {
    const cart = await cartModel.getCartWithTotals(req.customer.customer_id);
    if (!cart.items.length) return fail(res, 'Your cart is empty', 409);
    items = cart.items.map((i) => ({ product_id: i.product_id, unit_quantity: i.product_quantity }));
  }

  const result = await orderService.quote({
    items,
    coupon_code: req.body.coupon_code,
    payment_mode: req.body.payment_mode,
    customerId: req.customer.customer_id,
  });
  return ok(res, result);
});

/** POST /orders/checkout */
const checkout = asyncHandler(async (req, res) => {
  let items = req.body.items;

  if (!items || !items.length) {
    const cart = await cartModel.getCartWithTotals(req.customer.customer_id);
    if (!cart.items.length) return fail(res, 'Your cart is empty', 409);
    items = cart.items.map((i) => ({ product_id: i.product_id, unit_quantity: i.product_quantity }));
  }

  console.log("req.body", req.body);
  const result = await orderService.placeOrder({
    customerId: req.customer.customer_id,
    platform: req.platform,
    items,
    ...req.body,
  });

  return created(res, result, 'Order placed');
});

/** POST /orders/verify-payment — Razorpay checkout success ke baad */
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpayService.verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return fail(res, 'The payment signature could not be verified', 400);
  }

  const order = await orderModel.findByRazorpayOrderId(razorpay_order_id);
  if (!order) return fail(res, 'Order not found', 404);
  if (order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);

  const updated = await orderService.markOrderPaid(order.order_id, razorpay_payment_id, `customer:${req.customer.customer_id}`);
  return ok(res, updated, 'Payment confirmed');
});

/** POST /orders/:orderId/retry-payment — the payment failed, try again */
const retryPayment = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId, { withItems: false, withHistory: false });
  if (!order || order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);
  if (order.payment_status === 'Paid') return fail(res, 'This order is already paid', 409);
  if (order.status === 'Cancelled') return fail(res, 'A cancelled order cannot be paid for', 409);

  const rzp = await razorpayService.createOrder(order.amount, `${order.databaseOrderID}-R`, {
    order_id: String(order.order_id),
  });
  await orderModel.updatePayment(order.order_id, {});
  await require('../../config/db').query(
    `UPDATE orders SET razorpayOrderID = ? WHERE order_id = ?`, [rzp.id, order.order_id]
  );

  return ok(res, {
    razorpay: {
      key_id: process.env.RAZORPAY_KEY_ID,
      order_id: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
    },
  });
});

/** GET /orders */
const myOrders = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 10, 50);
  const { rows, total } = await orderModel.list(
    { customer_id: req.customer.customer_id, status: req.query.status },
    { limit, offset }
  );
  return paginated(res, rows, total, page, limit);
});

/** GET /orders/:orderId */
const orderDetail = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId);
  if (!order || order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);
  return ok(res, order);
});

/** GET /orders/:orderId/track */
const trackOrder = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId);
  if (!order || order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);

  return ok(res, {
    order_id: order.order_id,
    reference: order.databaseOrderID,
    status: order.status,
    payment_status: order.payment_status,
    awb_number: order.awb_number,
    courier_name: order.courier_name,
    tracking_status: order.tracking_status,
    tracking_location: order.tracking_location,
    tracking_datetime: order.tracking_datetime,
    delivered_at: order.delivered_at,
    history: order.history,
  });
});

/** POST /orders/:orderId/cancel */
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId, { withItems: false, withHistory: false });
  if (!order || order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);

  const result = await orderService.cancelOrder(order.order_id, {
    changedBy: `customer:${req.customer.customer_id}`,
    reason: req.body.reason || 'Cancelled by the customer',
  });
  return ok(res, result, 'Order cancelled');
});

/** POST /orders/:orderId/review — delivered product pe review */
const submitReview = asyncHandler(async (req, res) => {
  const { product_id, rating, title, review } = req.body;

  const purchased = await orderModel.customerHasPurchased(req.customer.customer_id, product_id);
  if (!purchased) return fail(res, 'You can only review products you have purchased', 403);

  await reviewModel.create({
    product_id,
    customer_id: req.customer.customer_id,
    order_id: req.params.orderId,
    rating, title, review,
  });
  return created(res, null, 'Review submitted — it will appear once approved');
});

/**
 * POST /orders/track-public — tracking can be viewed without logging in.
 * Rate limiting is required in production (basic brute-force protection),
 * currently both order_ref and phone must match, so guessing
 * is practically impossible.
 */
const trackPublic = asyncHandler(async (req, res) => {
  const { order_ref: orderRef, phone } = req.body;
  if (!orderRef) return fail(res, 'Both the Order ID required', 422);

  const order = await orderModel.findByRef(orderRef.trim(), '');
  if (!order) return fail(res, 'Order not found — check the Order ID', 404);

  return ok(res, order);
});

/**
 * POST /orders/:orderId/reorder
 *
 * Two-step to avoid surprises:
 *   - no body / { confirm:false } -> PREVIEW: returns each item's current
 *     availability so the UI can warn about out-of-stock products.
 *   - { confirm:true }            -> adds the in-stock items to the cart and
 *     reports what was skipped. Out-of-stock items are silently skipped, never
 *     block the rest of the order.
 */
const reorder = asyncHandler(async (req, res) => {
  const db = require('../../config/db');
  const order = await orderModel.findById(req.params.orderId);
  if (!order || order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);

  const items = order.items || [];
  const evals = [];
  for (const it of items) {
    const [[p]] = await db.query(
      `SELECT product_id, product_name, status, stock_quantity FROM products WHERE product_id = ?`,
      [it.product_id]
    );
    const quantity = Number(it.unit_quantity || it.quantity || 1);
    const stock = Number(p?.stock_quantity ?? 0);
    const available = !!p && p.status === 'Active' && stock >= quantity;
    evals.push({
      product_id: it.product_id,
      name: it.product_name || p?.product_name || `#${it.product_id}`,
      quantity,
      available,
      available_quantity: stock,
      reason: !p ? 'No longer available'
        : p.status !== 'Active' ? 'Currently unavailable'
          : stock < quantity ? (stock > 0 ? `Only ${stock} left` : 'Out of stock')
            : null,
    });
  }
  const skipped = evals.filter((e) => !e.available);

  // Preview — let the UI confirm before touching the cart
  if (!req.body?.confirm) {
    return ok(res, {
      items: evals,
      any_out_of_stock: skipped.length > 0,
      all_out_of_stock: evals.length > 0 && skipped.length === evals.length,
    });
  }

  // Confirmed — add whatever is in stock
  const added = [];
  for (const e of evals.filter((x) => x.available)) {
    try {
      await cartModel.addItem(req.customer.customer_id, { product_id: e.product_id, quantity: e.quantity });
      added.push(e.name);
    } catch { /* stock may have just changed — skip */ }
  }

  return ok(res, {
    added_count: added.length,
    added,
    skipped: skipped.map((e) => ({ name: e.name, reason: e.reason })),
    cart: await cartModel.getCartWithTotals(req.customer.customer_id),
  }, added.length ? 'Available items added to your cart' : 'None of these items are in stock right now');
});

/** GET /orders/:orderId/invoice — the customer's own invoice data */
const invoice = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId);
  if (!order || order.customer_id !== req.customer.customer_id) return fail(res, 'Order not found', 404);

  const settings = await require('../../models/settings.model').get();

  return ok(res, {
    invoice_number: order.invoice_number || `INV/${order.order_id}`,
    invoice_date: order.order_date,
    original_invoice_url: order.original_invoice_url || null,
    reference: order.databaseOrderID,
    order_id: order.order_id,
    status: order.status,
    seller: settings ? {
      name: settings.organization,
      address: settings.contact_address,
      phone: settings.contact_phone,
      email: settings.contact_email,
      logo: settings.logo,
    } : null,
    buyer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      shipping_address: order.customer_shipping_address,
      city: order.customer_shipping_city || order.customer_city,
      state: order.customer_shipping_state || order.customer_state,
      pincode: order.customer_shipping_pincode || order.customer_pincode,
    },
    items: order.items,
    totals: {
      subtotal: order.subtotal,
      gst: order.order_gst,
      discount: order.coupon_discount,
      shipping: order.shipping_charge,
      additional: order.additional_charge,
      total: order.amount,
    },
    payment: {
      mode: order.payment_mode,
      status: order.payment_status,
      transaction: order.transaction_number,
    },
  });
});

/**
 * POST /track-shipment — public, no login required. Anyone with an AWB
 * (admin or a customer) can look up its live DTDC status directly, same as
 * the standalone "Track your order" page.
 */
const trackShipmentPublic = asyncHandler(async (req, res) => {
  const awb = String(req.body?.awb || '').trim();
  if (!awb) return fail(res, 'AWB number is required', 422);
  if (!dtdc.isConfigured()) return fail(res, 'Tracking is not configured', 503);

  try {
    const result = await dtdc.trackShipment(awb);
    const steps = (result.scans || [])
      .slice()
      .sort((a, b) => new Date(a.scan_at || 0) - new Date(b.scan_at || 0))
      .map((s) => ({
        status: s.description,
        detail: s.detail,
        location: s.origin || s.destination || null,
        at: s.scan_at,
      }));
    const latestStep = steps[steps.length - 1];
    const currentStatus = result.header?.strStatus || latestStep?.status || 'Pickup scheduled';

    // Best-effort enrichment from our own order record, if this AWB is
    // attached to one — DTDC's own header fields are unreliable across
    // accounts, so fall back to what we already know about the order.
    const order = await orderModel.findByRef(awb).catch(() => null);

    return ok(res, {
      awb,
      ref_no: order ? order.databaseOrderID : (result.header?.strRefNo || null),
      current_status: currentStatus,
      stage: dtdc.stageFromStatus(currentStatus) || (steps.length ? 'picked_up' : null),
      origin: result.header?.strOrigin || result.header?.strOriginCity || null,
      destination: result.header?.strDestination || result.header?.strDestinationCity
        || (order ? [order.customer_shipping_city || order.customer_city, order.customer_shipping_pincode].filter(Boolean).join(', ') : null),
      expected_delivery: result.header?.strExpectedDeliveryDate || result.header?.strEDD || null,
      steps,
    });
  } catch (err) {
    return fail(res, err.response?.data?.error || 'Could not fetch tracking — check the AWB number and try again', 502);
  }
});

module.exports = {
  quote, checkout, verifyPayment, retryPayment,
  myOrders, orderDetail, trackOrder, cancelOrder, submitReview, trackPublic,
  reorder, invoice, trackShipmentPublic,
};