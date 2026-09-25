import { env } from "../config/env.js";

export function errorHandler(error, _request, response, _next) {
  const statusCode = error.isOperational ? error.statusCode : 500;
  const code = error.isOperational ? error.code : "INTERNAL_ERROR";
  if (!error.isOperational) console.error("Unhandled request error", error);
  response.status(statusCode).json({
    status: "error",
    code,
    message: error.isOperational ? error.message : "An unexpected error occurred",
    ...(error.isOperational && error.details ? { details: error.details } : {}),
    ...(env.nodeEnv === "development" && error.isOperational ? { stack: error.stack } : {}),
  });
}
