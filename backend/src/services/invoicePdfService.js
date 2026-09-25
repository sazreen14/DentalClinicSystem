import PDFDocument from "pdfkit";

function money(value) {
  return `RM ${Number(value).toFixed(2)}`;
}

export function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: invoice.clinic.name } });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fontSize(18).text(invoice.clinic.name);
    document.fontSize(9).text(invoice.clinic.address || "").text([invoice.clinic.phone, invoice.clinic.email].filter(Boolean).join(" | "));
    document.moveDown(1.5);
    document.fontSize(20).text("INVOICE", { align: "right" });
    document.fontSize(10).text(`Invoice Number: ${invoice.invoiceNumber}`, { align: "right" }).text(`Status: ${invoice.status}`, { align: "right" }).text(`Issue Date: ${invoice.issueDate || "Not issued"}`, { align: "right" });
    document.moveDown(1.5);
    document.fontSize(11).text("Bill To", { underline: true }).fontSize(10).text(invoice.patient.name).text(`Patient ID: ${invoice.patient.id}`);
    if (invoice.appointment) document.text(`Appointment: ${invoice.appointment.id} | ${invoice.appointment.service || "Dental service"}`);
    document.moveDown(1.5);

    const columns = { description: 50, quantity: 330, unit: 390, total: 475 };
    document.fontSize(10).text("Description", columns.description).text("Qty", columns.quantity, undefined, { width: 45, align: "right" }).text("Unit Price", columns.unit, undefined, { width: 70, align: "right" }).text("Line Total", columns.total, undefined, { width: 70, align: "right" });
    document.moveTo(50, document.y + 4).lineTo(545, document.y + 4).stroke();
    document.moveDown();
    for (const item of invoice.items) {
      const y = document.y;
      document.text(item.description, columns.description, y, { width: 260 }).text(String(item.quantity), columns.quantity, y, { width: 45, align: "right" }).text(money(item.unitPrice), columns.unit, y, { width: 70, align: "right" }).text(money(item.lineTotal), columns.total, y, { width: 70, align: "right" });
      document.y = Math.max(document.y, y + 22);
    }
    document.moveDown();
    document.moveTo(350, document.y).lineTo(545, document.y).stroke();
    document.moveDown(0.6).fontSize(10).text(`Subtotal: ${money(invoice.subtotal)}`, 350, undefined, { width: 195, align: "right" }).fontSize(12).text(`Total: ${money(invoice.total)}`, 350, undefined, { width: 195, align: "right" });
    document.moveDown(3).fontSize(9).text("This invoice was generated securely by the clinic system.", { align: "center" });
    document.end();
  });
}
