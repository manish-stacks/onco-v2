const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/products - list with search, category/brand filters, price range, sort, pagination
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      q: z.string().optional(),
      category: z.string().optional(), // slug
      brand: z.string().optional(), // slug
      minPrice: z.coerce.number().optional(),
      maxPrice: z.coerce.number().optional(),
      minRating: z.coerce.number().optional(),
      sort: z.enum(["relevance", "price_asc", "price_desc", "rating", "newest", "popularity"]).default("relevance"),
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(60).default(24),
      featured: z.coerce.boolean().optional(),
      bestSeller: z.coerce.boolean().optional(),
      newArrival: z.coerce.boolean().optional(),
      flashDeal: z.coerce.boolean().optional(),
    });
    const f = schema.parse(req.query);

    const where = {
      isActive: true,
      deletedAt: null,
      ...(f.q ? { OR: [{ name: { contains: f.q } }, { shortDescription: { contains: f.q } }, { sku: { contains: f.q } }] } : {}),
      ...(f.category ? { categories: { some: { category: { slug: f.category } } } } : {}),
      ...(f.brand ? { brand: { slug: f.brand } } : {}),
      ...(f.minPrice || f.maxPrice
        ? { sellingPrice: { ...(f.minPrice ? { gte: f.minPrice } : {}), ...(f.maxPrice ? { lte: f.maxPrice } : {}) } }
        : {}),
      ...(f.minRating ? { avgRating: { gte: f.minRating } } : {}),
      ...(f.featured ? { isFeatured: true } : {}),
      ...(f.bestSeller ? { isBestSeller: true } : {}),
      ...(f.newArrival ? { isNewArrival: true } : {}),
      ...(f.flashDeal ? { isFlashDeal: true, flashDealEndsAt: { gt: new Date() } } : {}),
    };

    const orderBy =
      f.sort === "price_asc" ? { sellingPrice: "asc" } :
      f.sort === "price_desc" ? { sellingPrice: "desc" } :
      f.sort === "rating" ? { avgRating: "desc" } :
      f.sort === "newest" ? { createdAt: "desc" } :
      f.sort === "popularity" ? { soldCount: "desc" } :
      { createdAt: "desc" }; // relevance fallback

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (f.page - 1) * f.limit,
        take: f.limit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          brand: { select: { name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      products: items,
      pagination: { page: f.page, limit: f.limit, total, totalPages: Math.ceil(total / f.limit) },
    });
  })
);

// GET /api/products/me/recently-viewed
// NOTE: must be declared before "/:slug" so "me" isn't swallowed as a slug param
router.get(
  "/me/recently-viewed",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await prisma.recentlyViewed.findMany({
      where: { userId: req.userId },
      orderBy: { viewedAt: "desc" },
      take: 12,
      include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
    });
    res.json({ success: true, items: items.map((i) => i.product) });
  })
);

// GET /api/products/:slug - full detail
router.get(
  "/:slug",

  optionalAuth,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        videos: true,
        documents: true,
        brand: true,
        manufacturer: true,
        categories: { include: { category: true } },
        variants: { where: { isActive: true }, include: { attributeValues: { include: { attributeValue: { include: { attribute: true } } } } } },
        attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
        faqs: { orderBy: { sortOrder: "asc" } },
        reviews: { where: { isApproved: true }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
        relatedTo: { include: { relatedProduct: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        fbtTo: { include: { pairProduct: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
      },
    });
    if (!product || !product.isActive || product.deletedAt) throw new ApiError(404, "Product not found");

    // fire-and-forget view count + recently viewed
    prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    if (req.userId) {
      prisma.recentlyViewed
        .upsert({
          where: { userId_productId: { userId: req.userId, productId: product.id } },
          update: { viewedAt: new Date() },
          create: { userId: req.userId, productId: product.id },
        })
        .catch(() => {});
    }

    res.json({ success: true, product });
  })
);

// POST /api/products/:id/reviews - submit a review (goes to isApproved:false until admin approves)
router.post(
  "/:id/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ rating: z.number().min(1).max(5), title: z.string().optional(), comment: z.string().optional() });
    const { rating, title, comment } = schema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new ApiError(404, "Product not found");

    // verified purchase check
    const hasOrdered = await prisma.orderItem.findFirst({
      where: { productId: product.id, order: { userId: req.userId, status: "DELIVERED" } },
    });

    const review = await prisma.review.create({
      data: { productId: product.id, userId: req.userId, rating, title, comment, isVerified: !!hasOrdered },
    });

    res.status(201).json({ success: true, review, message: "Review submitted, pending approval" });
  })
);

module.exports = router;
