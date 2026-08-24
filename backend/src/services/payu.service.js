const crypto = require('crypto');
const axios = require('axios');

/**
 * PayU Money / PayU Biz integration.
 *
 * Works differently from Razorpay: PayU has no SDK call, instead we
 * build a signed form and the browser POSTs it to PayU. On the way back
 * PayU POSTs to our surl/furl, where we compute the reverse hash
 * we verify.
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

// PayU's public sandbox merchant key. If this key is configured we must talk to
// the TEST endpoint no matter what PAYU_MODE says — posting a sandbox key to the
// live endpoint makes PayU reject the request and the checkout page never opens.
// const SANDBOX_KEYS = new Set(['tfHdP8', 'gtKFFx', 'JBZaLc']);

function config() {
  let mode = process.env.PAYU_MODE === 'live' ? 'live' : 'test';
  // if (mode === 'live' && SANDBOX_KEYS.has(process.env.PAYU_MERCHANT_KEY)) {
  //   console.warn('[payu] sandbox merchant key with PAYU_MODE=live — forcing the test endpoint');
  //   mode = 'test';
  // }
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
 * Request hash — before sending to PayU.
 * The sequence is fixed by PayU; one misplaced pipe and
 * a "hash mismatch" occurs:
 *   key|txnid|amount|productinfo|firstname|email|udf1|...|udf5||||||salt
 */
function requestHash({ key, txnid, amount, productinfo, firstname, email, udf = [], salt }) {
  const u = Array.from({ length: 5 }, (_, i) => udf[i] || '');
  const seq = [key, txnid, amount, productinfo, firstname, email, ...u, '', '', '', '', '', salt];
  return sha512(seq.join('|'));
}

/**
 * Response hash — when coming back from PayU. The sequence is REVERSED,
 * and `status` comes right after the salt.
 */
function responseHash({ salt, status, udf = [], email, firstname, productinfo, amount, txnid, key, additionalCharges }) {
  const u = Array.from({ length: 5 }, (_, i) => udf[i] || '');
  const seq = [salt, status, '', '', '', '', '', ...u.slice().reverse(),
    email, firstname, productinfo, amount, txnid, key];
  const base = seq.join('|');
  // If additionalCharges is present it goes first
  return sha512(additionalCharges ? `${additionalCharges}|${base}` : base);
}

/**
 * Build the form data for checkout. The frontend POSTs it to the PayU endpoint
 * will POST (hidden form + auto submit).
 */
function buildPaymentRequest(order, customer) {
  const c = config();
  if (!isConfigured()) {
    throw Object.assign(new Error('PayU credentials are not set in .env'), { status: 500 });
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
 * Verify the PayU callback.
 * Checking `status === 'success'` alone is not enough — hash verification is mandatory
 * otherwise anyone could fake a POST to our surl and mark an order paid.
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
 * Server-to-server verification. If the callback is missed (the customer closed the tab
 * they gave), this reveals the actual status.
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
