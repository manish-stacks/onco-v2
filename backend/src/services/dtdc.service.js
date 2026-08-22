const axios = require('axios');
const db = require('../config/db');

/**
 * DTDC integration — booking, label, tracking, cancel.
 *
 * .env:
 *   DTDC_MODE=live | test
 *   DTDC_API_KEY=
 *   DTDC_CUSTOMER_CODE=NL6143
 *   DTDC_TRACKING_TOKEN=NL6143_trk_json:...
 *   DTDC_ORIGIN_NAME / _PHONE / _ADDRESS / _PINCODE / _CITY / _STATE
 */

const ENDPOINTS = {
  live: {
    base: 'https://pxapi.dtdc.in/api/customer/integration/consignment/',
    label: 'https://pxapi.dtdc.in/api/customer/integration/consignment/shippinglabel/stream',
  },
  test: {
    base: 'https://alphademodashboardapi.shipsy.io/api/customer/integration/consignment/',
    label: 'https://alphademodashboardapi.shipsy.io/api/customer/integration/consignment/shippinglabel/stream',
  },
};

const TRACKING_URL = 'https://blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails';

const SERVICE_TYPES = {
  1: 'B2C PRIORITY',
  2: 'B2C PREMIUM',
  'B2C PRIORITY': 'B2C PRIORITY',
  'B2C PREMIUM': 'B2C PREMIUM',
};

/**
 * DTDC scan codes -> humare order status.
 * This mapping is used by both the webhook and manual tracking.
 */
const SCAN_TO_ORDER_STATUS = {
  DLV: 'Completed',
  NONDLV: 'Delivery Failed',
  RTO: 'Delivery Failed',
  CAN: 'Cancelled',
};

const SCAN_TO_SHIPMENT_STATUS = {
  DLV: 'Delivered',
  NONDLV: 'Failed',
  RTO: 'RTO',
  CAN: 'Cancelled',
  OFD: 'Out for Delivery',
};

function config() {
  const mode = process.env.DTDC_MODE === 'test' ? 'test' : 'live';
  return {
    mode,
    apiKey: process.env.DTDC_API_KEY,
    customerCode: process.env.DTDC_CUSTOMER_CODE,
    trackingToken: process.env.DTDC_TRACKING_TOKEN,
    ...ENDPOINTS[mode],
  };
}

function isConfigured() {
  const c = config();
  return !!(c.apiKey && c.customerCode);
}

function originDetails() {
  return {
    name: process.env.DTDC_ORIGIN_NAME || 'Onco Healthmart',
    phone: process.env.DTDC_ORIGIN_PHONE || '',
    address_line_1: process.env.DTDC_ORIGIN_ADDRESS || '',
    pincode: process.env.DTDC_ORIGIN_PINCODE || '',
    city: process.env.DTDC_ORIGIN_CITY || '',
    state: process.env.DTDC_ORIGIN_STATE || '',
  };
}

/** Fall back to the billing address when there is no shipping address */
function destinationFrom(order) {
  return {
    name: order.customer_shipping_name || order.customer_name,
    phone: order.customer_shipping_phone || order.customer_phone,
    address_line_1: order.customer_shipping_address || order.customer_address,
    pincode: order.customer_shipping_pincode || order.customer_pincode,
    city: order.customer_shipping_city || order.customer_city,
    state: order.customer_shipping_state || order.customer_state,
  };
}

/**
 * Book the consignment.
 * @param {object} order   the full order row
 * @param {object} opts    { serviceType, weight, dimensions, bookedBy }
 */
