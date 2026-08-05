const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// GET /api/categories - flat active list (with parent info) for menus/filters
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, imageUrl: true, parentId: true },
    });
    res.json({ success: true, categories });
  })
);

// GET /api/categories/tree - nested tree for mega-menu
router.get(
  "/tree",
  asyncHandler(async (req, res) => {
    const all = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    const byId = new Map(all.map((c) => [c.id, { ...c, children: [] }]));
    const roots = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(c);
      else roots.push(c);
    }
    res.json({ success: true, categories: roots });
  })
);

// GET /api/categories/:slug
router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { slug: req.params.slug } });
    if (!category || !category.isActive) throw new ApiError(404, "Category not found");
    res.json({ success: true, category });
  })
);

module.exports = router;
