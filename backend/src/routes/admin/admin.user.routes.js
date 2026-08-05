const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);

router.get(
  "/",
  requirePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const q = req.query.q;
    const where = q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, email: true, isBlocked: true, rewardPoints: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/:id",
  requirePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { orders: { orderBy: { createdAt: "desc" }, take: 10 }, addresses: true },
    });
    if (!user) throw new ApiError(404, "User not found");
    res.json({ success: true, user });
  })
);

router.patch(
  "/:id/block",
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const { isBlocked } = z.object({ isBlocked: z.boolean() }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isBlocked } });
    res.json({ success: true, user });
  })
);

// POST /api/admin/users/:id/wallet-adjust - manual credit/debit (refunds, goodwill credit, etc.)
router.post(
  "/:id/wallet-adjust",
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ amount: z.number(), reason: z.string().min(2) });
    const { amount, reason } = schema.parse(req.body);
    if (amount === 0) throw new ApiError(400, "Amount cannot be zero");

    const last = await prisma.walletTransaction.findFirst({ where: { userId: req.params.id }, orderBy: { createdAt: "desc" } });
    const currentBalance = Number(last?.balanceAfter || 0);
    const newBalance = currentBalance + amount;
    if (newBalance < 0) throw new ApiError(400, "Insufficient wallet balance for this debit");

    const txn = await prisma.walletTransaction.create({
      data: { userId: req.params.id, type: amount > 0 ? "CREDIT" : "DEBIT", amount: Math.abs(amount), balanceAfter: newBalance, reason },
    });
    res.status(201).json({ success: true, transaction: txn });
  })
);

module.exports = router;
