const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// GET /api/pages/:slug - e.g. about, contact, privacy-policy, return-policy, terms
router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const page = await prisma.cmsPage.findUnique({ where: { slug: req.params.slug } });
    if (!page || !page.isPublished) throw new ApiError(404, "Page not found");
    res.json({ success: true, page });
  })
);

module.exports = router;
