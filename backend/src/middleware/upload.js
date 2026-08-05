const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// NOTE: local disk storage for now so the project runs without AWS keys.
// To go to S3: swap `storage` for multer-s3 pointed at your bucket, keep
// the same field names/routes — controllers only use `req.file.filename`/`req.file.location`.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|pdf/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

module.exports = upload;
