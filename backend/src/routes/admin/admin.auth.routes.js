const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { signAdminAccessToken } = require("../../utils/tokens");
const { requireAdmin } = require("../../middleware/adminAuth");

const router = express.Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) throw new ApiError(401, "Invalid credentials");

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) throw new ApiError(401, "Invalid credentials");

    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: "LOGIN", entityType: "Admin", entityId: admin.id, ip: req.ip } });

    const accessToken = signAdminAccessToken(admin);
    res.json({ success: true, accessToken, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  })
);

router.get(
  "/me",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ success: true, admin });
  })
);

module.exports = router;
