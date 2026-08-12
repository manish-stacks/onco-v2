const wa = require('./whatsapp.service');
const push = require('./firebase.service');
const events = require('./events.service');
const { inrPlain, formatItems } = require('../utils/notify-format');

/**
 * Ek jagah se saare channels.
 *
 * order.service ko ye nahi sochna chahiye ki WhatsApp bhejna hai ya push —
 * bas `notify.orderPlaced(order)` bolna hai. Yahan se WhatsApp customer ko,
 * push app pe, aur SSE admin panel pe — sab ek saath nikal jaata hai.
 *
 * Har function fire-and-forget hai: notification fail hone se order flow
 * kabhi nahi rukna chahiye.
 */

function fireAndForget(promise, label) {
  Promise.resolve(promise).catch((err) => {
    console.error(`[notify] ${label} fail:`, err.message);
  });
}

/** Order place ho gaya — customer ko confirmation */
async function orderPlaced(order, items = []) {
  const isWeb = order.orderFrom !== 'app';
  const template = isWeb ? wa.TEMPLATES.WEB_ORDER_SUCCESS : wa.TEMPLATES.ORDER_SUCCESS;

  const shipAddress = [
    order.customer_shipping_address,
    order.customer_shipping_city,
    order.customer_shipping_state,
  ].filter(Boolean).join(' ');

  const values = {
    customer_name: order.customer_name,
    order_id: order.databaseOrderID,
    order_date: new Date(order.order_date || Date.now()).toLocaleDateString('en-IN'),
    order_status: order.status,
    ship_name: order.customer_shipping_name || order.customer_name,
    ship_address: shipAddress,
    pincode: order.customer_shipping_pincode || order.customer_pincode,
    mobile: order.customer_shipping_phone || order.customer_phone,
    items: formatItems(items),
    subtotal: inrPlain(order.subtotal),
    shipping: inrPlain(order.shipping_charge),
    cod_charges: inrPlain(order.additional_charge),
    discount: inrPlain(order.coupon_discount),
    total: inrPlain(order.amount),
    payment_method: String(order.payment_mode || '').toUpperCase() === 'COD'
      ? 'Cash on Delivery' : 'Online',
  };

  fireAndForget(
    wa.sendTemplate(order.customer_phone, template, values, {
      customerId: order.customer_id, orderId: order.order_id,
    }),
    'orderPlaced whatsapp'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Order confirm ho gaya',
      body: `${order.databaseOrderID} — ₹${inrPlain(order.amount)}. Hum jaldi dispatch karenge.`,
      channel: 'orders',
    }, { type: 'order', order_id: order.order_id, screen: 'order_detail' },
    { orderId: order.order_id }),
    'orderPlaced push'
  );

  // Admin app pe bhi — naya order aaya
  fireAndForget(
    push.sendToAdmins({
      title: `Naya order — ₹${inrPlain(order.amount)}`,
      body: `${order.customer_name} · ${order.databaseOrderID} (${order.orderFrom})`,
      channel: 'admin',
    }, { type: 'new_order', order_id: order.order_id }),
    'orderPlaced admin push'
  );
}

/** Payment confirm hua */
async function paymentSuccess(order, items = []) {
  fireAndForget(
    wa.sendTemplate(order.customer_phone, wa.TEMPLATES.PAYMENT_SUCCESS, {
      customer_name: order.customer_name,
      order_number: order.databaseOrderID,
      items: formatItems(items),
      total: inrPlain(order.amount),
      payment_method: 'Online',
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'paymentSuccess whatsapp'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Payment mil gaya',
      body: `₹${inrPlain(order.amount)} received — order ${order.databaseOrderID} process ho raha hai.`,
    }, { type: 'payment', order_id: order.order_id }, { orderId: order.order_id }),
    'paymentSuccess push'
  );
}

