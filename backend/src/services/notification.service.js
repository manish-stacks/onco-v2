const wa = require('./whatsapp.service');
const sms = require('./sms.service');
const push = require('./firebase.service');
const events = require('./events.service');
const { inrPlain, formatItems } = require('../utils/notify-format');
const { orderRef } = require('../utils/helpers');

/**
 * Ek jagah se saare channels.
 *
 * order.service should not have to think about whether to send WhatsApp, SMS or push —
 * just call `notify.orderPlaced(order)`. From here WhatsApp + SMS go to the customer,
 * push to the app, and SSE to the admin panel — all dispatched together.
 *
 * Every function is fire-and-forget: a failed notification must never stop the order flow.
 */

/**
 * SMS templates = the exact DLT-approved names the old OncoHealthMart site used
 * on 2Factor. VAR1 is the order number in every case (OTP is handled separately
 * in sms.service). Do NOT rename these without re-approving DLT templates.
 */
const SMS = {
  ORDER_PLACED: 'OrderPlacementNotification',
  ORDER_PROCESSING: 'OrderProcessing',
  ORDER_SHIPPED: 'OrderShipped',
  ORDER_DELIVERED: 'OrderDelivered',
  ORDER_CANCELLED: 'OrderCanceled',
  PRESCRIPTION_APPROVED: 'PrescriptionApproved',
};

function fireAndForget(promise, label) {
  Promise.resolve(promise).catch((err) => {
    console.error(`[notify] ${label} fail:`, err.message);
  });
}

/** map a status string to the matching old SMS template (or null) */
function smsTemplateForStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'processing': return SMS.ORDER_PROCESSING;
    case 'shipped': return SMS.ORDER_SHIPPED;
    case 'delivered': return SMS.ORDER_DELIVERED;
    case 'cancelled':
    case 'canceled': return SMS.ORDER_CANCELLED;
    default: return null;
  }
}

/** Order placed — confirmation for the customer */
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
    order_id: orderRef(order),
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

  // SMS — same template as the old site
  fireAndForget(
    sms.sendTransactional(order.customer_phone, SMS.ORDER_PLACED, [orderRef(order)]),
    'orderPlaced sms'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Order confirmed',
      body: `${orderRef(order)} — ₹${inrPlain(order.amount)}. We will dispatch it soon.`,
      channel: 'orders',
    }, { type: 'order', order_id: order.order_id, screen: 'order_detail' },
    { orderId: order.order_id }),
    'orderPlaced push'
  );

  // Admin app pe bhi — naya order aaya
  fireAndForget(
    push.sendToAdmins({
      title: `Naya order — ₹${inrPlain(order.amount)}`,
      body: `${order.customer_name} · ${orderRef(order)} (${order.orderFrom})`,
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
      order_number: orderRef(order),
      items: formatItems(items),
      total: inrPlain(order.amount),
      payment_method: 'Online',
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'paymentSuccess whatsapp'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Payment received',
      body: `₹${inrPlain(order.amount)} received — order ${orderRef(order)} is being processed.`,
    }, { type: 'payment', order_id: order.order_id }, { orderId: order.order_id }),
    'paymentSuccess push'
  );
}

/** Payment verification failed — this goes to the ADMIN, not the customer */
async function paymentFailedAlert({ order, paymentId, gatewayOrderId, context, error }) {
  fireAndForget(
    wa.alertAdmins(wa.TEMPLATES.PAYMENT_FAILED_ALERT, {
      payment_id: paymentId || 'N/A',
      gateway_order_id: gatewayOrderId || 'N/A',
      system_order_id: orderRef(order) || 'N/A',
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
      body: `${orderRef(order) || 'order'} — ${String(error || '').slice(0, 80)}`,
      channel: 'admin',
    }, { type: 'payment_failed', order_id: order?.order_id }),
    'paymentFailedAlert push'
  );

  events.emit('payment.failed', {
    order_id: order?.order_id,
    reference: orderRef(order),
    error: String(error || ''),
  }, 'orders.view');
}

/** Order status badla — customer ko batao */
async function orderStatusChanged(order, newStatus) {
  fireAndForget(
    wa.sendTemplate(order.customer_phone, wa.TEMPLATES.ORDER_STATUS_UPDATE, {
      customer_name: order.customer_name,
      order_id: orderRef(order),
      status: newStatus,
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'orderStatus whatsapp'
  );

  // SMS — only for the statuses the old site had a template for
  const tpl = smsTemplateForStatus(newStatus);
  if (tpl) {
    fireAndForget(
      sms.sendTransactional(order.customer_phone, tpl, [orderRef(order)]),
      `orderStatus sms (${newStatus})`
    );
  }

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: `Order ${newStatus.toLowerCase()}`,
      body: `${orderRef(order)} is now "${newStatus}".`,
    }, { type: 'order_status', order_id: order.order_id, status: newStatus },
    { orderId: order.order_id }),
    'orderStatus push'
  );
}

/** Shipped — with the AWB */
async function orderShipped(order, { courier, awb, trackingUrl }) {
  fireAndForget(
    wa.sendTemplate(order.customer_phone, wa.TEMPLATES.ORDER_SHIPPED, {
      customer_name: order.customer_shipping_name || order.customer_name,
      order_id: orderRef(order),
      courier: courier || 'DTDC',
      awb,
      tracking_url: trackingUrl,
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'orderShipped whatsapp'
  );

  fireAndForget(
    sms.sendTransactional(order.customer_phone, SMS.ORDER_SHIPPED, [orderRef(order)]),
    'orderShipped sms'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Order shipped',
      body: `${courier || 'DTDC'} · AWB ${awb}. Tap to track.`,
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
      order_id: orderRef(order),
      status: 'Cancelled',
    }, { customerId: order.customer_id, orderId: order.order_id }),
    'orderCancelled whatsapp'
  );

  fireAndForget(
    sms.sendTransactional(order.customer_phone, SMS.ORDER_CANCELLED, [orderRef(order)]),
    'orderCancelled sms'
  );

  fireAndForget(
    push.sendToCustomer(order.customer_id, {
      title: 'Order cancelled',
      body: reason
        ? `${orderRef(order)} — ${String(reason).slice(0, 80)}`
        : `${orderRef(order)} has been cancelled.`,
    }, { type: 'order_cancelled', order_id: order.order_id }, { orderId: order.order_id }),
    'orderCancelled push'
  );
}

/** Prescription review hua */
async function prescriptionReviewed(prescription, customer) {
  // SMS only on approval (old site sent "PrescriptionApproved")
  if (customer?.mobile && String(prescription.status).toLowerCase() === 'approved') {
    fireAndForget(
      sms.sendTransactional(
        customer.mobile,
        SMS.PRESCRIPTION_APPROVED,
        [prescription.databaseOrderID || prescription.reference_code || '']
      ),
      'prescriptionApproved sms'
    );
  }

  fireAndForget(
    push.sendToCustomer(prescription.customer_id, {
      title: `Prescription ${prescription.status.toLowerCase()}`,
      body: prescription.status === 'Rejected' && prescription.rejection_reason
        ? String(prescription.rejection_reason).slice(0, 100)
        : `${prescription.reference_code} has been reviewed.`,
    }, { type: 'prescription', prescription_id: prescription.prescription_id }),
    'prescriptionReviewed push'
  );
}

module.exports = {
  orderPlaced, paymentSuccess, paymentFailedAlert,
  orderStatusChanged, orderShipped, orderCancelled, prescriptionReviewed,
  SMS,
};
