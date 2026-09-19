const orderModel = require('../models/order.model');
const orderService = require('./order.service');

/**
 * Auto-cancel of stale "Pending" orders.
 *
 * A "Pending" order is one whose payment/confirmation step was never
 * finished (user closed the Razorpay popup, left mid-checkout, etc). Left
 * alone forever it keeps stock reserved for nothing, so anything still
 * Pending after ORDER_AUTO_CANCEL_MINUTES (default 60) is cancelled the
 * same way an admin cancel would — stock restored, coupon use released,
 * refunded if it was somehow already paid.
 *
 * Runs once shortly after boot, then on a fixed interval. No cron
 * dependency — same plain-interval pattern as cleanup.service.js.
 */
const AUTO_CANCEL_MINUTES = parseInt(process.env.ORDER_AUTO_CANCEL_MINUTES, 10) || 60;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // scan every 15 minutes

async function autoCancelStalePending() {
  // Self-heal first: a "Pending" order whose payment already succeeded must
  // never be auto-cancelled/refunded — push it forward instead. See
  // findStuckPaidPending()'s comment for why this can happen at all.
  try {
    const stuckPaid = await orderModel.findStuckPaidPending();
    for (const { order_id } of stuckPaid) {
      try {
        await orderModel.updateStatus(order_id, 'New', 'system:auto-heal', 'Payment was already successful — auto-recovered from a stuck Pending status');
        console.log(`[auto-cancel] order #${order_id} was Pending but already Paid — moved to New instead of cancelling`);
      } catch (err) {
        console.error(`[auto-cancel] could not auto-heal paid order #${order_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[auto-cancel] could not scan for stuck paid-pending orders:', err.message);
  }

  let stale = [];
  try {
    stale = await orderModel.findStalePending(AUTO_CANCEL_MINUTES);
  } catch (err) {
    console.error('[auto-cancel] could not scan for stale pending orders:', err.message);
    return;
  }

  for (const { order_id } of stale) {
    try {
      await orderService.cancelOrder(order_id, {
        changedBy: 'system:auto-cancel',
        reason: `Auto-cancelled — stayed 'Pending' for over ${AUTO_CANCEL_MINUTES} minute(s)`,
      });
      console.log(`[auto-cancel] order #${order_id} auto-cancelled (stale Pending)`);
    } catch (err) {
      // One bad order should never stop the rest of the batch.
      console.error(`[auto-cancel] order #${order_id} failed:`, err.message);
    }
  }
}

let timer = null;

/** Call once from server startup. */
function startAutoCancel() {
  setTimeout(() => { autoCancelStalePending(); }, 60 * 1000);
  timer = setInterval(autoCancelStalePending, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref(); // don't keep the process alive just for this
  console.log(
    `[auto-cancel] pending-order auto-cancel scheduled (every ${CHECK_INTERVAL_MS / 60000}m, threshold ${AUTO_CANCEL_MINUTES}m)`
  );
}

function stopAutoCancel() {
  if (timer) clearInterval(timer);
}

module.exports = { startAutoCancel, stopAutoCancel, autoCancelStalePending };
