import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const ENVELOPE_ALGORITHM = "A256GCM";

export function encryptField(value, context) {
  if (typeof value !== "string" || !value.length) throw new TypeError("A non-empty string is required");
  if (!context) throw new TypeError("Encryption context is required");
  const keyVersion = env.crypto.activeKeyVersion;
  const key = env.crypto.dataKeys.get(keyVersion);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(`${context}:v${keyVersion}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const envelope = {
    v: keyVersion,
    alg: ENVELOPE_ALGORITHM,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
  return { ciphertext: JSON.stringify(envelope), keyVersion };
}

export function decryptField(serializedEnvelope, context) {
  if (!context) throw new TypeError("Encryption context is required");
  const envelope = JSON.parse(serializedEnvelope);
  if (envelope.alg !== ENVELOPE_ALGORITHM || !Number.isInteger(envelope.v)) throw new Error("Unsupported encrypted field envelope");
  const key = env.crypto.dataKeys.get(envelope.v);
  if (!key) throw new Error("Unknown encryption key version");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64url"), { authTagLength: 16 });
  decipher.setAAD(Buffer.from(`${context}:v${envelope.v}`, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
