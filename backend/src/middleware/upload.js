const multer = require('multer');
const path = require('path');
const storage = require('../services/storage.service');

/**
 * Uploads now arrive in memory and go to S3 from there.
 *
 * Previously multer wrote straight to disk — in that model, sending it to S3 meant
 * the file had to be written twice (disk, then S3), and on a multi-server deploy
 * a file on one server's disk is not visible to another. Now the buffer goes straight
 * goes to the storage service, which puts it on S3 or (if S3 is absent) on disk.
 */

const MAX_SIZE = parseInt(process.env.UPLOAD_MAX_MB || '5', 10) * 1024 * 1024;
const ALLOWED = /jpeg|jpg|png|webp|gif|pdf/;

function makeUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 10 },
    fileFilter: (req, file, cb) => {
      const ok = ALLOWED.test(path.extname(file.originalname).toLowerCase());
      if (!ok) return cb(new Error('Only jpg/png/webp/gif/pdf are allowed'));
      return cb(null, true);
    },
  });
}

const uploader = makeUploader();

/**
 * Store a single file.
 * @returns {string|null} public URL — this is what goes into the DB
 */
async function storeFile(file, folder) {
  if (!file) return null;
  const result = await storage.upload(file.buffer, {
    folder,
    filename: file.originalname,
    contentType: file.mimetype,
  });
  console.log('storeFile', file.originalname, '->', result);
  return result.url;
}

/** Array of files -> array of URLs (prescriptions ke liye) */
async function storeFiles(files = [], folder) {
  const urls = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    urls.push(await storeFile(f, folder));
  }
  return urls;
}

/**
 * multer .fields() se aaye files ko URLs me badlo.
 *   fieldsToUrls(req.files, 'products', ['image_1','image_2'])
 *   -> { image_1: 'https://...', image_2: 'https://...' }
 */
async function fieldsToUrls(files, folder, fieldNames) {
  const out = {};
  if (!files) return out;

  for (const name of fieldNames) {
    const file = files[name]?.[0];
    if (file) {
      // eslint-disable-next-line no-await-in-loop
      out[name] = await storeFile(file, folder);
    }
  }
  return out;
}

module.exports = {
  // All uploaders are identical now (the folder is decided at upload time),
  // but the names are kept so old route signatures do not break
  uploadPrescription: uploader,
  uploadProduct: uploader,
  uploadCategory: uploader,
  uploadBanner: uploader,
  uploadBrand: uploader,
  uploadNews: uploader,
  uploadAvatar: uploader,

  storeFile,
  storeFiles,
  fieldsToUrls,

  // old helper — the URL now comes straight from storeFile
  filePath: (folder, file) => (file ? `/uploads/${folder}/${file.filename}` : null),
  filePaths: (folder, files = []) => files.map((f) => `/uploads/${folder}/${f.filename}`),
};
