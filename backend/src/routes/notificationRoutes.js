import { Router } from "express";
import { param } from "express-validator";
import * as controller from "../controllers/notificationController.js";
import { authenticateToken } from "../middleware/authenticateToken.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(authenticateToken);
router.get("/", asyncHandler(controller.getNotifications));
router.post("/read-all", asyncHandler(controller.markAllAsRead));
router.post(
  "/:notificationId/read",
  param("notificationId").trim().matches(/^NTF-[A-Z0-9]{20}$/),
  validateRequest,
  asyncHandler(controller.markAsRead),
);

export default router;
