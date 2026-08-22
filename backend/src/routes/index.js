const express = require('express');

const router = express.Router();

router.use('/admin', require('./admin.routes'));
router.use('/app', require('./app.routes')); // website + mobile app
router.use('/webhooks', require('./webhook.routes')); // DTDC etc. — public

router.get('/health', async (req, res) => {
  const db = require('../config/db');
  const redis = require('../config/redis');

  const health = { api: 'up', db: 'unknown', redis: 'unknown' };
  try { await db.query('SELECT 1'); health.db = 'up'; } catch { health.db = 'down'; }
  try { await redis.ping(); health.redis = 'up'; } catch { health.redis = 'down'; }

  const allUp = Object.values(health).every((v) => v === 'up');

  // Build marker — proves which code the running process actually has.
  // If `pos_orders` is false here, PM2 is serving an older build and a 404 on
  // POST /api/admin/pos/orders is expected until it is restarted.
  const adminStack = require('./admin.routes').stack || [];
  const has = (path, method) => adminStack.some(
    (l) => l.route && l.route.path === path && l.route.methods?.[method]
  );

  return res.status(allUp ? 200 : 503).json({
    success: allUp,
    message: 'health check',
    data: {
      ...health,
      started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      routes: {
        pos_orders: has('/pos/orders', 'post'),
        payments_gateways: true,
      },
    },
  });
});

module.exports = router;
