const settingsModel = require('../models/settings.model');
const cache = require('../utils/cache');

/**
 * Site maintenance mode.
 *
 * Applied ONLY to app.routes.js (the customer-facing web/app API) —
 * admin.routes.js and webhook.routes.js are never touched by this, so the
 * admin panel keeps working (including turning maintenance back OFF), and
 * payment/DTDC webhooks keep updating orders that were already placed.
 *
 * A small allowlist stays open even during maintenance so the frontend can
 * actually render a "we'll be back soon" page (it needs /settings for the
 * message) and existing logged-in customers can still check an order they
 * already placed instead of it just vanishing mid-delivery.
 */
const ALLOWLIST = [
  '/settings',
  '/orders/track',
];

function isAllowed(path) {
  return ALLOWLIST.some((p) => path === p || path.startsWith(`${p}/`));
}

async function maintenanceGate(req, res, next) {
  if (isAllowed(req.path)) return next();

  try {
    const settings = await cache.getOrSet('settings:public:raw', cache.TTL.LONG, () => settingsModel.get());
    if (!settings?.maintenance_mode) return next();

    return res.status(503).json({
      success: false,
      maintenance: true,
      message: settings.maintenance_message
        || 'We are currently doing scheduled maintenance. Please check back shortly.',
    });
  } catch (err) {
    // If we can't even tell whether maintenance is on, fail OPEN — a broken
    // maintenance check must never be the reason the whole site goes down.
    console.error('[maintenance] check failed, allowing request through:', err.message);
    return next();
  }
}

module.exports = { maintenanceGate };
