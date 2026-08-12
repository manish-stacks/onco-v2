const prescriptionModel = require('../../models/prescription.model');
const { storeFiles } = require('../../middleware/upload');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');
const events = require('../../services/events.service');

/**
 * Web aur app dono yahi endpoint use karte hain. Jitni images bhejo (1 se 10),
 * sab ek JSON array me store hoti hain — koi image_1..image_5 wala jhanjhat nahi.
 */

/** POST /prescriptions — multipart, field name: images */
const upload = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) return fail(res, 'Kam se kam ek prescription image chahiye', 422);

  const images = await storeFiles(files, 'prescriptions');

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

  return created(res, { ...result, images }, `${images.length} image(s) upload ho gayi`);
});

/** POST /prescriptions/:id/images — existing prescription me aur images */
const addImages = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription nahi mila', 404);
  if (!['Pending', 'Under Review'].includes(presc.status)) {
    return fail(res, `'${presc.status}' status me images add nahi kar sakte`, 409);
  }

  const files = req.files || [];
  if (!files.length) return fail(res, 'Koi image nahi mili', 422);

  const uploaded = await storeFiles(files, 'prescriptions');
  const images = await prescriptionModel.addImages(req.params.id, uploaded);
  return ok(res, { images }, 'Images add ho gayi');
});

/** DELETE /prescriptions/:id/images */
const removeImage = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription nahi mila', 404);

  const images = await prescriptionModel.removeImage(req.params.id, req.body.image_path);
  return ok(res, { images }, 'Image hata di');
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
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription nahi mila', 404);
  return ok(res, presc);
});

/** DELETE /prescriptions/:id — sirf pending state me */
const cancelPrescription = asyncHandler(async (req, res) => {
  const presc = await prescriptionModel.findById(req.params.id);
  if (!presc || presc.customer_id !== req.customer.customer_id) return fail(res, 'Prescription nahi mila', 404);
  if (!['Pending', 'Under Review'].includes(presc.status)) {
    return fail(res, `'${presc.status}' status ka prescription cancel nahi ho sakta`, 409);
  }

  await prescriptionModel.updateStatus(req.params.id, 'Cancelled', { rejectionReason: req.body.reason });
  return ok(res, null, 'Prescription cancel ho gaya');
});

module.exports = {
  upload, addImages, removeImage, myPrescriptions, prescriptionDetail, cancelPrescription,
};
