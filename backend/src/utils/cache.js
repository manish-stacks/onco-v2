const redis = require('../config/redis');
const { CACHE_TTL } = require('../config/constants');

/**
 * In-memory fallback cache when Redis is down, disconnected, or local.
 * Prevents hammering MySQL on repeated queries when Redis is unavailable.
 */
const memoryCache = new Map();

function memGet(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

function memSet(key, value, ttlSeconds = CACHE_TTL.MEDIUM) {
  if (memoryCache.size > 2000) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds || 300) * 1000,
  });
}

function memDel(...keys) {
  keys.forEach((k) => memoryCache.delete(k));
}

function memDelByPrefix(prefix) {
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) memoryCache.delete(k);
  }
}

/** Cache-aside: check redis first, then memory fallback, otherwise run fetchFn and store the result */
async function getOrSet(key, ttlSeconds, fetchFn) {
  const ttl = ttlSeconds || CACHE_TTL.MEDIUM;

  // 1. Try memory cache first (0ms)
  const memCached = memGet(key);
  if (memCached !== null) return memCached;

  // 2. Try Redis if connected
  if (redis.isReady()) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        memSet(key, parsed, ttl);
        return parsed;
      }
    } catch (err) {
      // Redis error, continue to fetchFn
    }
  }

  // 3. Fetch fresh data
  const fresh = await fetchFn();

  // 4. Populate memory cache and Redis
  memSet(key, fresh, ttl);
  if (redis.isReady()) {
    try {
      await redis.set(key, JSON.stringify(fresh), 'EX', ttl);
    } catch {
      /* redis write fail — ignored */
    }
  }
  return fresh;
}

async function get(key) {
  const memCached = memGet(key);
  if (memCached !== null) return memCached;

  if (redis.isReady()) {
    try {
      const v = await redis.get(key);
      if (v !== null) {
        const parsed = JSON.parse(v);
        memSet(key, parsed, CACHE_TTL.MEDIUM);
        return parsed;
      }
    } catch { return null; }
  }
  return null;
}

async function set(key, value, ttlSeconds = CACHE_TTL.MEDIUM) {
  memSet(key, value, ttlSeconds);
  if (redis.isReady()) {
    try { await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch (err) {
      console.error('[cache] set fail', key, err.message);
    }
  }
}

async function del(...keys) {
  if (!keys.length) return;
  memDel(...keys);
  if (redis.isReady()) {
    try { await redis.del(...keys); } catch (err) {
      console.error('[cache] del fail', err.message);
    }
  }
}

/** Delete every prefix* key via SCAN — does not use KEYS (prod safe) */
async function delByPrefix(prefix) {
  memDelByPrefix(prefix);
  if (!redis.isReady()) return;
  try {
    const fullPrefix = `${redis.options.keyPrefix || ''}${prefix}`;
    const stream = redis.scanStream({ match: `${fullPrefix}*`, count: 200 });
    const batch = [];
    for await (const keys of stream) {
      keys.forEach((k) => batch.push(k.replace(redis.options.keyPrefix || '', '')));
    }
    if (batch.length) {
      const pipeline = redis.pipeline();
      batch.forEach((k) => pipeline.del(k));
      await pipeline.exec();
    }
  } catch (err) {
    console.error('[cache] delByPrefix fail', prefix, err.message);
  }
}

/** When a product/category changes, clear every list cache that depends on it */
const invalidate = {
  products: () => Promise.all([delByPrefix('products:'), delByPrefix('home:')]),
  categories: () => Promise.all([delByPrefix('categories:'), delByPrefix('products:'), delByPrefix('home:')]),
  brands: () => Promise.all([delByPrefix('brands:'), delByPrefix('home:')]),
  coupons: () => delByPrefix('coupons:'),
  banners: () => Promise.all([delByPrefix('banners:'), delByPrefix('home:')]),
  settings: () => Promise.all([delByPrefix('settings:'), delByPrefix('home:')]),
  orders: () => Promise.all([delByPrefix('admin:dashboard'), delByPrefix('admin:orders:'), delByPrefix('reports:')]),
  cms: () => delByPrefix('cms:'),
  all: () => delByPrefix(''),
};

/** Cache key banane ka consistent tarika — object ko sorted string me */
function buildKey(namespace, params = {}) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sorted ? `${namespace}:${sorted}` : namespace;
}

module.exports = { getOrSet, get, set, del, delByPrefix, invalidate, buildKey, TTL: CACHE_TTL };
