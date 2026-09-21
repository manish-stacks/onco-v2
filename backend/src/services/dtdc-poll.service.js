const orderModel = require('../models/order.model');
const shipping = require('./shipping.service');

/**
 * DTDC auto-tracking poll.
 *
 * The `/api/webhooks/dtdc` route (webhook.routes.js) already updates the
 * order status + sends the customer a message the moment DTDC pushes a scan
 * — but DTDC only pushes to that URL if their integration team has switched
 * push-callbacks ON for this customer code (NL6143). Until that's confirmed
 * with DTDC support, this poller is the fallback: it periodically pulls
 * live tracking for every order that's still out for delivery and runs the
 * exact same update-status + notify-customer logic
 * (shipping.refreshTracking → notify.orderStatusChanged), so "Completed" +
 * the delivery message still happen automatically either way.
 *
 * Safe to leave running even after DTDC's push webhook is confirmed working
 * — refreshTracking() only acts when the status actually changed, so it's a
 * harmless no-op most of the time.
 *
 * Runs once shortly after boot, then on a fixed interval. Same plain-interval
 * pattern as cleanup.service.js / order-autocancel.service.js — no cron dep.
 */
const CHECK_INTERVAL_MS = parseInt(process.env.DTDC_POLL_INTERVAL_MINUTES, 10) * 60 * 1000 || 30 * 60 * 1000;

async function pollActiveShipments() {
  let rows = [];
  try {
    rows = await orderModel.findActiveDtdcShipments();
  } catch (err) {
    console.error('[dtdc-poll] could not scan for active shipments:', err.message);
    return;
  }

  // If DTDC's tracking token has expired (or their API is down), EVERY order
  // fails the same way — hammering all of them and logging each one is just
  // noise. After a run of consecutive failures, assume it's a systemic issue
  // (not a bad AWB on one order) and stop this cycle early; the next cycle
  // will pick up where this left off.
  const CONSECUTIVE_FAILURE_LIMIT = 5;
  let consecutiveFailures = 0;
  let checked = 0;

  for (const { order_id } of rows) {
    try {
      await shipping.refreshTracking(order_id);
      consecutiveFailures = 0;
      checked++;
    } catch (err) {
      // A courier-side hiccup on one AWB must never stop the rest of the batch.
      console.error(`[dtdc-poll] order #${order_id} tracking refresh failed:`, err.message);
      consecutiveFailures++;
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
        console.error(
          `[dtdc-poll] ${consecutiveFailures} failures in a row — likely DTDC_TRACKING_TOKEN expired ` +
          `or DTDC's tracking API is down, not a per-order issue. Stopping this cycle early ` +
          `(${rows.length - checked - consecutiveFailures} order(s) skipped) — will retry next cycle.`
        );
        break;
      }
    }
  }
  if (checked) console.log(`[dtdc-poll] checked ${checked} active DTDC shipment(s)`);
}

let timer = null;

/** Call once from server startup. */
function startDtdcPoll() {
  setTimeout(() => { pollActiveShipments(); }, 90 * 1000);
  timer = setInterval(pollActiveShipments, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
  console.log(`[dtdc-poll] DTDC auto-tracking poll scheduled (every ${CHECK_INTERVAL_MS / 60000}m)`);
}

function stopDtdcPoll() {
  if (timer) clearInterval(timer);
}

module.exports = { startDtdcPoll, stopDtdcPoll, pollActiveShipments };
