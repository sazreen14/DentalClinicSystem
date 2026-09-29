import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import * as icons from "react-icons/fa";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

async function harness(file, name, bindings, props = {}) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const { code } = await transformWithOxc(source.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace(`export default ${name};`, "").replace("export default function", "function"), `${name}.jsx`, { jsx: { runtime: "classic" } });
  const state = [];
  let index = 0;
  const scope = { React, ...icons, useState: initial => {
    const slot = index++;
    if (!(slot in state)) state[slot] = typeof initial === "function" ? initial() : initial;
    return [state[slot], value => { state[slot] = typeof value === "function" ? value(state[slot]) : value; }];
  }, ...bindings };
  const Component = new Function(...Object.keys(scope), `${code}\nreturn ${name};`)(...Object.values(scope));
  const render = () => { index = 0; return Component(props); };
  return { render, html: () => renderToStaticMarkup(render()) };
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props?.children).map(child => find(child, predicate)).find(Boolean);
}
const byClass = (tree, value) => find(tree, node => node.props?.className === value);
const byName = (tree, value) => find(tree, node => node.props?.name === value);
const preventDefault = () => {};

test("login card keeps normal controls, pending state, credential errors, and verification grouping", async () => {
  const navigation = [], submitted = [];
  let fail, release, closed = 0, forgot = 0, registered = 0;
  const ResendVerification = () => null;
  const page = await harness("../src/components/modals/LoginModal.jsx", "LoginModal", {
    ResendVerification,
    useNavigate: () => (...args) => navigation.push(args),
    useAuth: () => ({ login: async details => { submitted.push(details); await new Promise(resolve => { release = resolve; }); if (fail) throw fail; return { role: "Patient" }; } }),
  }, { onClose: () => { closed++; }, onForgotPassword: () => { forgot++; }, onSwitchToRegister: () => { registered++; } });
  assert.doesNotMatch(page.html(), /Email verification required|auth-verification-divider/);
  assert.match(page.html(), /Welcome Back/);
  let tree = page.render();
  const close = byClass(tree, "auth-modal-close");
  assert.equal(close.props["aria-label"], "Close login");
  assert.match(renderToStaticMarkup(close), /<svg/);
  close.props.onClick();
  assert.equal(closed, 1);
  closed = 0;
  find(byClass(tree, "auth-switch-text"), node => node.type === "button").props.onClick();
  assert.equal(registered, 1);
  byName(tree, "email").props.onChange({ target: { name: "email", value: "patient@example.test", type: "email" } });
  byName(tree, "password").props.onChange({ target: { name: "password", value: "Example9Password", type: "password" } });
  byName(tree, "rememberMe").props.onChange({ target: { name: "rememberMe", type: "checkbox", checked: true } });
  byClass(tree, "password-toggle").props.onClick();
  byClass(tree, "forgot-password-button").props.onClick();
  tree = page.render();
  assert.equal(byName(tree, "password").props.type, "text");
  assert.equal(byName(tree, "rememberMe").props.checked, true);
  assert.equal(forgot, 1);
  fail = Object.assign(new Error("Invalid email or password."), { code: "INVALID_CREDENTIALS" });
  let pending = byClass(tree, "auth-form").props.onSubmit({ preventDefault });
  assert.equal(byClass(page.render(), "auth-submit-button").props.disabled, true);
  assert.match(page.html(), /Signing in\.\.\./);
  assert.match(page.html(), /auth-login-spinner/);
  assert.equal(byClass(page.render(), "auth-submit-button").props["aria-busy"], true);
  await byClass(page.render(), "auth-form").props.onSubmit({ preventDefault });
  assert.equal(submitted.length, 1, "A pending form must not send a second login request");
  release(); await pending;
  assert.match(page.html(), /Invalid email or password\./);
  assert.match(page.html(), /Login to Portal/);
  assert.doesNotMatch(page.html(), /auth-login-spinner|Signing in/);
  assert.equal(byClass(page.render(), "auth-submit-button").props.disabled, false);
  assert.doesNotMatch(page.html(), /Email verification required/);
  assert.equal(byName(page.render(), "password").props.value, "");
  fail = Object.assign(new Error("Please verify your registered email before logging in. You can request another verification email."), { code: "EMAIL_VERIFICATION_REQUIRED" });
  pending = byClass(page.render(), "auth-form").props.onSubmit({ preventDefault });
  release(); await pending;
  const html = page.html();
  assert.match(html, /Email verification required/);
  assert.equal((html.match(/Please verify your registered email/g) || []).length, 1);
  assert.ok(html.indexOf("Email verification required") < html.indexOf("Please verify"));
  assert.doesNotMatch(html, /auth-verification-divider|id="login-email"|id="login-password"|Forgot password|Remember me|Login to Portal|Register here/);
  const resend = find(page.render(), node => node.type === ResendVerification);
  assert.equal(resend.props.initialEmail, "patient@example.test");
  assert.equal(resend.props.variant, "login");
  assert.equal(resend.props.readOnly, true);
  find(page.render(), node => node.type === "button" && node.props.children === "Return to Login").props.onClick();
  assert.match(page.html(), /Welcome Back/);
  assert.doesNotMatch(page.html(), /Email verification required|Please verify your registered email/);
  fail = null;
  pending = byClass(page.render(), "auth-form").props.onSubmit({ preventDefault });
  release(); await pending;
  assert.equal(closed, 1);
  assert.deepEqual(navigation, [["/patient-dashboard", { replace: true }]]);
  assert.deepEqual(submitted[0], { email: "patient@example.test", password: "Example9Password" });
});

