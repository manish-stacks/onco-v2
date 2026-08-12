const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_PREFIX || 'ohm:',
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
});

let connected = false;
redis.on('connect', () => { connected = true; console.log('[redis] connected'); });
redis.on('error', (err) => { connected = false; console.error('[redis] error:', err.message); });

redis.isReady = () => connected;

module.exports = redis;
