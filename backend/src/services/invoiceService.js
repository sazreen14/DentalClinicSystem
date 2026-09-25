import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import * as model from "../models/invoiceModel.js";
import { doctorHasPatient } from "../models/clinicalRecordsModel.js";
import { inTransaction } from "./authService.js";
import { writeAudit } from "./auditService.js";
import { AppError } from "../utils/AppError.js";

const MAX_CENTS = 999999999999n;

function publicId(prefix) {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

function moneyToCents(value) {
  const text = String(value);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) throw new AppError("Unit price must be a non-negative amount with at most two decimal places.", 422, "INVALID_MONEY_AMOUNT");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function centsToMoney(value) {
  const cents = BigInt(value);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function normalizeItemInput(input) {
  const quantity = Number(input.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw new AppError("Quantity must be a whole number between 1 and 10000.", 422, "INVALID_INVOICE_QUANTITY");
  const unitCents = moneyToCents(input.unitPrice);
  const lineCents = unitCents * BigInt(quantity);
  if (lineCents > MAX_CENTS) throw new AppError("Invoice item total exceeds the supported amount.", 422, "INVOICE_AMOUNT_TOO_LARGE");
  return { description: input.description.trim(), quantity, unitPrice: centsToMoney(unitCents), lineTotal: centsToMoney(lineCents) };
}

function dateOnly(value) {
  return value ? (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)) : null;
}

function invoiceSummary(row) {
  return { id: row.invoice_id, invoiceNumber: row.invoice_number, status: row.status, patientId: row.patient_code, patientName: row.patient_name, appointmentId: row.appointment_code ?? null, issueDate: dateOnly(row.issue_date), subtotal: String(row.subtotal), total: String(row.total), createdAt: row.created_at };
}

function itemView(row) {
  return { id: row.item_id, description: row.description, quantity: Number(row.quantity), unitPrice: String(row.unit_price), lineTotal: String(row.line_total) };
}

async function detail(executor, row) {
  return { ...invoiceSummary(row), patient: { id: row.patient_code, name: row.patient_name }, appointment: row.appointment_code ? { id: row.appointment_code, service: row.appointment_service, doctor: row.doctor_name } : null, items: (await model.itemsForInvoice(executor, row.id)).map(itemView) };
}

async function recalculate(executor, invoiceId) {
  const items = await model.itemsForInvoice(executor, invoiceId);
  const cents = items.reduce((sum, item) => sum + moneyToCents(item.line_total), 0n);
  if (cents > MAX_CENTS) throw new AppError("Invoice total exceeds the supported amount.", 422, "INVOICE_AMOUNT_TOO_LARGE");
  const total = centsToMoney(cents);
  await model.setTotals(executor, invoiceId, total);
  return total;
}

async function draftForMutation(executor, invoiceCode) {
  const invoice = await model.invoiceByCode(executor, invoiceCode, { lock: true });
  if (!invoice) throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
  if (invoice.status !== "Draft") throw new AppError("Issued invoices are immutable.", 409, "INVOICE_ALREADY_ISSUED");
  return invoice;
}

export async function createDraft(userId, input, ipAddress) {
  return inTransaction(async (connection) => {
    const patient = await model.patientByCode(connection, input.patientId, { lock: true });
    if (!patient || patient.account_status !== "Active") throw new AppError("Patient not found or inactive.", 422, "INVALID_INVOICE_PATIENT");
    let appointment = null;
    if (input.appointmentId) {
      appointment = await model.appointmentByCode(connection, input.appointmentId, { lock: true });
      if (!appointment || Number(appointment.patient_id) !== Number(patient.id)) throw new AppError("The appointment does not belong to the selected Patient.", 422, "INVALID_INVOICE_CONTEXT");
    }
    const invoiceId = publicId("INVREC");
    const databaseId = await model.insertInvoice(connection, { invoiceId, provisionalNumber: invoiceId, patientId: patient.id, appointmentId: appointment?.id, userId });
    const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${String(databaseId).padStart(6, "0")}`;
    await model.setInvoiceNumber(connection, databaseId, invoiceNumber);
    for (const inputItem of input.items) await model.insertItem(connection, { itemId: publicId("ITM"), invoiceId: databaseId, ...normalizeItemInput(inputItem) });
    await recalculate(connection, databaseId);
    await writeAudit({ userId, eventType: "INVOICE_CREATED", outcome: "Success", ipAddress, metadata: { invoiceId, invoiceNumber, patientId: patient.patient_id, appointmentId: input.appointmentId ?? null } }, connection);
    return detail(connection, await model.invoiceByCode(connection, invoiceId));
  });
}

export async function addItem(userId, invoiceCode, input, ipAddress) {
  return inTransaction(async (connection) => {
    const invoice = await draftForMutation(connection, invoiceCode);
    await model.insertItem(connection, { itemId: publicId("ITM"), invoiceId: invoice.id, ...normalizeItemInput(input) });
    await recalculate(connection, invoice.id);
    await writeAudit({ userId, eventType: "INVOICE_UPDATED", outcome: "Success", ipAddress, metadata: { invoiceId: invoiceCode, action: "ITEM_ADDED" } }, connection);
    return detail(connection, await model.invoiceByCode(connection, invoiceCode));
  });
}

export async function updateItem(userId, invoiceCode, itemCode, input, ipAddress) {
  return inTransaction(async (connection) => {
    const invoice = await draftForMutation(connection, invoiceCode);
    const item = await model.itemByCode(connection, invoice.id, itemCode, { lock: true });
    if (!item) throw new AppError("Invoice item not found.", 404, "INVOICE_ITEM_NOT_FOUND");
    await model.updateItem(connection, item.id, normalizeItemInput(input));
    await recalculate(connection, invoice.id);
    await writeAudit({ userId, eventType: "INVOICE_UPDATED", outcome: "Success", ipAddress, metadata: { invoiceId: invoiceCode, action: "ITEM_UPDATED", itemId: itemCode } }, connection);
    return detail(connection, await model.invoiceByCode(connection, invoiceCode));
  });
}

export async function removeItem(userId, invoiceCode, itemCode, ipAddress) {
  return inTransaction(async (connection) => {
    const invoice = await draftForMutation(connection, invoiceCode);
    const item = await model.itemByCode(connection, invoice.id, itemCode, { lock: true });
    if (!item) throw new AppError("Invoice item not found.", 404, "INVOICE_ITEM_NOT_FOUND");
    await model.removeItem(connection, item.id);
    await recalculate(connection, invoice.id);
    await writeAudit({ userId, eventType: "INVOICE_UPDATED", outcome: "Success", ipAddress, metadata: { invoiceId: invoiceCode, action: "ITEM_REMOVED", itemId: itemCode } }, connection);
    return detail(connection, await model.invoiceByCode(connection, invoiceCode));
  });
}

export async function issue(userId, invoiceCode, ipAddress) {
  return inTransaction(async (connection) => {
    const invoice = await draftForMutation(connection, invoiceCode);
    const items = await model.itemsForInvoice(connection, invoice.id);
    if (!items.length) throw new AppError("Add at least one item before issuing the invoice.", 409, "EMPTY_INVOICE");
    await recalculate(connection, invoice.id);
    await model.issueInvoice(connection, invoice.id, userId);
    await writeAudit({ userId, eventType: "INVOICE_ISSUED", outcome: "Success", ipAddress, metadata: { invoiceId: invoiceCode, invoiceNumber: invoice.invoice_number } }, connection);
    return detail(connection, await model.invoiceByCode(connection, invoiceCode));
  });
}

export async function listForUser(user) {
  if (user.role === "Admin") return (await model.listAdminInvoices(db)).map(invoiceSummary);
  if (user.role === "Patient") {
    const patient = await model.patientForUser(db, user.id);
    if (!patient) throw new AppError("Patient profile is unavailable.", 404, "PATIENT_PROFILE_REQUIRED");
    return (await model.listPatientInvoices(db, patient.id)).map(invoiceSummary);
  }
  const doctor = await model.doctorForUser(db, user.id);
  if (!doctor) throw new AppError("Doctor profile is unavailable.", 403, "DOCTOR_PROFILE_REQUIRED");
  return (await model.listDoctorInvoices(db, doctor.id)).map(invoiceSummary);
}

async function authorizedInvoice(user, invoiceCode) {
  const invoice = await model.invoiceByCode(db, invoiceCode);
  if (!invoice) throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
  if (user.role === "Admin") return invoice;
  if (invoice.status !== "Issued") throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
  if (user.role === "Patient") {
    const patient = await model.patientForUser(db, user.id);
    if (!patient || Number(patient.id) !== Number(invoice.patient_id)) throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
    return invoice;
  }
  const doctor = await model.doctorForUser(db, user.id);
  if (!doctor || !await doctorHasPatient(db, doctor.id, invoice.patient_id)) throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
  return invoice;
}

export async function getForUser(user, invoiceCode, ipAddress, eventType = "INVOICE_VIEWED") {
  const invoice = await authorizedInvoice(user, invoiceCode);
  await writeAudit({ userId: user.id, eventType, outcome: "Success", ipAddress, metadata: { invoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number } });
  return detail(db, invoice);
}

export async function getPdfData(user, invoiceCode, ipAddress) {
  const invoice = await authorizedInvoice(user, invoiceCode);
  const value = await detail(db, invoice);
  await writeAudit({ userId: user.id, eventType: "INVOICE_PDF_VIEWED", outcome: "Success", ipAddress, metadata: { invoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number } });
  return { ...value, clinic: { name: invoice.clinic_name || "Klinik Pergigian Rosni Adam", phone: invoice.clinic_phone || "", email: invoice.clinic_email || "", address: invoice.clinic_address || "" } };
}