for (const [name, message, failure] of [
  ["success", "If this address belongs to an eligible account, a verification email will be sent. Please wait a minute before trying again.", false],
  ["cooldown", "Too many authentication requests. Please try again later.", true],
  ["error", "The request could not be completed.", true],
]) {
  test(`resend ${name} preserves message, entered email, and loading state`, async () => {
    let release, requestedEmail;
    const page = await harness("../src/components/auth/ResendVerification.jsx", "ResendVerification", {
      resendVerification: async email => { requestedEmail = email; await new Promise(resolve => { release = resolve; }); if (failure) throw new Error(message); return { message }; },
    }, { initialEmail: "patient@example.test", variant: "login", readOnly: true });
    let tree = page.render();
    const input = find(tree, node => node.type === "input");
    assert.equal(input.props.value, "patient@example.test");
    assert.equal(input.props.readOnly, true);
    tree = page.render();
    const pending = tree.props.onSubmit({ preventDefault });
    const busy = page.render();
    assert.equal(find(busy, node => node.type === "button").props.disabled, true);
    assert.match(page.html(), /Requesting/);
    release(); await pending;
    assert.equal(requestedEmail, "patient@example.test");
    assert.equal(find(page.render(), node => node.type === "button").props.disabled, false);
    assert.ok(page.html().includes(message));
    assert.match(page.html(), /role="status"/);
  });
}

test("registration opens dedicated verification and Return to Login restores the form", async () => {
  const ResendVerification = () => React.createElement("span", null, "Resend Verification Email");
  const page = await harness("../src/components/modals/LoginModal.jsx", "LoginModal", {
    ResendVerification, useNavigate: () => () => {}, useAuth: () => ({ login: () => {} }),
  }, { verificationEmail: "new@example.test" });
  const html = page.html();
  assert.match(html, /Your account has been created successfully/);
  assert.match(html, /Resend Verification Email/);
  assert.doesNotMatch(html, /id="login-email"|id="login-password"|Forgot password|Remember me|Login to Portal|auth-verification-divider/);
  const resend = find(page.render(), node => node.type === ResendVerification);
  assert.equal(resend.props.initialEmail, "new@example.test");
  assert.equal(resend.props.readOnly, true);
  find(page.render(), node => node.type === "button" && node.props.children === "Return to Login").props.onClick();
  assert.match(page.html(), /Welcome Back|Login to Portal/);
  assert.doesNotMatch(page.html(), /Email verification required|Resend Verification Email/);
  assert.equal(byName(page.render(), "email").props.value, "new@example.test");
});

