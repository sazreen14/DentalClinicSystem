import * as authService from "../services/authService.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const clientIp = (request) => request.ip ?? request.socket.remoteAddress ?? "unknown";
const REFRESH_COOKIE = "dental_refresh";
const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax",
  path: "/api/auth",
};

function setRefreshCookie(response, token, expiresAt) {
  response.cookie(REFRESH_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

function requireRefreshCookie(request) {
  const token = request.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError("Authentication session is unavailable.", 401, "REFRESH_COOKIE_REQUIRED");
  return token;
}

export async function registerPatient(request, response) {
  const user = await authService.registerPatient(request.body, clientIp(request));
  response.status(201).json({ status: "success", user });
}

export async function login(request, response) {
  const result = await authService.login(request.body, clientIp(request));
  setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
  response.status(200).json({ status: "success", accessToken: result.accessToken, user: result.user });
}

export async function refresh(request, response) {
  const result = await authService.refresh(requireRefreshCookie(request), clientIp(request));
  setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
  response.status(200).json({ status: "success", accessToken: result.accessToken });
}

export async function logout(request, response) {
  await authService.logout(requireRefreshCookie(request), clientIp(request));
  response.clearCookie(REFRESH_COOKIE, cookieOptions);
  response.status(200).json({ status: "success", message: "Logged out successfully." });
}

export async function logoutAll(request, response) {
  await authService.logoutAll(request.user.id, clientIp(request));
  response.clearCookie(REFRESH_COOKIE, cookieOptions);
  response.status(200).json({ status: "success", message: "All sessions have been signed out." });
}

export async function me(request, response) {
  const user = await authService.getCurrentUser(request.user.id);
  response.status(200).json({ status: "success", user });
}

export async function changePassword(request, response) {
  const result = await authService.changePassword(request.user.id, request.body, clientIp(request));
  response.status(200).json({ status: "success", ...result });
}

export async function forgotPassword(request, response) {
  const result = await authService.forgotPassword(request.body, clientIp(request));
  response.status(200).json({ status: "success", ...result });
}

export async function resetPassword(request, response) {
  const result = await authService.resetPassword(request.body, clientIp(request));
  response.status(200).json({ status: "success", ...result });
}
