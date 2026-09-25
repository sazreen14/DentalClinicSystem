import { validationResult } from "express-validator";
import { AppError } from "../utils/AppError.js";

export function validateRequest(request, _response, next) {
  const errors = validationResult(request);
  if (errors.isEmpty()) return next();
  const error = new AppError("The request contains invalid fields.", 422, "VALIDATION_ERROR");
  error.details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
  return next(error);
}
