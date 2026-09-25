import { apiBlobRequest, apiRequest } from "./apiClient";

export async function listInvoices() {
  return (await apiRequest("/invoices")).invoices;
}

export async function getInvoice(invoiceId) {
  return (await apiRequest(`/invoices/${encodeURIComponent(invoiceId)}`)).invoice;
}

export async function createInvoice(input) {
  return (await apiRequest("/admin/invoices", { method: "POST", body: JSON.stringify(input) })).invoice;
}

export async function addInvoiceItem(invoiceId, input) {
  return (await apiRequest(`/admin/invoices/${encodeURIComponent(invoiceId)}/items`, { method: "POST", body: JSON.stringify(input) })).invoice;
}

export async function updateInvoiceItem(invoiceId, itemId, input) {
  return (await apiRequest(`/admin/invoices/${encodeURIComponent(invoiceId)}/items/${encodeURIComponent(itemId)}`, { method: "PUT", body: JSON.stringify(input) })).invoice;
}

export async function removeInvoiceItem(invoiceId, itemId) {
  return (await apiRequest(`/admin/invoices/${encodeURIComponent(invoiceId)}/items/${encodeURIComponent(itemId)}`, { method: "DELETE" })).invoice;
}

export async function issueInvoice(invoiceId) {
  return (await apiRequest(`/admin/invoices/${encodeURIComponent(invoiceId)}/issue`, { method: "POST" })).invoice;
}

export function getInvoicePdf(invoiceId) {
  return apiBlobRequest(`/invoices/${encodeURIComponent(invoiceId)}/pdf`);
}
