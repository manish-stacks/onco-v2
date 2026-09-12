const db = require('../config/db');
const orderModel = require('../models/order.model');
const productModel = require('../models/product.model');
const inventoryModel = require('../models/inventory.model');
const couponModel = require('../models/coupon.model');
const cartModel = require('../models/cart.model');
const settingsModel = require('../models/settings.model');
const paymentService = require('./payment.service');
const razorpayService = require('./razorpay.service');
const notify = require('./notification.service');
const events = require('./events.service');
const cache = require('../utils/cache');
const { genRef, genInvoiceNumber, money } = require('../utils/helpers');
const { isProductCodEligible } = require('../utils/cod-eligibility');
const {
  ORDER_STATUS, PAYMENT_STATUS, PAYMENT_MODE, CANCELLABLE_STATUSES, INVENTORY_CHANGE_TYPE,
} = require('../config/constants');

/**
 * The complete checkout logic. Web and app both use this service —
 * only `platform` differs, and that goes into orders.orderFrom.
 *
 * Everything happens inside one transaction:
 *   stock lock+decrement -> coupon consume -> order insert -> items insert
 * If anything fails, everything is rolled back — a half-created order never exists.
 */

/** Server-side pricing of the items — we never trust a price sent by the client */
async function priceItems(conn, items) {
  // Admin-controlled GST — read once, then applied to every line below
  const taxConfig = await settingsModel.getTaxConfig();
  let subtotal = 0;
  let totalGst = 0;
  let requiresPrescription = false;
  let codAllowed = true;
  const priced = [];

  for (const it of items) {
    const quantity = parseInt(it.unit_quantity || it.quantity, 10);
    if (!quantity || quantity < 1) {
      throw Object.assign(new Error('Every item must have a quantity of at least 1'), { status: 422 });
    }

    const product = await productModel.getPricingInfo(it.product_id, conn);
    if (!product) throw Object.assign(new Error(`Product ${it.product_id} not found`), { status: 404 });
    if (product.status !== 'Active') {
      throw Object.assign(new Error(`"${product.product_name}" is not available right now`), { status: 409 });
    }

    if (product.presciption_required === 'Yes') requiresPrescription = true;
    if (!isProductCodEligible(product)) codAllowed = false;

    const unitPrice = product.product_sp;
    const lineSubtotal = money(unitPrice * quantity);
    const taxPercent = settingsModel.resolveGstPercent(product.product_gst, taxConfig);
    const taxAmount = money((lineSubtotal * taxPercent) / 100);

    subtotal += lineSubtotal;
    totalGst += taxAmount;

    priced.push({
      product_id: product.product_id,
      product_name: product.product_name,
      product_image: product.image_1,
      sku: product.sku,
      hsn_code: product.hsn_code,
      unit_price: unitPrice,
      unit_mrp: product.product_mrp,
      unit_quantity: quantity,
      line_subtotal: lineSubtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      line_total: money(lineSubtotal + taxAmount),
    });
  }

  return {
    items: priced,
    subtotal: money(subtotal),
    gst: money(totalGst),
    requiresPrescription,
    codAllowed,
  };
}

/**
 * Checkout preview — shows the totals without creating an order.
 * Called when "apply coupon" is used on the cart page.
 */
async function quote({ items, coupon_code, payment_mode, customerId }) {
  const pricing = await priceItems(db, items);

  let couponResult = { valid: false, discount: 0 };
  if (coupon_code) {
    couponResult = await couponModel.validateForCart({
      code: coupon_code,
      customerId,
      subtotal: pricing.subtotal,
      productIds: items.map((i) => i.product_id),
    });
  }

  const discount = couponResult.valid ? couponResult.discount : 0;
  const charges = await settingsModel.calcCharges(pricing.subtotal, payment_mode);
  const total = money(pricing.subtotal + pricing.gst - discount + charges.shipping_charge + charges.cod_fee);

  return {
    items: pricing.items,
    subtotal: pricing.subtotal,
    gst: pricing.gst,
    coupon: coupon_code ? {
      code: coupon_code,
      valid: couponResult.valid,
      reason: couponResult.reason || null,
      discount,
    } : null,
    shipping_charge: charges.shipping_charge,
    cod_fee: charges.cod_fee,
    total,
    requires_prescription: pricing.requiresPrescription,
    cod_allowed: pricing.codAllowed,
  };
}