async function bookShipment(order, opts = {}) {
  const c = config();
  if (!isConfigured()) {
    throw Object.assign(new Error('DTDC credentials are not set in .env'), { status: 500 });
  }

  const serviceType = SERVICE_TYPES[opts.serviceType] || SERVICE_TYPES[2];
  const isCod = String(order.payment_mode).toLowerCase() === 'cod'
    && order.payment_status !== 'Paid';

  const dest = destinationFrom(order);
  console.log("DTDC booking", { orderId: order.order_id, serviceType, isCod, dest, opts });
  // when the pincode/phone is missing, DTDC's error is hard to interpret —
  // give a clear message up front
  const missing = ['name', 'phone', 'address_line_1', 'pincode', 'city']
    .filter((k) => !dest[k]);
  if (missing.length) {
    throw Object.assign(
      new Error(`The shipping address is incomplete: ${missing.join(', ')} missing`),
      { status: 422 }
    );
  }

  const consignment = {
    customer_code: c.customerCode,
    service_type_id: "GROUND EXPRESS",
    load_type: 'NON-DOCUMENT',
    description: opts.description || 'Pharmaceutical Medicines',
    dimension_unit: 'cm',
    length: String(opts.length || 10),
    width: String(opts.width || 15),
    height: String(opts.height || 15),
    weight_unit: 'kg',
    weight: String(opts.weight || 0.5),
    declared_value: order.amount,
    num_pieces: String(opts.numPieces || 1),
    cod_collection_mode: isCod ? 'CASH' : '',
    cod_amount: isCod ? order.amount : '',
    origin_details: originDetails(),
    destination_details: dest,
    customer_reference_number: order.databaseOrderID || String(order.order_id),
    invoice_number: order.invoice_number || `INV${order.order_id}`,
    invoice_date: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
  };

  const payload = { consignments: [consignment] };

  let response;
  try {
    const res = await axios.post(`${c.base}softdata`, payload, {
      headers: { 'Content-Type': 'application/json', 'api-key': c.apiKey },
      timeout: 30000,
    });
    response = res.data;
  } catch (err) {
    const msg = err.response?.data?.data?.[0]?.message
      || err.response?.data?.message
      || err.message;
    await saveShipment(order, consignment, err.response?.data, null, opts.bookedBy, 'Failed');
    throw Object.assign(new Error(`DTDC booking fail: ${msg}`), { status: 502 });
  }

  const first = response?.data?.[0];
  if (!first?.success) {
    const msg = first?.message || 'Booking fail hui';
    await saveShipment(order, consignment, response, null, opts.bookedBy, 'Failed');
    throw Object.assign(new Error(`DTDC: ${msg}`), { status: 502 });
  }

  const awb = first.reference_number;
  const shipmentId = await saveShipment(order, consignment, response, awb, opts.bookedBy, 'Booked');

  return { awb, shipmentId, courier: 'DTDC', serviceType, response };
}

