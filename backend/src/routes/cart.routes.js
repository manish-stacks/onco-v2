const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function calcTotals(items) {
  let subtotal = 0;
  for (const item of items) {
    const price = item.variant ? Number(item.variant.sellingPrice) : Number(item.product.sellingPrice);
    subtotal += price * item.qty;
  }
  return { subtotal, itemCount: items.reduce((s, i) => s + i.qty, 0) };
}

// GET /api/cart
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
        variant: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, items, totals: calcTotals(items) });
  })
);

// POST /api/cart - add item
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const schema = z.object({ productId: z.string(), variantId: z.string().optional(), qty: z.number().min(1).default(1) });
    const { productId, variantId, qty } = schema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw new ApiError(404, "Product not available");

    if (product.isTrackInventory && product.stockQty < qty) {
      throw new ApiError(400, "Insufficient stock");
    }

    const item = await prisma.cartItem.upsert({
      where: { userId_productId_variantId: { userId: req.userId, productId, variantId: variantId || null } },
      update: { qty: { increment: qty } },
      create: { userId: req.userId, productId, variantId, qty },
    });

    res.status(201).json({ success: true, item });
  })
);

// PATCH /api/cart/:itemId - update qty
router.patch(
  "/:itemId",
  asyncHandler(async (req, res) => {
    const schema = z.object({ qty: z.number().min(1) });
    const { qty } = schema.parse(req.body);

    const item = await prisma.cartItem.findFirst({ where: { id: req.params.itemId, userId: req.userId } });
    if (!item) throw new ApiError(404, "Cart item not found");

    const updated = await prisma.cartItem.update({ where: { id: item.id }, data: { qty } });
    res.json({ success: true, item: updated });
  })
);

// DELETE /api/cart/:itemId
router.delete(
  "/:itemId",
  asyncHandler(async (req, res) => {
    const item = await prisma.cartItem.findFirst({ where: { id: req.params.itemId, userId: req.userId } });
    if (!item) throw new ApiError(404, "Cart item not found");
    await prisma.cartItem.delete({ where: { id: item.id } });
    res.json({ success: true });
  })
);

// DELETE /api/cart - clear
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { userId: req.userId } });
    res.json({ success: true });
  })
);

module.exports = router;
