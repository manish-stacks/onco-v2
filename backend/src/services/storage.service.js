const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * File storage. S3 configure ho to S3, warna local disk — dono ka interface
 * same hai, isliye upload code ko farak nahi padta.
 *
 * .env:
 *   S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 *   S3_ENDPOINT       (optional — DigitalOcean Spaces / MinIO ke liye)
 *   CDN_BASE_URL      (optional — CloudFront domain)
 *   MEDIA_PUBLIC_READ (default true — false karo to signed URLs chahiye honge)
 */

let s3Client = null;
let initTried = false;
let initError = null;

function config() {
  return {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'ap-south-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    cdn: (process.env.CDN_BASE_URL || '').replace(/\/$/, ''),
    publicRead: process.env.MEDIA_PUBLIC_READ !== 'false',
  };
}

function getClient() {
  if (initTried) return s3Client;
  initTried = true;

  const c = config();
  if (!c.bucket || !process.env.S3_ACCESS_KEY_ID) {
    initError = 'S3 configure nahi hai — local disk use ho rahi hai';
    return null;
  }

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: c.region,
      ...(c.endpoint ? { endpoint: c.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    console.log(`[storage] S3 ready — ${c.bucket} (${c.region})`);
    return s3Client;
  } catch (err) {
    initError = err.message;
    console.error('[storage] S3 init fail:', err.message);
    return null;
  }
}

function isS3Enabled() {
  return !!getClient();
}

/** Unique key banao — collision na ho aur original naam ka hint rahe */
function buildKey(folder, originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const base = path.basename(originalName || 'file', ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';

  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${folder}/${base}-${stamp}${rand}${ext}`;
}

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
};

function mimeFor(key) {
  return MIME[path.extname(key).toLowerCase()] || 'application/octet-stream';
}

/**
 * Buffer upload karo.
 * @returns {{ key, url, storage }} — url wahi hai jo DB me store hoga
 */
async function upload(buffer, { folder = 'misc', filename, contentType } = {}) {
  const key = buildKey(folder, filename);
  const type = contentType || mimeFor(key);

  const client = getClient();
  if (!client) return uploadLocal(buffer, key, type);

  const c = config();
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  await client.send(new PutObjectCommand({
    Bucket: c.bucket,
    Key: key,
    Body: buffer,
    ContentType: type,
    // Ek saal ka cache — filename me hash hai, to content badalne pe key badal jaati hai
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, url: publicUrl(key), storage: 's3' };
}

/** S3 na ho to local disk — dev me flow chalta rahe */
function uploadLocal(buffer, key, contentType) {
  const dir = path.join(__dirname, '..', '..', 'uploads', path.dirname(key));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '..', 'uploads', key), buffer);
  return { key, url: `/uploads/${key}`, storage: 'local', contentType };
}

/** DB me jaane wala URL. CDN ho to CDN, warna S3 direct, warna local. */
function publicUrl(key) {
  const c = config();
  if (!c.bucket) return `/uploads/${key}`;

  // Proxy mode: apne server se serve karo taaki cache layer beech me aaye
  if (process.env.MEDIA_SERVE_MODE === 'proxy') return `/media/${key}`;

  if (c.cdn) return `${c.cdn}/${key}`;
  if (c.endpoint) return `${c.endpoint.replace(/\/$/, '')}/${c.bucket}/${key}`;
  return `https://${c.bucket}.s3.${c.region}.amazonaws.com/${key}`;
}

/** S3 se object laao — proxy route aur migration verify dono use karte hain */
async function getObject(key) {
  const client = getClient();
  if (!client) {
    const filePath = path.join(__dirname, '..', '..', 'uploads', key);
    if (!fs.existsSync(filePath)) return null;
    return { body: fs.readFileSync(filePath), contentType: mimeFor(key) };
  }

  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: config().bucket, Key: key,
    }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return {
      body: Buffer.concat(chunks),
      contentType: res.ContentType || mimeFor(key),
      etag: res.ETag,
    };
  } catch (err) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
}

async function remove(key) {
  const client = getClient();
  if (!client) {
    const filePath = path.join(__dirname, '..', '..', 'uploads', key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  }
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  await client.send(new DeleteObjectCommand({ Bucket: config().bucket, Key: key }));
  return true;
}

async function exists(key) {
  const client = getClient();
  if (!client) {
    return fs.existsSync(path.join(__dirname, '..', '..', 'uploads', key));
  }
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { HeadObjectCommand } = require('@aws-sdk/client-s3');
  try {
    await client.send(new HeadObjectCommand({ Bucket: config().bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Health check ke liye — bucket tak pahunch ban rahi hai? */
async function ping() {
  const client = getClient();
  if (!client) return { ok: false, reason: initError || 'S3 configure nahi hai' };

  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { HeadBucketCommand } = require('@aws-sdk/client-s3');
  try {
    await client.send(new HeadBucketCommand({ Bucket: config().bucket }));
    return { ok: true, bucket: config().bucket, region: config().region };
  } catch (err) {
    return { ok: false, reason: err.name === 'Forbidden' ? 'Bucket pe access nahi hai' : err.message };
  }
}

module.exports = {
  upload, getObject, remove, exists, publicUrl, buildKey, ping,
  isS3Enabled, config, mimeFor,
};
