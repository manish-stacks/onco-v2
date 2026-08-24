const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { parseJson, genRef } = require('../utils/helpers');
const storage = require('../services/storage.service');

/**
 * ONE prescriptions table — for both web and app. Images live in a JSON array,
 * so whether there is 1 image or 8, everything fits (the app previously had 5 fixed columns).
 */

/** DB row -> API shape (images hamesha proper array) */
function hydrate(row) {
  if (!row) return null;
  return { ...row, images: parseJson(row.images, []) };
}

async function create({
  customer_id, images = [], title, patient_name, doctor_name, hospital_name,
  notes, contact_number, source, direct_upload,
}) {
  const referenceCode = genRef('RX');
  const [result] = await db.query(
    `INSERT INTO prescriptions
      (customer_id, reference_code, title, images, patient_name, doctor_name, hospital_name,
       notes, contact_number, source, direct_upload, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Pending')`,
    [customer_id, referenceCode, title || 'Prescription', JSON.stringify(images),
      patient_name || null, doctor_name || null, hospital_name || null,
      notes || null, contact_number || null,
      source === 'app' ? 'app' : 'web', direct_upload ? 1 : 0]
  );
  return { prescription_id: result.insertId, reference_code: referenceCode };
}

async function findById(prescriptionId) {
  const [[row]] = await db.query(`SELECT * FROM prescriptions WHERE prescription_id = ?`, [prescriptionId]);
  if (!row) return null;

  const [medicines] = await db.query(
    `SELECT pm.*, p.slug, p.product_sp, p.image_1
     FROM prescription_medicines pm
     LEFT JOIN products p ON p.product_id = pm.product_id
     WHERE pm.prescription_id = ?`,
    [prescriptionId]
  );
  return { ...hydrate(row), medicines };
}

async function findByReference(referenceCode) {
  const [[row]] = await db.query(`SELECT * FROM prescriptions WHERE reference_code = ?`, [referenceCode]);
  return hydrate(row);
}

async function list(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('p');
  qb.eq('customer_id', filters.customer_id)
    .eq('status', filters.status)
    .eq('source', filters.source)
    .eq('direct_upload', filters.direct_upload)
    .gte('created_at', filters.from_date)
    .lte('created_at', filters.to_date)
    .like(['reference_code', 'patient_name', 'doctor_name', 'contact_number'], filters.search);

  const { sql: whereSql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT p.*, c.customer_name, c.mobile AS customer_mobile
     FROM prescriptions p
     LEFT JOIN customers c ON c.customer_id = p.customer_id
     ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM prescriptions p ${whereSql}`, params);

  return { rows: rows.map(hydrate), total };
}

async function updateStatus(prescriptionId, status, { reviewedBy, rejectionReason, notes } = {}) {
  await db.query(
    `UPDATE prescriptions SET status = ?, rejection_reason = ?, notes = COALESCE(?, notes),
       reviewed_by = ?, reviewed_at = NOW()
     WHERE prescription_id = ?`,
    [status, rejectionReason || null, notes || null, reviewedBy || null, prescriptionId]
  );
}

/** Add more images to the images array (the customer sent more later) */
async function addImages(prescriptionId, newImages = []) {
  const [[row]] = await db.query(`SELECT images FROM prescriptions WHERE prescription_id = ?`, [prescriptionId]);
  if (!row) throw Object.assign(new Error('Prescription not found'), { status: 404 });

  const merged = [...parseJson(row.images, []), ...newImages];
  await db.query(`UPDATE prescriptions SET images = ? WHERE prescription_id = ?`,
    [JSON.stringify(merged), prescriptionId]);
  return merged;
}

async function removeImage(prescriptionId, imagePath) {
  const [[row]] = await db.query(`SELECT images FROM prescriptions WHERE prescription_id = ?`, [prescriptionId]);
  if (!row) throw Object.assign(new Error('Prescription not found'), { status: 404 });

  const remaining = parseJson(row.images, []).filter((img) => img !== imagePath);
  await db.query(`UPDATE prescriptions SET images = ? WHERE prescription_id = ?`,
    [JSON.stringify(remaining), prescriptionId]);
  return remaining;
}

/** The admin reviews the prescription and suggests medicines */
async function setMedicines(prescriptionId, medicines = []) {
  return db.withTransaction(async (conn) => {
    await conn.query(`DELETE FROM prescription_medicines WHERE prescription_id = ?`, [prescriptionId]);
    if (medicines.length) {
      const values = medicines.map((m) => [
        prescriptionId, m.product_id || null, m.medicine_name || null,
        m.medicine_link || null, m.quantity || 1,
      ]);
      await conn.query(
        `INSERT INTO prescription_medicines (prescription_id, product_id, medicine_name, medicine_link, quantity)
         VALUES ?`, [values]
      );
    }
  });
}

async function remove(prescriptionId) {
  // Pull the image URLs first so we can clean them off S3 after the row is gone.
  let images = [];
  try {
    const [[row]] = await db.query(`SELECT images FROM prescriptions WHERE prescription_id = ?`, [prescriptionId]);
    images = parseJson(row?.images, []);
  } catch { /* row may already be gone */ }

  await db.query(`DELETE FROM prescription_medicines WHERE prescription_id = ?`, [prescriptionId]);
  await db.query(`DELETE FROM prescriptions WHERE prescription_id = ?`, [prescriptionId]);

  // Best-effort S3 cleanup — a failed delete here must not fail the request.
  for (const url of images) {
    const key = keyFromUrl(url);
    if (key) storage.remove(key).catch((e) => console.error('[prescription] s3 delete fail:', key, e.message));
  }
}

/** Turn a stored image URL back into its S3 object key. */
function keyFromUrl(url) {
  if (!url) return null;
  const s = String(url);
  // Prescription images always live under the "prescriptions/" folder — grab from there.
  const i = s.indexOf('prescriptions/');
  if (i !== -1) return s.slice(i);
  // Fallback: strip protocol/host and any /uploads or /media prefix.
  return s.replace(/^https?:\/\/[^/]+\//, '').replace(/^(uploads|media)\//, '');
}

async function countByStatus() {
  const [rows] = await db.query(
    `SELECT status, COUNT(*) AS count FROM prescriptions GROUP BY status`
  );
  return rows;
}

module.exports = {
  create, findById, findByReference, list, updateStatus,
  addImages, removeImage, setMedicines, remove, countByStatus, hydrate,
};
