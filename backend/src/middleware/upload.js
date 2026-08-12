const multer = require('multer');
const path = require('path');
const storage = require('../services/storage.service');

/**
 * Uploads ab memory me aate hain aur wahan se S3 pe jaate hain.
 *
 * Pehle multer seedha disk pe likhta tha — us model me S3 pe jaane ke liye
 * file do baar likhni padti (disk, phir S3) aur multi-server deploy pe
 * ek server ki disk pe padi file doosre ko nahi milti. Ab buffer seedha
 * storage service ko jaata hai, jo S3 ya (S3 na ho to) disk pe rakh deta hai.
 */

const MAX_SIZE = parseInt(process.env.UPLOAD_MAX_MB || '5', 10) * 1024 * 1024;
const ALLOWED = /jpeg|jpg|png|webp|gif|pdf/;

function makeUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 10 },
    fileFilter: (req, file, cb) => {
      const ok = ALLOWED.test(path.extname(file.originalname).toLowerCase());
      if (!ok) return cb(new Error('Sirf jpg/png/webp/gif/pdf allowed hain'));
      return cb(null, true);
    },
  });
}

const uploader = makeUploader();

/**
 * Ek file ko store karo.
 * @returns {string|null} public URL — yahi DB me jaata hai
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
  // Saare uploaders same hain ab (folder upload ke waqt decide hota hai),
  // lekin purane route signatures na tootein isliye naam bane hue hain
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

  // purana helper — ab URL seedha storeFile se aata hai
  filePath: (folder, file) => (file ? `/uploads/${folder}/${file.filename}` : null),
  filePaths: (folder, files = []) => files.map((f) => `/uploads/${folder}/${f.filename}`),
};
