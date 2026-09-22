const wa = require('./whatsapp.service');
const sms = require('./sms.service');
const push = require('./firebase.service');
const mail = require('./mail.service');
const events = require('./events.service');
const settingsModel = require('../models/settings.model');
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
  // NOTE: new DLT template — must be registered/approved on the 2Factor/DLT
  // portal (see notes given to the client) before this will actually deliver.
  PRESCRIPTION_REJECTED: 'PrescriptionRejected',
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

  // Order confirmation email — customer + admin. Was missing entirely
  // (only WhatsApp/SMS/push were wired up for orderPlaced) — this is that.
  const itemRows = items.map((it) =>
    `<tr>
       <td style="padding:6px 8px;border-bottom:1px solid #eee;">${String(it.product_name || 'Item')}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${it.unit_quantity}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">₹${inrPlain(it.line_total)}</td>
     </tr>`
  ).join('');
  const itemsTable = `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;">Item</th>
        <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #ddd;">Qty</th>
        <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>`;

  if (order.customer_email) {
    fireAndForget(
      mail.send(
        order.customer_email,
        `Order Confirmed — ${orderRef(order)}`,
        `<p>Hi ${order.customer_name || 'Customer'},</p>
         <p>Thanks for your order! We've received <b>${orderRef(order)}</b> and it's being processed.</p>
         ${itemsTable}
         <p><b>Total: ₹${inrPlain(order.amount)}</b> (${values.payment_method})</p>
         <p>Shipping to: ${values.ship_name}, ${shipAddress}${values.pincode ? ' - ' + values.pincode : ''}</p>
         <p>We'll notify you as your order moves through processing, shipping and delivery.</p>`,
        { customerId: order.customer_id, orderId: order.order_id }
      ),
      'orderPlaced customer email'
    );
  }

  fireAndForget(
    (async () => {
      const settings = await settingsModel.get();
      const adminEmail = settings?.contact_email;
      if (!adminEmail) return { success: false, error: 'no admin contact_email configured in settings' };
      return mail.sendAdminAlert(
        adminEmail,
        `New Order — ${orderRef(order)} (₹${inrPlain(order.amount)})`,
        `<p>New order placed on the website.</p>
         <p><b>${orderRef(order)}</b> — ${order.customer_name} (${order.customer_phone || 'no phone'})</p>
         ${itemsTable}
         <p><b>Total: ₹${inrPlain(order.amount)}</b> (${values.payment_method}) — via ${order.orderFrom || 'web'}</p>
         <p>Shipping to: ${values.ship_name}, ${shipAddress}${values.pincode ? ' - ' + values.pincode : ''}</p>`,
        { orderId: order.order_id }
      );
    })(),
    'orderPlaced admin email'
  );
}

/** Payment confirm */
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

  if (order.customer_email) {
    fireAndForget(
      mail.send(
        order.customer_email,
        `Order ${orderRef(order)} — ${newStatus}`,
        `<p>Hi ${order.customer_name || 'Customer'},</p>
         <p>Your order <b>${orderRef(order)}</b> is now <b>${newStatus}</b>.</p>`,
        { customerId: order.customer_id, orderId: order.order_id }
      ),
      'orderStatus email'
    );
  }
}

/** Shipped — with the AWB */
async function orderShipped(order, { courier, awb, trackingUrl, notes }) {
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
      body: notes
        ? `${courier || 'DTDC'} · AWB ${awb}. ${notes}`
        : `${courier || 'DTDC'} · AWB ${awb}. Tap to track.`,
    }, {
      type: 'shipped', order_id: order.order_id, awb, tracking_url: trackingUrl,
    }, { orderId: order.order_id }),
    'orderShipped push'
  );

  if (order.customer_email) {
    fireAndForget(
      mail.send(
        order.customer_email,
        `Order Shipped — ${orderRef(order)}`,
        `<p>Hi ${order.customer_shipping_name || order.customer_name || 'Customer'},</p>
         <p>Your order <b>${orderRef(order)}</b> has been shipped via <b>${courier || 'DTDC'}</b>.</p>
         <p>AWB: <b>${awb}</b></p>
         ${trackingUrl ? `<p><a href="${trackingUrl}">Track your shipment</a></p>` : ''}
         ${notes ? `<p>${String(notes)}</p>` : ''}`,
        { customerId: order.customer_id, orderId: order.order_id }
      ),
      'orderShipped email'
    );
  }
}

