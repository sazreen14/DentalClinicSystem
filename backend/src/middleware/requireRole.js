import { AppError } from "../utils/AppError.js";

export function requireRole(...roles) {
  const allowed = new Set(roles);
  return (request, _response, next) => {
    if (!request.user) return next(new AppError("Authentication is required.", 401, "AUTHENTICATION_REQUIRED"));
    if (!allowed.has(request.user.role)) return next(new AppError("You do not have permission to perform this action.", 403, "FORBIDDEN"));
    return next();
  };
}
