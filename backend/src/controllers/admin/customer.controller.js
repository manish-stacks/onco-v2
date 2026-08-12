const customerModel = require('../../models/customer.model');
const orderModel = require('../../models/order.model');
const adminModel = require('../../models/admin.model');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination, toCsv } = require('../../utils/helpers');

/** GET /admin/customers */
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await customerModel.list({
    status: req.query.status,
    platform: req.query.platform,
    city: req.query.city,
    state: req.query.state,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
    search: req.query.search,
  }, { limit, offset });

  return paginated(res, rows, total, page, limit);
});

/** GET /admin/customers/stats */
const stats = asyncHandler(async (req, res) => {
  return ok(res, await customerModel.stats());
});

/** GET /admin/customers/:customerId — 360 view */
const detail = asyncHandler(async (req, res) => {
  const profile = await customerModel.profile(req.params.customerId);
  if (!profile) return fail(res, 'Customer nahi mila', 404);
  return ok(res, profile);
});

/** GET /admin/customers/:customerId/orders */
const customerOrders = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 20, 100);
  const { rows, total } = await orderModel.list(
    { customer_id: req.params.customerId, status: req.query.status },
    { limit, offset }
  );
  return paginated(res, rows, total, page, limit);
});

/** PATCH /admin/customers/:customerId */
const update = asyncHandler(async (req, res) => {
  const updated = await customerModel.update(req.params.customerId, req.body);
  if (!updated) return fail(res, 'Koi valid field nahi mila', 422);

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'update', module: 'customers', record_id: req.params.customerId, ip_address: req.ip,
  });

  return ok(res, await customerModel.findById(req.params.customerId), 'Customer update ho gaya');
});

/** PATCH /admin/customers/:customerId/status — block / unblock */
const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Active', 'Inactive'].includes(status)) return fail(res, "status 'Active' ya 'Inactive' hona chahiye", 422);

  await customerModel.setStatus(req.params.customerId, status);
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: status === 'Active' ? 'unblock' : 'block', module: 'customers',
    record_id: req.params.customerId, ip_address: req.ip,
  });

  return ok(res, null, status === 'Active' ? 'Customer unblock ho gaya' : 'Customer block ho gaya');
});

/** GET /admin/customers/export */
const exportCsv = asyncHandler(async (req, res) => {
  const { rows } = await customerModel.list({
    status: req.query.status,
    platform: req.query.platform,
    search: req.query.search,
  }, { limit: 10000, offset: 0 });

  const csv = toCsv(rows, [
    'customer_id', 'customer_name', 'mobile', 'email_id', 'platform', 'city', 'state',
    'pincode', 'registration_date', 'status', 'order_count', 'total_spent', 'last_order_date',
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="customers-${Date.now()}.csv"`);
  return res.send(csv);
});

module.exports = { list, stats, detail, customerOrders, update, setStatus, exportCsv };
