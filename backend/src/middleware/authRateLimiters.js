import rateLimit from "express-rate-limit";

function limiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { status: "error", code: "RATE_LIMITED", message: "Too many authentication requests. Please try again later." },
  });
}

export const registrationRateLimiter = limiter(10);
export const loginRateLimiter = limiter(20);
export const refreshRateLimiter = limiter(60);
export const forgotPasswordRateLimiter = limiter(5);
export const resetPasswordRateLimiter = limiter(10);
