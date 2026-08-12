const express = require('express');

const router = express.Router();
const shipping = require('../services/shipping.service');

/**
 * Public webhooks — courier/gateway seedha hit karte hain, koi JWT nahi.
 *
 * DTDC dashboard me ye URL daalo:
 *   https://api.oncohealthmart.com/api/webhooks/dtdc
 */
router.post('/dtdc', async (req, res) => {
  try {
    console.log('[webhook:dtdc]', JSON.stringify(req.body).slice(0, 500));
    const result = await shipping.handleWebhook(req.body);
    return res.status(200).json({ status: 'received', ...result });
  } catch (err) {
    // 200 hi bhejo — warna DTDC hamari bug pe retries hammer karega.
    // Log dekh ke manually investigate karna.
    console.error('[webhook:dtdc] error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
