import "./requireTestDatabase.js";
import { randomBytes } from "node:crypto";
import { db } from "../../src/config/database.js";
import { hashToken } from "../../src/utils/authSecurity.js";
import { verifyEmail } from "../../src/services/emailVerificationService.js";
export async function verifyFixtureEmail(email) {
  const token = randomBytes(32).toString("base64url");
  await db.execute("UPDATE email_verification_tokens t JOIN users u ON u.id=t.user_id SET t.token_hash=? WHERE u.email=? AND t.used_at IS NULL AND t.revoked_at IS NULL", [hashToken(token), email]);
  await verifyEmail(token, "127.0.0.1");
}