/** Payment verify fail — ye customer ko nahi, ADMIN ko jaata hai */
async function paymentFailedAlert({ order, paymentId, gatewayOrderId, context, error }) {
  fireAndForget(
    wa.alertAdmins(wa.TEMPLATES.PAYMENT_FAILED_ALERT, {
      payment_id: paymentId || 'N/A',
      gateway_order_id: gatewayOrderId || 'N/A',
      system_order_id: order?.databaseOrderID || order?.order_id || 'N/A',
      customer_name: order?.customer_name || 'N/A',
      customer_phone: order?.customer_phone || 'N/A',
      amount: inrPlain(order?.amount || 0),
      context: context || 'payment verification',
      error_message: String(error || 'unknown').slice(0, 200),
      time: new Date().toLocaleString('en-IN'),
    }, { orderId: order?.order_id }),
    'paymentFailedAlert whatsapp'
  );

  fireAndForget(
    push.sendToAdmins({
      title: 'Payment verification fail',
      body: `${order?.databaseOrderID || 'order'} — ${String(error || '').slice(0, 80)}`,
      channel: 'admin',
    }, { type: 'payment_failed', order_id: order?.order_id }),
    'paymentFailedAlert push'
  );

  events.emit('payment.failed', {
    order_id: order?.order_id,
    reference: order?.databaseOrderID,
    error: String(error || ''),
  }, 'orders.view');
}

/** Order status badla — customer ko batao */
async function orderStatusChanged(order, newStatus) {
  fireAndForget(
    wa.sendTemplate(order.customer_phone, wa.TEMPLATES.ORDER_STATUS_UPDATE, {
      customer_name: order.customer_name,
      order_id: order.databaseOrderID,
      status: newStatus,
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'orderStatus whatsapp'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: `Order ${newStatus.toLowerCase()}`,
      body: `${order.databaseOrderID} ab "${newStatus}" hai.`,
    }, { type: 'order_status', order_id: order.order_id, status: newStatus },
    { orderId: order.order_id }),
    'orderStatus push'
  );
}

/** Ship ho gaya — AWB ke saath */
async function orderShipped(order, { courier, awb, trackingUrl }) {
  fireAndForget(
    wa.sendTemplate(order.customer_phone, wa.TEMPLATES.ORDER_SHIPPED, {
      customer_name: order.customer_shipping_name || order.customer_name,
      order_id: order.databaseOrderID,
      courier: courier || 'DTDC',
      awb,
      tracking_url: trackingUrl,
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'orderShipped whatsapp'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Order ship ho gaya',
      body: `${courier || 'DTDC'} · AWB ${awb}. Track karne ke liye tap karo.`,
    }, {
      type: 'shipped', order_id: order.order_id, awb, tracking_url: trackingUrl,
    }, { orderId: order.order_id }),
    'orderShipped push'
  );
}

/** Order cancel hua */
async function orderCancelled(order, reason) {
  fireAndForget(
    wa.sendTemplate(order.customer_phone, wa.TEMPLATES.ORDER_STATUS_UPDATE, {
      customer_name: order.customer_name,
      order_id: order.databaseOrderID,
      status: 'Cancelled',
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'orderCancelled whatsapp'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Order cancel ho gaya',
      body: reason
        ? `${order.databaseOrderID} — ${String(reason).slice(0, 80)}`
        : `${order.databaseOrderID} cancel kar diya gaya hai.`,
    }, { type: 'order_cancelled', order_id: order.order_id }, { orderId: order.order_id }),
    'orderCancelled push'
  );
}

/** Prescription review hua */
async function prescriptionReviewed(prescription, customer) {
  if (!customer?.mobile) return;

  fireAndForget(
    push.sendToCustomer(prescription.customer_id, {
      title: `Prescription ${prescription.status.toLowerCase()}`,
      body: prescription.status === 'Rejected' && prescription.rejection_reason
        ? String(prescription.rejection_reason).slice(0, 100)
        : `${prescription.reference_code} review ho gaya.`,
    }, { type: 'prescription', prescription_id: prescription.prescription_id }),
    'prescriptionReviewed push'
  );
}

module.exports = {
  orderPlaced, paymentSuccess, paymentFailedAlert,
  orderStatusChanged, orderShipped, orderCancelled, prescriptionReviewed,
};
