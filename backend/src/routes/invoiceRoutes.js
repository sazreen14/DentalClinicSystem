import { Router } from "express";
import * as controller from "../controllers/invoiceController.js";
import { authenticateToken } from "../middleware/authenticateToken.js";
import { requireRole } from "../middleware/requireRole.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invoiceIdRules } from "../validators/invoiceValidators.js";

const router = Router();
router.use(authenticateToken, requireRole("Admin", "Doctor", "Patient"));
router.get("/", asyncHandler(controller.list));
router.get("/:invoiceId", invoiceIdRules, validateRequest, asyncHandler(controller.detail));
router.get("/:invoiceId/pdf", invoiceIdRules, validateRequest, asyncHandler(controller.pdf));
export default router;
