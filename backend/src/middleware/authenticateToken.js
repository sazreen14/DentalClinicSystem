import { db } from "../config/database.js";
import { findUserById } from "../models/authModel.js";
import { verifyAccessToken } from "../services/tokenService.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticateToken = asyncHandler(async (request, _response, next) => {
  const authorization = request.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AppError("Authentication is required.", 401, "AUTHENTICATION_REQUIRED");
  const payload = verifyAccessToken(match[1]);
  const user = await findUserById(db, Number(payload.sub));
  if (!user || user.account_status !== "Active" || user.user_id !== payload.userId || user.role !== payload.role) throw new AppError("Invalid or expired access token.", 401, "INVALID_ACCESS_TOKEN");
  request.user = { id: user.id, userId: user.user_id, role: user.role };
  next();
});
