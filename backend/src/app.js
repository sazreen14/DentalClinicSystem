import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import apiRoutes from "./routes/index.js";

const app = express();
if (env.nodeEnv === "production") {
  app.set("trust proxy", "127.0.0.1");
}
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.frontendOrigin, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use("/api", (request, response, next) => {
  if (request.path.startsWith("/public/profile-photos/") || (!request.path.startsWith("/public/") && request.path !== "/health")) response.set("Cache-Control", "no-store, private");
  next();
});
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }), apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