/** Order cancel */
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

  if (order.customer_email) {
    fireAndForget(
      mail.send(
        order.customer_email,
        `Order Cancelled — ${orderRef(order)}`,
        `<p>Hi ${order.customer_name || 'Customer'},</p>
         <p>Your order <b>${orderRef(order)}</b> has been cancelled.</p>
         ${reason ? `<p>Reason: ${String(reason)}</p>` : ''}`,
        { customerId: order.customer_id, orderId: order.order_id }
      ),
      'orderCancelled email'
    );
  }
}

/** Prescription review notification */
async function prescriptionReviewed(prescription, customer) {
  const isApproved = String(prescription.status).toLowerCase() === 'approved';
  const refCode = prescription.reference_code || orderRef(prescription) || '';

  // SMS — approved uses the old site's template; rejected uses the new one
  // (both DLT templates, see the note given alongside this fix)
  if (customer?.mobile) {
    if (isApproved) {
      fireAndForget(
        sms.sendTransactional(customer.mobile, SMS.PRESCRIPTION_APPROVED, [refCode]),
        'prescriptionApproved sms'
      );
    } else {
      fireAndForget(
        sms.sendTransactional(customer.mobile, SMS.PRESCRIPTION_REJECTED,
          [refCode, prescription.rejection_reason || 'contact support']),
        'prescriptionRejected sms'
      );
    }
  }

  // WhatsApp — approve and reject each use their own template (WA templates
  // can't do conditional text, so one template per outcome keeps it clean)
  if (customer?.mobile) {
    if (isApproved) {
      fireAndForget(
        wa.sendTemplate(customer.mobile, wa.TEMPLATES.PRESCRIPTION_APPROVED, {
          customer_name: customer.customer_name || 'Customer',
          reference_code: refCode,
        }, { customerId: prescription.customer_id }),
        'prescriptionApproved whatsapp'
      );
    } else {
      fireAndForget(
        wa.sendTemplate(customer.mobile, wa.TEMPLATES.PRESCRIPTION_REJECTED, {
          customer_name: customer.customer_name || 'Customer',
          reference_code: refCode,
          reason: prescription.rejection_reason || 'Please contact support for details',
        }, { customerId: prescription.customer_id }),
        'prescriptionRejected whatsapp'
      );
    }
  }

  // Email — approve and reject both
  if (customer?.email_id) {
    const subject = isApproved
      ? `Prescription ${refCode} Approved`
      : `Prescription ${refCode} Rejected`;
    const html = isApproved
      ? `<p>Hi ${customer.customer_name || 'Customer'},</p>
         <p>Your prescription <b>${refCode}</b> has been <b>approved</b>. You can now proceed to order the prescribed medicines.</p>`
      : `<p>Hi ${customer.customer_name || 'Customer'},</p>
         <p>Your prescription <b>${refCode}</b> has been <b>rejected</b>.</p>
         ${prescription.rejection_reason ? `<p>Reason: ${String(prescription.rejection_reason)}</p>` : ''}
         <p>Please upload a valid prescription and try again.</p>`;
    fireAndForget(
      mail.send(customer.email_id, subject, html, { customerId: prescription.customer_id }),
      `prescriptionReviewed email (${prescription.status})`
    );
  }

  fireAndForget(
    push.sendToCustomer(prescription.customer_id, {
      title: `Prescription ${prescription.status.toLowerCase()}`,
      body: prescription.status === 'Rejected' && prescription.rejection_reason
        ? String(prescription.rejection_reason).slice(0, 100)
        : `${refCode} has been reviewed.`,
    }, { type: 'prescription', prescription_id: prescription.prescription_id }),
    'prescriptionReviewed push'
  );
}

module.exports = {
  orderPlaced, paymentSuccess, paymentFailedAlert,
  orderStatusChanged, orderShipped, orderCancelled, prescriptionReviewed,
  SMS,
};
