const redis = require('../../config/redis');
const cache = require('../../utils/cache');
const health = require('../../services/health.service');
const mediaMigration = require('../../services/media-migration.service');
const storage = require('../../services/storage.service');
const mediaRoutes = require('../../routes/media.routes');
const adminModel = require('../../models/admin.model');
const { MEDIA_MAP } = require('../../config/media');
const { ok, fail, asyncHandler } = require('../../utils/response');

// ---------------------------------------------------------------------------
// HEALTH
// ---------------------------------------------------------------------------

/** GET /admin/system/health?deep=true */
const getHealth = asyncHandler(async (req, res) => {
  const data = await health.fullHealth({ deep: req.query.deep === 'true' });
  return ok(res, data);
});

// ---------------------------------------------------------------------------
// CACHE
// ---------------------------------------------------------------------------

/** GET /admin/system/cache — kitna cache pada hai */
const cacheStats = asyncHandler(async (req, res) => {
  let redisInfo = { ok: false };
  try {
    const info = await redis.info('memory');
    const used = info.match(/used_memory_human:(\S+)/);
    const peak = info.match(/used_memory_peak_human:(\S+)/);

    // Sirf humare prefix wale keys count karo — DB shared ho sakta hai
    const prefix = redis.options.keyPrefix || '';
    let keys = 0;
    const byNamespace = {};

    const stream = redis.scanStream({ match: `${prefix}*`, count: 500 });
    // eslint-disable-next-line no-restricted-syntax
    for await (const batch of stream) {
      keys += batch.length;
      batch.forEach((k) => {
        const bare = k.replace(prefix, '');
        const ns = bare.split(':')[0] || 'other';
        byNamespace[ns] = (byNamespace[ns] || 0) + 1;
      });
    }

    redisInfo = {
      ok: true,
      keys,
      used_memory: used?.[1] || null,
      peak_memory: peak?.[1] || null,
      prefix,
      by_namespace: Object.entries(byNamespace)
        .map(([namespace, count]) => ({ namespace, count }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (err) {
    redisInfo = { ok: false, error: err.message };
  }

  return ok(res, {
    redis: redisInfo,
    media_cache: mediaRoutes.cacheStats(),
  });
});

/**
 * POST /admin/system/cache/clear
 * body: { scope: 'all' | 'redis' | 'media' | 'products' | 'orders' | ... }
 *
 * Default 'all' — Redis ke saare ohm:* keys + media disk cache dono.
 */
const clearCache = asyncHandler(async (req, res) => {
  const scope = req.body.scope || 'all';
  const result = {};

  const SCOPES = {
    products: cache.invalidate.products,
    categories: cache.invalidate.categories,
    brands: cache.invalidate.brands,
    coupons: cache.invalidate.coupons,
    banners: cache.invalidate.banners,
    settings: cache.invalidate.settings,
    orders: cache.invalidate.orders,
    cms: cache.invalidate.cms,
  };

  if (scope === 'media') {
    result.media = mediaRoutes.clearCache();
  } else if (scope === 'redis' || scope === 'all') {
    // Saare prefixed keys — doosre apps ka data nahi chhuta,
    // isliye FLUSHDB nahi, prefix scan
    await cache.invalidate.all();
    result.redis = { cleared: true };

    if (scope === 'all') {
      result.media = mediaRoutes.clearCache();
    }
  } else if (SCOPES[scope]) {
    await SCOPES[scope]();
    result[scope] = { cleared: true };
  } else {
    return fail(res, `Unknown scope: ${scope}`, 422);
  }

  await adminModel.logActivity({
    admin_id: req.admin.admin_id,
    admin_username: req.admin.admin_username,
    action: 'cache_clear',
    module: 'system',
    description: `scope: ${scope}`,
    ip_address: req.ip,
  });

  return ok(res, result, scope === 'all'
    ? 'Poora cache saaf ho gaya'
    : `${scope} cache saaf ho gaya`);
});

// ---------------------------------------------------------------------------
// MEDIA MIGRATION
// ---------------------------------------------------------------------------

/** Query ya body se tables list — string "a,b" ya array dono chalti hai */
function normalizeTables(value) {
  if (!value) return null;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const clean = arr.map((t) => String(t).trim()).filter(Boolean);

  // Sirf wahi tables jo MEDIA_MAP me hain — koi arbitrary table name na aaye
  const allowed = new Set(MEDIA_MAP.map((m) => m.table));
  const valid = clean.filter((t) => allowed.has(t));
  return valid.length ? valid : null;
}

/**
 * GET /admin/system/media/preview?tables=products,categories&limit=24
 *
 * Migrate karne se pehle dikhane ke liye — kaunsi images jaane wali hain.
 */
const previewMedia = asyncHandler(async (req, res) => {
  const data = await mediaMigration.preview({
    tables: normalizeTables(req.query.tables),
    limit: req.query.limit,
    offset: req.query.offset,
  });
  return ok(res, data);
});

/** GET /admin/system/media/status */
const mediaStatus = asyncHandler(async (req, res) => {
  const [status, cacheInfo] = await Promise.all([
    mediaMigration.status(),
    Promise.resolve(mediaRoutes.cacheStats()),
  ]);

  return ok(res, {
    ...status,
    storage_configured: storage.isS3Enabled(),
    storage_config: storage.isS3Enabled() ? {
      bucket: storage.config().bucket,
      region: storage.config().region,
      cdn: storage.config().cdn || null,
      serve_mode: process.env.MEDIA_SERVE_MODE || 'direct',
    } : null,
    media_cache: cacheInfo,
    tables: MEDIA_MAP.map((m) => ({ table: m.table, columns: m.columns, json: !!m.json })),
    batch_limit: mediaMigration.BATCH_LIMIT,
  });
});

/**
 * POST /admin/system/media/scan
 * DB scan karke kaam ki list banata hai. Chalane me thoda time lagta hai
 * (saari tables padhta hai) lekin ye ek baar ka kaam hai.
 */
const scanMedia = asyncHandler(async (req, res) => {
  if (!storage.isS3Enabled()) {
    return fail(res, 'Pehle S3 configure karo — .env me S3_BUCKET aur keys daalo', 409);
  }

  const result = await mediaMigration.scan({ tables: normalizeTables(req.body.tables) });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'media_scan', module: 'system',
    description: `${result.pending} images queued`, ip_address: req.ip,
  });

  return ok(res, result, `${result.pending} images migrate hone baaki hain`);
});

/**
 * POST /admin/system/media/migrate
 * body: { limit: 50, retry_failed: false }
 *
 * Ek batch process karta hai aur turant return kar deta hai. Admin panel
 * isko baar-baar call karta hai jab tak `done` na aaye — isse har batch ka
 * result dikhta rehta hai aur request timeout nahi hoti.
 */
const migrateMedia = asyncHandler(async (req, res) => {
  if (!storage.isS3Enabled()) {
    return fail(res, 'Pehle S3 configure karo', 409);
  }

  const result = await mediaMigration.runBatch({
    limit: req.body.limit || 50,
    retryFailed: req.body.retry_failed === true,
    dryRun: req.body.dry_run === true,
    tables: normalizeTables(req.body.tables),
  });

  return ok(res, result, result.done
    ? 'Saari images migrate ho gayi'
    : `${result.succeeded} migrate hui, ${result.remaining} baaki`);
});

/** GET /admin/system/media/failed */
const failedMedia = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  const data = await mediaMigration.failedItems({ limit, offset });
  return ok(res, data);
});

/**
 * POST /admin/system/media/repair-urls
 * LEGACY_MEDIA_PATH badla ho to purani queued rows ke URLs theek kar do.
 */
const repairUrls = asyncHandler(async (req, res) => {
  const result = await mediaMigration.repairSourceUrls({
    tables: normalizeTables(req.body.tables),
  });
  return ok(res, result, `${result.fixed} URLs theek kiye (${result.checked} check hue)`);
});

/** POST /admin/system/media/retry-failed */
const retryFailed = asyncHandler(async (req, res) => {
  const result = await mediaMigration.resetFailed();
  return ok(res, result, `${result.reset} items dobara try honge`);
});

/** DELETE /admin/system/media/queue */
const clearQueue = asyncHandler(async (req, res) => {
  const result = await mediaMigration.clearQueue();

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'media_queue_clear', module: 'system',
    description: `${result.cleared} items`, ip_address: req.ip,
  });

  return ok(res, result, 'Migration queue saaf ho gayi');
});

module.exports = {
  getHealth, cacheStats, clearCache,
  mediaStatus, scanMedia, previewMedia, migrateMedia, failedMedia, retryFailed,
  repairUrls, clearQueue,
};