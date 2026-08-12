const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const storage = require('../services/storage.service');

/**
 * Cached image proxy — /media/<key>
 *
 * Kaam: S3 se ek baar object laao, local disk pe rakho, aage se wahi serve
 * karo. Isse har page load pe S3 hit nahi hoti (S3 GET requests ka paisa
 * lagta hai aur latency bhi zyada hai).
 *
 * ⚠ Asli production answer CloudFront hai — wo edge pe cache karta hai,
 * humara server beech me aata hi nahi. Ye proxy tab ke liye hai jab CDN
 * abhi setup na hua ho, ya single-server deploy ho.
 *
 * CloudFront lagane ke baad `CDN_BASE_URL` set kar do aur
 * `MEDIA_SERVE_MODE=proxy` hata do — URLs seedha CDN ki ban jaayengi
 * aur ye route bypass ho jayega.
 */

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache', 'media');
const MAX_AGE_SECONDS = parseInt(process.env.MEDIA_CACHE_MAX_AGE || '2592000', 10); // 30 din
const MAX_CACHE_MB = parseInt(process.env.MEDIA_CACHE_MAX_MB || '2048', 10);

fs.mkdirSync(CACHE_DIR, { recursive: true });

/** Key ko flat filename me — nested folders banane se bachte hain */
function cachePath(key) {
  const hash = crypto.createHash('sha1').update(key).digest('hex');
  const ext = path.extname(key) || '.bin';
  return path.join(CACHE_DIR, `${hash}${ext}`);
}

/**
 * Cache badhta rehta hai to disk bhar jaayegi. Har 100th request pe
 * check karo, aur limit cross ho to sabse purani files hata do.
 */
let requestCount = 0;
function maybeEvict() {
  requestCount += 1;
  if (requestCount % 100 !== 0) return;

  try {
    const files = fs.readdirSync(CACHE_DIR).map((f) => {
      const full = path.join(CACHE_DIR, f);
      const stat = fs.statSync(full);
      return { full, size: stat.size, atime: stat.atimeMs };
    });

    const totalMb = files.reduce((s, f) => s + f.size, 0) / (1024 * 1024);
    if (totalMb <= MAX_CACHE_MB) return;

    // LRU — sabse purani access wali pehle hatao
    files.sort((a, b) => a.atime - b.atime);
    let freed = 0;
    const target = totalMb - MAX_CACHE_MB * 0.8; // 80% tak le aao

    for (const f of files) {
      if (freed / (1024 * 1024) >= target) break;
      try { fs.unlinkSync(f.full); freed += f.size; } catch { /* already gone */ }
    }
    console.log(`[media-cache] ${(freed / 1024 / 1024).toFixed(1)}MB evict kiya`);
  } catch (err) {
    console.error('[media-cache] evict fail:', err.message);
  }
}

router.get(/^\/(.+)$/, async (req, res) => {
  const key = req.params[0];

  // Path traversal — ".." se cache dir ke bahar nikalne ki koshish
  if (!key || key.includes('..')) {
    return res.status(400).send('Invalid key');
  }

  const local = cachePath(key);
  const contentType = storage.mimeFor(key);

  const setHeaders = (source) => {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', `public, max-age=${MAX_AGE_SECONDS}, immutable`);
    res.setHeader('X-Media-Cache', source);
  };

  // 1. Local cache
  try {
    if (fs.existsSync(local)) {
      const stat = fs.statSync(local);
      const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;

      if (req.headers['if-none-match'] === etag) {
        setHeaders('HIT');
        res.setHeader('ETag', etag);
        return res.status(304).end();
      }

      setHeaders('HIT');
      res.setHeader('ETag', etag);
      maybeEvict();
      return fs.createReadStream(local).pipe(res);
    }
  } catch (err) {
    console.error('[media-cache] read fail:', err.message);
  }

  // 2. Origin (S3) se laao aur cache kar lo
  try {
    const object = await storage.getObject(key);
    if (!object) return res.status(404).send('Not found');

    try {
      fs.writeFileSync(local, object.body);
    } catch (err) {
      // Cache write fail ho to bhi image to serve honi chahiye
      console.error('[media-cache] write fail:', err.message);
    }

    setHeaders('MISS');
    if (object.contentType) res.setHeader('Content-Type', object.contentType);
    maybeEvict();
    return res.send(object.body);
  } catch (err) {
    console.error('[media-proxy] fetch fail:', key, err.message);
    return res.status(502).send('Media fetch failed');
  }
});

/** Cache stats — admin System page dikhata hai */
function cacheStats() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let bytes = 0;
    files.forEach((f) => {
      try { bytes += fs.statSync(path.join(CACHE_DIR, f)).size; } catch { /* gone */ }
    });
    return {
      files: files.length,
      size_mb: Number((bytes / 1024 / 1024).toFixed(1)),
      limit_mb: MAX_CACHE_MB,
      dir: CACHE_DIR,
    };
  } catch {
    return { files: 0, size_mb: 0, limit_mb: MAX_CACHE_MB };
  }
}

/** Poora media cache saaf */
function clearCache() {
  let removed = 0;
  try {
    fs.readdirSync(CACHE_DIR).forEach((f) => {
      try { fs.unlinkSync(path.join(CACHE_DIR, f)); removed += 1; } catch { /* gone */ }
    });
  } catch (err) {
    console.error('[media-cache] clear fail:', err.message);
  }
  return { removed };
}

module.exports = router;
module.exports.cacheStats = cacheStats;
module.exports.clearCache = clearCache;
