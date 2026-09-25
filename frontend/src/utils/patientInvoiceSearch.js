function searchableDate(value) {
  if (!value) return [];
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return [String(value)];
  return [
    value,
    parsed.toLocaleDateString("en-MY", { day:"numeric", month:"short", year:"numeric" }),
    parsed.toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" }),
  ];
}

export function matchesPatientInvoiceSearch(invoice, search) {
  const query = search.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
  if (!query) return true;

  const total = invoice.total == null ? "" : Number(invoice.total).toFixed(2);
  const searchable = [
    invoice.invoiceNumber,
    ...searchableDate(invoice.issueDate),
    invoice.total,
    total,
    total && `RM ${total}`,
    invoice.status,
    invoice.appointmentId,
    invoice.patientName,
  ];
  return searchable.some((value) => String(value ?? "").toLocaleLowerCase("en").includes(query));
}
