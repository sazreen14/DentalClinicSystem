import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { transformWithOxc } from "vite";

const source = (await readFile(new URL("../src/services/apiClient.js", import.meta.url), "utf8"))
  .replaceAll("import.meta.env", "({ PROD: true })");
let moduleId = 0;
const client = () => import(`data:text/javascript,${encodeURIComponent(source)}#${moduleId++}`);
const token = (sub) => `header.${btoa(JSON.stringify({ sub }))}.synthetic`;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

for (const path of ["/appointments/my", "/patient/records", "/notifications", "/invoices", "/patient/profile"]) {
  test(`late A response cannot enter B session: ${path}`, async (t) => {
    const api = await client();
    const late = deferred();
    t.mock.method(globalThis, "fetch", () => late.promise);
    api.setApiAccessToken(token("A"));
    const pending = api.apiRequest(path);
    const denied = assert.rejects(pending, { code: "SESSION_CHANGED" });
    api.resetApiSession();
    api.setApiAccessToken(token("B"));
    late.resolve(response({ syntheticOwner: "A" }));
    await denied;
  });
}

test("late photo/PDF blobs are discarded across logout", async (t) => {
  const api = await client();
  const late = deferred();
  t.mock.method(globalThis, "fetch", () => late.promise);
  const denied = assert.rejects(api.apiBlobRequest("/invoices/synthetic/pdf"), { code: "SESSION_CHANGED" });
  api.resetApiSession();
  late.resolve(new Response("synthetic"));
  await denied;
});

test("old 401 cannot refresh, retry as B, or expire B", async (t) => {
  const api = await client();
  const late = deferred();
  let calls = 0;
  let expired = 0;
  api.setSessionExpiredHandler(() => { expired += 1; });
  t.mock.method(globalThis, "fetch", () => { calls += 1; return late.promise; });
  const denied = assert.rejects(api.apiRequest("/appointments/my"), { code: "SESSION_CHANGED" });
  api.resetApiSession();
  api.setApiAccessToken(token("B"));
  late.resolve(response({}, 401));
  await denied;
  assert.equal(calls, 1);
  assert.equal(expired, 0);
});

test("refresh completes before logout/login; old token never reinstated", async (t) => {
  const api = await client();
  const late = deferred();
  const started = deferred();
  const paths = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    paths.push(url);
    assert.equal(options.cache, "no-store");
    if (url.endsWith("/refresh")) { started.resolve(); return late.promise; }
    return response({ accessToken: token("B") });
  });
  api.setApiAccessToken(token("A"));
  const denied = assert.rejects(api.refreshAccessToken(), { code: "SESSION_CHANGED" });
  await started.promise;
  api.resetApiSession();
  const logout = api.apiRequest("/auth/logout", { method: "POST" });
  const login = api.apiRequest("/auth/login", { method: "POST" });
  assert.equal(paths.length, 1);
  late.resolve(response({ accessToken: token("A") }));
  await Promise.all([denied, logout, login]);
  assert.deepEqual(paths, ["/api/auth/refresh", "/api/auth/logout", "/api/auth/login"]);
});

test("refresh with another account's cookie fails closed", async (t) => {
  const api = await client();
  api.setApiAccessToken(token("A"));
  let expired = 0;
  api.setSessionExpiredHandler(() => { expired += 1; api.resetApiSession(); });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    return url.endsWith("/refresh") ? response({ accessToken: token("B") }) : response({}, 401);
  });
  await assert.rejects(api.apiRequest("/patient/profile"), /account changed/);
  assert.equal(expired, 1);
  assert.equal(calls.length, 2);
});

test("repeated A/B sessions request and return only current session data", async (t) => {
  const api = await client();
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const owner = options.headers.Authorization === `Bearer ${token("A")}` ? "A" : "B";
    return response({ appointments: owner === "A" ? [{ id: "synthetic-A" }] : [] });
  });
  for (const owner of ["A", "B", "A", "B"]) {
    api.resetApiSession();
    api.setApiAccessToken(token(owner));
    const result = await api.apiRequest("/appointments/my");
    assert.equal(result.appointments.length, owner === "A" ? 1 : 0);
  }
});

const authSource = (await readFile(new URL("../src/context/AuthContext.jsx", import.meta.url), "utf8"))
  .replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export function AuthProvider", "function AuthProvider");
const { code: authCode } = await transformWithOxc(authSource, "AuthContext.jsx", { jsx: { runtime: "classic" } });

// Exercise the real provider's callbacks and boundary keys with controlled
// hooks/browser events. No network or persisted patient data is involved.
async function authHarness(api, initiallySignedOut = true) {
  const state = [], effects = [], events = new Map(), storage = new Map();
  if (initiallySignedOut) storage.set("dentalClinicSignedOut", "true");
  let cursor = 0, first = true, reloads = 0;
  const bindings = {
    React, Fragment: React.Fragment, AuthContext: React.createContext(null), ...api,
    useState: initial => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial; return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
    useCallback: value => value, useMemo: fn => fn(),
    useEffect: fn => { if (first) effects.push(fn); },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name), location: { reload: () => { reloads += 1; } } },
  };
  const Provider = new Function(...Object.keys(bindings), `${authCode}\nreturn AuthProvider;`)(...Object.values(bindings));
  const render = () => { cursor = 0; const tree = Provider({ children: "synthetic provider tree" }); first = false; return { auth: tree.props.value, boundary: tree.props.children.key }; };
  render();
  const cleanup = effects.map(fn => fn());
  await new Promise(resolve => setTimeout(resolve, 0));
  return { render, storage, events, reloads: () => reloads, cleanup: () => cleanup.forEach(fn => fn?.()) };
}

test("provider resets every patient-data subtree immediately on logout and changes account", async (t) => {
  const api = await client();
  const lateLogout = deferred();
  let owner = "A";
  t.mock.method(globalThis, "fetch", async url => url.endsWith("/logout") ? lateLogout.promise : response({ accessToken: token(owner), user: { userId: owner, patientId: owner, role: "Patient" } }));
  const h = await authHarness(api);
  t.after(h.cleanup);
  await h.render().auth.login({});
  const a = h.render();
  assert.equal(a.auth.user.userId, "A");
  const logout = a.auth.logout();
  const empty = h.render();
  assert.equal(empty.auth.user, null);
  assert.equal(empty.auth.isAuthenticated, false);
  assert.notEqual(empty.boundary, a.boundary);
  assert.equal(h.storage.get("dentalClinicSignedOut"), "true");
  lateLogout.resolve(response({}));
  await logout;
  owner = "B";
  await h.render().auth.login({});
  const b = h.render();
  assert.equal(b.auth.user.userId, "B");
  assert.notEqual(b.boundary, a.boundary);
  assert.notEqual(b.boundary, empty.boundary);
});

test("signed-out reload does not restore cookies; cross-tab and browser-back handlers clear or reload", async (t) => {
  const api = await client();
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests += 1; return response({ accessToken: token("A"), user: { userId: "A", role: "Patient" } }); });
  const h = await authHarness(api);
  t.after(h.cleanup);
  assert.equal(requests, 0);
  assert.equal(h.render().auth.isAuthenticated, false);
  await h.render().auth.login({});
  const key = h.render().boundary;
  h.events.get("storage")({ key: "dentalClinicSessionChange" });
  assert.equal(h.render().auth.user, null);
  assert.notEqual(h.render().boundary, key);
  h.events.get("pageshow")({ persisted: true });
  assert.equal(h.reloads(), 1);
});
