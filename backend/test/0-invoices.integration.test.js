import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../src/app.js";
import { db } from "../src/config/database.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { cleanupAuxiliaryIntegrationFixtures } from "./helpers/databaseFixtureCleanup.js";

const tag = Date.now().toString(36).toUpperCase();
const created = { users: [], patients: [], doctors: [], appointments: [], invoices: [], service: null };
let server;
let base;
let admin;
let doctor;
let otherDoctor;
let patient;
let otherPatient;
let patientCode;
let otherPatientCode;
let appointmentCode;
let otherAppointmentCode;
let invoice;
let auditStart;
let cleaned = false;

async function createUser(role, suffix) {
  const [result] = await db.execute("INSERT INTO users(user_id,full_name,email,password_hash,role) VALUES(?,?,?,?,?)", [`USR-INV-${suffix}-${tag}`, `Invoice ${suffix}`, `invoice.${suffix}.${tag}@example.test`, "$2b$12$syntheticInvoiceHashOnly0000000000000000000000000000", role]);
  created.users.push(result.insertId);
  const [[user]] = await db.execute("SELECT * FROM users WHERE id=?", [result.insertId]);
  return user;
}

async function createPatient(suffix) {
  const user = await createUser("Patient", suffix);
  const code = `PT-INV-${suffix}-${tag}`;
  const blind = `${suffix}${tag}`.padEnd(64, "0").slice(0, 64);
  const [result] = await db.execute("INSERT INTO patients(patient_id,user_id,date_of_birth,gender,phone_ciphertext,phone_blind_index,phone_key_version,registration_date) VALUES(?,?,?,'Female',?,?,1,CURRENT_DATE)", [code, user.id, "1990-01-01", "encrypted-test-phone", blind]);
  created.patients.push(result.insertId);
  return { user, code, id: result.insertId };
}

async function createDoctor(suffix) {
  const user = await createUser("Doctor", suffix);
  const [result] = await db.execute("INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,?,?)", [`DOC-INV-${suffix}-${tag}`, user.id, "Dentist", `LIC-INV-${suffix}-${tag}`]);
  created.doctors.push(result.insertId);
  return { user, id: result.insertId };
}

