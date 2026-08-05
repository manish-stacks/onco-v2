const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../lib/prisma");

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, type: "user" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signAdminAccessToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: admin.role, type: "admin" },
    process.env.JWT_ADMIN_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

async function issueRefreshToken(userId, meta = {}) {
  const token = uuidv4() + "." + uuidv4(); // opaque token stored hashed-free for simplicity; swap for hashed in prod
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent: meta.userAgent || null,
      ip: meta.ip || null,
    },
  });

  return token;
}

async function rotateRefreshToken(oldToken, meta = {}) {
  const existing = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    return null;
  }
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revoked: true } });
  const newToken = await issueRefreshToken(existing.userId, meta);
  return { userId: existing.userId, token: newToken };
}

module.exports = {
  signAccessToken,
  signAdminAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
};