/**
 * Place the actual order.
 * @param {object} p  { customerId, platform, items, address fields, coupon_code, payment_mode, ... }
 */
async function placeOrder(p) {
  const paymentMode = p.payment_mode === PAYMENT_MODE.COD ? PAYMENT_MODE.COD : PAYMENT_MODE.ONLINE;

  // If COD is disabled globally, stop right here.
  // POS (admin-created) orders are exempt — cash is always accepted at the counter.
  if (paymentMode === PAYMENT_MODE.COD && !p.isPos && !(await settingsModel.isCodEnabled())) {
    throw Object.assign(new Error('COD is not available right now'), { status: 409 });
  }

  const databaseOrderID = genRef('OHM');

  const result = await db.withTransaction(async (conn) => {
    // 1. pricing (the products FOR UPDATE lock is taken in the stock step)
    const pricing = await priceItems(conn, p.items);

    if (paymentMode === PAYMENT_MODE.COD && !p.isPos && !pricing.codAllowed) {
      throw Object.assign(new Error('Some items in the cart are not available for COD'), { status: 409 });
    }
    if (pricing.requiresPrescription && !p.isPos && !p.prescription_id) {
      throw Object.assign(new Error('A prescription upload is required for these medicines'), { status: 422 });
    }

    // 2. coupon validate + consume
    let couponId = null;
    let discount = 0;
    if (p.coupon_code) {
      const check = await couponModel.validateForCart({
        code: p.coupon_code,
        customerId: p.customerId,
        subtotal: pricing.subtotal,
        productIds: p.items.map((i) => i.product_id),
      });
      if (!check.valid) throw Object.assign(new Error(check.reason), { status: 409 });
      couponId = check.coupon.coupon_id;
      discount = check.discount;
    }

    // Manual POS discount (flat amount or percentage), on top of any coupon.
    // Capped so the discount can never exceed the item subtotal.
    if (p.isPos && p.discount_value) {
      const value = parseFloat(p.discount_value) || 0;
      const manual = p.discount_type === 'percent'
        ? (pricing.subtotal * Math.min(Math.max(value, 0), 100)) / 100
        : Math.max(value, 0);
      discount = money(Math.min(discount + manual, pricing.subtotal));
    }

    // 3. charges + final total
    const charges = await settingsModel.calcCharges(pricing.subtotal, paymentMode);
    const amount = money(
      pricing.subtotal + pricing.gst - discount + charges.shipping_charge + charges.cod_fee
    );

    // 4. stock lock + decrement (this is where out-of-stock is caught)
    for (const item of pricing.items) {
      await inventoryModel.decrementStock(conn, {
        productId: item.product_id,
        quantity: item.unit_quantity,
        referenceType: 'order',
        referenceId: null, // the order does not exist yet; it is linked via the note in the log below
        changedBy: p.isPos ? `admin:${p.created_by || 'pos'}` : `customer:${p.customerId}`,
        note: `Order ${databaseOrderID}`,
      });
    }

    // 5. order row
    const orderId = await orderModel.create(conn, {
      databaseOrderID,
      razorpayOrderID: null, // set below
      order_date: new Date(),
      prescription_id: p.prescription_id || null,
      customer_id: p.customerId,
      customer_name: p.customer_name,
      patient_name: p.patient_name || p.customer_name,
      doctor_name: p.doctor_name,
      hospital_name: p.hospital_name,
      customer_email: p.customer_email,
      customer_phone: p.customer_phone,
      customer_address: p.customer_address,
      customer_country: p.customer_country,
      customer_city: p.customer_city,
      customer_state: p.customer_state,
      customer_pincode: p.customer_pincode,
      amount,
      subtotal: pricing.subtotal,
      order_gst: pricing.gst,
      coupon_code: p.coupon_code || null,
      coupon_id: couponId,
      coupon_discount: discount,
      shipping_charge: charges.shipping_charge,
      additional_charge: charges.cod_fee,
      comment: p.comment,
      payment_mode: paymentMode,
      payment_option: paymentMode,
      payment_status: PAYMENT_STATUS.UNPAID,
      prescription_notes: p.prescription_notes,
      customer_shipping_name: p.shipping_same_as_billing ? p.customer_name : p.customer_shipping_name,
      customer_shipping_phone: p.shipping_same_as_billing ? p.customer_phone : p.customer_shipping_phone,
      customer_shipping_address: p.shipping_same_as_billing ? p.customer_address : p.customer_shipping_address,
      customer_shipping_city: p.shipping_same_as_billing ? p.customer_city : p.customer_shipping_city,
      customer_shipping_state: p.shipping_same_as_billing ? p.customer_state : p.customer_shipping_state,
      customer_shipping_pincode: p.shipping_same_as_billing ? p.customer_pincode : p.customer_shipping_pincode,
      customer_shipping_country: p.shipping_same_as_billing ? p.customer_country : p.customer_shipping_country,
      status: paymentMode === PAYMENT_MODE.COD ? ORDER_STATUS.NEW : ORDER_STATUS.PENDING,
      orderFrom: p.platform,
    });

    // 6. items
    await orderModel.addItems(conn, orderId, pricing.items);

    // 7. consume the coupon use (with the order id, so it can be restored on cancel)
    if (couponId) {
      const consumed = await couponModel.consumeUse(conn, couponId, p.customerId, orderId, discount);
      if (!consumed) throw Object.assign(new Error('This coupon just ran out'), { status: 409 });
    }

    // 8. total_sold counter
    for (const item of pricing.items) {
      await productModel.incrementSold(item.product_id, item.unit_quantity, conn);
    }

    // 9. status log + invoice
    await orderModel.logStatus(
      conn, orderId, null,
      paymentMode === PAYMENT_MODE.COD ? ORDER_STATUS.NEW : ORDER_STATUS.PENDING,
      p.isPos ? `admin:${p.created_by || 'pos'}` : 'system',
      `Order placed — ${p.isPos ? 'POS' : p.platform} | ${paymentMode}`
    );
    await conn.query(`UPDATE orders SET invoice_number = ? WHERE order_id = ?`,
      [genInvoiceNumber(orderId), orderId]);

    return { orderId, amount, pricing, discount, charges };
  });

  // ---- outside the transaction: create the payment session (external API, must not hold a DB lock) ----
  let payment = null;
  if (p.isPos) {
    // POS order — money is collected at the counter, so no gateway session is created
    await db.query(`UPDATE orders SET payment_gateway = ? WHERE order_id = ?`,
      [p.payment_gateway || 'offline', result.orderId]);
    if (p.mark_paid) {
      await orderModel.updatePayment(result.orderId, {
        payment_status: PAYMENT_STATUS.PAID,
        transaction_number: p.transaction_number || `POS-${databaseOrderID}`,
      });
    }
  } else if (paymentMode === PAYMENT_MODE.ONLINE) {
    let gateway = paymentService.resolve(p.payment_gateway);

    // A gateway the admin has disabled is never allowed — whatever the client
    // sends, Settings is the single source of truth.
    const { list } = await paymentService.availableGatewaysLive();
    if (list.length && !list.some((g) => g.id === gateway)) {
      gateway = list[0].id;
    }
    if (!list.length) {
      throw Object.assign(new Error('Online payment is not available right now'), { status: 409 });
    }

    try {
      const session = await paymentService.createPaymentSession(gateway, {
        order_id: result.orderId,
        customer_id: p.customerId,
        databaseOrderID,
        amount: result.amount,
        customer_name: p.customer_name,
        customer_phone: p.customer_phone,
        customer_email: p.customer_email,
      }, { customer_name: p.customer_name, email_id: p.customer_email });

      await db.query(
        `UPDATE orders SET payment_gateway = ?, gateway_order_id = ?,
           razorpayOrderID = IF(? = 'razorpay', ?, razorpayOrderID)
         WHERE order_id = ?`,
        [session.gateway, session.gateway_order_id, session.gateway,
          session.gateway_order_id, result.orderId]
      );
      payment = session;
    } catch (err) {
      // gateway failure — the order stays Pending/Unpaid and the customer can retry
      console.error('[order] payment session fail:', err.message);
      await orderModel.updateStatus(result.orderId, ORDER_STATUS.PENDING, 'system',
        `Payment session fail: ${err.message}`);
      notify.paymentFailedAlert({
        order: {
          order_id: result.orderId,
          databaseOrderID,
          amount: result.amount,
          customer_name: p.customer_name,
          customer_phone: p.customer_phone,
        },
        context: 'payment session create',
        error: err.message,
      });
      throw Object.assign(new Error('Could not connect to the payment gateway, please try again'), { status: 502 });
    }
  } else {
    await db.query(`UPDATE orders SET payment_gateway = 'cod' WHERE order_id = ?`, [result.orderId]);
  }

  // Online payment: keep the cart intact until the payment actually succeeds
  // (markOrderPaid clears it). Otherwise a failed/cancelled/abandoned payment
  // would leave the customer with an empty cart even though nothing was paid.
  if (!p.isPos && paymentMode !== PAYMENT_MODE.ONLINE) await cartModel.clear(p.customerId);
  await cache.invalidate.orders();
  await cache.invalidate.products();

  // tell the admin panel live — a new order has arrived
  events.emit('order.created', {
    order_id: result.orderId,
    reference: databaseOrderID,
    amount: result.amount,
    customer_name: p.customer_name,
    source: p.platform,
    payment_mode: paymentMode,
    item_count: result.pricing.items.length,
  }, 'orders.view');

  // stock alert — which product ran out or got low because of this order
  for (const item of result.pricing.items) {
    const left = await productModel.getPricingInfo(item.product_id);
    if (left && left.stock_quantity <= 0) {
      events.emit('stock.out', {
        product_id: item.product_id, product_name: left.product_name,
      }, 'inventory.view');
    }
  }

  const order = await orderModel.findById(result.orderId);

  // A COD order is confirmed immediately. Online confirmation is sent after payment.
  if (paymentMode === PAYMENT_MODE.COD) {
    notify.orderPlaced(order, order.items);
  }

  return {
    order,
    payment,
    // for older clients — the response used to contain a `razorpay` key
    razorpay: payment?.razorpay || null,
  };
}

