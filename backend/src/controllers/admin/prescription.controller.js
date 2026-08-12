const prescriptionModel = require('../../models/prescription.model');
const adminModel = require('../../models/admin.model');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');
const { PRESCRIPTION_STATUSES } = require('../../config/constants');

/**
 * Web aur app dono ke prescriptions ek hi table me hain, to ek hi list.
 * ?source=web / ?source=app se filter kar sakte ho.
 */

/** GET /admin/prescriptions */
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await prescriptionModel.list({
    status: req.query.status,
    source: req.query.source,
    customer_id: req.query.customer_id,
    direct_upload: req.query.direct_upload,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
    search: req.query.search,
  }, { limit, offset });

  return paginated(res, rows, total, page, limit);
});

/** GET /admin/prescriptions/stats */
const stats = asyncHandler(async (req, res) => {
  return ok(res, await prescriptionModel.countByStatus());
});

/** GET /admin/prescriptions/:id */
const detail = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc) return fail(res, 'Prescription nahi mila', 404);
  return ok(res, presc);
});

/** PATCH /admin/prescriptions/:id/status */
const updateStatus = asyncHandler(async (req, res) => {
  const { status, rejection_reason, notes } = req.body;

  if (!PRESCRIPTION_STATUSES.includes(status)) {
    return fail(res, `status in me se ek: ${PRESCRIPTION_STATUSES.join(', ')}`, 422);
  }
  if (status === 'Rejected' && !rejection_reason) {
    return fail(res, 'Reject karne ke liye rejection_reason dena zaroori hai', 422);
  }

  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc) return fail(res, 'Prescription nahi mila', 404);

  await prescriptionModel.updateStatus(req.params.id, status, {
    reviewedBy: req.admin.admin_id,
    rejectionReason: rejection_reason,
    notes,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'status_change', module: 'prescriptions', record_id: req.params.id,
    description: `${presc.status} -> ${status}`, ip_address: req.ip,
  });

  return ok(res, await prescriptionModel.findById(req.params.id), 'Status update ho gaya');
});

/**
 * PUT /admin/prescriptions/:id/medicines
 * Admin prescription padh ke medicines suggest karta hai — customer inhe
 * cart me daal sakta hai.
 */
const setMedicines = asyncHandler(async (req, res) => {
  const medicines = req.body.medicines;
  if (!Array.isArray(medicines)) {
    return fail(res, 'medicines array chahiye: [{ product_id, medicine_name, quantity }]', 422);
  }

  await prescriptionModel.setMedicines(req.params.id, medicines);
  return ok(res, await prescriptionModel.findById(req.params.id), 'Medicines set ho gayi');
});

/** DELETE /admin/prescriptions/:id */
const remove = asyncHandler(async (req, res) => {
  await prescriptionModel.remove(req.params.id);
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'delete', module: 'prescriptions', record_id: req.params.id, ip_address: req.ip,
  });
  return ok(res, null, 'Prescription delete ho gaya');
});

module.exports = { list, stats, detail, updateStatus, setMedicines, remove };
