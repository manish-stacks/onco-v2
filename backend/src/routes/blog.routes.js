const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/blog - list published posts, filter by category/tag slug
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 12);
    const where = {
      isPublished: true,
      ...(req.query.category ? { categories: { some: { category: { slug: req.query.category } } } } : {}),
      ...(req.query.tag ? { tags: { some: { tag: { slug: req.query.tag } } } } : {}),
    };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * limit, take: limit,
        select: { id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true },
      }),
      prisma.blog.count({ where }),
    ]);

    res.json({ success: true, blogs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.blogCategory.findMany();
    res.json({ success: true, categories });
  })
);

// GET /api/blog/:slug
router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const blog = await prisma.blog.findUnique({
      where: { slug: req.params.slug },
      include: {
        author: { select: { name: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        comments: { where: { isApproved: true, parentId: null }, include: { user: { select: { name: true } }, replies: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!blog || !blog.isPublished) throw new ApiError(404, "Blog post not found");
    res.json({ success: true, blog });
  })
);

// POST /api/blog/:id/comments - goes to isApproved:false pending moderation
router.post(
  "/:id/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { comment, parentId } = z.object({ comment: z.string().min(2), parentId: z.string().optional() }).parse(req.body);
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) throw new ApiError(404, "Blog post not found");

    const created = await prisma.blogComment.create({ data: { blogId: blog.id, userId: req.userId, comment, parentId } });
    res.status(201).json({ success: true, comment: created, message: "Comment submitted, pending approval" });
  })
);

module.exports = router;
