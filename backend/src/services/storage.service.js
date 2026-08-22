const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * File storage. S3 when configured, otherwise the local disk — the interface for both
 * is the same, so the upload code does not change.
 *
 * .env:
 *   S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 *   S3_ENDPOINT       (optional — DigitalOcean Spaces / MinIO ke liye)
 *   CDN_BASE_URL      (optional — CloudFront domain)
 *   MEDIA_PUBLIC_READ (default true — set false and signed URLs will be required)
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
    initError = 'S3 is not configured — falling back to local disk';
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

/** Build a unique key — avoid collisions while keeping a hint of the original name */
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
 * Upload the buffer.
 * @returns {{ key, url, storage }} — url is exactly what gets stored in the DB
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
    // One year of cache — the filename contains a hash, so the key changes when the content changes
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, url: publicUrl(key), storage: 's3' };
}

/** Fall back to the local disk when S3 is absent — so the flow keeps working in dev */
function uploadLocal(buffer, key, contentType) {
  const dir = path.join(__dirname, '..', '..', 'uploads', path.dirname(key));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '..', 'uploads', key), buffer);
  return { key, url: `/uploads/${key}`, storage: 'local', contentType };
}

/** The URL that goes into the DB. CDN if available, otherwise S3 direct, otherwise local. */
function publicUrl(key) {
  const c = config();
  if (!c.bucket) return `/uploads/${key}`;

  // Proxy mode: serve from our own server so the cache layer sits in the middle
  if (process.env.MEDIA_SERVE_MODE === 'proxy') return `/media/${key}`;

  if (c.cdn) return `${c.cdn}/${key}`;
  if (c.endpoint) return `${c.endpoint.replace(/\/$/, '')}/${c.bucket}/${key}`;
  return `https://${c.bucket}.s3.${c.region}.amazonaws.com/${key}`;
}

/** Fetch an object from S3 — used by both the proxy route and migration verification */
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

/** For health checks — is the bucket reachable? */
async function ping() {
  const client = getClient();
  if (!client) return { ok: false, reason: initError || 'S3 is not configured' };

  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const { HeadBucketCommand } = require('@aws-sdk/client-s3');
  try {
    await client.send(new HeadBucketCommand({ Bucket: config().bucket }));
    return { ok: true, bucket: config().bucket, region: config().region };
  } catch (err) {
    return { ok: false, reason: err.name === 'Forbidden' ? 'No access to the bucket' : err.message };
  }
}

module.exports = {
  upload, getObject, remove, exists, publicUrl, buildKey, ping,
  isS3Enabled, config, mimeFor,
};
