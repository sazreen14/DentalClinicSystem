import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authenticateToken.js";
import { requireRole } from "../middleware/requireRole.js";
import { forgotPasswordRateLimiter, loginRateLimiter, refreshRateLimiter, registrationRateLimiter, resetPasswordRateLimiter } from "../middleware/authRateLimiters.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { changePasswordRules, forgotPasswordRules, loginRules, patientRegistrationRules, resetPasswordRules } from "../validators/authValidators.js";

const router = Router();

router.post("/register/patient", registrationRateLimiter, patientRegistrationRules, validateRequest, asyncHandler(authController.registerPatient));
router.post("/login", loginRateLimiter, loginRules, validateRequest, asyncHandler(authController.login));
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPasswordRules, validateRequest, asyncHandler(authController.forgotPassword));
router.post("/reset-password", resetPasswordRateLimiter, resetPasswordRules, validateRequest, asyncHandler(authController.resetPassword));
router.post("/refresh", refreshRateLimiter, asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));
router.post("/logout-all", authenticateToken, asyncHandler(authController.logoutAll));
router.get("/me", authenticateToken, asyncHandler(authController.me));
router.post("/change-password", authenticateToken, requireRole("Patient", "Doctor"), changePasswordRules, validateRequest, asyncHandler(authController.changePassword));

export default router;
