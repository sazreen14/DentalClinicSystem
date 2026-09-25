import test from "node:test";
import assert from "node:assert/strict";
import { createAppointmentEmailService, createPasswordResetEmailService } from "../src/services/emailService.js";
import { runBestEffortEmail } from "../src/services/appointmentEmailEventService.js";

const appointment = {
  id: "APT-SYNTHETIC-EMAIL",
  patientName: "Synthetic Patient",
  doctorName: "Dr. Synthetic Dentist",
  service: "Synthetic Dental Review",
  date: "2099-08-12",
  time: "10:00",
};

test("disabled appointment email reports disabled without using a transport", async () => {
  let used = false;
  const sender = createAppointmentEmailService({ enabled: false }, { sendMail: async () => { used = true; } });
  assert.deepEqual(await sender("booked", appointment, "synthetic@example.test"), { status: "disabled" });
  assert.equal(used, false);
});

test("test transport builds every approved appointment lifecycle email", async () => {
  const messages = [];
  const transport = { sendMail: async (message) => { messages.push(message); return { messageId: `appointment-${messages.length}` }; } };
  const sender = createAppointmentEmailService({ enabled: true, clinicEmail: "clinic@example.test" }, transport);
  for (const event of ["booked", "confirmed", "rescheduled", "patientCancelled", "adminCancelled"]) {
    const result = await sender(event, appointment, "synthetic@example.test");
    assert.equal(result.status, "test");
    assert.ok(result.messageId);
  }
  assert.equal(messages.length, 5);
  for (const message of messages) {
    assert.deepEqual(message.from, { name: "Klinik Pergigian Rosni Adam", address: "clinic@example.test" });
    assert.equal(message.to, "synthetic@example.test");
  }
});

test("transport failures are contained and never reported as sent", async () => {
  const result = await runBestEffortEmail("SYNTHETIC_EMAIL_FAILURE", async () => {
    throw new Error("synthetic transport failure");
  });
  assert.deepEqual(result, { status: "failed" });
});

test("password reset email uses the approved local reset link without exposing a password", async () => {
  let email;
  const transport = { sendMail: async (message) => { email = message; return { messageId: "password-reset-test" }; } };
  const sender = createPasswordResetEmailService({ enabled: true, clinicEmail: "clinic@example.test" }, transport);
  const result = await sender({ recipientEmail: "patient@example.test", recipientName: "Synthetic Patient", resetUrl: "http://localhost:5173/reset-password?token=safe-test-token", expiresInMinutes: 30 });
  assert.equal(result.status, "test");
  assert.ok(result.messageId);
  assert.equal(email.subject, "Reset Your Password - Klinik Pergigian Rosni Adam");
  assert.deepEqual(email.from, { name: "Klinik Pergigian Rosni Adam", address: "clinic@example.test" });
  assert.equal(email.to, "patient@example.test");
  assert.match(email.text, /http:\/\/localhost:5173\/reset-password\?token=safe-test-token/);
  assert.match(email.text, /expire in 30 minutes/);
  assert.doesNotMatch(email.text, /existing password/i);
});
