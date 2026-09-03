const db = require('../config/db');
const dtdc = require('./dtdc.service');
const orderModel = require('../models/order.model');
const notify = require('./notification.service');
const events = require('./events.service');
const cache = require('../utils/cache');
const { ORDER_STATUS } = require('../config/constants');

/**
 * Connects DTDC to the order flow.
 *
 * Three things must happen together on booking: save the AWB, update order status
 * Shipped, and a tracking message to the customer. Doing these in separate places
 * one of them gets missed, so they all live in this one function.
 */

async function bookOrder(orderId, opts = {}) {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (order.status === ORDER_STATUS.CANCELLED) {
    throw Object.assign(new Error('A cancelled order cannot be shipped'), { status: 409 });
  }
  if (order.awb_number) {
    throw Object.assign(
      new Error(`This order is already booked (AWB ${order.awb_number}). Cancel it first.`),
      { status: 409 }
    );
  }

  const booking = await dtdc.bookShipment(order, {
    serviceType: opts.serviceType,
    weight: opts.weight,
    length: opts.length,
    width: opts.width,
    height: opts.height,
    numPieces: opts.numPieces,
    bookedBy: opts.bookedBy,
  });

  const trackingUrl = dtdc.trackingUrl(booking.awb);

  await orderModel.updateTracking(orderId, {
    awb_number: booking.awb,
    courier_name: 'DTDC',
    tracking_status: 'Booked',
    tracking_datetime: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });

  await orderModel.updateStatus(orderId, ORDER_STATUS.SHIPPED, opts.bookedBy || 'system',
    `DTDC booked — AWB ${booking.awb} (${booking.serviceType})`);

  await cache.invalidate.orders();

  notify.orderShipped(order, { courier: 'DTDC', awb: booking.awb, trackingUrl });

  events.emit('order.shipped', {
    order_id: orderId,
    reference: order.databaseOrderID,
    awb: booking.awb,
    courier: 'DTDC',
  }, 'orders.view');

  return { ...booking, trackingUrl, order: await orderModel.findById(orderId) };
}

/**
 * Manual shipment booking — for orders sent through a courier that isn't
 * wired up (Porter, a local rider, hand delivery, etc). No API call to any
 * courier here; the admin just tells us the tracking id + courier name and
 * we save it exactly like a DTDC booking would, then notify the customer.
 */
async function manualShip(orderId, { courierName, awbNumber, notes, shippedBy } = {}) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (order.status === ORDER_STATUS.CANCELLED) {
    throw Object.assign(new Error('A cancelled order cannot be shipped'), { status: 409 });
  }
  if (order.awb_number) {
    throw Object.assign(
      new Error(`This order is already booked (AWB ${order.awb_number}). Cancel it first.`),
      { status: 409 }
    );
  }
  if (!String(courierName || '').trim()) {
    throw Object.assign(new Error('Courier name is required'), { status: 422 });
  }
  if (!String(awbNumber || '').trim()) {
    throw Object.assign(new Error('Tracking / AWB number is required'), { status: 422 });
  }

  await orderModel.updateTracking(orderId, {
    awb_number: awbNumber.trim(),
    courier_name: courierName.trim(),
    tracking_status: 'Booked',
    tracking_datetime: new Date().toISOString().slice(0, 19).replace('T', ' '),
    tracking_details: notes || null,
  });

  await orderModel.updateStatus(orderId, ORDER_STATUS.SHIPPED, shippedBy || 'system',
    `Manually shipped via ${courierName} — Tracking ${awbNumber}${notes ? ` — ${notes}` : ''}`);

  await cache.invalidate.orders();

  notify.orderShipped(order, { courier: courierName, awb: awbNumber, trackingUrl: null, notes });

  events.emit('order.shipped', {
    order_id: orderId, reference: order.databaseOrderID, awb: awbNumber, courier: courierName,
  }, 'orders.view');

  return { awb: awbNumber, courier: courierName, order: await orderModel.findById(orderId) };
}

