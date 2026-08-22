const orderModel = require('../../models/order.model');
const prescriptionModel = require('../../models/prescription.model');
const orderService = require('../../services/order.service');
const adminModel = require('../../models/admin.model');
const cache = require('../../utils/cache');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination, getSort, toCsv } = require('../../utils/helpers');
const { ORDER_STATUSES, ORDER_STATUS_FLOW, PAYMENT_STATUS } = require('../../config/constants');

/**
 * One set of endpoints for both web and app orders.
 *   ?orderFrom=web  -> only website orders
 *   ?orderFrom=app  -> only mobile app orders
 *   (no filter) -> both combined
 */

/** GET /admin/orders */
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const sort = getSort(req.query, orderModel.SORTABLE, 'order_date');

  const { rows, total } = await orderModel.list({
    status: req.query.status,
    statuses: req.query.statuses,
    payment_status: req.query.payment_status,
    payment_mode: req.query.payment_mode,
    orderFrom: req.query.orderFrom,
    city: req.query.city,
    state: req.query.state,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
    min_amount: req.query.min_amount,
    max_amount: req.query.max_amount,
    search: req.query.search,
    customer_id: req.query.customer_id,
  }, { limit, offset }, sort);

  return paginated(res, rows, total, page, limit);
});

/** GET /admin/orders/stats — for the summary cards, cached for 60s */
const stats = asyncHandler(async (req, res) => {
  const filters = {
    orderFrom: req.query.orderFrom,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
  };
  const key = cache.buildKey('admin:orders:stats', filters);
  return ok(res, await cache.getOrSet(key, cache.TTL.SHORT, () => orderModel.stats(filters)));
});

/** GET /admin/orders/:orderId */
const detail = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId);
  if (!order) return fail(res, 'Order not found', 404);

  // which status is allowed next — the frontend dropdown is built from this
  order.allowed_next_statuses = ORDER_STATUS_FLOW[order.status] || [];
  return ok(res, order);
});

/** PATCH /admin/orders/:orderId/status */
const updateStatus = asyncHandler(async (req, res) => {
  const { status, note, force } = req.body;

  if (!ORDER_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${ORDER_STATUSES.join(', ')}`, 422);
  }

  const order = await orderModel.findById(req.params.orderId, { withItems: false, withHistory: false });
  if (!order) return fail(res, 'Order not found', 404);

  // validate the flow — can be overridden with force=true (for super admins)
  const allowed = ORDER_STATUS_FLOW[order.status] || [];
  if (!force && !allowed.includes(status)) {
    return fail(
      res,
      `Cannot move directly from '${order.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
      409
    );
  }

  const result = await orderService.changeStatus(req.params.orderId, status, {
    changedBy: req.admin.admin_username,
    note,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'status_change', module: 'orders', record_id: req.params.orderId,
    description: `${order.status} -> ${status}`, ip_address: req.ip,
  });

  return ok(res, result, 'Order status updated');
});

/** POST /admin/orders/:orderId/cancel — with refund + stock restore */
const cancelOrder = asyncHandler(async (req, res) => {
  const result = await orderService.cancelOrder(req.params.orderId, {
    changedBy: req.admin.admin_username,
    reason: req.body.reason,
    refundPayment: req.body.refund !== false,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'cancel', module: 'orders', record_id: req.params.orderId,
    description: req.body.reason, ip_address: req.ip,
  });

  return ok(res, result, result.refund?.failed
    ? 'The order was cancelled, but the refund failed — check it manually'
    : 'Order cancelled');
});

/** PATCH /admin/orders/:orderId/tracking */
const updateTracking = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId, { withItems: false, withHistory: false });
  if (!order) return fail(res, 'Order not found', 404);

  await orderModel.updateTracking(req.params.orderId, {
    awb_number: req.body.awb_number,
    courier_name: req.body.courier_name,
    tracking_status: req.body.tracking_status,
    tracking_location: req.body.tracking_location,
    tracking_datetime: req.body.tracking_datetime,
    tracking_details: req.body.tracking_details,
  });

  await cache.invalidate.orders();
  return ok(res, null, 'Tracking details updated');
});

