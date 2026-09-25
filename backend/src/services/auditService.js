import { db } from "../config/database.js";
import { insertAuditLog } from "../models/authModel.js";
import { hashIpAddress } from "../utils/authSecurity.js";

export function writeAudit(event, executor = db) {
  return insertAuditLog(executor, {
    ...event,
    ipAddressHash: hashIpAddress(event.ipAddress),
  });
}
