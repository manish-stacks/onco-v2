const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const addressSchema = z.object({
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  fullName: z.string().min(2),
  phone: z.string().min(10),
  line1: z.string().min(3),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string(),
  state: z.string(),
  pincode: z.string().length(6),
  isDefault: z.boolean().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({ where: { userId: req.userId }, orderBy: { isDefault: "desc" } });
    res.json({ success: true, addresses });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = addressSchema.parse(req.body);

    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.userId }, data: { isDefault: false } });
    }

    const address = await prisma.address.create({ data: { ...data, userId: req.userId } });
    res.status(201).json({ success: true, address });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) throw new ApiError(404, "Address not found");

    const data = addressSchema.partial().parse(req.body);
    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.userId }, data: { isDefault: false } });
    }

    const address = await prisma.address.update({ where: { id: existing.id }, data });
    res.json({ success: true, address });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) throw new ApiError(404, "Address not found");
    await prisma.address.delete({ where: { id: existing.id } });
    res.json({ success: true });
  })
);

module.exports = router;
