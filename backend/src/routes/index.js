const express = require('express');

const router = express.Router();

router.use('/admin', require('./admin.routes'));
router.use('/app', require('./app.routes')); // website + mobile app dono
router.use('/webhooks', require('./webhook.routes')); // DTDC wagairah — public

router.get('/health', async (req, res) => {
  const db = require('../config/db');
  const redis = require('../config/redis');

  const health = { api: 'up', db: 'unknown', redis: 'unknown' };
  try { await db.query('SELECT 1'); health.db = 'up'; } catch { health.db = 'down'; }
  try { await redis.ping(); health.redis = 'up'; } catch { health.redis = 'down'; }

  const allUp = Object.values(health).every((v) => v === 'up');
  return res.status(allUp ? 200 : 503).json({ success: allUp, message: 'health check', data: health });
});

module.exports = router;
