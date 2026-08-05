const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

router.get(
  "/",
  requirePermission("categories", "view"),
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    res.json({ success: true, categories });
  })
);

router.post(
  "/",
  requirePermission("categories", "create"),
  asyncHandler(async (req, res) => {
    const data = categorySchema.parse(req.body);
    const slug = slugify(data.name);

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ApiError(409, "A category with this name already exists");

    const category = await prisma.category.create({ data: { ...data, slug } });
    res.status(201).json({ success: true, category });
  })
);

router.put(
  "/:id",
  requirePermission("categories", "edit"),
  asyncHandler(async (req, res) => {
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ success: true, category });
  })
);

router.delete(
  "/:id",
  requirePermission("categories", "delete"),
  asyncHandler(async (req, res) => {
    const inUse = await prisma.productCategory.findFirst({ where: { categoryId: req.params.id } });
    if (inUse) throw new ApiError(400, "Cannot delete: category has products. Reassign products first.");
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

module.exports = router;
