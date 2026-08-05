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

const pageSchema = z.object({
  title: z.string().min(2),
  slug: z.string().optional(),
  content: z.string(),
  isPublished: z.boolean().default(true),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

router.get(
  "/",
  requirePermission("blogs", "view"), // reuse "blogs" module perms for CMS/content; add a "pages" module if you want finer-grained control
  asyncHandler(async (req, res) => {
    const pages = await prisma.cmsPage.findMany({ orderBy: { updatedAt: "desc" } });
    res.json({ success: true, pages });
  })
);

router.post(
  "/",
  requirePermission("blogs", "create"),
  asyncHandler(async (req, res) => {
    const data = pageSchema.parse(req.body);
    const slug = data.slug ? slugify(data.slug) : slugify(data.title);

    const existing = await prisma.cmsPage.findUnique({ where: { slug } });
    if (existing) throw new ApiError(409, "A page with this slug already exists");

    const page = await prisma.cmsPage.create({ data: { ...data, slug } });
    res.status(201).json({ success: true, page });
  })
);

router.put(
  "/:id",
  requirePermission("blogs", "edit"),
  asyncHandler(async (req, res) => {
    const data = pageSchema.partial().parse(req.body);
    const page = await prisma.cmsPage.update({ where: { id: req.params.id }, data });
    res.json({ success: true, page });
  })
);

router.delete(
  "/:id",
  requirePermission("blogs", "delete"),
  asyncHandler(async (req, res) => {
    await prisma.cmsPage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

module.exports = router;