async function cancelBooking(orderId, { cancelledBy } = {}) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (!order.awb_number) {
    throw Object.assign(new Error('This order has no AWB'), { status: 409 });
  }

  if (order.courier_name === 'DTDC') {
    await dtdc.cancelShipment(order.awb_number);
  }

  await db.query(
    `UPDATE orders SET awb_number = NULL, courier_name = NULL, tracking_status = 'Cancelled'
     WHERE order_id = ?`, [orderId]
  );
  await orderModel.updateStatus(orderId, ORDER_STATUS.PROCESSING, cancelledBy || 'system',
    `${order.courier_name || 'Courier'} booking cancelled — AWB ${order.awb_number}`);

  await cache.invalidate.orders();
  return { cancelled: true, awb: order.awb_number };
}

/** Live tracking + order status sync */
async function refreshTracking(orderId) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order?.awb_number) {
    throw Object.assign(new Error('This order has no AWB'), { status: 409 });
  }
  if (order.courier_name !== 'DTDC') {
    throw Object.assign(
      new Error(`Live tracking isn't available for ${order.courier_name || 'this courier'} — this was a manually recorded shipment`),
      { status: 409 }
    );
  }

  const tracking = await dtdc.trackShipment(order.awb_number);
  const latest = tracking.scans[tracking.scans.length - 1];

  if (latest) {
    await orderModel.updateTracking(orderId, {
      awb_number: order.awb_number,
      courier_name: order.courier_name || 'DTDC',
      tracking_status: latest.description,
      tracking_location: latest.destination || latest.origin,
      tracking_datetime: latest.scan_at,
    });

    const mapped = dtdc.SCAN_TO_ORDER_STATUS[String(latest.action_code).toUpperCase()];
    if (mapped && mapped !== order.status) {
      await orderModel.updateStatus(orderId, mapped, 'dtdc-tracking', latest.description);
      notify.orderStatusChanged(order, mapped);
    }
  }

  await cache.invalidate.orders();
  return tracking;
}

/**
 * DTDC webhook — pushes status updates.
 * Endpoint: POST /api/webhooks/dtdc  (public, no auth)
 */
async function handleWebhook(body) {
  const parsed = dtdc.parseWebhook(body);
  if (!parsed.awb) return { ignored: 'No AWB found' };

  const [[order]] = await db.query(
    `SELECT * FROM orders WHERE awb_number = ? LIMIT 1`, [parsed.awb]
  );
  if (!order) return { ignored: `No order found for AWB ${parsed.awb}` };

  await dtdc.syncScans(parsed.awb, [{
    action_code: parsed.code,
    description: parsed.description,
    origin: parsed.origin,
    destination: parsed.destination,
    scan_at: parsed.scanAt,
  }]);

  await orderModel.updateTracking(order.order_id, {
    awb_number: parsed.awb,
    courier_name: order.courier_name || 'DTDC',
    tracking_status: parsed.description,
    tracking_location: parsed.destination || parsed.origin,
    tracking_datetime: parsed.scanAt,
  });

  // Only change the status when it has actually moved forward
  if (parsed.orderStatus && parsed.orderStatus !== order.status) {
    await orderModel.updateStatus(order.order_id, parsed.orderStatus, 'dtdc-webhook', parsed.description);
    notify.orderStatusChanged(order, parsed.orderStatus);

    events.emit('order.status', {
      order_id: order.order_id,
      reference: order.databaseOrderID,
      status: parsed.orderStatus,
      changed_by: 'dtdc-webhook',
    }, 'orders.view');
  }

  await cache.invalidate.orders();
  return { ok: true, awb: parsed.awb, status: parsed.orderStatus };
}

async function listShipments(orderId) {
  const [rows] = await db.query(
    `SELECT shipment_id, courier, awb_number, service_type, status, cod_amount,
            last_scan, last_location, last_scan_at, booked_by, created_at
     FROM shipments WHERE order_id = ? ORDER BY shipment_id DESC`,
    [orderId]
  );
  return rows;
}

async function listScans(awb) {
  const [rows] = await db.query(
    `SELECT * FROM shipment_scans WHERE awb_number = ? ORDER BY scan_at DESC, id DESC`, [awb]
  );
  return rows;
}

module.exports = {
  bookOrder, manualShip, cancelBooking, refreshTracking, handleWebhook, listShipments, listScans,
};
