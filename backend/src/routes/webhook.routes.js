const express = require('express');

const router = express.Router();
const shipping = require('../services/shipping.service');

/**
 * Public webhooks — hit directly by the courier/gateway, no JWT.
 *
 * Put this URL in the DTDC dashboard:
 *   https://api.oncohealthmart.com/api/webhooks/dtdc
 */
router.post('/dtdc', async (req, res) => {
  try {
    console.log('[webhook:dtdc]', JSON.stringify(req.body).slice(0, 500));
    const result = await shipping.handleWebhook(req.body);
    return res.status(200).json({ status: 'received', ...result });
  } catch (err) {
    // Always return 200 — otherwise DTDC will hammer retries because of our bug.
    // Investigate manually by reading the log.
    console.error('[webhook:dtdc] error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
