import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import app from "../src/app.js";
import { db } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { decryptField } from "../src/services/fieldEncryptionService.js";
import { registerPatient } from "../src/services/authService.js";
import { hashToken } from "../src/utils/authSecurity.js";
import { normalizeAddress, normalizeIdentityNumber, normalizePhone } from "../src/utils/sensitiveFieldNormalization.js";
import { cleanupAuxiliaryIntegrationFixtures } from "./helpers/databaseFixtureCleanup.js";

let server;
let baseUrl;
let createdUserDatabaseId;
let createdUserId;
let createdPatientId;
let browserCookie = "";

const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const testData = {
  fullName: "Synthetic Auth Patient",
  email: `synthetic.auth.${unique}@example.test`,
  password: "Synthetic9Password",
  identityNumber: `TEST-${unique.replace(/\D/g, "").slice(-12).padStart(12, "7")}`,
  dateOfBirth: "1995-04-16",
  gender: "Female",
  phone: `+601${String(Date.now()).slice(-8)}`,
  address: `Synthetic Test Address ${unique}`,
};
const rollbackEmail = `rollback.${unique}@example.test`;
const changedPassword = "Changed9Password";
const resetPasswordValue = "Reset9Password";

async function api(path, { method = "GET", body, token, cookie = browserCookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) browserCookie = setCookie.split(";")[0];
  return { response, json: await response.json(), setCookie };
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (createdUserDatabaseId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM security_audit_logs WHERE user_id = ?", [createdUserDatabaseId]);
      await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [createdUserDatabaseId]);
      await connection.execute("DELETE FROM refresh_tokens WHERE user_id = ?", [createdUserDatabaseId]);
      await connection.execute("DELETE FROM patient_clinical_profiles WHERE patient_id IN (SELECT id FROM patients WHERE user_id = ?)", [createdUserDatabaseId]);
      await connection.execute("DELETE FROM patients WHERE user_id = ?", [createdUserDatabaseId]);
      await connection.execute("DELETE FROM users WHERE id = ?", [createdUserDatabaseId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  await db.execute("DELETE FROM users WHERE email = ?", [rollbackEmail]);
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

test("registration rolls back the user when patient storage fails", async () => {
  await assert.rejects(() => registerPatient({
    ...testData,
    email: rollbackEmail,
    identityNumber: `${testData.identityNumber}ROLLBACK`,
    phone: `${testData.phone}9`,
    gender: "NotAValidGender",
  }, "127.0.0.1"));
  const [rows] = await db.execute("SELECT id FROM users WHERE email = ?", [rollbackEmail]);
  assert.equal(rows.length, 0);
});

test("complete authentication lifecycle", async () => {
  const registered = await api("/api/auth/register/patient", { method: "POST", body: testData });
  assert.equal(registered.response.status, 201);
  createdUserId = registered.json.user.userId;
  createdPatientId = registered.json.user.patientId;
  assert.ok(createdUserId);
  assert.ok(createdPatientId);

  const [rows] = await db.execute(
    `SELECT u.id, u.password_hash, p.identity_number_ciphertext,
            p.identity_number_blind_index, p.phone_ciphertext,
            p.phone_blind_index, p.address_ciphertext
       FROM users u JOIN patients p ON p.user_id = u.id WHERE u.email = ?`,
    [testData.email],
  );
  assert.equal(rows.length, 1);
  const stored = rows[0];
  createdUserDatabaseId = stored.id;
  assert.match(stored.password_hash, /^\$2[aby]\$/);
  assert.notEqual(stored.password_hash, testData.password);
  assert.equal(await bcrypt.compare(testData.password, stored.password_hash), true);

  const normalizedIdentity = normalizeIdentityNumber(testData.identityNumber);
  const normalizedPhone = normalizePhone(testData.phone);
  const normalizedAddress = normalizeAddress(testData.address);
  for (const [ciphertext, plaintext] of [
    [stored.identity_number_ciphertext, normalizedIdentity],
    [stored.phone_ciphertext, normalizedPhone],
    [stored.address_ciphertext, normalizedAddress],
  ]) assert.equal(ciphertext.includes(plaintext), false);
  assert.equal(decryptField(stored.identity_number_ciphertext, "patients.identity_number"), normalizedIdentity);
  assert.equal(decryptField(stored.phone_ciphertext, "patients.phone"), normalizedPhone);
  assert.equal(decryptField(stored.address_ciphertext, "patients.address"), normalizedAddress);

  const duplicateIdentity = await api("/api/auth/register/patient", {
    method: "POST",
    body: { ...testData, email: `other.${unique}@example.test`, phone: `${testData.phone}8` },
  });
  assert.equal(duplicateIdentity.response.status, 409);
  const [duplicateUsers] = await db.execute("SELECT id FROM users WHERE email = ?", [`other.${unique}@example.test`]);
  assert.equal(duplicateUsers.length, 0);

  const wrongLogin = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: "Incorrect9Password" } });
  assert.equal(wrongLogin.response.status, 401);
  assert.equal(wrongLogin.json.message, "Invalid email or password.");

  const firstLogin = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: testData.password } });
  assert.equal(firstLogin.response.status, 200);
  const firstAccess = firstLogin.json.accessToken;
  assert.ok(firstAccess);
  assert.equal("refreshToken" in firstLogin.json, false);
  assert.match(firstLogin.setCookie, /HttpOnly/i);
  const firstCookie = browserCookie;
  const firstRefresh = decodeURIComponent(firstCookie.split("=").slice(1).join("="));

  const me = await api("/api/auth/me", { token: firstAccess });
  assert.equal(me.response.status, 200);
  assert.equal(me.response.headers.get("cache-control"), "no-store, private");
  assert.equal(me.json.user.userId, createdUserId);
  assert.equal(me.json.user.patientId, createdPatientId);

  const invalidAccess = await api("/api/auth/me", { token: "invalid.token.value" });
  assert.equal(invalidAccess.response.status, 401);
  const expiredAccess = jwt.sign({ sub: String(createdUserDatabaseId), userId: createdUserId, role: "Patient" }, env.jwt.accessSecret, { expiresIn: -1 });
  const expiredResult = await api("/api/auth/me", { token: expiredAccess });
  assert.equal(expiredResult.response.status, 401);

  const [storedRefreshRows] = await db.execute("SELECT token_hash FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL", [createdUserDatabaseId]);
  assert.equal(storedRefreshRows.length, 1);
  assert.equal(storedRefreshRows[0].token_hash, hashToken(firstRefresh));
  assert.notEqual(storedRefreshRows[0].token_hash, firstRefresh);

  const rotated = await api("/api/auth/refresh", { method: "POST", cookie: firstCookie });
  assert.equal(rotated.response.status, 200);
  assert.equal("refreshToken" in rotated.json, false);
  const rotatedCookie = browserCookie;
  const rotatedRefresh = decodeURIComponent(rotatedCookie.split("=").slice(1).join("="));
  assert.notEqual(rotatedRefresh, firstRefresh);
  const reuseOld = await api("/api/auth/refresh", { method: "POST", cookie: firstCookie });
  assert.equal(reuseOld.response.status, 401);

  const logout = await api("/api/auth/logout", { method: "POST", cookie: rotatedCookie });
  assert.equal(logout.response.status, 200);
  const reuseLoggedOut = await api("/api/auth/refresh", { method: "POST", cookie: rotatedCookie });
  assert.equal(reuseLoggedOut.response.status, 401);

  const loginA = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: testData.password } });
  assert.equal(loginA.response.status, 200);
  const cookieA = browserCookie;
  const loginB = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: testData.password } });
  assert.equal(loginB.response.status, 200);
  const cookieB = browserCookie;
  const logoutAll = await api("/api/auth/logout-all", { method: "POST", token: loginA.json.accessToken });
  assert.equal(logoutAll.response.status, 200);
  assert.ok(cookieA && cookieB);
  const refreshAfterLogoutAll = await api("/api/auth/refresh", { method: "POST", cookie: cookieB });
  assert.equal(refreshAfterLogoutAll.response.status, 401);

  const emptyPasswordChange = await api("/api/auth/change-password", { method: "POST", token: loginB.json.accessToken, body: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  assert.equal(emptyPasswordChange.response.status, 422);

  const mismatchedPasswordChange = await api("/api/auth/change-password", { method: "POST", token: loginB.json.accessToken, body: { currentPassword: testData.password, newPassword: changedPassword, confirmPassword: "Different9Password" } });
  assert.equal(mismatchedPasswordChange.response.status, 422);
  assert.ok(mismatchedPasswordChange.json.details.some((detail) => detail.field === "confirmPassword" && detail.message === "New passwords do not match."));

  const wrongCurrentPassword = await api("/api/auth/change-password", { method: "POST", token: loginB.json.accessToken, body: { currentPassword: "Incorrect9Password", newPassword: changedPassword, confirmPassword: changedPassword } });
  assert.equal(wrongCurrentPassword.response.status, 400);
  assert.equal(wrongCurrentPassword.json.message, "Current password is incorrect.");

  const passwordChange = await api("/api/auth/change-password", { method: "POST", token: loginB.json.accessToken, body: { currentPassword: testData.password, newPassword: changedPassword, confirmPassword: changedPassword } });
  assert.equal(passwordChange.response.status, 200);
  assert.equal(passwordChange.json.message, "Password updated successfully.");
  const [[changedUser]] = await db.execute("SELECT password_hash FROM users WHERE id = ?", [createdUserDatabaseId]);
  assert.equal(await bcrypt.compare(changedPassword, changedUser.password_hash), true);
  assert.equal(await bcrypt.compare(testData.password, changedUser.password_hash), false);

  const oldPasswordLogin = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: testData.password } });
  assert.equal(oldPasswordLogin.response.status, 401);
  const newPasswordLogin = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: changedPassword } });
  assert.equal(newPasswordLogin.response.status, 200);

  const forgotExisting = await api("/api/auth/forgot-password", { method: "POST", body: { email: testData.email } });
  const forgotUnknown = await api("/api/auth/forgot-password", { method: "POST", body: { email: `unknown.${unique}@example.test` } });
  assert.equal(forgotExisting.response.status, 200);
  assert.equal(forgotUnknown.response.status, 200);
  assert.equal(forgotExisting.json.message, forgotUnknown.json.message);
  const [generatedTokens] = await db.execute("SELECT token_hash FROM password_reset_tokens WHERE user_id = ?", [createdUserDatabaseId]);
  assert.equal(generatedTokens.length, 1);
  assert.match(generatedTokens[0].token_hash, /^[a-f0-9]{64}$/);

  const invalidRawToken = randomBytes(32).toString("base64url");
  const invalidReset = await api("/api/auth/reset-password", { method: "POST", body: { token: invalidRawToken, newPassword: resetPasswordValue, confirmPassword: resetPasswordValue } });
  assert.equal(invalidReset.response.status, 400);
  assert.equal(invalidReset.json.code, "INVALID_RESET_TOKEN");

  const expiredRawToken = randomBytes(32).toString("base64url");
  await db.execute("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_SUB(NOW(), INTERVAL 1 MINUTE))", [createdUserDatabaseId, hashToken(expiredRawToken)]);
  const expiredReset = await api("/api/auth/reset-password", { method: "POST", body: { token: expiredRawToken, newPassword: resetPasswordValue, confirmPassword: resetPasswordValue } });
  assert.equal(expiredReset.response.status, 400);
  assert.equal(expiredReset.json.code, "EXPIRED_RESET_TOKEN");

  const validRawToken = randomBytes(32).toString("base64url");
  await db.execute("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(), INTERVAL 30 MINUTE))", [createdUserDatabaseId, hashToken(validRawToken)]);
  const validReset = await api("/api/auth/reset-password", { method: "POST", body: { token: validRawToken, newPassword: resetPasswordValue, confirmPassword: resetPasswordValue } });
  assert.equal(validReset.response.status, 200);
  const [[resetUser]] = await db.execute("SELECT password_hash FROM users WHERE id = ?", [createdUserDatabaseId]);
  assert.notEqual(resetUser.password_hash, resetPasswordValue);
  assert.equal(await bcrypt.compare(resetPasswordValue, resetUser.password_hash), true);
  assert.equal(await bcrypt.compare(changedPassword, resetUser.password_hash), false);

  const reusedReset = await api("/api/auth/reset-password", { method: "POST", body: { token: validRawToken, newPassword: "Another9Password", confirmPassword: "Another9Password" } });
  assert.equal(reusedReset.response.status, 400);
  assert.equal(reusedReset.json.code, "USED_RESET_TOKEN");
  const oldAfterReset = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: changedPassword } });
  assert.equal(oldAfterReset.response.status, 401);
  const loginAfterReset = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: resetPasswordValue } });
  assert.equal(loginAfterReset.response.status, 200);

  await db.execute("UPDATE users SET account_status = 'Inactive' WHERE id = ?", [createdUserDatabaseId]);
  const inactiveLogin = await api("/api/auth/login", { method: "POST", body: { email: testData.email, password: resetPasswordValue } });
  assert.equal(inactiveLogin.response.status, 401);
  assert.equal(inactiveLogin.json.message, "Invalid email or password.");

  const [auditRows] = await db.execute("SELECT event_type FROM security_audit_logs WHERE user_id = ?", [createdUserDatabaseId]);
  const events = new Set(auditRows.map((row) => row.event_type));
  for (const event of ["PATIENT_REGISTERED", "LOGIN_SUCCESS", "LOGIN_FAILED", "ACCOUNT_INACTIVE_LOGIN_ATTEMPT", "TOKEN_REFRESH", "LOGOUT", "LOGOUT_ALL", "PASSWORD_CHANGE_FAILED", "PASSWORD_CHANGED", "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED"]) assert.ok(events.has(event), `missing audit event ${event}`);

  console.log(`synthetic-test-user-id: ${createdUserId}`);
  console.log(`synthetic-test-patient-id: ${createdPatientId}`);
});
test("authentication integration fixtures are removed",async()=>{await cleanupAuxiliaryIntegrationFixtures(db,{family:"auth",tag:unique});createdUserDatabaseId=null;});
import './helpers/requireTestDatabase.js';
