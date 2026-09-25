import { AppError } from "../utils/AppError.js";

export function notFound(request, _response, next) {
  next(new AppError(`Route ${request.method} ${request.originalUrl} was not found`, 404, "ROUTE_NOT_FOUND"));
}
