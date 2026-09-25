import { createHash, createHmac } from "node:crypto";
import { env } from "../config/env.js";

export function createBlindIndex(value, field) {
  const key = field === "identity" ? env.crypto.identityBlindIndexKey : env.crypto.phoneBlindIndexKey;
  return createHmac("sha256", key).update(`${field}:${value}`, "utf8").digest("hex");
}

export function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashIpAddress(ipAddress = "unknown") {
  return createHmac("sha256", env.crypto.identityBlindIndexKey).update(`ip:${ipAddress}`, "utf8").digest("hex");
}
