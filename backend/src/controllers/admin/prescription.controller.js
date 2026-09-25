const prescriptionModel = require('../../models/prescription.model');
const adminModel = require('../../models/admin.model');
const customerModel = require('../../models/customer.model');
const notify = require('../../services/notification.service');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');
const { storeFile } = require('../../middleware/upload');
const cache = require('../../utils/cache');
const { PRESCRIPTION_STATUSES } = require('../../config/constants');

/**
 * Prescriptions from web and app live in one table, so one list covers both.
 * You can filter with ?source=web / ?source=app.
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
  if (!presc) return fail(res, 'Prescription not found', 404);
  return ok(res, presc);
});

/** PATCH /admin/prescriptions/:id/status */
const updateStatus = asyncHandler(async (req, res) => {
  const { status, rejection_reason, notes } = req.body;

  if (!PRESCRIPTION_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${PRESCRIPTION_STATUSES.join(', ')}`, 422);
  }
  if (status === 'Rejected' && !rejection_reason) {
    return fail(res, 'rejection_reason is required in order to reject', 422);
  }

  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc) return fail(res, 'Prescription not found', 404);

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

  // Tell the customer (SMS + push) — old site sent "PrescriptionApproved" on approval
  try {
    const fresh = await prescriptionModel.findById(req.params.id);
    const customer = fresh?.customer_id ? await customerModel.findById(fresh.customer_id) : null;
    notify.prescriptionReviewed(fresh, customer);
  } catch (e) {
    console.error('[prescription] notify fail:', e.message);
  }

  return ok(res, await prescriptionModel.findById(req.params.id), 'Status updated');
});

/**
 * PUT /admin/prescriptions/:id/medicines
 * The admin reads the prescription and suggests medicines — the customer can
 * can add them to the cart.
 */
const setMedicines = asyncHandler(async (req, res) => {
  const medicines = req.body.medicines;
  if (!Array.isArray(medicines)) {
    return fail(res, 'A medicines array is required: [{ product_id, medicine_name, quantity }]', 422);
  }

  await prescriptionModel.setMedicines(req.params.id, medicines);
  return ok(res, await prescriptionModel.findById(req.params.id), 'Medicines set');
});

/**
 * POST /admin/prescriptions/:id/add-images   (multipart)
 * fields: prescription_images (multiple files)
 * Lets the admin attach extra pages to an existing prescription — e.g. the
 * customer sent more pages after the order was placed — same as adding
 * multiple pages at POS create time.
 */
const addImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) return fail(res, 'At least one file is required', 422);

  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc) return fail(res, 'Prescription not found', 404);

  const urls = [];
  for (const f of files) urls.push(await storeFile(f, 'prescriptions'));
  await prescriptionModel.addImages(req.params.id, urls);

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'update', module: 'prescriptions', record_id: req.params.id,
    description: `${urls.length} page(s) added to prescription`, ip_address: req.ip,
  });

  try { await cache.invalidate.orders(); } catch { /* cache is best effort */ }

  return ok(res, await prescriptionModel.findById(req.params.id), 'Pages added');
});

/**
 * POST /admin/prescriptions/:id/replace-image   (multipart)
 * fields: prescription_image (file), old_image (optional URL of the file to replace)
 * Used when a wrong prescription was uploaded — the old file is deleted.
 */
const replaceImage = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, 'A replacement file is required', 422);

  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc) return fail(res, 'Prescription not found', 404);

  const oldImage = req.body.old_image || null;
  if (oldImage && !presc.images.includes(oldImage)) {
    return fail(res, 'The image to replace was not found on this prescription', 404);
  }

  const url = await storeFile(req.file, 'prescriptions');
  await prescriptionModel.replaceImage(req.params.id, oldImage, url);

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'update', module: 'prescriptions', record_id: req.params.id,
    description: oldImage ? 'Prescription file replaced' : 'All prescription files replaced', ip_address: req.ip,
  });

  try { await cache.invalidate.orders(); } catch { /* cache is best effort */ }

  return ok(res, await prescriptionModel.findById(req.params.id), 'Prescription replaced');
});

/** DELETE /admin/prescriptions/:id */
const remove = asyncHandler(async (req, res) => {
  await prescriptionModel.remove(req.params.id);
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'delete', module: 'prescriptions', record_id: req.params.id, ip_address: req.ip,
  });
  return ok(res, null, 'Prescription deleted');
});

module.exports = { list, stats, detail, updateStatus, setMedicines, replaceImage, addImages, remove };
