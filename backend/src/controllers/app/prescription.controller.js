const prescriptionModel = require('../../models/prescription.model');
const db = require('../../config/db');
const { storeFiles } = require('../../middleware/upload');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');
const events = require('../../services/events.service');

/**
 * Both web and app use this endpoint. However many images you send (1 to 10),
 * are all stored in one JSON array — no image_1..image_5 hassle.
 */

/** POST /prescriptions — multipart, field name: images */
const upload = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) return fail(res, 'At least one prescription image is required', 422);

  const images = await storeFiles(files, 'prescriptions');
  console.log('Uploaded prescription images:', images.length, images);
  const result = await prescriptionModel.create({
    customer_id: req.customer.customer_id,
    images,
    title: req.body.title,
    patient_name: req.body.patient_name,
    doctor_name: req.body.doctor_name,
    hospital_name: req.body.hospital_name,
    notes: req.body.notes,
    contact_number: req.body.contact_number,
    source: req.platform,
    direct_upload: req.body.direct_upload === 'true' || req.body.direct_upload === true,
  });

  events.emit('prescription.created', {
    prescription_id: result.prescription_id,
    reference: result.reference_code,
    image_count: images.length,
    source: req.platform,
  }, 'prescriptions.view');

  return created(res, { ...result, images }, `${images.length} image(s) uploaded`);
});

/** POST /prescriptions/:id/images — existing prescription me aur images */
const addImages = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription not found', 404);
  if (!['Pending', 'Under Review'].includes(presc.status)) {
    return fail(res, `Images cannot be added while the status is '${presc.status}'`, 409);
  }

  const files = req.files || [];
  if (!files.length) return fail(res, 'No image was received', 422);

  const uploaded = await storeFiles(files, 'prescriptions');
  const images = await prescriptionModel.addImages(req.params.id, uploaded);
  return ok(res, { images }, 'Images added');
});

/** DELETE /prescriptions/:id/images */
const removeImage = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription not found', 404);

  const images = await prescriptionModel.removeImage(req.params.id, req.body.image_path);
  return ok(res, { images }, 'Image removed');
});

/** GET /prescriptions */
const myPrescriptions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 10, 50);
  const { rows, total } = await prescriptionModel.list(
    { customer_id: req.customer.customer_id, status: req.query.status },
    { limit, offset }
  );
  return paginated(res, rows, total, page, limit);
});

/** GET /prescriptions/:id */
const prescriptionDetail = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription not found', 404);
  return ok(res, presc);
});

/**
 * PATCH /prescriptions/:id — fill in patient/doctor/hospital name.
 * Used at checkout: when a saved prescription is selected but is missing
 * these fields, the customer fills them in there, and this saves them back
 * onto the prescription itself so the prescription card and dashboard show
 * the complete details from then on (not just this one order).
 */
const updateDetails = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription not found', 404);

  const { patient_name, doctor_name, hospital_name } = req.body;
  await prescriptionModel.updateDetails(req.params.id, { patient_name, doctor_name, hospital_name });
  const updated = await prescriptionModel.findById(req.params.id);
  return ok(res, updated, 'Prescription updated');
});

/** DELETE /prescriptions/:id — only while pending */
const cancelPrescription = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription not found', 404);

  // A prescription that is attached to any order cannot be deleted — it is part
  // of that order's record.
  const [[used]] = await db.query(
    `SELECT COUNT(*) AS c FROM orders WHERE prescription_id = ?`, [req.params.id]
  );
  if (used.c > 0) {
    return fail(res, 'This prescription is used in an order and cannot be deleted', 409);
  }

  // Hard delete — removes the row, its suggested medicines and the S3 images.
  await prescriptionModel.remove(req.params.id);
  return ok(res, null, 'Prescription deleted');
});

module.exports = {
  upload, addImages, removeImage, myPrescriptions, prescriptionDetail, updateDetails, cancelPrescription,
};
