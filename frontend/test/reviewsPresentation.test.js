import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "react-icons/fa";
import { transformWithOxc } from "vite";
import { getGoogleReviewsLinkState } from "../src/utils/reviewsPresentation.js";

test("Reviews presents four safe links and exactly three supplied static review excerpts", async () => {
  const source = await readFile(new URL("../src/components/Reviews.jsx", import.meta.url), "utf8");
  const { code } = await transformWithOxc(source.replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default Reviews;", ""), "Reviews.jsx", { jsx: { runtime: "classic" } });
  for (const url of ["https://g.page/r/example/review", "", "https://example.com/reviews"]) {
    const bindings = { React, ...icons, publicClinicConfig: { googleReviewsUrl: url }, getGoogleReviewsLinkState };
    const Reviews = new Function(...Object.keys(bindings), `${code}\nreturn Reviews;`)(...Object.values(bindings));
    const html = renderToStaticMarkup(React.createElement(Reviews));
    assert.match(html, /What Our Patients/);
    assert.match(html, /Say About Us/);
    assert.match(html, /src="\/clinic-reviews\.jpg"/);
    assert.doesNotMatch(html, /reviews-dental-art/);
    assert.doesNotMatch(html, /Share Your Experience|YOUR VOICE MATTERS|Write a Review on Google|reviews-share|reviews-notice|Reviews are viewed and submitted through Google/);
    assert.doesNotMatch(html, /PATIENT EXPERIENCES|reviews-experiences-heading|Read experiences shared by patients/);
    assert.doesNotMatch(html, /Help Other Patients/);
    assert.doesNotMatch(html, /Support Our Clinic/);
    assert.doesNotMatch(html, /Better Dental Care/);
    assert.equal((html.match(/class="reviews-patient-card"/g) || []).length, 3);
    assert.equal((html.match(/aria-label="5 out of 5 stars"/g) || []).length, 3);
    assert.match(html, /IR\. NOORSYARINI ROSARIA BINTI NO\.\.\./);
    assert.match(html, /remove my wisdom \.\.\./);
    assert.match(html, /Cappuccino Latte/);
    assert.match(html, /Yatie/);
    assert.match(html, /overall is good\. ?/);
    assert.match(html, /5 months ago/);
    assert.equal((html.match(/2 years ago/g) || []).length, 2);
    assert.match(html, /Static excerpts/);
    assert.ok(html.indexOf('class="reviews-hero"') < html.indexOf('class="reviews-experiences"'));
    if (getGoogleReviewsLinkState(url) === "available") {
      assert.equal((html.match(/<a /g) || []).length, 4);
      assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 4);
      assert.equal((html.match(/href="https:\/\/g.page\/r\/example\/review"/g) || []).length, 4);
    } else {
      assert.doesNotMatch(html, /<a /);
      assert.match(html, /Google review link unavailable/);
    }
    assert.doesNotMatch(html, /\d[.,]\d\s*(?:stars|out of)|\d+ reviews/i);
  }
});

test("Google Reviews direct link accepts official HTTPS Google URLs", () => {
  assert.equal(getGoogleReviewsLinkState("https://www.google.com/maps/place/example"), "available");
  assert.equal(getGoogleReviewsLinkState("https://maps.app.goo.gl/example"), "available");
  assert.equal(getGoogleReviewsLinkState("https://g.page/r/example/review"), "available");
});

test("Google Reviews direct link reports missing configuration", () => {
  assert.equal(getGoogleReviewsLinkState(""), "missing");
});

test("Google Reviews direct link rejects non-Google or unsafe URLs", () => {
  assert.equal(getGoogleReviewsLinkState("http://www.google.com/maps/place/example"), "invalid");
  assert.equal(getGoogleReviewsLinkState("https://example.com/reviews"), "invalid");
  assert.equal(getGoogleReviewsLinkState("not a URL"), "invalid");
});
