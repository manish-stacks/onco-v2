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
 */
const BASE_INTERVAL_MS = parseInt(process.env.DTDC_POLL_INTERVAL_MINUTES, 10) * 60 * 1000 || 30 * 60 * 1000;
// If DTDC_TRACKING_TOKEN is expired or DTDC's API is down, retrying every
// 30 minutes forever is exactly the "faltu hits" problem — back off hard
// instead: 30m → 2h → 6h → cap at 12h between attempts until something
// actually succeeds again.
const BACKOFF_STEPS_MS = [BASE_INTERVAL_MS, 2 * 60 * 60 * 1000, 6 * 60 * 60 * 1000, 12 * 60 * 60 * 1000];

let consecutiveBrokenCycles = 0;

async function pollActiveShipments() {
  let rows = [];
  try {
    rows = await orderModel.findActiveDtdcShipments();
  } catch (err) {
    console.error('[dtdc-poll] could not scan for active shipments:', err.message);
    return { systemicFailure: false };
  }

  // If DTDC's tracking token has expired (or their API is down), EVERY order
  // fails the same way — hammering all of them and logging each one is just
  // noise. After a run of consecutive failures, assume it's a systemic issue
  // (not a bad AWB on one order) and stop this cycle early.
  const CONSECUTIVE_FAILURE_LIMIT = 5;
  let consecutiveFailures = 0;
  let checked = 0;
  let systemicFailure = false;

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
        systemicFailure = true;
        console.error(
          `[dtdc-poll] ${consecutiveFailures} failures in a row — likely DTDC_TRACKING_TOKEN expired ` +
          `or DTDC's tracking API is down, not a per-order issue. Stopping this cycle early ` +
          `(${rows.length - checked - consecutiveFailures} order(s) skipped).`
        );
        break;
      }
    }
  }
  if (checked) console.log(`[dtdc-poll] checked ${checked} active DTDC shipment(s)`);
  return { systemicFailure };
}

let timer = null;

async function runAndReschedule() {
  const { systemicFailure } = await pollActiveShipments();

  if (systemicFailure) {
    consecutiveBrokenCycles++;
  } else {
    if (consecutiveBrokenCycles > 0) console.log('[dtdc-poll] tracking calls are succeeding again — back to the normal interval.');
    consecutiveBrokenCycles = 0;
  }

  const stepIndex = Math.min(consecutiveBrokenCycles, BACKOFF_STEPS_MS.length - 1);
  const nextDelay = BACKOFF_STEPS_MS[stepIndex];
  if (consecutiveBrokenCycles > 0) {
    console.log(`[dtdc-poll] backing off — next attempt in ${Math.round(nextDelay / 60000)}m (fix DTDC_TRACKING_TOKEN / check DTDC's API to recover sooner).`);
  }

  timer = setTimeout(runAndReschedule, nextDelay);
  if (timer.unref) timer.unref();
}

/** Call once from server startup. */
function startDtdcPoll() {
  setTimeout(() => { runAndReschedule(); }, 90 * 1000);
  console.log(`[dtdc-poll] DTDC auto-tracking poll scheduled (every ${BASE_INTERVAL_MS / 60000}m, backs off on repeated failure)`);
}

function stopDtdcPoll() {
  if (timer) clearTimeout(timer);
}

module.exports = { startDtdcPoll, stopDtdcPoll, pollActiveShipments };