async function saveShipment(order, payload, response, awb, bookedBy, status) {
  const [result] = await db.query(
    `INSERT INTO shipments
      (order_id, courier, awb_number, service_type, cod_amount, declared_value,
       weight, length, width, height, num_pieces, status, booked_by,
       request_payload, response_payload)
     VALUES (?, 'DTDC', ?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      order.order_id, awb, payload.service_type_id,
      payload.cod_amount || 0, payload.declared_value || 0,
      payload.weight, payload.length, payload.width, payload.height, payload.num_pieces,
      status, bookedBy || 'system',
      JSON.stringify(payload).slice(0, 60000),
      JSON.stringify(response || {}).slice(0, 60000),
    ]
  );
  return result.insertId;
}

/** Shipping label PDF — returns the raw buffer */
async function fetchLabel(referenceNumber) {
  const url = process.env.DTDC_MODE === 'test' ? ENDPOINTS.test.label : ENDPOINTS.live.label;

  try {
    const response = await axios.get(url, {
      params: {
        reference_number: referenceNumber,
        label_code: 'SHIP_LABEL_4X6',
        label_format: 'pdf',
      },

      headers: {
        'api-key': process.env.DTDC_API_KEY,
        Accept: 'application/pdf',
      },

      responseType: 'arraybuffer',
      timeout: 30000,

      validateStatus: () => true,
    });

    const contentType = String(
      response.headers?.['content-type'] || ''
    ).toLowerCase();

    console.log('========== DTDC LABEL RESPONSE ==========');
    console.log('URL:', url);
    console.log('Reference:', referenceNumber);
    console.log('Status:', response.status);
    console.log('Content-Type:', contentType);
    console.log(
      'Content-Disposition:',
      response.headers?.['content-disposition']
    );
    console.log('Size:', response.data?.length);
    console.log('=========================================');

    // Success
    if (
      response.status >= 200 &&
      response.status < 300 &&
      Buffer.isBuffer(response.data)
    ) {
      return Buffer.from(response.data);
    }

    // DTDC error response is arraybuffer, so decode it
    let errorBody = '';

    if (Buffer.isBuffer(response.data)) {
      errorBody = response.data.toString('utf8');
    } else {
      errorBody = String(response.data || '');
    }

    console.error('DTDC LABEL ERROR BODY:', errorBody);

    let parsedError = null;

    try {
      parsedError = JSON.parse(errorBody);
    } catch (parseError) {
      parsedError = null;
    }

    const message =
      parsedError?.error?.message ||
      parsedError?.message ||
      errorBody ||
      `DTDC label API failed with status ${response.status}`;

    const error = new Error(`DTDC Label Error: ${message}`);
    error.status = response.status >= 400 ? response.status : 502;
    error.dtdcResponse = parsedError || errorBody;

    throw error;
  } catch (error) {
    console.error('❌ DTDC fetchLabel failed:', error);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);

      if (Buffer.isBuffer(error.response.data)) {
        console.error(
          'Body:',
          error.response.data.toString('utf8')
        );
      }
    }

    throw error;
  }
}

/** Live tracking — pulls scans from DTDC and syncs them into the DB */
async function trackShipment(awb) {
  const c = config();

  const { data } = await axios.post(TRACKING_URL, {
    trkType: 'cnno',
    strcnno: awb,
    addtnlDtl: 'Y',
  }, {
    headers: { 'Content-Type': 'application/json', 'x-access-token': c.trackingToken },
    timeout: 20000,
  });

  const scans = (data?.trackDetails || []).map((s) => ({
    action_code: s.strAction,
    description: s.strActionDesc || s.strAction,
    origin: s.strOrigin,
    destination: s.strDestination,
    scan_at: parseScanDate(s.strScanDate, s.strScanTime) || null,
  }));

  await syncScans(awb, scans);

  return { awb, scans, header: data?.trackHeader || null, raw: data };
}

/** DTDC "20240115" + "1430" format ko MySQL datetime me */
function parseScanDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = String(dateStr).replace(/\D/g, '');
  if (d.length !== 8) return null;
  const t = String(timeStr || '0000').replace(/\D/g, '').padStart(4, '0');
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}:00`;
}

/** Insert scans into the DB — avoid duplicates */
async function syncScans(awb, scans = []) {
  if (!scans.length) return;

  const [[shipment]] = await db.query(
    `SELECT shipment_id FROM shipments WHERE awb_number = ? LIMIT 1`, [awb]
  );

  for (const s of scans) {
    const [existing] = await db.query(
      `SELECT id FROM shipment_scans
       WHERE awb_number = ? AND action_code <=> ? AND scan_at <=> ? LIMIT 1`,
      [awb, s.action_code, s.scan_at]
    );
    if (existing.length) continue;

    await db.query(
      `INSERT INTO shipment_scans
        (shipment_id, awb_number, action_code, description, origin, destination, scan_at)
       VALUES (?,?,?,?,?,?,?)`,
      [shipment?.shipment_id || null, awb, s.action_code, s.description,
        s.origin, s.destination, s.scan_at]
    );
  }

  // reflect the latest scan on the shipment row
  const latest = scans[scans.length - 1];
  if (latest) {
    const shipStatus = SCAN_TO_SHIPMENT_STATUS[String(latest.action_code).toUpperCase()];
    await db.query(
      `UPDATE shipments SET last_scan = ?, last_location = ?, last_scan_at = ?,
         status = COALESCE(?, status)
       WHERE awb_number = ?`,
      [latest.description, latest.destination || latest.origin, latest.scan_at,
        shipStatus || null, awb]
    );
  }
}

/** Booking cancel */
async function cancelShipment(awb) {
  const c = config();

  const { data } = await axios.post(`${c.base}cancel`, {
    AWBNo: [awb],
    customerCode: c.customerCode,
  }, {
    headers: { 'Content-Type': 'application/json', 'api-key': c.apiKey },
    timeout: 20000,
  });

  const ok = data?.status === 'OK';
  if (!ok) {
    const msg = data?.data?.[0]?.message || 'Cancellation failed';
    throw Object.assign(new Error(`DTDC: ${msg}`), { status: 502 });
  }

  await db.query(`UPDATE shipments SET status = 'Cancelled' WHERE awb_number = ?`, [awb]);
  return data;
}

/**
 * Extract the order + shipment status from the webhook payload.
 * DTDC dashboard me webhook URL: POST /api/webhooks/dtdc
 */
function parseWebhook(body) {
  const awb = body?.shipment?.strShipmentNo || body?.strShipmentNo;
  const statusRow = body?.shipmentStatus?.[0] || {};
  const code = String(statusRow.strAction || '').toUpperCase();
  const desc = statusRow.strActionDesc || code;

  let orderStatus = SCAN_TO_ORDER_STATUS[code];
  if (!orderStatus && /deliver(ed)?/i.test(desc) && !/non/i.test(desc)) {
    orderStatus = 'Completed';
  }

  return {
    awb,
    code,
    description: desc,
    orderStatus: orderStatus || 'Shipped',
    shipmentStatus: SCAN_TO_SHIPMENT_STATUS[code] || 'In Transit',
    origin: statusRow.strOrigin,
    destination: statusRow.strDestination,
    scanAt: parseScanDate(statusRow.strScanDate, statusRow.strScanTime),
  };
}

function trackingUrl(awb) {
  const base = process.env.PUBLIC_SITE_URL || '';
  return `${base}/tracking?awb=${awb}`;
}

module.exports = {
  bookShipment, fetchLabel, trackShipment, cancelShipment, syncScans,
  parseWebhook, trackingUrl, isConfigured, config,
  SERVICE_TYPES, SCAN_TO_ORDER_STATUS,
};
