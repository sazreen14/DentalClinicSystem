import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import * as icons from "react-icons/fa";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

test("reset presentation preserves token, validation, submission and return to login", async () => {
  const source = await readFile(new URL("../src/pages/ResetPassword.jsx", import.meta.url), "utf8");
  const { code } = await transformWithOxc(source.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default ResetPassword;", ""), "ResetPassword.jsx", { jsx: { runtime: "classic" } });
  const states = [], requests = [], navigation = [];
  let index = 0, release, failure;
  const token = "local-test-token";
  const bindings = {
    React, ...icons,
    useMemo: callback => callback(),
    useState: initial => {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], value => { states[slot] = typeof value === "function" ? value(states[slot]) : value; }];
    },
    useSearchParams: () => [new URLSearchParams({ token })],
    useNavigate: () => (...args) => navigation.push(args),
    resetPassword: async data => { requests.push(data); await new Promise(resolve => { release = resolve; }); if (failure) throw new Error(failure); },
  };
  const Page = new Function(...Object.keys(bindings), `${code}\nreturn ResetPassword;`)(...Object.values(bindings));
  const render = () => { index = 0; return Page(); };
  function find(node, predicate) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    return React.Children.toArray(node.props?.children).map(child => find(child, predicate)).find(Boolean);
  }
  const html = () => renderToStaticMarkup(render());
  const enter = (name, value) => find(render(), node => node.props?.name === name).props.onChange({ target: { name, value } });
  const submit = () => find(render(), node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.match(html(), /verification-page reset-recovery-page/);
  assert.match(html(), /Klinik Pergigian Rosni Adam/);
  assert.match(html(), /Create a New Password/);
  assert.doesNotMatch(source, /ThemeToggle/);
  assert.doesNotMatch(html(), /local-test-token/);
  enter("newPassword", "weak");
  await submit();
  assert.match(html(), /uppercase, lowercase, and a number/);
  assert.equal(requests.length, 0);
  enter("newPassword", "DemoPassword2026!");
  enter("confirmPassword", "Mismatch2026!");
  await submit();
  assert.match(html(), /New passwords do not match/);
  assert.equal(requests.length, 0);
  enter("confirmPassword", "DemoPassword2026!");
  find(render(), node => node.props?.["aria-label"] === "Show New Password").props.onClick();
  assert.equal(find(render(), node => node.props?.name === "newPassword").props.type, "text");
  failure = "This reset link has expired.";
  let pending = submit();
  assert.equal(find(render(), node => node.props?.type === "submit").props.disabled, true);
  release(); await pending;
  assert.match(html(), /This reset link has expired/);
  assert.equal(find(render(), node => node.props?.type === "submit").props.disabled, false);
  failure = null;
  pending = submit(); release(); await pending;
  assert.deepEqual(requests[1], { token, newPassword: "DemoPassword2026!", confirmPassword: "DemoPassword2026!" });
  assert.match(html(), /Password Reset Successful/);
  find(render(), node => node.type === "button" && node.props.children === "Return to Login").props.onClick();
  assert.deepEqual(navigation, [["/", { state: { openLogin: true }, replace: true }]]);
});
