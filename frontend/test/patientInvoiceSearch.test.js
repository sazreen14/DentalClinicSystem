import assert from "node:assert/strict";
import test from "node:test";
import { matchesPatientInvoiceSearch } from "../src/utils/patientInvoiceSearch.js";

const invoice = {
  invoiceNumber: "INV-2026-000014",
  issueDate: "2026-08-24",
  total: "170.00",
  status: "Issued",
  appointmentId: "APT-0014",
  patientName: "Patient Name",
};

test("patient invoice search matches available summary fields and date formats", () => {
  for (const query of ["inv-2026-000014", "24 Aug 2026", "24 August 2026", "2026-08-24", "170", "170.00", "RM 170.00", "issued", "apt-0014"]) {
    assert.equal(matchesPatientInvoiceSearch(invoice, query), true, query);
  }
});

test("patient invoice search trims input, matches partial text, and clears to all", () => {
  assert.equal(matchesPatientInvoiceSearch(invoice, "  AUG 2026  "), true);
  assert.equal(matchesPatientInvoiceSearch(invoice, "  "), true);
  assert.equal(matchesPatientInvoiceSearch(invoice, "Dental X-Ray"), false);
});
