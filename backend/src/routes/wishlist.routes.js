const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.userId },
      include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, items });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.userId, productId } },
      update: {},
      create: { userId: req.userId, productId },
    });
    res.status(201).json({ success: true, item });
  })
);

router.delete(
  "/:productId",
  asyncHandler(async (req, res) => {
    await prisma.wishlistItem.deleteMany({ where: { userId: req.userId, productId: req.params.productId } });
    res.json({ success: true });
  })
);

module.exports = router;
