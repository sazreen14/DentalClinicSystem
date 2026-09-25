import { body, param } from "express-validator";

const publicId = (name) => param(name).trim().isLength({ min: 1, max: 40 }).matches(/^[A-Za-z0-9-]+$/);
const description = (path) => body(path).trim().isLength({ min: 1, max: 250 });
const quantity = (path) => body(path).isInt({ min: 1, max: 10000 });
const unitPrice = (path) => body(path).custom((value) => typeof value === "string" && /^\d{1,10}(?:\.\d{1,2})?$/.test(value)).withMessage("Unit price must be a non-negative decimal string with at most two decimal places.");
const noClientTotals = [body(["subtotal", "total"]).not().exists().withMessage("Invoice totals are calculated by the server."), body("items.*.lineTotal").not().exists().withMessage("Line totals are calculated by the server.")];

export const invoiceIdRules = [publicId("invoiceId")];
export const invoiceItemIdRules = [publicId("invoiceId"), publicId("itemId")];
export const createInvoiceRules = [
  body("patientId").trim().isLength({ min: 1, max: 32 }).matches(/^[A-Za-z0-9-]+$/),
  body("appointmentId").optional({ nullable: true }).trim().isLength({ min: 1, max: 32 }).matches(/^[A-Za-z0-9-]+$/),
  body("items").isArray({ min: 1, max: 50 }),
  description("items.*.description"), quantity("items.*.quantity"), unitPrice("items.*.unitPrice"),
  ...noClientTotals,
];
export const invoiceItemRules = [publicId("invoiceId"), description("description"), quantity("quantity"), unitPrice("unitPrice"), body(["lineTotal", "subtotal", "total"]).not().exists().withMessage("Invoice totals are calculated by the server.")];
