import "./helpers/requireTestDatabase.js";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import { db } from "../src/config/database.js";
import { createAccessToken } from "../src/services/tokenService.js";

const tag = Date.now().toString(36);
const password = "NotificationTest123!";
const defaults = {
  Patient: { appointmentReminder: true, emailNotifications: true },
  Doctor: { appointments: true, followUps: true, system: false },
  Admin: { appointment: true, cancellation: true, reschedule: true, newPatient: true, security: true },
};
const users = [];
let server, base;

async function api(path, { token, method = "GET", body, cookie } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: await response.json() };
}

before(async () => {
  const hash = await bcrypt.hash(password, 4);
  for (const role of Object.keys(defaults)) {
    for (let i = 0; i < 2; i++) {
      const [result] = await db.execute(
        "INSERT INTO users (user_id, full_name, email, password_hash, role, email_verified_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [`NP-${tag}-${role}-${i}`, `Preferences ${role}`, `np-${tag}-${role}-${i}@example.test`, hash, role],
      );
      const [[user]] = await db.execute("SELECT * FROM users WHERE id = ?", [result.insertId]);
      users.push({ ...user, token: createAccessToken(user) });
    }
  }
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const user of users) {
    await db.execute("DELETE FROM refresh_tokens WHERE user_id = ?", [user.id]);
    await db.execute("DELETE FROM security_audit_logs WHERE user_id = ?", [user.id]);
    await db.execute("DELETE FROM users WHERE id = ?", [user.id]);
  }
  await db.end();
});

for (const role of Object.keys(defaults)) {
  test(`${role}: saves every existing preference, reloads after login, and isolates another account`, async () => {
    const [owner, other] = users.filter(user => user.role === role);
    const initial = await api("/notifications/preferences", { token: owner.token });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.response.headers.get("cache-control"), "no-store");
    assert.deepEqual(initial.json.preferences, defaults[role]);
    const values = Object.fromEntries(Object.entries(defaults[role]).map(([key, value]) => [key, !value]));
    const saved = await api("/notifications/preferences", { token: owner.token, method: "PATCH", body: values });
    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.json.preferences, values);
    const [rows] = await db.execute("SELECT preference_key, enabled FROM notification_preferences WHERE user_id = ?", [owner.id]);
    assert.deepEqual(Object.fromEntries(rows.map(row => [row.preference_key, Boolean(row.enabled)])), values);
    assert.deepEqual((await api("/notifications/preferences", { token: owner.token })).json.preferences, values);
    assert.deepEqual((await api("/notifications/preferences", { token: other.token })).json.preferences, defaults[role]);

    const login = await api("/auth/login", { method: "POST", body: { email: owner.email, password } });
    assert.equal(login.response.status, 200);
    assert.deepEqual((await api("/notifications/preferences", { token: login.json.accessToken })).json.preferences, values);
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    assert.equal((await api("/auth/logout", { method: "POST", cookie })).response.status, 200);
    const relogin = await api("/auth/login", { method: "POST", body: { email: owner.email, password } });
    assert.equal(relogin.response.status, 200);
    assert.deepEqual((await api("/notifications/preferences", { token: relogin.json.accessToken })).json.preferences, values);
  });
}

test("patient reminders and email are independent and partial saves preserve other values", async () => {
  const patient = users.find(user => user.role === "Patient");
  for (const values of [{ appointmentReminder: false, emailNotifications: true }, { appointmentReminder: true, emailNotifications: false }]) {
    assert.equal((await api("/notifications/preferences", { token: patient.token, method: "PATCH", body: values })).response.status, 200);
    assert.deepEqual((await api("/notifications/preferences", { token: patient.token })).json.preferences, values);
  }
  const partial = await api("/notifications/preferences", { token: patient.token, method: "PATCH", body: { appointmentReminder: false } });
  assert.deepEqual(partial.json.preferences, { appointmentReminder: false, emailNotifications: false });
});

test("authentication and strict role-specific validation prevent user-ID injection and invalid writes", async () => {
  for (const method of ["GET", "PATCH"]) {
    assert.equal((await api("/notifications/preferences", { method, ...(method === "PATCH" ? { body: { appointmentReminder: false } } : {}) })).response.status, 401);
  }
  for (const user of users.filter((_, i) => i % 2 === 0)) {
    const key = Object.keys(defaults[user.role])[0];
    const beforeSave = (await api("/notifications/preferences", { token: user.token })).json.preferences;
    for (const body of [{}, [], { [key]: "false" }, { [key]: 0 }, { [key]: null }, { [key]: false, userId: users[1].id }, { patientId: "another-patient" }, { role: "Admin" }, { [key]: false, unknown: true }, { privacy: false }]) {
      const result = await api("/notifications/preferences", { token: user.token, method: "PATCH", body });
      assert.equal(result.response.status, 400, JSON.stringify(body));
    }
    assert.deepEqual((await api("/notifications/preferences", { token: user.token })).json.preferences, beforeSave);
    assert.deepEqual((await api(`/notifications/preferences?userId=${users[1].id}`, { token: user.token })).json.preferences, beforeSave);
  }
  const doctor = users.find(user => user.role === "Doctor");
  assert.equal((await api("/notifications/preferences", { token: doctor.token, method: "PATCH", body: { emailNotifications: false } })).response.status, 400);
});
