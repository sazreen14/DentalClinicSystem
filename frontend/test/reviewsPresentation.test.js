import assert from "node:assert/strict";
import test from "node:test";
import { getGoogleReviewsLinkState } from "../src/utils/reviewsPresentation.js";

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
