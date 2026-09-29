import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import * as icons from "react-icons/fa";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const source = await readFile(new URL("../src/pages/VerifyEmail.jsx", import.meta.url), "utf8");
const { code } = await transformWithOxc(source.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default function", "function"), "VerifyEmail.jsx", { jsx: { runtime: "classic" } });

for (const [outcome, title] of [
  [null, "Email verified successfully"],
  ["ALREADY_VERIFIED", "Email already verified"],
  ["EXPIRED_VERIFICATION_TOKEN", "Verification link expired"],
  ["INVALID_VERIFICATION_TOKEN", "Invalid verification link"],
  ["NETWORK_ERROR", "Verification could not be completed"],
]) {
  test(`verification page renders ${title} and Strict Mode sends one request`, async () => {
    const states = [], ref = { current: null };
    let index = 0, effect, requests = 0, historyWrites = 0;
    const navigation = [];
    const bindings = {
      React,
      ...icons,
      useState: initial => {
        const slot = index++;
        if (!(slot in states)) states[slot] = typeof initial === "function" ? initial() : initial;
        return [states[slot], value => { states[slot] = value; }];
      },
      useRef: () => ref,
      useEffect: callback => { effect = callback; },
      useNavigate: () => (...args) => navigation.push(args),
      ResendVerification: () => React.createElement("button", null, "Resend Verification Email"),
      window: { location: { hash: `#token=${"a".repeat(43)}`, pathname: "/verify-email" }, history: { state: null, replaceState: (_state, _unused, url) => { assert.equal(url, "/verify-email"); historyWrites++; } } },
      verifyEmail: async token => { requests++; assert.equal(token, "a".repeat(43)); if (outcome) throw Object.assign(new Error("Result message"), { code: outcome }); return { message: "You can now log in." }; },
    };
    const Page = new Function(...Object.keys(bindings), `${code}\nreturn VerifyEmail;`)(...Object.values(bindings));
    const loading = renderToStaticMarkup(React.createElement(Page));
    assert.match(loading, /Verifying your email/);
    assert.match(loading, /verification-spinner/);
    assert.match(loading, /aria-busy="true"/);
    assert.doesNotMatch(loading, /<footer|theme-toggle|Dark Mode/);
    const cleanup = effect(); cleanup(); effect();
    await ref.current; await Promise.resolve();
    index = 0;
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.ok(html.replace(/<[^>]*>/g, "").includes(title));
    assert.match(html, /aria-busy="false"/);
    assert.doesNotMatch(html, /verification-spinner|<footer|theme-toggle|Dark Mode/);
    assert.match(html, /Klinik Pergigian Rosni Adam/);
    if (outcome) assert.match(html, /Result message/);
    else assert.match(html, /Your email has been verified successfully\. You can now log in to access your patient account\./);
    if (outcome === "ALREADY_VERIFIED") assert.match(html, /verification-card--info/);
    index = 0;
    const tree = Page();
    function findLogin(node) {
      if (!node || typeof node !== "object") return null;
      if (node.props?.className === "verification-login") return node;
      return React.Children.toArray(node.props?.children).map(findLogin).find(Boolean);
    }
    findLogin(tree).props.onClick();
    assert.deepEqual(navigation, [["/", { state: { openLogin: true }, replace: true }]]);
    assert.equal(requests, 1); assert.equal(historyWrites, 2);
    assert.equal(html.includes("Resend Verification Email"), Boolean(outcome && outcome !== "ALREADY_VERIFIED"));
    assert.ok(!html.includes("a".repeat(43)));
  });
}

test("verification route is outside session-restoration remounts", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const publicApp = app.slice(app.indexOf("function App()"));
  assert.match(publicApp, /path="\/verify-email" element={<VerifyEmail \/>}/);
  assert.doesNotMatch(publicApp, /<AuthProvider>/);
});
