import * as invoiceService from "../services/invoiceService.js";
import { generateInvoicePdf } from "../services/invoicePdfService.js";

export async function list(request, response) {
  response.json({ invoices: await invoiceService.listForUser(request.user) });
}

export async function detail(request, response) {
  response.json({ invoice: await invoiceService.getForUser(request.user, request.params.invoiceId, request.ip) });
}

export async function pdf(request, response) {
  const invoice = await invoiceService.getPdfData(request.user, request.params.invoiceId, request.ip);
  const document = await generateInvoicePdf(invoice);
  const safeNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "");
  response.set({
    "Cache-Control": "private, no-store",
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="invoice-${safeNumber}.pdf"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(document.length),
  });
  response.send(document);
}
