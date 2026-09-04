const orderModel = require('../../models/order.model');
const adminModel = require('../../models/admin.model');
const { paginated, asyncHandler } = require('../../utils/response');
const { getPagination, toCsv } = require('../../utils/helpers');

/**
 * GET /admin/payments
 * One row per order with just the payment-reconciliation columns, plus a
 * totals-by-gateway summary — "how much came in via Razorpay vs PayU vs
 * COD vs counter (Cash/UPI/Card/Bank transfer)".
 *
 * query: from_date, to_date, payment_mode (cod|online), payment_gateway,
 *        payment_status, search, page, limit
 */
const list = asyncHandler(async (req, res) => {
  const { from_date, to_date, payment_mode, payment_gateway, payment_status, search } = req.query;
  const { limit, offset, page } = getPagination(req.query);

  const filters = { from_date, to_date, payment_mode, payment_gateway, payment_status, search };

  const [{ rows, total }, summary] = await Promise.all([
    orderModel.paymentsList(filters, { limit, offset }),
    orderModel.paymentsSummary(filters),
  ]);

  return paginated(res, rows, total, page, limit, { summary });
});

/**
 * GET /admin/payments/export — same filters as the list above, no pagination.
 * Plain CSV (opens straight in Excel) rather than a real .xlsx — no extra
 * library needed, and Excel/Sheets both open CSV natively.
 */
const exportCsv = asyncHandler(async (req, res) => {
  const { from_date, to_date, payment_mode, payment_gateway, payment_status, search } = req.query;
  const filters = { from_date, to_date, payment_mode, payment_gateway, payment_status, search };

  const { rows } = await orderModel.paymentsList(filters, { limit: 10000, offset: 0 });

  const csv = toCsv(rows, [
    'order_id', 'databaseOrderID', 'order_date', 'customer_name', 'customer_phone',
    'amount', 'payment_mode', 'payment_gateway', 'payment_status', 'transaction_number',
    'razorpayOrderID', 'orderFrom', 'status',
  ]);

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'export', module: 'payments', description: `${rows.length} rows`, ip_address: req.ip,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
  return res.send(csv);
});

module.exports = { list, exportCsv };
