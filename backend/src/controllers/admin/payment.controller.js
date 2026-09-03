const orderModel = require('../../models/order.model');
const { paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

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

module.exports = { list };
