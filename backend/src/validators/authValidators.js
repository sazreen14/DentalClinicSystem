import { body } from "express-validator";

const genders = ["Female", "Male", "Other", "Prefer not to say"];

const passwordRule = (field) => body(field)
  .isString()
  .isLength({ min: 8, max: 128 })
  .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter.")
  .matches(/[a-z]/).withMessage("Password must contain a lowercase letter.")
  .matches(/[0-9]/).withMessage("Password must contain a number.");

export const patientRegistrationRules = [
  body("fullName").trim().isLength({ min: 2, max: 150 }),
  body("email").trim().isEmail().normalizeEmail().isLength({ max: 254 }),
  passwordRule("password"),
  body("identityNumber").trim().isLength({ min: 4, max: 50 }).matches(/^[A-Za-z0-9\s-]+$/),
  body("dateOfBirth").isISO8601({ strict: true }).custom((value) => {
    if (new Date(`${value}T00:00:00Z`) >= new Date()) throw new Error("Date of birth must be in the past.");
    return true;
  }),
  body("gender").isIn(genders),
  body("phone").trim().isLength({ min: 7, max: 30 }).matches(/^\+?[0-9\s().-]+$/),
  body("address").trim().isLength({ min: 5, max: 500 }),
];

export const loginRules = [
  body("email").trim().isEmail().normalizeEmail().isLength({ max: 254 }),
  body("password").isString().isLength({ min: 1, max: 128 }),
];

export const changePasswordRules = [
  body("currentPassword").isString().isLength({ min: 1, max: 128 }),
  passwordRule("newPassword"),
  body("confirmPassword")
    .isString()
    .isLength({ min: 1, max: 128 })
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("New passwords do not match."),
];

export const forgotPasswordRules = [
  body("email").trim().isEmail().normalizeEmail().isLength({ max: 254 }),
];

export const resetPasswordRules = [
  body("token").isString().isLength({ min: 32, max: 256 }).matches(/^[A-Za-z0-9_-]+$/),
  passwordRule("newPassword"),
  body("confirmPassword")
    .isString()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("New passwords do not match."),
];
