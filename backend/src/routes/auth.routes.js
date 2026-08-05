const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { signAccessToken, issueRefreshToken, rotateRefreshToken } = require("../utils/tokens");
const { sendTemplatedSms, generateOtp } = require("../utils/notify");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number");

// ---------- Request OTP (used for both login & registration) ----------
router.post(
  "/otp/request",
  asyncHandler(async (req, res) => {
    const schema = z.object({ phone: phoneSchema, purpose: z.enum(["LOGIN", "REGISTER", "RESET_PASSWORD"]) });
    const { phone, purpose } = schema.parse(req.body);

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    await prisma.otpVerification.create({
      data: { phone, otpHash, purpose, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });

    await sendTemplatedSms(phone, "OTP", { otp }, "Your Onco Health Mart OTP is {{otp}}. Valid for 5 minutes.");

    res.json({ success: true, message: "OTP sent" });
  })
);

// ---------- Verify OTP -> login or auto-register ----------
router.post(
  "/otp/verify",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      phone: phoneSchema,
      otp: z.string().length(6),
      purpose: z.enum(["LOGIN", "REGISTER"]),
      name: z.string().min(2).optional(),
      referredByCode: z.string().optional(),
    });
    const { phone, otp, purpose, name, referredByCode } = schema.parse(req.body);

    const record = await prisma.otpVerification.findFirst({
      where: { phone, purpose, consumed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!record) throw new ApiError(400, "No OTP request found. Please request a new OTP.");
    if (record.expiresAt < new Date()) throw new ApiError(400, "OTP expired");
    if (record.attempts >= 5) throw new ApiError(429, "Too many attempts. Request a new OTP.");

    const valid = await bcrypt.compare(otp, record.otpHash);
    if (!valid) {
      await prisma.otpVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new ApiError(400, "Incorrect OTP");
    }

    await prisma.otpVerification.update({ where: { id: record.id }, data: { consumed: true } });

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      let referredById = null;
      if (referredByCode) {
        const referrer = await prisma.user.findUnique({ where: { referralCode: referredByCode.toUpperCase() } });
        if (referrer) referredById = referrer.id;
      }

      user = await prisma.user.create({
        data: {
          phone,
          name: name || "New User",
          phoneVerifiedAt: new Date(),
          referredById,
          referralCode: phone.slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
        },
      });
    } else if (!user.phoneVerifiedAt) {
      user = await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    });
  })
);

// ---------- Email + password register ----------
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      phone: phoneSchema,
      email: z.string().email().optional(),
      password: z.string().min(6),
      referredByCode: z.string().optional(),
    });
    const { name, phone, email, password, referredByCode } = schema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ApiError(409, "Phone number already registered");

    let referredById = null;
    if (referredByCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: referredByCode.toUpperCase() } });
      if (referrer) referredById = referrer.id; // silently ignore invalid/unknown codes rather than blocking signup
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email,
        password: hashed,
        referredById,
        referralCode: phone.slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
      },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, { userAgent: req.headers["user-agent"], ip: req.ip });

    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    });
  })
);

// ---------- Email/phone + password login ----------
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const schema = z.object({ identifier: z.string(), password: z.string() });
    const { identifier, password } = schema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
    });
    if (!user || !user.password) throw new ApiError(401, "Invalid credentials");
    if (user.isBlocked) throw new ApiError(403, "Account blocked. Contact support.");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new ApiError(401, "Invalid credentials");

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, { userAgent: req.headers["user-agent"], ip: req.ip });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    });
  })
);

// ---------- Refresh access token ----------
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const schema = z.object({ refreshToken: z.string() });
    const { refreshToken } = schema.parse(req.body);

    const rotated = await rotateRefreshToken(refreshToken, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    if (!rotated) throw new ApiError(401, "Invalid or expired refresh token");

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.isBlocked) throw new ApiError(401, "Invalid session");

    const accessToken = signAccessToken(user);
    res.json({ success: true, accessToken, refreshToken: rotated.token });
  })
);

// ---------- Logout (revoke refresh token) ----------
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const schema = z.object({ refreshToken: z.string() });
    const { refreshToken } = schema.parse(req.body);
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } });
    res.json({ success: true });
  })
);

// ---------- Current user ----------
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        rewardPoints: true, referralCode: true, createdAt: true,
      },
    });
    if (!user) throw new ApiError(404, "User not found");
    res.json({ success: true, user });
  })
);

module.exports = router;