/** Called once payment is confirmed — from both the verify-payment endpoint and the webhook */
async function markOrderPaid(orderId, paymentId, changedBy = 'system') {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.payment_status === PAYMENT_STATUS.PAID) return order; // already paid, do not repeat

  await orderModel.updatePayment(orderId, {
    payment_status: PAYMENT_STATUS.PAID,
    transaction_number: paymentId,
  });

  // Online payment just succeeded — this is the moment the cart should empty.
  if (order.customer_id) await cartModel.clear(order.customer_id);

  if (order.status === ORDER_STATUS.PENDING) {
    await orderModel.updateStatus(orderId, ORDER_STATUS.NEW, changedBy, 'Payment confirmed');
  }

  await cache.invalidate.orders();
  events.emit('order.paid', {
    order_id: orderId, reference: order.databaseOrderID, amount: order.amount,
  }, 'orders.view');

  const full = await orderModel.findById(orderId);
  notify.orderPlaced(full, full.items);
  notify.paymentSuccess(full, full.items);

  return full;
}

async function markOrderPaymentFailed(orderId, paymentId) {
  await orderModel.updatePayment(orderId, {
    payment_status: PAYMENT_STATUS.FAILED,
    transaction_number: paymentId,
  });
  await cache.invalidate.orders();
}

