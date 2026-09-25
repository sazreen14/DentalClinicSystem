import { Router } from "express";
import * as controller from "../controllers/adminInvoiceController.js";
import { authenticateToken } from "../middleware/authenticateToken.js";
import { requireRole } from "../middleware/requireRole.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createInvoiceRules, invoiceIdRules, invoiceItemIdRules, invoiceItemRules } from "../validators/invoiceValidators.js";

const router = Router();
router.use(authenticateToken, requireRole("Admin"));
router.post("/", createInvoiceRules, validateRequest, asyncHandler(controller.create));
router.post("/:invoiceId/items", invoiceItemRules, validateRequest, asyncHandler(controller.addItem));
router.put("/:invoiceId/items/:itemId", invoiceItemIdRules, invoiceItemRules.slice(1), validateRequest, asyncHandler(controller.updateItem));
router.delete("/:invoiceId/items/:itemId", invoiceItemIdRules, validateRequest, asyncHandler(controller.removeItem));
router.post("/:invoiceId/issue", invoiceIdRules, validateRequest, asyncHandler(controller.issue));
export default router;
