const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const customerModel = require('../../models/customer.model');
const productModel = require('../../models/product.model');
const orderService = require('../../services/order.service');
const orderModel = require('../../models/order.model');
const adminModel = require('../../models/admin.model');
const settingsModel = require('../../models/settings.model');
const prescriptionModel = require('../../models/prescription.model');
const cache = require('../../utils/cache');
const { storeFiles } = require('../../middleware/upload');
const { ok, created, fail, asyncHandler } = require('../../utils/response');

/**
 * GET /admin/pos/config — the POS estimate needs the same GST rules the server
 * uses so the GST it shows matches the final amount. default_gst is the fallback
 * rate; gst_override means that rate is applied to every item.
 *
 * Also returns shipping/COD charge config so the POS "Estimate" card can show
 * the same shipping + COD fee live, the way the customer checkout page does —
 * the server still recalculates everything on submit either way.
 */
const getConfig = asyncHandler(async (req, res) => {
  const tax = await settingsModel.getTaxConfig();
  const s = await settingsModel.get();
  return ok(res, {
    default_gst: tax.default_gst,
    gst_override: tax.gst_override,
    shipping_charge: parseFloat(s?.shipping_charge) || 0,
    shipping_threshold: parseFloat(s?.shipping_threshold) || 0,
    cod_fee: parseInt(s?.cod_fee, 10) || 0,
  });
});

/**
 * POS — lets an admin create a custom order (counter / phone order).
 *
 * The order goes into the normal `orders` table and is linked to a customer_id,
 * so the customer can log in later and see it in their own order history.
 */

function normaliseMobile(m) {
  return String(m || '').replace(/\D/g, '').slice(-10);
}

/**
 * GET /admin/pos/products?search=...
 * Quick product picker for the POS screen — active products only.
 */
const searchProducts = asyncHandler(async (req, res) => {
  const { rows } = await productModel.list(
    { status: 'Active', search: req.query.search || '' },
    { limit: 25, offset: 0 }
  );

  return ok(res, rows.map((p) => ({
    product_id: p.product_id,
    product_name: p.product_name,
    sku: p.sku,
    slug: p.slug,
    image_1: p.image_1,
    product_sp: p.product_sp,
    product_mrp: p.product_mrp,
    product_gst: p.product_gst,
    stock_quantity: p.stock_quantity,
    presciption_required: p.presciption_required,
  })));
});

/**
 * GET /admin/pos/customer?mobile=9876543210
 * Looks up an existing customer by number so their name/address can be auto-filled.
 */
const lookupCustomer = asyncHandler(async (req, res) => {
  const mobile = normaliseMobile(req.query.mobile);
  if (mobile.length !== 10) return fail(res, 'Please enter a valid 10-digit mobile number', 422);

  const existing = await customerModel.findByMobile(mobile);
  if (!existing) return ok(res, { found: false, customer: null, addresses: [] });

  const [addresses] = await db.query(
    `SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, ad_id DESC LIMIT 10`,
    [String(existing.customer_id)]
  );

  return ok(res, {
    found: true,
    customer: {
      customer_id: existing.customer_id,
      customer_name: existing.customer_name,
      mobile: existing.mobile,
      email_id: existing.email_id,
      address: existing.address,
      city: existing.city,
      state: existing.state,
      pincode: existing.pincode,
    },
    addresses,
  });
});

/** Find the customer for this number, or create one if there is none */
async function findOrCreateCustomer({ mobile, customer_name, email_id, address, city, state, pincode }) {
  const existing = await customerModel.findByMobile(mobile);
  if (existing) {
    // If the account has no name yet, fill in the one given at the counter
    if (!existing.customer_name && customer_name) {
      await db.query(`UPDATE customers SET customer_name = ? WHERE customer_id = ?`,
        [customer_name, existing.customer_id]);
    }
    return { customerId: existing.customer_id, isNew: false };
  }

  // Random password — the customer will log in with an OTP later
  const password = await bcrypt.hash(`pos-${mobile}-${Date.now()}`, 10);
  const customerId = await customerModel.create({
    customer_name: customer_name || `Customer ${mobile}`,
    password,
    email_id: email_id || null,
    mobile,
    address, city, state, pincode,
    country: 'India',
    platform: 'web',
  });

  return { customerId, isNew: true };
}

/**
 * POST /admin/pos/orders
 *
 * body: {
 *   customer: { mobile, customer_name, email_id },
 *   patient_name, doctor_name, hospital_name,
 *   address, city, state, pincode,
 *   items: [{ product_id, quantity }],
 *   payment_mode: 'cod' | 'online',
 *   payment_method_label: 'Cash' | 'UPI' | 'Card' | ...,
 *   mark_paid: true|false,
 *   transaction_number, comment, coupon_code
 * }
 */
