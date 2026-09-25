import { randomUUID } from "node:crypto";

function publicId(prefix) {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

export const createUserId = () => publicId("USR");
export const createPatientId = () => publicId("PT");
