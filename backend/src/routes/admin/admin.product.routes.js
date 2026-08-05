const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");
const upload = require("../../middleware/upload");

const router = express.Router();
router.use(requireAdmin);

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  shortDescription: z.string().optional(),
  description: z.string(),
  composition: z.string().optional(),
  dosage: z.string().optional(),
  sideEffects: z.string().optional(),
  scheduleClass: z.enum(["NONE", "SCHEDULE_H", "SCHEDULE_H1", "SCHEDULE_X"]).default("NONE"),
  requiresPrescription: z.boolean().default(false),
  brandId: z.string().optional(),
  manufacturerId: z.string().optional(),
  mrp: z.number().positive(),
  sellingPrice: z.number().positive(),
  stockQty: z.number().min(0).default(0),
  categoryIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

// GET /api/admin/products - list all (incl inactive) with pagination + basic search
router.get(
  "/",
  requirePermission("products", "view"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const q = req.query.q;

    const where = {
      deletedAt: null,
      ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        include: { images: { where: { isPrimary: true }, take: 1 }, brand: true },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// POST /api/admin/products - create
router.post(
  "/",
  requirePermission("products", "create"),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const slug = slugify(data.name) + "-" + Math.random().toString(36).slice(2, 6);

    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) throw new ApiError(409, "SKU already exists");

    const { categoryIds, ...productData } = data;

    const product = await prisma.product.create({
      data: {
        ...productData,
        slug,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });

    await prisma.auditLog.create({
      data: { adminId: req.admin.id, action: "CREATE", entityType: "Product", entityId: product.id, newValue: product },
    });

    res.status(201).json({ success: true, product });
  })
);

// PUT /api/admin/products/:id - update
router.put(
  "/:id",
  requirePermission("products", "edit"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Product not found");

    const data = productSchema.partial().parse(req.body);
    const { categoryIds, ...productData } = data;

    const product = await prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.productCategory.deleteMany({ where: { productId: existing.id } });
        await tx.productCategory.createMany({ data: categoryIds.map((categoryId) => ({ productId: existing.id, categoryId })) });
      }
      return tx.product.update({ where: { id: existing.id }, data: productData });
    });

    await prisma.auditLog.create({
      data: { adminId: req.admin.id, action: "UPDATE", entityType: "Product", entityId: product.id, oldValue: existing, newValue: product },
    });

    res.json({ success: true, product });
  })
);

// DELETE /api/admin/products/:id - soft delete
router.delete(
  "/:id",
  requirePermission("products", "delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Product not found");

    await prisma.product.update({ where: { id: existing.id }, data: { deletedAt: new Date(), isActive: false } });
    await prisma.auditLog.create({ data: { adminId: req.admin.id, action: "DELETE", entityType: "Product", entityId: existing.id } });

    res.json({ success: true });
  })
);

// POST /api/admin/products/:id/images - upload + attach image
router.post(
  "/:id/images",
  requirePermission("products", "edit"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Image file required");
    const isPrimary = req.body.isPrimary === "true";

    if (isPrimary) {
      await prisma.productImage.updateMany({ where: { productId: req.params.id }, data: { isPrimary: false } });
    }

    const image = await prisma.productImage.create({
      data: { productId: req.params.id, url: `/uploads/${req.file.filename}`, isPrimary, altText: req.body.altText || null },
    });

    res.status(201).json({ success: true, image });
  })
);

module.exports = router;