const createOrder = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const c = b.customer || {};
  const errors = {};

  const mobile = normaliseMobile(c.mobile || b.customer_phone);
  if (mobile.length !== 10) errors.mobile = 'Please enter a valid 10-digit mobile number';

  const customerName = String(c.customer_name || b.customer_name || '').trim();
  if (!customerName) errors.customer_name = 'Customer name is required';

  // When prescription images are attached the request is multipart/form-data,
  // so `items` arrives as a JSON string instead of a real array.
  let itemsInput = b.items;
  if (typeof itemsInput === 'string') {
    try { itemsInput = JSON.parse(itemsInput); } catch { itemsInput = []; }
  }
  const items = Array.isArray(itemsInput) ? itemsInput.filter((i) => i && i.product_id) : [];
  if (!items.length) errors.items = 'Add at least one product to the order';

  if (!String(b.address || '').trim()) errors.address = 'Address is required';
  if (!String(b.city || '').trim()) errors.city = 'City is required';
  if (!String(b.state || '').trim()) errors.state = 'State is required';
  if (!/^\d{6}$/.test(String(b.pincode || '').trim())) errors.pincode = 'Please enter a valid 6-digit PIN code';

  if (Object.keys(errors).length) return fail(res, 'Please fix the highlighted fields', 422, errors);

  const { customerId, isNew } = await findOrCreateCustomer({
    mobile,
    customer_name: customerName,
    email_id: c.email_id || b.customer_email,
    address: b.address,
    city: b.city,
    state: b.state,
    pincode: b.pincode,
  });

  // A prescription can be uploaded right here on the POS screen — the admin is
  // looking at the physical copy at the counter, so it is auto-approved instead
  // of sitting in the usual pharmacist review queue.
  let prescriptionId = b.prescription_id || null;
  const files = req.files || [];
  if (files.length) {
    const images = await storeFiles(files, 'prescriptions');
    const presc = await prescriptionModel.create({
      customer_id: customerId,
      images,
      patient_name: b.patient_name || customerName,
      doctor_name: b.doctor_name || null,
      hospital_name: b.hospital_name || null,
      source: 'web',
      direct_upload: true,
    });
    await prescriptionModel.updateStatus(presc.prescription_id, 'Approved', {
      reviewedBy: req.admin?.admin_username,
      notes: `Uploaded and verified at POS by ${req.admin?.admin_username || 'admin'}`,
    });
    prescriptionId = presc.prescription_id;
  }

  const result = await orderService.placeOrder({
    isPos: true,
    created_by: req.admin?.admin_username || req.admin?.admin_id,
    customerId,
    platform: 'web',
    items: items.map((i) => ({
      product_id: i.product_id,
      unit_quantity: parseInt(i.quantity || i.unit_quantity, 10) || 1,
    })),
    customer_name: customerName,
    customer_phone: mobile,
    customer_email: c.email_id || b.customer_email || null,
    customer_address: b.address,
    customer_city: b.city,
    customer_state: b.state,
    customer_pincode: b.pincode,
    customer_country: 'India',
    shipping_same_as_billing: true,
    patient_name: b.patient_name || customerName,
    doctor_name: b.doctor_name || null,
    hospital_name: b.hospital_name || null,
    prescription_id: prescriptionId,
    coupon_code: b.coupon_code || null,
    discount_type: b.discount_type === 'percent' ? 'percent' : 'flat',
    discount_value: parseFloat(b.discount_value) || 0,
    payment_mode: b.payment_mode === 'online' ? 'online' : 'cod',
    payment_gateway: b.payment_method_label || (b.payment_mode === 'online' ? 'online' : 'cash'),
    mark_paid: b.mark_paid === true || b.mark_paid === 'true',
    transaction_number: b.transaction_number || null,
    comment: [b.comment, `POS order by ${req.admin?.admin_username || 'admin'}`]
      .filter(Boolean).join(' | '),
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id,
    admin_username: req.admin.admin_username,
    action: 'create',
    module: 'orders',
    record_id: result.order?.order_id,
    description: `POS order ${result.order?.databaseOrderID} for ${customerName} (${mobile})`,
    ip_address: req.ip,
  });

  await cache.invalidate.orders();

  return created(res, {
    order: await orderModel.findById(result.order.order_id),
    customer_created: isNew,
  }, 'POS order created');
});

module.exports = { searchProducts, lookupCustomer, createOrder, getConfig };
