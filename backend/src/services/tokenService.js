import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { hashToken } from "../utils/authSecurity.js";

export function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), userId: user.user_id, role: user.role },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn },
  );
}

export function createRefreshToken(user) {
  const token = jwt.sign(
    { sub: String(user.id), jti: randomUUID() },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn },
  );
  const decoded = jwt.decode(token);
  return { raw: token, hash: hashToken(token), expiresAt: new Date(decoded.exp * 1000) };
}-[]

export function createTokenPair(user) {
  const refresh = createRefreshToken(user);
  return { accessToken: createAccessToken(user), refreshToken: refresh.raw, refresh };
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, { algorithms: ["HS256"] });
    if (!Number.isSafeInteger(Number(payload.sub)) || Number(payload.sub) < 1 || !payload.userId || !["Patient", "Doctor", "Admin"].includes(payload.role)) throw new Error("Invalid identity claims");
    return payload;
  } catch {
    throw new AppError("Invalid or expired access token.", 401, "INVALID_ACCESS_TOKEN");
  }
}

export function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret, { algorithms: ["HS256"] });
    if (!Number.isSafeInteger(Number(payload.sub)) || Number(payload.sub) < 1 || !payload.jti) throw new Error("Invalid identity claims");
    return payload;
  } catch {
    throw new AppError("Invalid or expired refresh token.", 401, "INVALID_REFRESH_TOKEN");
  }
}