/**
 * Cancel — used by both the customer and the admin.
 * Restore stock, restore the coupon use, and refund via Razorpay if it was paid.
 */
async function cancelOrder(orderId, { changedBy, reason, refundPayment = true }) {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw Object.assign(
      new Error(`An order with status '${order.status}' cannot be cancelled`),
      { status: 409 }
    );
  }

  await db.withTransaction(async (conn) => {
    // 1. restore stock
    for (const item of order.items) {
      await inventoryModel.incrementStock(conn, {
        productId: item.product_id,
        quantity: item.unit_quantity,
        changeType: INVENTORY_CHANGE_TYPE.RETURN,
        referenceType: 'order',
        referenceId: orderId,
        changedBy,
        note: `Order ${order.databaseOrderID} cancelled`,
      });
      await conn.query(
        `UPDATE products SET total_sold = GREATEST(total_sold - ?, 0) WHERE product_id = ?`,
        [item.unit_quantity, item.product_id]
      );
    }

    // 2. restore the coupon use
    if (order.coupon_id) {
      await couponModel.refundUse(order.coupon_id, orderId, conn);
    }

    // 3. status
    await conn.query(
      `UPDATE orders SET status = ?, cancellation_note = ? WHERE order_id = ?`,
      [ORDER_STATUS.CANCELLED, reason || null, orderId]
    );
    await orderModel.logStatus(conn, orderId, order.status, ORDER_STATUS.CANCELLED, changedBy, reason);
  });

  // 4. refund (outside the transaction — external API)
  let refundInfo = null;
  if (refundPayment && order.payment_status === PAYMENT_STATUS.PAID && order.transaction_number) {
    try {
      const r = await paymentService.refund(order.payment_gateway, {
        paymentId: order.transaction_number,
        amount: order.amount,
        txnid: order.gateway_order_id || order.databaseOrderID,
      });
      await orderModel.updatePayment(orderId, {
        payment_status: PAYMENT_STATUS.REFUNDED,
        refund_amount: order.amount,
        refund_reference: r.id,
      });
      refundInfo = { refund_id: r.id, amount: order.amount, status: 'initiated' };
      await orderModel.updateStatus(orderId, ORDER_STATUS.CANCELLED, 'system', `Refund started — ${r.id}`)
        .catch(() => {}); // status is already Cancelled, this is only for logging
    } catch (err) {
      console.error('[order] refund fail', orderId, err.message);
      refundInfo = { failed: true, error: err.message };
      // the cancel is still valid — just flag it for manual review
      await db.query(
        `INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, note) VALUES (?,?,?,?,?)`,
        [orderId, ORDER_STATUS.CANCELLED, ORDER_STATUS.CANCELLED, 'system',
          `REFUND FAILED — manual review required: ${err.message}`]
      );
    }
  }

  await cache.invalidate.orders();
  await cache.invalidate.products();

  events.emit('order.status', {
    order_id: orderId, reference: order.databaseOrderID,
    status: ORDER_STATUS.CANCELLED, changed_by: changedBy,
  }, 'orders.view');

  notify.orderCancelled(order, reason);

  return { order: await orderModel.findById(orderId), refund: refundInfo };
}

