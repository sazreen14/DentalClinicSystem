import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { db } from "../src/config/database.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { createNotification } from "../src/services/notificationService.js";
import { runBestEffortNotification } from "../src/services/domainEventNotificationService.js";
import { cleanupAuxiliaryIntegrationFixtures } from "./helpers/databaseFixtureCleanup.js";

const suffix = Date.now().toString(36).toUpperCase();
let server;
let base;
let firstUser;
let secondUser;
let firstToken;
let secondToken;
let firstNotification;
let secondNotification;
let cleaned = false;
async function cleanup() { if (!cleaned) { await cleanupAuxiliaryIntegrationFixtures(db, { family: "notification", tag: suffix }); cleaned = true; } }

async function api(path, { method = "GET", token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { response, json: await response.json() };
}

async function createUser(tag) {
  const [result] = await db.execute(
    `INSERT INTO users (user_id, full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'Admin')`,
    [`NT-${tag}-${suffix}`, `Notification ${tag}`, `${tag.toLowerCase()}.${suffix}@example.test`, "$2b$12$syntheticNotificationTestHashOnly00000000000000000"],
  );
  const [[user]] = await db.execute("SELECT * FROM users WHERE id = ?", [result.insertId]);
  return user;
}

before(async () => {
  firstUser = await createUser("ONE");
  secondUser = await createUser("TWO");
  firstToken = createAccessToken(firstUser);
  secondToken = createAccessToken(secondUser);
  firstNotification = await createNotification(db, {
    recipientUserId: firstUser.id,
    type: "security-alert",
    title: "Synthetic first notification",
    message: "Synthetic encrypted message for first account",
    relatedRoute: "/admin-settings",
    relatedEntityType: "User",
    relatedEntityId: firstUser.user_id,
  });
  secondNotification = await createNotification(db, {
    recipientUserId: secondUser.id,
    type: "security-alert",
    title: "Synthetic second notification",
    message: "Synthetic encrypted message for second account",
  });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });
});

after(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
});

test("notifications are ownership scoped and expose no encryption metadata", async () => {
  const { response, json } = await api("/notifications", { token: firstToken });
  assert.equal(response.status, 200);
  assert.equal(json.notifications.length, 1);
  assert.equal(json.notifications[0].id, firstNotification);
  assert.equal(json.notifications[0].message, "Synthetic encrypted message for first account");
  for (const forbidden of ["messageCiphertext", "message_ciphertext", "encryptionKeyVersion", "encryption_key_version", "iv", "tag"]) {
    assert.equal(Object.hasOwn(json.notifications[0], forbidden), false);
  }

  const [[stored]] = await db.execute(
    "SELECT message_ciphertext, encryption_key_version FROM notifications WHERE notification_id = ?",
    [firstNotification],
  );
  assert.ok(stored.message_ciphertext);
  assert.ok(!stored.message_ciphertext.includes("Synthetic encrypted message for first account"));
  assert.equal(Number(stored.encryption_key_version), 1);
});

test("mark one and mark all are restricted to the authenticated owner", async () => {
  const denied = await api(`/notifications/${secondNotification}/read`, { method: "POST", token: firstToken });
  assert.equal(denied.response.status, 404);

  const marked = await api(`/notifications/${firstNotification}/read`, { method: "POST", token: firstToken });
  assert.equal(marked.response.status, 200);
  let listing = await api("/notifications", { token: firstToken });
  assert.equal(listing.json.notifications.filter((item) => !item.read).length, 0);

  await createNotification(db, {
    recipientUserId: firstUser.id,
    type: "security-alert",
    title: "Synthetic unread notification",
    message: "Synthetic unread encrypted message",
  });
  const all = await api("/notifications/read-all", { method: "POST", token: firstToken });
  assert.equal(all.response.status, 200);
  assert.equal(all.json.updated, 1);
  listing = await api("/notifications", { token: firstToken });
  assert.equal(listing.json.notifications.filter((item) => !item.read).length, 0);

  const other = await api("/notifications", { token: secondToken });
  assert.equal(other.json.notifications[0].read, false);
});

test("authentication is required and dispatch failures are contained", async () => {
  const unauthenticated = await api("/notifications");
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(await runBestEffortNotification("SYNTHETIC_FAILURE", async () => {
    throw new Error("synthetic dispatch failure");
  }), false);
});
test("notification integration fixtures are removed", cleanup);
import './helpers/requireTestDatabase.js';
