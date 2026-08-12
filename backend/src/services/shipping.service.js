const db = require('../config/db');
const dtdc = require('./dtdc.service');
const orderModel = require('../models/order.model');
const notify = require('./notification.service');
const events = require('./events.service');
const cache = require('../utils/cache');
const { ORDER_STATUS } = require('../config/constants');

/**
 * DTDC ko order flow se jodta hai.
 *
 * Booking pe teen cheezein ek saath honi chahiye: AWB save, order status
 * Shipped, aur customer ko tracking message. Alag-alag jagah se karne pe
 * koi ek reh jaata hai, isliye sab yahan ek function me.
 */

async function bookOrder(orderId, opts = {}) {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error('Order nahi mila'), { status: 404 });

  if (order.status === ORDER_STATUS.CANCELLED) {
    throw Object.assign(new Error('Cancelled order ship nahi ho sakta'), { status: 409 });
  }
  if (order.awb_number) {
    throw Object.assign(
      new Error(`Ye order pehle hi book hai (AWB ${order.awb_number}). Pehle cancel karo.`),
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

async function cancelBooking(orderId, { cancelledBy } = {}) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order nahi mila'), { status: 404 });
  if (!order.awb_number) {
    throw Object.assign(new Error('Is order ka koi AWB nahi hai'), { status: 409 });
  }

  await dtdc.cancelShipment(order.awb_number);

  await db.query(
    `UPDATE orders SET awb_number = NULL, courier_name = NULL, tracking_status = 'Cancelled'
     WHERE order_id = ?`, [orderId]
  );
  await orderModel.updateStatus(orderId, ORDER_STATUS.PROCESSING, cancelledBy || 'system',
    `DTDC booking cancel — AWB ${order.awb_number}`);

  await cache.invalidate.orders();
  return { cancelled: true, awb: order.awb_number };
}

/** Live tracking + order status sync */
async function refreshTracking(orderId) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order?.awb_number) {
    throw Object.assign(new Error('Is order ka koi AWB nahi hai'), { status: 409 });
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
 * DTDC webhook — status push karta hai.
 * Endpoint: POST /api/webhooks/dtdc  (public, koi auth nahi)
 */
async function handleWebhook(body) {
  const parsed = dtdc.parseWebhook(body);
  if (!parsed.awb) return { ignored: 'AWB nahi mila' };

  const [[order]] = await db.query(
    `SELECT * FROM orders WHERE awb_number = ? LIMIT 1`, [parsed.awb]
  );
  if (!order) return { ignored: `AWB ${parsed.awb} ka order nahi mila` };

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

  // Sirf tabhi status badlo jab wo actually aage badha ho
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
  bookOrder, cancelBooking, refreshTracking, handleWebhook, listShipments, listScans,
};