/**
 * Hard-delete — admin only, and only while the order is still "Pending"
 * (never touched, never paid). Stock is restored first, same as a cancel,
 * then the order row itself is removed instead of being kept as Cancelled.
 */
async function deletePendingOrder(orderId, { changedBy } = {}) {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (order.status !== ORDER_STATUS.PENDING) {
    throw Object.assign(
      new Error(`Only a 'Pending' order can be deleted — this one is '${order.status}'. Cancel it instead.`),
      { status: 409 }
    );
  }

  await db.withTransaction(async (conn) => {
    for (const item of order.items) {
      await inventoryModel.incrementStock(conn, {
        productId: item.product_id,
        quantity: item.unit_quantity,
        changeType: INVENTORY_CHANGE_TYPE.RETURN,
        referenceType: 'order',
        referenceId: orderId,
        changedBy,
        note: `Order ${order.databaseOrderID} deleted (was pending)`,
      });
    }
    if (order.coupon_id) {
      await couponModel.refundUse(order.coupon_id, orderId, conn);
    }
    await orderModel.remove(conn, orderId);
  });

  await cache.invalidate.orders();
  await cache.invalidate.products();

  return { deleted: true };
}

/** Move an order's status forward (admin) — with flow validation */
async function changeStatus(orderId, newStatus, { changedBy, note }) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (newStatus === ORDER_STATUS.CANCELLED) {
    return cancelOrder(orderId, { changedBy, reason: note });
  }

  await orderModel.updateStatus(orderId, newStatus, changedBy, note);

  // COD order delivered -> mark it paid
  if (newStatus === ORDER_STATUS.COMPLETED
      && order.payment_mode === PAYMENT_MODE.COD
      && order.payment_status === PAYMENT_STATUS.UNPAID) {
    await orderModel.updatePayment(orderId, { payment_status: PAYMENT_STATUS.PAID });
  }

  // The shipping service sends the Shipped message (with the AWB), not this one
  if (newStatus !== ORDER_STATUS.SHIPPED) {
    notify.orderStatusChanged(order, newStatus);
  }

  await cache.invalidate.orders();
  events.emit('order.status', {
    order_id: orderId, reference: order.databaseOrderID,
    status: newStatus, changed_by: changedBy,
  }, 'orders.view');
  return { order: await orderModel.findById(orderId) };
}

module.exports = {
  quote, placeOrder, markOrderPaid, markOrderPaymentFailed,
  cancelOrder, deletePendingOrder, changeStatus, priceItems,
};