const crypto = require('crypto');
const axios = require('axios');

/**
 * PayU Money / PayU Biz integration.
 *
 * Razorpay se alag kaam karta hai: PayU me SDK call nahi hoti, hum ek
 * signed form banate hain aur browser usko PayU pe POST karta hai. Wapas
 * aane pe PayU humare surl/furl pe POST karta hai, jahan hum reverse hash
 * verify karte hain.
 *
 * .env:
 *   PAYU_MODE=test | live
 *   PAYU_MERCHANT_KEY=
 *   PAYU_MERCHANT_SALT=
 *   PAYU_SUCCESS_URL=https://api.oncohealthmart.com/api/app/payments/payu/success
 *   PAYU_FAILURE_URL=https://api.oncohealthmart.com/api/app/payments/payu/failure
 */

const ENDPOINTS = {
  live: 'https://secure.payu.in/_payment',
  test: 'https://test.payu.in/_payment',
};

const VERIFY_API = {
  live: 'https://info.payu.in/merchant/postservice.php?form=2',
  test: 'https://test.payu.in/merchant/postservice.php?form=2',
};

function config() {
  const mode = process.env.PAYU_MODE === 'live' ? 'live' : 'test';
  return {
    mode,
    key: process.env.PAYU_MERCHANT_KEY,
    salt: process.env.PAYU_MERCHANT_SALT,
    endpoint: ENDPOINTS[mode],
    verifyApi: VERIFY_API[mode],
    successUrl: process.env.PAYU_SUCCESS_URL,
    failureUrl: process.env.PAYU_FAILURE_URL,
  };
}

function isConfigured() {
  const c = config();
  return !!(c.key && c.salt);
}

const sha512 = (s) => crypto.createHash('sha512').update(s).digest('hex');

/**
 * Request hash — PayU ko bhejne se pehle.
 * Sequence PayU ne fix kiya hua hai, ek pipe bhi idhar-udhar hua to
 * "hash mismatch" aata hai:
 *   key|txnid|amount|productinfo|firstname|email|udf1|...|udf5||||||salt
 */
function requestHash({ key, txnid, amount, productinfo, firstname, email, udf = [], salt }) {
  const u = Array.from({ length: 5 }, (_, i) => udf[i] || '');
  const seq = [key, txnid, amount, productinfo, firstname, email, ...u, '', '', '', '', '', salt];
  return sha512(seq.join('|'));
}

/**
 * Response hash — PayU se wapas aane pe. Sequence ULTA hota hai,
 * aur `status` salt ke turant baad aata hai.
 */
function responseHash({ salt, status, udf = [], email, firstname, productinfo, amount, txnid, key, additionalCharges }) {
  const u = Array.from({ length: 5 }, (_, i) => udf[i] || '');
  const seq = [salt, status, '', '', '', '', '', ...u.slice().reverse(),
    email, firstname, productinfo, amount, txnid, key];
  const base = seq.join('|');
  // additionalCharges aaya ho to wo sabse aage lagta hai
  return sha512(additionalCharges ? `${additionalCharges}|${base}` : base);
}

/**
 * Checkout ke liye form data banao. Frontend isko PayU ke endpoint pe
 * POST karega (hidden form + auto submit).
 */
function buildPaymentRequest(order, customer) {
  const c = config();
  if (!isConfigured()) {
    throw Object.assign(new Error('PayU credentials .env me set nahi hain'), { status: 500 });
  }

  const txnid = order.databaseOrderID || `OHM${order.order_id}`;
  const amount = Number(order.amount).toFixed(2);
  const productinfo = `Order ${txnid}`;
  const firstname = String(order.customer_name || customer?.customer_name || 'Customer').split(' ')[0];
  const email = order.customer_email || customer?.email_id || 'noreply@oncohealthmart.com';
  const phone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);

  const udf = [String(order.order_id), String(order.customer_id || ''), '', '', ''];

  const hash = requestHash({
    key: c.key, txnid, amount, productinfo, firstname, email, udf, salt: c.salt,
  });

  return {
    endpoint: c.endpoint,
    mode: c.mode,
    params: {
      key: c.key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl: c.successUrl,
      furl: c.failureUrl,
      udf1: udf[0],
      udf2: udf[1],
      udf3: udf[2],
      udf4: udf[3],
      udf5: udf[4],
      hash,
    },
  };
}

/**
 * PayU ke callback ko verify karo.
 * Sirf `status === 'success'` dekhna kaafi nahi — hash verify karna zaroori
 * hai, warna koi bhi humare surl pe fake POST karke order paid mark kar sakta hai.
 */
function verifyCallback(body) {
  const c = config();

  const expected = responseHash({
    salt: c.salt,
    status: body.status,
    udf: [body.udf1, body.udf2, body.udf3, body.udf4, body.udf5],
    email: body.email,
    firstname: body.firstname,
    productinfo: body.productinfo,
    amount: body.amount,
    txnid: body.txnid,
    key: body.key,
    additionalCharges: body.additionalCharges,
  });

  const received = String(body.hash || '').toLowerCase();
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    valid = false;
  }

  return {
    valid,
    success: valid && body.status === 'success',
    txnid: body.txnid,
    orderId: body.udf1 ? parseInt(body.udf1, 10) : null,
    paymentId: body.mihpayid,
    amount: body.amount,
    mode: body.mode,
    status: body.status,
    error: body.error_Message || body.field9 || null,
  };
}

/**
 * Server-to-server verify. Callback miss ho jaye (customer ne tab band kar
 * diya) to isse actual status pata chalta hai.
 */
async function verifyPayment(txnid) {
  const c = config();
  const command = 'verify_payment';
  const hash = sha512(`${c.key}|${command}|${txnid}|${c.salt}`);

  const { data } = await axios.post(c.verifyApi, new URLSearchParams({
    key: c.key,
    command,
    var1: txnid,
    hash,
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
  });

  const txn = data?.transaction_details?.[txnid];
  return {
    found: !!txn,
    status: txn?.status,
    paymentId: txn?.mihpayid,
    amount: txn?.amt,
    mode: txn?.mode,
    raw: data,
  };
}

/** Refund */
async function refund(paymentId, amount, txnid) {
  const c = config();
  const command = 'cancel_refund_transaction';
  const hash = sha512(`${c.key}|${command}|${paymentId}|${c.salt}`);

  const { data } = await axios.post(c.verifyApi, new URLSearchParams({
    key: c.key,
    command,
    var1: paymentId,
    var2: txnid || `REF${Date.now()}`,
    var3: Number(amount).toFixed(2),
    hash,
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000,
  });

  if (data?.status !== 1) {
    throw Object.assign(
      new Error(`PayU refund fail: ${data?.msg || 'unknown error'}`),
      { status: 502 }
    );
  }
  return { id: data?.request_id, raw: data };
}

module.exports = {
  buildPaymentRequest, verifyCallback, verifyPayment, refund,
  requestHash, responseHash, isConfigured, config,
};
