const shipping = require('../../services/shipping.service');
const dtdc = require('../../services/dtdc.service');
const adminModel = require('../../models/admin.model');
const { ok, fail, asyncHandler } = require('../../utils/response');

/** POST /admin/orders/:orderId/ship — DTDC booking */
const bookShipment = asyncHandler(async (req, res) => {
  const { service_type, weight, length, width, height, num_pieces } = req.body;

  const result = await shipping.bookOrder(req.params.orderId, {
    serviceType: service_type,
    weight, length, width, height,
    numPieces: num_pieces,
    bookedBy: req.admin.admin_username,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'ship', module: 'orders', record_id: req.params.orderId,
    description: `DTDC AWB ${result.awb}`, ip_address: req.ip,
  });

  return ok(res, result, `Shipped — AWB ${result.awb}`);
});

/** DELETE /admin/orders/:orderId/ship — booking cancel */
const cancelShipment = asyncHandler(async (req, res) => {
  const result = await shipping.cancelBooking(req.params.orderId, {
    cancelledBy: req.admin.admin_username,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'ship_cancel', module: 'orders', record_id: req.params.orderId,
    description: `AWB ${result.awb}`, ip_address: req.ip,
  });

  return ok(res, result, 'DTDC booking cancelled');
});

/** GET /admin/orders/:orderId/tracking — live DTDC se */
const refreshTracking = asyncHandler(async (req, res) => {
  const tracking = await shipping.refreshTracking(req.params.orderId);
  return ok(res, tracking, 'Tracking updated');
});

/** GET /admin/orders/:orderId/shipments — booking history */
const shipments = asyncHandler(async (req, res) => {
  const rows = await shipping.listShipments(req.params.orderId);
  return ok(res, rows);
});

/**
 * GET /admin/shipments/:awb/label — PDF stream
 * The admin panel opens this in a new tab; both print and download work.
 */
const label = asyncHandler(async (req, res) => {
  const { awb } = req.params;

  if (!awb) {
    return fail(res, 'AWB is required', 422);
  }

  const pdf = await dtdc.fetchLabel(awb);

  if (!pdf || !Buffer.isBuffer(pdf)) {
    return fail(res, 'The DTDC label could not be generated', 502);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="label-${awb}.pdf"`
  );
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Cache-Control', 'no-store');

  return res.send(pdf);
});

/** GET /admin/shipments/:awb/scans */
const scans = asyncHandler(async (req, res) => {
  const rows = await shipping.listScans(req.params.awb);
  return ok(res, rows);
});

/** GET /admin/shipping/config — tell the panel whether DTDC is ready */
const config = asyncHandler(async (req, res) => {
  const c = dtdc.config();
  return ok(res, {
    configured: dtdc.isConfigured(),
    mode: c.mode,
    customer_code: c.customerCode || null,
    service_types: [
      { value: '1', label: 'B2C Priority' },
      { value: '2', label: 'B2C Premium' },
    ],
  });
});

module.exports = {
  bookShipment, cancelShipment, refreshTracking, shipments, label, scans, config,
};
