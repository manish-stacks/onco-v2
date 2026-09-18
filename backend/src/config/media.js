/**
 * Where image paths live in the DB — needed for both migration and cleanup
 * also run off this map.
 *
 * When you add a new table/column just add an entry here, the migration
 * usko uthaa legi.
 */
const MEDIA_MAP = [
  {
    table: 'products',
    pk: 'product_id',
    columns: ['image_1', 'image_2', 'image_3', 'image_4', 'image_5'],
    folder: 'products',
  },
  {
    table: 'categories',
    pk: 'category_id',
    columns: ['category_image', 'category_banner'],
    folder: 'categories',
  },
  {
    table: 'banners',
    pk: 'banner_id',
    columns: ['banner_image'],
    folder: 'banners',
  },
  {
    table: 'brands',
    pk: 'id',
    columns: ['image_url'],
    folder: 'brands',
  },
  {
    table: 'deals',
    pk: 'id',
    columns: ['image'],
    folder: 'deals',
  },
  {
    table: 'news',
    pk: 'id',
    columns: ['image'],
    folder: 'news',
  },
  {
    table: 'settings',
    pk: 'id',
    columns: ['logo', 'mini_banner_1', 'mini_banner_2', 'event_ad_image'],
    folder: 'settings',
  },
  {
    // JSON array column — each element is a separate asset
    table: 'prescriptions',
    pk: 'prescription_id',
    columns: ['images'],
    json: true,
    folder: 'prescriptions',
    legacyPath: 'doc_upload', // old CI site ke uploads/doc_upload me hain, img_upload me nahi
  },
  {
    // Historical snapshot — the image as it was at order time. Migrating it is optional,
    // but we do it so old orders do not show a broken image.
    table: 'order_items',
    pk: 'item_id',
    columns: ['product_image'],
    folder: 'products',
  },
];

/** The old site where the images currently live */
function legacyBase() {
  return (process.env.LEGACY_MEDIA_BASE_URL || 'https://oncohealthmart.com').replace(/\/$/, '');
}

/**
 * The image folder on the old site. The DB often stores only the filename
 * (such as "abc123.jpg"), and the real URL is built as:
 *   https://oncohealthmart.com  +  /uploads/img_upload/  +  abc123.jpg
 */
function legacyPath(override) {
  // override: MEDIA_MAP entry ka legacyPath (e.g. "doc_upload"), agar diya ho —
  // isse bina override wale columns (products, categories...) purane behaviour
  // (LEGACY_MEDIA_PATH env / default img_upload) pe hi rehte hain.
  const p = override
    ? `uploads/${override.replace(/^\/+|\/+$/g, '').replace(/^uploads\//, '')}`
    : (process.env.LEGACY_MEDIA_PATH || '/uploads/img_upload');
  return `/${p.replace(/^\/+|\/+$/g, '')}`;
}

/**
 * DB me stored value ko downloadable URL me badlo.
 *
 * Values can come in several shapes, so every case has to be handled:
 *   "abc.jpg"                              -> base + /uploads/img_upload/abc.jpg
 *   "sub/abc.jpg"                          -> base + /uploads/img_upload/sub/abc.jpg
 *   "/uploads/img_upload/abc.jpg"          -> base + as-is (do not prefix twice)
 *   "uploads/img_upload/abc.jpg"           -> base + /uploads/img_upload/abc.jpg
 *   "https://oncohealthmart.com/..."       -> waise hi
 */
function toSourceUrl(value, legacyPathOverride) {
  if (!value) return null;

  let v = String(value).trim();
  if (!v) return null;

  // Already a full URL
  if (/^https?:\/\//i.test(v)) return v;

  v = v.replace(/^\/+/, ''); // leading slashes hata do
  const folder = legacyPath(legacyPathOverride).replace(/^\//, ''); // e.g. "uploads/doc_upload"

  // Is the folder already in the path? Then do not add it again — otherwise
  // it would become /uploads/img_upload/uploads/img_upload/abc.jpg
  const hasFolder = v.toLowerCase().startsWith(`${folder.toLowerCase()}/`);

  return hasFolder
    ? `${legacyBase()}/${v}`
    : `${legacyBase()}${legacyPath(legacyPathOverride)}/${v}`;
}

/** Has this value already been migrated? */
function isMigrated(value) {
  if (!value) return true; // empty, nothing to migrate
  const v = String(value);
  const cdn = process.env.CDN_BASE_URL;
  const bucket = process.env.S3_BUCKET;

  if (cdn && v.includes(cdn.replace(/^https?:\/\//, ''))) return true;
  if (bucket && v.includes(`${bucket}.s3.`)) return true;
  if (v.startsWith('/media/')) return true; // served through our proxy
  return false;
}

/** MEDIA_MAP se us table ka legacyPath dhoondo (agar diya ho) — resolveUrl jaisi
 *  jagah ke liye jahan sirf table ka naam pata hota hai, poora map entry nahi */
function legacyPathForTable(table) {
  return MEDIA_MAP.find((m) => m.table === table)?.legacyPath;
}

module.exports = {
  MEDIA_MAP, legacyBase, legacyPath, toSourceUrl, isMigrated, legacyPathForTable,
};