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
const {
  ORDER_STATUS, PAYMENT_STATUS, PAYMENT_MODE, CANCELLABLE_STATUSES, INVENTORY_CHANGE_TYPE,
} = require('../config/constants');

/**
 * Checkout ka poora logic. Web aur app dono yahi service use karte hain —
 * sirf `platform` ka farak hai, jo orders.orderFrom me chala jaata hai.
 *
 * Ek transaction ke andar sab kuch hota hai:
 *   stock lock+decrement -> coupon consume -> order insert -> items insert
 * Kahin bhi fail hua to poora rollback — aadha order kabhi nahi banta.
 */

/** Items ki server-side pricing — client ki bheji price kabhi trust nahi karte */
async function priceItems(conn, items) {
  let subtotal = 0;
  let totalGst = 0;
  let requiresPrescription = false;
  let codAllowed = true;
  const priced = [];

  for (const it of items) {
    const quantity = parseInt(it.unit_quantity || it.quantity, 10);
    if (!quantity || quantity < 1) {
      throw Object.assign(new Error('Har item ki quantity kam se kam 1 honi chahiye'), { status: 422 });
    }

    const product = await productModel.getPricingInfo(it.product_id, conn);
    if (!product) throw Object.assign(new Error(`Product ${it.product_id} nahi mila`), { status: 404 });
    if (product.status !== 'Active') {
      throw Object.assign(new Error(`"${product.product_name}" abhi available nahi hai`), { status: 409 });
    }

    if (product.presciption_required === 'Yes') requiresPrescription = true;
    if (!product.isCOD) codAllowed = false;

    const unitPrice = product.product_sp;
    const lineSubtotal = money(unitPrice * quantity);
    const taxPercent = product.product_gst || 0;
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
 * Checkout ka preview — order banaye bina totals dikhane ke liye.
 * Cart page pe "apply coupon" karte waqt yahi call hota hai.
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
 * Asli order place karo.
 * @param {object} p  { customerId, platform, items, address fields, coupon_code, payment_mode, ... }
 */
async function placeOrder(p) {
  const paymentMode = p.payment_mode === PAYMENT_MODE.COD ? PAYMENT_MODE.COD : PAYMENT_MODE.ONLINE;

  // COD globally band ho to pehle hi rok do
  if (paymentMode === PAYMENT_MODE.COD && !(await settingsModel.isCodEnabled())) {
    throw Object.assign(new Error('COD abhi available nahi hai'), { status: 409 });
  }

  const databaseOrderID = genRef('OHM');

  const result = await db.withTransaction(async (conn) => {
    // 1. pricing (products FOR UPDATE lock stock step me lagta hai)
    const pricing = await priceItems(conn, p.items);

    if (paymentMode === PAYMENT_MODE.COD && !pricing.codAllowed) {
      throw Object.assign(new Error('Cart me kuch items COD pe available nahi hain'), { status: 409 });
    }
    // if (pricing.requiresPrescription && !p.prescription_id) {
    //   throw Object.assign(new Error('In medicines ke liye prescription upload karna zaroori hai'), { status: 422 });
    // }

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

    // 3. charges + final total
    const charges = await settingsModel.calcCharges(pricing.subtotal, paymentMode);
    const amount = money(
      pricing.subtotal + pricing.gst - discount + charges.shipping_charge + charges.cod_fee
    );

    // 4. stock lock + decrement (yahi jagah hai jahan out-of-stock pakda jaata hai)
    for (const item of pricing.items) {
      await inventoryModel.decrementStock(conn, {
        productId: item.product_id,
        quantity: item.unit_quantity,
        referenceType: 'order',
        referenceId: null, // order abhi bana nahi, neeche log me note se link ho jaata hai
        changedBy: `customer:${p.customerId}`,
        note: `Order ${databaseOrderID}`,
      });
    }

    // 5. order row
    const orderId = await orderModel.create(conn, {
      databaseOrderID,
      razorpayOrderID: null, // neeche set hoga
      order_date: new Date(),
      prescription_id: p.prescription_id || null,
      customer_id: p.customerId,
      customer_name: p.customer_name,
      patient_name: p.customer_name,
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

    // 7. coupon use consume (order id ke saath, taaki cancel pe wapas kar sakein)
    if (couponId) {
      const consumed = await couponModel.consumeUse(conn, couponId, p.customerId, orderId, discount);
      if (!consumed) throw Object.assign(new Error('Ye coupon abhi-abhi khatam ho gaya'), { status: 409 });
    }

    // 8. total_sold counter
    for (const item of pricing.items) {
      await productModel.incrementSold(item.product_id, item.unit_quantity, conn);
    }

    // 9. status log + invoice
    await orderModel.logStatus(
      conn, orderId, null,
      paymentMode === PAYMENT_MODE.COD ? ORDER_STATUS.NEW : ORDER_STATUS.PENDING,
      'system', `Order place hua — ${p.platform} | ${paymentMode}`
    );
    await conn.query(`UPDATE orders SET invoice_number = ? WHERE order_id = ?`,
      [genInvoiceNumber(orderId), orderId]);

    return { orderId, amount, pricing, discount, charges };
  });

  // ---- transaction ke bahar: payment session banao (external API, DB lock nahi rokna) ----
  let payment = null;
  if (paymentMode === PAYMENT_MODE.ONLINE) {
    const gateway = paymentService.resolve(p.payment_gateway);
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
      // gateway fail — order Pending/Unpaid pada rahega, customer retry kar sakta hai
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
      throw Object.assign(new Error('Payment gateway se connect nahi ho paaya, dobara try karo'), { status: 502 });
    }
  } else {
    await db.query(`UPDATE orders SET payment_gateway = 'cod' WHERE order_id = ?`, [result.orderId]);
  }

  await cartModel.clear(p.customerId);
  await cache.invalidate.orders();
  await cache.invalidate.products();

  // admin panel ko live batao — naya order aaya
  events.emit('order.created', {
    order_id: result.orderId,
    reference: databaseOrderID,
    amount: result.amount,
    customer_name: p.customer_name,
    source: p.platform,
    payment_mode: paymentMode,
    item_count: result.pricing.items.length,
  }, 'orders.view');

  // stock alert — kaunsa product khatam ya kam ho gaya is order se
  for (const item of result.pricing.items) {
    const left = await productModel.getPricingInfo(item.product_id);
    if (left && left.stock_quantity <= 0) {
      events.emit('stock.out', {
        product_id: item.product_id, product_name: left.product_name,
      }, 'inventory.view');
    }
  }

  const order = await orderModel.findById(result.orderId);

  // COD order turant confirm hai. Online ka confirmation payment ke baad jaata hai.
  if (paymentMode === PAYMENT_MODE.COD) {
    notify.orderPlaced(order, order.items);
  }

  return {
    order,
    payment,
    // purane clients ke liye — pehle response me `razorpay` key aati thi
    razorpay: payment?.razorpay || null,
  };
}

/** Payment confirm hone pe — verify-payment endpoint aur webhook dono se */
async function markOrderPaid(orderId, paymentId, changedBy = 'system') {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order nahi mila'), { status: 404 });
  if (order.payment_status === PAYMENT_STATUS.PAID) return order; // pehle se paid, dobara mat karo

  await orderModel.updatePayment(orderId, {
    payment_status: PAYMENT_STATUS.PAID,
    transaction_number: paymentId,
  });

  if (order.status === ORDER_STATUS.PENDING) {
    await orderModel.updateStatus(orderId, ORDER_STATUS.NEW, changedBy, 'Payment confirm hua');
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
 * Cancel — customer aur admin dono yahi use karte hain.
 * Stock wapas, coupon use wapas, aur paid tha to Razorpay refund.
 */
async function cancelOrder(orderId, { changedBy, reason, refundPayment = true }) {
  const order = await orderModel.findById(orderId);
  if (!order) throw Object.assign(new Error('Order nahi mila'), { status: 404 });

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw Object.assign(
      new Error(`'${order.status}' status ka order cancel nahi ho sakta`),
      { status: 409 }
    );
  }

  await db.withTransaction(async (conn) => {
    // 1. stock wapas
    for (const item of order.items) {
      await inventoryModel.incrementStock(conn, {
        productId: item.product_id,
        quantity: item.unit_quantity,
        changeType: INVENTORY_CHANGE_TYPE.RETURN,
        referenceType: 'order',
        referenceId: orderId,
        changedBy,
        note: `Order ${order.databaseOrderID} cancel hua`,
      });
      await conn.query(
        `UPDATE products SET total_sold = GREATEST(total_sold - ?, 0) WHERE product_id = ?`,
        [item.unit_quantity, item.product_id]
      );
    }

    // 2. coupon use wapas
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

  // 4. refund (transaction ke bahar — external API)
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
      await orderModel.updateStatus(orderId, ORDER_STATUS.CANCELLED, 'system', `Refund shuru — ${r.id}`)
        .catch(() => {}); // status already Cancelled hai, sirf log ke liye
    } catch (err) {
      console.error('[order] refund fail', orderId, err.message);
      refundInfo = { failed: true, error: err.message };
      // cancel phir bhi valid hai — bas manual review ke liye flag kar do
      await db.query(
        `INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, note) VALUES (?,?,?,?,?)`,
        [orderId, ORDER_STATUS.CANCELLED, ORDER_STATUS.CANCELLED, 'system',
          `REFUND FAIL — manual review chahiye: ${err.message}`]
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

/** Order ka status aage badhao (admin) — flow validation ke saath */
async function changeStatus(orderId, newStatus, { changedBy, note }) {
  const order = await orderModel.findById(orderId, { withItems: false, withHistory: false });
  if (!order) throw Object.assign(new Error('Order nahi mila'), { status: 404 });

  if (newStatus === ORDER_STATUS.CANCELLED) {
    return cancelOrder(orderId, { changedBy, reason: note });
  }

  await orderModel.updateStatus(orderId, newStatus, changedBy, note);

  // COD order deliver hua -> paid mark karo
  if (newStatus === ORDER_STATUS.COMPLETED
      && order.payment_mode === PAYMENT_MODE.COD
      && order.payment_status === PAYMENT_STATUS.UNPAID) {
    await orderModel.updatePayment(orderId, { payment_status: PAYMENT_STATUS.PAID });
  }

  // Shipped ka message shipping service bhejti hai (AWB ke saath), yahan nahi
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
  cancelOrder, changeStatus, priceItems,
};