/** PATCH /admin/orders/:orderId/payment — manual payment mark (bank transfer, etc.) */
const updatePayment = asyncHandler(async (req, res) => {
  const { payment_status, transaction_number } = req.body;
  const valid = Object.values(PAYMENT_STATUS);
  if (!valid.includes(payment_status)) {
    return fail(res, `payment_status must be one of: ${valid.join(', ')}`, 422);
  }

  await orderModel.updatePayment(req.params.orderId, { payment_status, transaction_number });
  await cache.invalidate.orders();

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'payment_update', module: 'orders', record_id: req.params.orderId,
    description: payment_status, ip_address: req.ip,
  });

  return ok(res, null, 'Payment status updated');
});

/** PATCH /admin/orders/:orderId — shipping address / notes edit */
const updateOrder = asyncHandler(async (req, res) => {
  const updated = await orderModel.updateFields(req.params.orderId, req.body);
  if (!updated) return fail(res, 'No valid field was provided to update', 422);

  await cache.invalidate.orders();
  return ok(res, await orderModel.findById(req.params.orderId), 'Order updated');
});

/** GET /admin/orders/export — CSV (one row per item) */
const exportCsv = asyncHandler(async (req, res) => {
  const rows = await orderModel.listForExport({
    status: req.query.status,
    payment_status: req.query.payment_status,
    orderFrom: req.query.orderFrom,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
    search: req.query.search,
  });

  const csv = toCsv(rows, [
    'order_id', 'databaseOrderID', 'order_date', 'customer_name', 'customer_phone',
    'customer_city', 'customer_state', 'customer_pincode', 'status', 'payment_status',
    'payment_mode', 'orderFrom', 'product_name', 'sku', 'unit_price', 'unit_quantity',
    'line_total', 'subtotal', 'order_gst', 'coupon_code', 'coupon_discount',
    'shipping_charge', 'amount', 'awb_number', 'courier_name',
  ]);

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'export', module: 'orders', description: `${rows.length} rows`, ip_address: req.ip,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
  return res.send(csv);
});

/** GET /admin/orders/:orderId/invoice — invoice ka structured data (PDF frontend banaye) */
const invoice = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.orderId);
  if (!order) return fail(res, 'Order not found', 404);

  const settingsModel = require('../../models/settings.model');
  const settings = await settingsModel.get();

  return ok(res, {
    invoice_number: order.invoice_number || `INV/${order.order_id}`,
    invoice_date: order.order_date,
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
      billing_address: order.customer_address,
      shipping_address: order.customer_shipping_address,
      city: order.customer_city,
      state: order.customer_state,
      pincode: order.customer_pincode,
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
 * PATCH /admin/orders/:orderId/prescription
 * Approve / reject the prescription straight from the order detail page,
 * so there is no need to jump to the separate Prescriptions page.
 * body: { status: 'Approved' | 'Rejected' | ..., rejection_reason, notes }
 */
const updatePrescriptionStatus = asyncHandler(async (req, res) => {
  const { status, rejection_reason, notes } = req.body;

  const order = await orderModel.findById(req.params.orderId, { withItems: false, withHistory: false });
  if (!order) return fail(res, 'Order not found', 404);
  if (!order.prescription_id) return fail(res, 'No prescription is attached to this order', 409);

  const { PRESCRIPTION_STATUSES } = require('../../config/constants');
  if (!PRESCRIPTION_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${PRESCRIPTION_STATUSES.join(', ')}`, 422);
  }
  if (status === 'Rejected' && !rejection_reason) {
    return fail(res, 'A reason is required in order to reject', 422);
  }

  await prescriptionModel.updateStatus(order.prescription_id, status, {
    reviewedBy: req.admin.admin_id,
    rejectionReason: rejection_reason,
    notes,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'status_change', module: 'prescriptions', record_id: order.prescription_id,
    description: `Order ${order.databaseOrderID} — prescription -> ${status}`, ip_address: req.ip,
  });

  await cache.invalidate.orders();
  return ok(res, await orderModel.findById(req.params.orderId), 'Prescription status updated');
});

module.exports = {
  list, stats, detail, updateStatus, cancelOrder, updateTracking,
  updatePayment, updateOrder, exportCsv, invoice, updatePrescriptionStatus,
};
