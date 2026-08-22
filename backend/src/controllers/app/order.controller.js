const orderService = require('../../services/order.service');
const orderModel = require('../../models/order.model');
const cartModel = require('../../models/cart.model');
const razorpayService = require('../../services/razorpay.service');
const reviewModel = require('../../models/review.model');
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
  if (!orderRef || !phone) return fail(res, 'Both the Order ID and mobile number are required', 422);

  const order = await orderModel.findByRefAndPhone(orderRef.trim(), phone);
  if (!order) return fail(res, 'Order not found — check the Order ID and mobile number', 404);

  return ok(res, order);
});

module.exports = {
  quote, checkout, verifyPayment, retryPayment,
  myOrders, orderDetail, trackOrder, cancelOrder, submitReview, trackPublic,
};