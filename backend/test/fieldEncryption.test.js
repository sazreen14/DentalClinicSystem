import assert from "node:assert/strict";
import test from "node:test";
import { createBlindIndex } from "../src/utils/authSecurity.js";
import { decryptField, encryptField } from "../src/services/fieldEncryptionService.js";
import { normalizeIdentityNumber, normalizePhone } from "../src/utils/sensitiveFieldNormalization.js";

test("AES-256-GCM round-trip uses unique IVs", () => {
  const value = normalizeIdentityNumber("TEST-900101-01-1234");
  const first = encryptField(value, "patients.identity_number");
  const second = encryptField(value, "patients.identity_number");
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(decryptField(first.ciphertext, "patients.identity_number"), value);
  assert.equal(decryptField(second.ciphertext, "patients.identity_number"), value);
});

test("authentication-tag tampering is rejected", () => {
  const encrypted = encryptField("synthetic sensitive value", "patients.address");
  const envelope = JSON.parse(encrypted.ciphertext);
  const tag = Buffer.from(envelope.tag, "base64url");
  tag[0] ^= 0xff;
  envelope.tag = tag.toString("base64url");
  assert.throws(() => decryptField(JSON.stringify(envelope), "patients.address"));
});

test("identity and phone blind indexes are normalized and deterministic", () => {
  const identityA = normalizeIdentityNumber("TEST-900101-01-1234");
  const identityB = normalizeIdentityNumber("test 900101 01 1234");
  const phoneA = normalizePhone("012-345 6789");
  const phoneB = normalizePhone("+60 12 345 6789");
  assert.equal(identityA, identityB);
  assert.equal(phoneA, phoneB);
  assert.equal(createBlindIndex(identityA, "identity"), createBlindIndex(identityB, "identity"));
  assert.equal(createBlindIndex(phoneA, "phone"), createBlindIndex(phoneB, "phone"));
  assert.notEqual(createBlindIndex(identityA, "identity"), createBlindIndex(phoneA, "phone"));
});