async function api(path, { method = "GET", user, body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(user ? { authorization: `Bearer ${createAccessToken(user)}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const contentType = response.headers.get("content-type") || "";
  return { response, data: contentType.includes("application/pdf") ? Buffer.from(await response.arrayBuffer()) : await response.json().catch(() => ({})) };
}

before(async () => {
  admin = await createUser("Admin", "ADMIN");
  const doctorFixture = await createDoctor("DOCTOR");
  const otherDoctorFixture = await createDoctor("OTHERDOCTOR");
  doctor = doctorFixture.user;
  otherDoctor = otherDoctorFixture.user;
  const patientFixture = await createPatient("PATIENT");
  const otherPatientFixture = await createPatient("OTHERPATIENT");
  patient = patientFixture.user;
  otherPatient = otherPatientFixture.user;
  patientCode = patientFixture.code;
  otherPatientCode = otherPatientFixture.code;

  let result;
  [result] = await db.execute("INSERT INTO dental_services(service_code,name,duration_minutes,status) VALUES(?,?,30,'Active')", [`SVC-INV-${tag}`, "Invoice Test Service"]);
  created.service = result.insertId;
  appointmentCode = `APT-INV-${tag}`;
  [result] = await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status,booking_source) VALUES(?,?,?,?,CURRENT_DATE,'09:00','Confirmed','Admin')", [appointmentCode, patientFixture.id, doctorFixture.id, created.service]);
  created.appointments.push(result.insertId);
  otherAppointmentCode = `APT-INV-OTHER-${tag}`;
  [result] = await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status,booking_source) VALUES(?,?,?,?,CURRENT_DATE,'10:00','Confirmed','Admin')", [otherAppointmentCode, otherPatientFixture.id, otherDoctorFixture.id, created.service]);
  created.appointments.push(result.insertId);
  const [[audit]] = await db.execute("SELECT COALESCE(MAX(id),0) id FROM security_audit_logs");
  auditStart = Number(audit.id);
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", () => { base = `http://127.0.0.1:${server.address().port}/api`; resolve(); }); });
});

async function cleanupFixtures() {
  if (cleaned) return;
  await db.execute("DELETE FROM security_audit_logs WHERE id>?", [auditStart]);
  if (created.invoices.length) {
    const placeholders = created.invoices.map(() => "?").join(",");
    await db.execute(`DELETE FROM invoice_items WHERE invoice_id IN (${placeholders})`, created.invoices);
    await db.execute(`DELETE FROM invoices WHERE id IN (${placeholders})`, created.invoices);
  }
  if (created.appointments.length) await db.execute(`DELETE FROM appointments WHERE id IN (${created.appointments.map(() => "?").join(",")})`, created.appointments);
  if (created.service) await db.execute("DELETE FROM dental_services WHERE id=?", [created.service]);
  if (created.patients.length) await db.execute(`DELETE FROM patients WHERE id IN (${created.patients.map(() => "?").join(",")})`, created.patients);
  if (created.doctors.length) await db.execute(`DELETE FROM doctors WHERE id IN (${created.doctors.map(() => "?").join(",")})`, created.doctors);
  if (created.users.length) await db.execute(`DELETE FROM users WHERE id IN (${created.users.map(() => "?").join(",")})`, created.users);
  cleaned = true;
}

after(async () => {
  if (!cleaned) await cleanupFixtures();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

test("Admin creates a Draft invoice and server calculates exact totals", async () => {
  const result = await api("/admin/invoices", { method: "POST", user: admin, body: { patientId: patientCode, appointmentId: appointmentCode, items: [{ description: "Treatment A", quantity: 2, unitPrice: "10.25" }, { description: "Treatment B", quantity: 1, unitPrice: "5.00" }] } });
  assert.equal(result.response.status, 201);
  invoice = result.data.invoice;
  assert.equal(invoice.status, "Draft");
  assert.equal(invoice.total, "25.50");
  assert.match(invoice.invoiceNumber, /^INV-\d{4}-\d{6,}$/);
  const [[stored]] = await db.execute("SELECT id FROM invoices WHERE invoice_id=?", [invoice.id]);
  created.invoices.push(stored.id);
});

test("Admin input validation rejects manipulated totals, invalid money, quantity, and Patient context", async () => {
  for (const body of [
    { patientId: patientCode, items: [{ description: "Bad total", quantity: 1, unitPrice: "1.00" }], total: "0.01" },
    { patientId: patientCode, items: [{ description: "Negative", quantity: 1, unitPrice: "-1.00" }] },
    { patientId: patientCode, items: [{ description: "Malformed", quantity: 1, unitPrice: "1.999" }] },
    { patientId: patientCode, items: [{ description: "Zero quantity", quantity: 0, unitPrice: "1.00" }] },
  ]) {
    const result = await api("/admin/invoices", { method: "POST", user: admin, body });
    assert.equal(result.response.status, 422);
  }
  const context = await api("/admin/invoices", { method: "POST", user: admin, body: { patientId: patientCode, appointmentId: otherAppointmentCode, items: [{ description: "Wrong appointment", quantity: 1, unitPrice: "1.00" }] } });
  assert.equal(context.response.status, 422);
  assert.equal(context.data.code, "INVALID_INVOICE_CONTEXT");
});

test("Only Admin can mutate Draft invoices and item changes recalculate totals", async () => {
  for (const user of [doctor, patient]) {
    const denied = await api("/admin/invoices", { method: "POST", user, body: { patientId: patientCode, items: [{ description: "Forbidden", quantity: 1, unitPrice: "1.00" }] } });
    assert.equal(denied.response.status, 403);
  }
  let result = await api(`/admin/invoices/${invoice.id}/items`, { method: "POST", user: admin, body: { description: "Added item", quantity: 2, unitPrice: "2.50" } });
  assert.equal(result.data.invoice.total, "30.50");
  const item = result.data.invoice.items.find((value) => value.description === "Added item");
  result = await api(`/admin/invoices/${invoice.id}/items/${item.id}`, { method: "PUT", user: admin, body: { description: "Updated item", quantity: 3, unitPrice: "2.00" } });
  assert.equal(result.data.invoice.total, "31.50");
  result = await api(`/admin/invoices/${invoice.id}/items/${item.id}`, { method: "DELETE", user: admin });
  assert.equal(result.data.invoice.total, "25.50");
});

test("Admin issues invoice and issued financial contents become immutable", async () => {
  const issued = await api(`/admin/invoices/${invoice.id}/issue`, { method: "POST", user: admin });
  assert.equal(issued.response.status, 200);
  invoice = issued.data.invoice;
  assert.equal(invoice.status, "Issued");
  assert.ok(invoice.issueDate);
  for (const request of [
    { path: `/admin/invoices/${invoice.id}/items`, method: "POST", body: { description: "Late item", quantity: 1, unitPrice: "1.00" } },
    { path: `/admin/invoices/${invoice.id}/items/${invoice.items[0].id}`, method: "PUT", body: { description: "Changed", quantity: 1, unitPrice: "1.00" } },
    { path: `/admin/invoices/${invoice.id}/items/${invoice.items[0].id}`, method: "DELETE" },
    { path: `/admin/invoices/${invoice.id}/issue`, method: "POST" },
  ]) {
    const result = await api(request.path, { method: request.method, user: admin, body: request.body });
    assert.equal(result.response.status, 409);
    assert.equal(result.data.code, "INVOICE_ALREADY_ISSUED");
  }
});

test("Patient access is self-only for list, details, and PDF", async () => {
  const ownList = await api("/invoices", { user: patient });
  assert.ok(ownList.data.invoices.some((value) => value.id === invoice.id));
  const otherList = await api("/invoices", { user: otherPatient });
  assert.equal(otherList.data.invoices.some((value) => value.id === invoice.id), false);
  assert.equal((await api(`/invoices/${invoice.id}`, { user: patient })).response.status, 200);
  assert.equal((await api(`/invoices/${invoice.id}`, { user: otherPatient })).response.status, 404);
  const pdf = await api(`/invoices/${invoice.id}/pdf`, { user: patient });
  assert.equal(pdf.response.status, 200);
  assert.equal(pdf.response.headers.get("content-type"), "application/pdf");
  assert.equal(pdf.response.headers.get("cache-control"), "private, no-store");
  assert.equal(pdf.response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(pdf.data.subarray(0, 4).toString(), "%PDF");
  assert.equal((await api(`/invoices/${invoice.id}/pdf`, { user: otherPatient })).response.status, 404);
});

test("Doctor access is relationship-scoped and read-only", async () => {
  const list = await api("/invoices", { user: doctor });
  assert.ok(list.data.invoices.some((value) => value.id === invoice.id));
  const unrelatedList = await api("/invoices", { user: otherDoctor });
  assert.equal(unrelatedList.data.invoices.some((value) => value.id === invoice.id), false);
  assert.equal((await api(`/invoices/${invoice.id}`, { user: doctor })).response.status, 200);
  assert.equal((await api(`/invoices/${invoice.id}`, { user: otherDoctor })).response.status, 404);
  assert.equal((await api(`/invoices/${invoice.id}/pdf`, { user: doctor })).response.status, 200);
  assert.equal((await api(`/invoices/${invoice.id}/pdf`, { user: otherDoctor })).response.status, 404);
  const mutation = await api(`/admin/invoices/${invoice.id}/issue`, { method: "POST", user: doctor });
  assert.equal(mutation.response.status, 403);
});

test("Admin can list, view, and retrieve the protected PDF", async () => {
  assert.ok((await api("/invoices", { user: admin })).data.invoices.some((value) => value.id === invoice.id));
  assert.equal((await api(`/invoices/${invoice.id}`, { user: admin })).response.status, 200);
  const pdf = await api(`/invoices/${invoice.id}/pdf`, { user: admin });
  assert.equal(pdf.response.status, 200);
  assert.match(pdf.response.headers.get("content-disposition"), /^attachment; filename="invoice-INV-\d{4}-\d+\.pdf"$/);
});

test("Invoice audit events contain safe public metadata", async () => {
  const [events] = await db.execute("SELECT event_type,metadata FROM security_audit_logs WHERE id>? AND event_type LIKE 'INVOICE_%' ORDER BY id", [auditStart]);
  const types = new Set(events.map((event) => event.event_type));
  for (const type of ["INVOICE_CREATED", "INVOICE_UPDATED", "INVOICE_ISSUED", "INVOICE_VIEWED", "INVOICE_PDF_VIEWED"]) assert.ok(types.has(type));
  for (const event of events) {
    const metadata = typeof event.metadata === "string" ? JSON.parse(event.metadata) : event.metadata;
    assert.equal(JSON.stringify(metadata).includes("Treatment A"), false);
    assert.equal(JSON.stringify(metadata).includes("Bearer"), false);
  }
});

test("Phase E integration fixtures are removed", async () => {
  await cleanupFixtures();
  await cleanupAuxiliaryIntegrationFixtures(db, { family: "invoice", tag });
  const [[remaining]] = await db.execute("SELECT COUNT(*) count FROM invoices WHERE invoice_id LIKE 'INVREC-%' AND created_by_user_id IN (SELECT id FROM users WHERE email LIKE ?)", [`%.${tag}@example.test`]);
  assert.equal(Number(remaining.count), 0);
});
import './helpers/requireTestDatabase.js';
