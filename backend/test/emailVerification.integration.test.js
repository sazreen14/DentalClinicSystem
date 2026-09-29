import "./helpers/requireTestDatabase.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { db } from "../src/config/database.js";
import { registerPatient, login, refresh } from "../src/services/authService.js";
import { resendVerification, verifyEmail, requestEmailChange } from "../src/services/emailVerificationService.js";
import { createAccessToken, createTokenPair } from "../src/services/tokenService.js";
import { hashToken } from "../src/utils/authSecurity.js";
import { createVerificationEmailService } from "../src/services/emailService.js";
import { decryptField } from "../src/services/fieldEncryptionService.js";

test("secure email verification lifecycle and regressions", async t => {
  const tag = randomBytes(6).toString("hex");
  const ip = "127.0.0.1";
  const password = "Verification9Password";
  const ids = [];
  const mails = [];
  const sender = async mail => { mails.push(mail); return { status: "test" }; };
  const token = mail => new URLSearchParams(new URL(mail.verificationUrl).hash.slice(1)).get("token");
  const input = suffix => ({ fullName: "Verification Patient", email: `verify.${tag}.${suffix}@example.test`, password, identityNumber: `VERIFY-${tag}-${suffix}`, dateOfBirth: "1990-01-01", gender: "Female", phone: "+60123456789", address: "Synthetic verification address" });
  let a, b, first, access;
  const server = await new Promise(resolve => { const server = app.listen(0, ip, () => resolve(server)); });
  async function api(path, body, bearer) {
    const response = await fetch(`http://${ip}:${server.address().port}/api${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie") };
  }
  const age = userId => db.execute("UPDATE email_verification_tokens SET created_at=DATE_SUB(NOW(), INTERVAL 2 HOUR) WHERE user_id=?", [userId]);
  const row = async userId => (await db.execute("SELECT * FROM users WHERE id=?", [userId]))[0][0];
  try {
    await t.test("registration is unverified, hashes token and encrypts destination; SMTP uses existing transport", async () => {
      for (const suffix of ["a", "b"]) {
        const result = await registerPatient(input(suffix), ip, sender);
        assert.equal(result.emailVerified, false);
        const [[user]] = await db.execute("SELECT * FROM users WHERE user_id=?", [result.userId]);
        ids.push(user.id);
        if (suffix === "a") a = user; else b = user;
      }
      first = token(mails[0]);
      const [[stored]] = await db.execute("SELECT * FROM email_verification_tokens WHERE user_id=?", [a.id]);
      assert.equal(a.email_verified_at, null);
      assert.equal(stored.token_hash, hashToken(first));
      assert.ok(!JSON.stringify(stored).includes(first));
      assert.ok(!stored.email_ciphertext.includes(a.email));
      assert.equal(decryptField(stored.email_ciphertext, "email_verification_tokens.email"), a.email);
      let message;
      const smtp = createVerificationEmailService({ enabled: true, clinicEmail: "clinic@example.test" }, { sendMail: async value => { message = value; return {}; } });
      await smtp(mails[0]);
      assert.equal(message.to, a.email);
      assert.ok(message.text.includes(first));
    });
    await t.test("unverified login, access token and refresh cannot grant patient access", async () => {
      const result = await api("/auth/login", { email: a.email, password });
      assert.equal(result.status, 403); assert.equal(result.data.code, "EMAIL_VERIFICATION_REQUIRED");
      assert.equal(result.cookie, null); assert.equal(result.data.accessToken, undefined);
      assert.equal((await api("/patient/profile", null, createAccessToken(a))).status, 403);
      const pair = createTokenPair(a);
      await db.execute("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)", [a.id, pair.refresh.hash, pair.refresh.expiresAt]);
      await assert.rejects(refresh(pair.refreshToken, ip), { code: "EMAIL_VERIFICATION_REQUIRED" });
    });
    await t.test("resend generic responses, cooldown and old token revocation", async () => {
      const count = mails.length;
      const existing = await resendVerification(a.email, ip, sender);
      const unknown = await resendVerification(`missing.${tag}@example.test`, ip, sender);
      assert.deepEqual(existing, unknown); assert.equal(mails.length, count);
      await age(a.id);
      await Promise.all([resendVerification(a.email, ip, sender), resendVerification(a.email, ip, sender)]);
      assert.equal(mails.length, count + 1);
      await assert.rejects(verifyEmail(first, ip), { code: "INVALID_VERIFICATION_TOKEN" });
      first = token(mails.at(-1));
    });
    await t.test("invalid and expired links rejected; concurrent valid use succeeds once", async () => {
      await assert.rejects(verifyEmail(randomBytes(32).toString("base64url"), ip), { code: "INVALID_VERIFICATION_TOKEN" });
      await db.execute("UPDATE email_verification_tokens SET expires_at=DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE token_hash=?", [hashToken(first)]);
      await assert.rejects(verifyEmail(first, ip), { code: "EXPIRED_VERIFICATION_TOKEN" });
      assert.equal((await row(a.id)).email_verified_at, null);
      await db.execute("UPDATE email_verification_tokens SET expires_at=DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE token_hash=?", [hashToken(first)]);
      const results = await Promise.allSettled([verifyEmail(first, ip), verifyEmail(first, ip)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.find(result => result.status === "rejected").reason.code, "ALREADY_VERIFIED");
      assert.equal((await api("/auth/verify-email", { token: first })).status, 409);
      access = (await login({ email: a.email, password }, ip)).accessToken;
      assert.equal((await api("/patient/profile", null, access)).status, 200);
      await verifyEmail(token(mails[1]), ip);
    });
    await t.test("email change requires authenticated Patient and ignores supplied ownership", async () => {
      assert.equal((await api("/auth/change-email", { email: "new@example.test" })).status, 401);
      assert.equal((await api("/auth/change-email", { email: "invalid" }, access)).status, 422);
      await age(a.id);
      const result = await api("/auth/change-email", { email: `new.${tag}@example.test`, patient_id: b.id, userId: b.id }, access);
      assert.equal(result.status, 200);
      assert.equal((await row(a.id)).email, a.email); assert.equal((await row(b.id)).email, b.email);
      const [[pending]] = await db.execute("SELECT user_id FROM email_verification_tokens WHERE purpose='email_change' AND revoked_at IS NULL AND user_id IN (?,?)", [a.id, b.id]);
      assert.equal(pending.user_id, a.id);
      await assert.rejects(requestEmailChange(a.id, b.email, ip, sender), { code: "EMAIL_EXISTS" });
    });
    await t.test("email change expiry, resend, conflict at consumption and single use", async () => {
      await age(a.id);
      const newEmail = `changed.${tag}@example.test`;
      await requestEmailChange(a.id, newEmail, ip, sender);
      const expired = token(mails.at(-1));
      assert.equal((await row(a.id)).email, a.email);
      await db.execute("UPDATE email_verification_tokens SET expires_at=DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE token_hash=?", [hashToken(expired)]);
      await assert.rejects(verifyEmail(expired, ip), { code: "EXPIRED_VERIFICATION_TOKEN" });
      assert.equal((await row(a.id)).email, a.email);
      await age(a.id); await requestEmailChange(a.id, newEmail, ip, sender);
      const valid = token(mails.at(-1));
      await assert.rejects(verifyEmail(expired, ip), { code: "INVALID_VERIFICATION_TOKEN" });
      await db.execute("UPDATE users SET email=? WHERE id=?", [newEmail, b.id]);
      await assert.rejects(verifyEmail(valid, ip), { code: "EMAIL_EXISTS" });
      assert.equal((await row(a.id)).email, a.email);
      await db.execute("UPDATE users SET email=? WHERE id=?", [b.email, b.id]);
      let previousRecipient;
      await verifyEmail(valid, ip, async ({ recipientEmail }) => { previousRecipient = recipientEmail; return { status: "test" }; });
      assert.equal(previousRecipient, a.email);
      assert.equal((await row(a.id)).email, newEmail);
      await assert.rejects(verifyEmail(valid, ip), { code: "ALREADY_VERIFIED" });
      assert.ok((await login({ email: newEmail, password }, ip)).accessToken);
      await assert.rejects(login({ email: a.email, password }, ip), { code: "INVALID_CREDENTIALS" });
    });
    await t.test("delivery failure keeps the account pending and can be recovered with resend", async () => {
      const details = input("delivery");
      const result = await registerPatient(details, ip, async () => { throw new Error("Synthetic SMTP failure"); });
      const [[user]] = await db.execute("SELECT * FROM users WHERE user_id=?", [result.userId]);
      ids.push(user.id);
      assert.equal(user.email_verified_at, null);
      await age(user.id);
      await resendVerification(user.email, ip, sender);
      assert.equal((await api("/auth/verify-email", { token: token(mails.at(-1)) })).status, 200);
      assert.ok((await row(user.id)).email_verified_at);
    });
    await t.test("Doctor and Admin login remain available without patient verification", async () => {
      for (const role of ["Doctor", "Admin"]) {
        const email = `${role}.${tag}@example.test`.toLowerCase();
        const [result] = await db.execute("INSERT INTO users(user_id,full_name,email,password_hash,role) VALUES(?,?,?,?,?)", [`USR-${role}-${tag}`, role, email, await bcrypt.hash(password, 10), role]);
        ids.push(result.insertId);
        const loggedIn = await api("/auth/login", { email, password });
        assert.equal(loggedIn.status, 200); assert.ok(loggedIn.data.accessToken);
        assert.equal((await api("/auth/change-email", { email: "staffnew@example.test" }, loggedIn.data.accessToken)).status, 403);
      }
    });
    await t.test("resend rate limit and security audit events", async () => {
      let result;
      for (let i = 0; i < 6; i++) result = await api("/auth/resend-verification", { email: `missing.${tag}@example.test` });
      assert.equal(result.status, 429);
      const [rows] = await db.execute("SELECT event_type,metadata FROM security_audit_logs WHERE user_id=?", [a.id]);
      for (const event of ["EMAIL_VERIFICATION_SENT", "EMAIL_VERIFICATION_RESENT", "EMAIL_VERIFIED", "EMAIL_CHANGE_REQUESTED", "EMAIL_CHANGE_VERIFIED"]) assert.ok(rows.some(row => row.event_type === event), event);
      assert.ok(!JSON.stringify(rows).includes(first));
    });
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (const id of ids) {
      await db.execute("DELETE FROM security_audit_logs WHERE user_id=?", [id]);
      await db.execute("DELETE FROM refresh_tokens WHERE user_id=?", [id]);
      await db.execute("DELETE FROM patients WHERE user_id=?", [id]);
      await db.execute("DELETE FROM users WHERE id=?", [id]);
    }
  }
});