test("booking notice does not trigger verification", async () => {
  const page = await harness("../src/components/modals/LoginModal.jsx", "LoginModal", {
    ResendVerification: () => null, useNavigate: () => () => {}, useAuth: () => ({}),
  }, { notice: "Please sign in to book an appointment." });
  assert.match(page.html(), /Please sign in to book an appointment/);
  assert.match(page.html(), /Login to Portal/);
  assert.doesNotMatch(page.html(), /Email verification required/);
});

test("registration passes the submitted email through Home to verification and clears it on close", async () => {
  let registeredEmail;
  const registration = await harness("../src/components/modals/RegisterModal.jsx", "RegisterModal", {
    useAuth: () => ({ registerPatient: async () => ({}) }),
  }, { onRegistered: email => { registeredEmail = email; } });
  for (const [name, value] of Object.entries({ email: "new@example.test", password: "Example9Password", confirmPassword: "Example9Password" })) {
    byName(registration.render(), name).props.onChange({ target: { name, value } });
  }
  await byClass(registration.render(), "register-form").props.onSubmit({ preventDefault });
  assert.equal(registeredEmail, "new@example.test");
  const components = Object.fromEntries(["Navbar", "Hero", "Services", "About", "PatientManagement", "Location", "Reviews", "Footer", "LoginModal", "RegisterModal", "ForgotPasswordModal", "AppointmentModal"].map(name => [name, () => null]));
  const home = await harness("../src/pages/Home.jsx", "Home", {
    ...components, useLocation: () => ({ state: {} }), useAuth: () => ({ isAuthenticated: false }),
  });
  find(home.render(), node => node.type === components.Navbar).props.onRegister();
  find(home.render(), node => node.type === components.RegisterModal).props.onRegistered(registeredEmail);
  const login = find(home.render(), node => node.type === components.LoginModal);
  assert.equal(login.props.verificationEmail, registeredEmail);
  login.props.onClose();
  find(home.render(), node => node.type === components.Navbar).props.onLogin();
  assert.equal(find(home.render(), node => node.type === components.LoginModal).props.verificationEmail, "");
});

for (const role of ["Patient", "Doctor", "Admin"]) {
  test(`${role} login retains its dashboard navigation`, async () => {
    const navigation = [];
    let closed = false;
    const page = await harness("../src/components/modals/LoginModal.jsx", "LoginModal", {
      ResendVerification: () => null,
      useNavigate: () => (...args) => navigation.push(args),
      useAuth: () => ({ login: async () => ({ role }) }),
    }, { onClose: () => { closed = true; } });
    await byClass(page.render(), "auth-form").props.onSubmit({ preventDefault });
    assert.equal(closed, true);
    assert.deepEqual(navigation, [[`/${role.toLowerCase()}-dashboard`, { replace: true }]]);
  });
}


test("auth UI source contains no mojibake or replacement characters", async () => {
  for (const file of [
    "components/modals/LoginModal.jsx", "components/modals/RegisterModal.jsx",
    "components/modals/ForgotPasswordModal.jsx", "components/auth/ResendVerification.jsx",
    "pages/Login.jsx", "pages/Register.jsx", "pages/ResetPassword.jsx", "pages/VerifyEmail.jsx",
  ]) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
    // Target malformed UTF-8 decoded as Western text, not valid punctuation/Unicode.
    assert.doesNotMatch(source, /[\u00c3\u00c2\ufffd]|\u00e2[\u0080-\u00bf\u2000-\u20ff]/, file);
  }
});
