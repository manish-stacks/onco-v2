const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/wallet - balance derived from latest transaction's balanceAfter + full history
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: req.userId }, orderBy: { createdAt: "desc" },
    });
    const balance = transactions[0]?.balanceAfter || 0;
    res.json({ success: true, balance, transactions });
  })
);

module.exports = router;
