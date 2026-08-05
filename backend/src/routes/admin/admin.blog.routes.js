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

const blogSchema = z.object({
  title: z.string().min(3),
  excerpt: z.string().optional(),
  content: z.string().min(10),
  coverImage: z.string().optional(),
  isPublished: z.boolean().default(false),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
});

router.get(
  "/",
  requirePermission("blogs", "view"),
  asyncHandler(async (req, res) => {
    const blogs = await prisma.blog.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ success: true, blogs });
  })
);

router.post(
  "/",
  requirePermission("blogs", "create"),
  asyncHandler(async (req, res) => {
    const data = blogSchema.parse(req.body);
    const { categoryIds, tagIds, ...rest } = data;
    const slug = slugify(data.title) + "-" + Math.random().toString(36).slice(2, 6);

    const blog = await prisma.blog.create({
      data: {
        ...rest,
        slug,
        authorId: req.admin.id,
        publishedAt: data.isPublished ? new Date() : null,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    res.status(201).json({ success: true, blog });
  })
);

router.put(
  "/:id",
  requirePermission("blogs", "edit"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Blog not found");

    const data = blogSchema.partial().parse(req.body);
    const { categoryIds, tagIds, ...rest } = data;

    const blog = await prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.blogCategoryMap.deleteMany({ where: { blogId: existing.id } });
        await tx.blogCategoryMap.createMany({ data: categoryIds.map((categoryId) => ({ blogId: existing.id, categoryId })) });
      }
      if (tagIds) {
        await tx.blogTagMap.deleteMany({ where: { blogId: existing.id } });
        await tx.blogTagMap.createMany({ data: tagIds.map((tagId) => ({ blogId: existing.id, tagId })) });
      }
      return tx.blog.update({
        where: { id: existing.id },
        data: { ...rest, ...(rest.isPublished && !existing.publishedAt ? { publishedAt: new Date() } : {}) },
      });
    });

    res.json({ success: true, blog });
  })
);

router.delete(
  "/:id",
  requirePermission("blogs", "delete"),
  asyncHandler(async (req, res) => {
    await prisma.blog.delete({ where: { id: req.params.id } }).catch(() => { throw new ApiError(404, "Blog not found"); });
    res.json({ success: true });
  })
);

// ---------- Blog categories & tags (simple lookups) ----------
router.get(
  "/meta/categories",
  requirePermission("blogs", "view"),
  asyncHandler(async (req, res) => {
    const categories = await prisma.blogCategory.findMany();
    res.json({ success: true, categories });
  })
);
router.post(
  "/meta/categories",
  requirePermission("blogs", "create"),
  asyncHandler(async (req, res) => {
    const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
    const category = await prisma.blogCategory.create({ data: { name, slug: slugify(name) } });
    res.status(201).json({ success: true, category });
  })
);
router.get(
  "/meta/tags",
  requirePermission("blogs", "view"),
  asyncHandler(async (req, res) => {
    const tags = await prisma.blogTag.findMany();
    res.json({ success: true, tags });
  })
);
router.post(
  "/meta/tags",
  requirePermission("blogs", "create"),
  asyncHandler(async (req, res) => {
    const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
    const tag = await prisma.blogTag.create({ data: { name, slug: slugify(name) } });
    res.status(201).json({ success: true, tag });
  })
);

// ---------- Comment moderation ----------
router.get(
  "/comments/pending",
  requirePermission("blogs", "edit"),
  asyncHandler(async (req, res) => {
    const comments = await prisma.blogComment.findMany({
      where: { isApproved: false }, include: { blog: { select: { title: true } }, user: { select: { name: true } } }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, comments });
  })
);
router.patch(
  "/comments/:id/approve",
  requirePermission("blogs", "edit"),
  asyncHandler(async (req, res) => {
    await prisma.blogComment.update({ where: { id: req.params.id }, data: { isApproved: true } });
    res.json({ success: true });
  })
);
router.delete(
  "/comments/:id",
  requirePermission("blogs", "edit"),
  asyncHandler(async (req, res) => {
    await prisma.blogComment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

module.exports = router;
