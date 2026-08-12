/**
 * DB me image paths kahan-kahan padi hain — migration aur cleanup dono
 * isi map se chalte hain.
 *
 * Naya table/column add karo to bas yahan entry daal do, migration khud
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
    // JSON array column — har element alag asset hai
    table: 'prescriptions',
    pk: 'prescription_id',
    columns: ['images'],
    json: true,
    folder: 'prescriptions',
  },
  {
    // Historical snapshot — order ke waqt ki image. Migrate karna optional hai,
    // lekin purane orders me broken image na dikhe isliye kar dete hain.
    table: 'order_items',
    pk: 'item_id',
    columns: ['product_image'],
    folder: 'products',
  },
];

/** Purani site jahan images abhi padi hain */
function legacyBase() {
  return (process.env.LEGACY_MEDIA_BASE_URL || 'https://oncohealthmart.com').replace(/\/$/, '');
}

/**
 * Images ka folder purani site pe. DB me aksar sirf filename padi hoti hai
 * (jaise "abc123.jpg"), aur asli URL banta hai:
 *   https://oncohealthmart.com  +  /uploads/img_upload/  +  abc123.jpg
 */
function legacyPath() {
  const p = process.env.LEGACY_MEDIA_PATH || '/uploads/img_upload';
  return `/${p.replace(/^\/+|\/+$/g, '')}`; // aage-peeche ke slashes normalize
}

/**
 * DB me stored value ko downloadable URL me badlo.
 *
 * Values kai tarah ki ho sakti hain, isliye har case handle karna padta hai:
 *   "abc.jpg"                              -> base + /uploads/img_upload/abc.jpg
 *   "sub/abc.jpg"                          -> base + /uploads/img_upload/sub/abc.jpg
 *   "/uploads/img_upload/abc.jpg"          -> base + waise hi (dobara prefix mat lagao)
 *   "uploads/img_upload/abc.jpg"           -> base + /uploads/img_upload/abc.jpg
 *   "https://oncohealthmart.com/..."       -> waise hi
 */
function toSourceUrl(value) {
  if (!value) return null;

  let v = String(value).trim();
  if (!v) return null;

  // Pehle se poora URL hai
  if (/^https?:\/\//i.test(v)) return v;

  v = v.replace(/^\/+/, ''); // leading slashes hata do
  const folder = legacyPath().replace(/^\//, ''); // "uploads/img_upload"

  // Path me folder pehle se hai? To dobara mat jodo — warna
  // /uploads/img_upload/uploads/img_upload/abc.jpg ban jayega
  const hasFolder = v.toLowerCase().startsWith(`${folder.toLowerCase()}/`);

  return hasFolder
    ? `${legacyBase()}/${v}`
    : `${legacyBase()}${legacyPath()}/${v}`;
}

/** Ye value pehle hi migrate ho chuki hai? */
function isMigrated(value) {
  if (!value) return true; // khaali hai, migrate karne ko kuch nahi
  const v = String(value);
  const cdn = process.env.CDN_BASE_URL;
  const bucket = process.env.S3_BUCKET;

  if (cdn && v.includes(cdn.replace(/^https?:\/\//, ''))) return true;
  if (bucket && v.includes(`${bucket}.s3.`)) return true;
  if (v.startsWith('/media/')) return true; // humare proxy se serve ho rahi hai
  return false;
}

module.exports = { MEDIA_MAP, legacyBase, legacyPath, toSourceUrl, isMigrated };