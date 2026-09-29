export async function lockUser(executor, userId) {
  const [[user]] = await executor.execute("SELECT * FROM users WHERE id = ? FOR UPDATE", [userId]);
  return user;
}

export async function recentRequest(executor, userId, seconds) {
  const [[row]] = await executor.execute(
    "SELECT id FROM email_verification_tokens WHERE user_id = ? AND created_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? SECOND) LIMIT 1",
    [userId, seconds],
  );
  return Boolean(row);
}

export async function revokeTokens(executor, userId) {
  await executor.execute("UPDATE email_verification_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL", [userId]);
}

export async function insertToken(executor, { userId, tokenHash, purpose, emailCiphertext, ttl }) {
  await executor.execute(
    "INSERT INTO email_verification_tokens (user_id, token_hash, purpose, email_ciphertext, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))",
    [userId, tokenHash, purpose, emailCiphertext, ttl],
  );
}

export async function tokenByHash(executor, hash, lock = false) {
  const [[row]] = await executor.execute(`SELECT *, expires_at <= CURRENT_TIMESTAMP AS expired FROM email_verification_tokens WHERE token_hash = ?${lock ? " FOR UPDATE" : ""}`, [hash]);
  return row;
}

export async function pendingChange(executor, userId) {
  const [[row]] = await executor.execute("SELECT email_ciphertext FROM email_verification_tokens WHERE user_id = ? AND purpose = 'email_change' AND used_at IS NULL AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1", [userId]);
  return row;
}
