export async function findUserByEmail(executor, email, { forUpdate = false } = {}) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.user_id, u.full_name, u.email, u.password_hash, u.role,
            u.account_status, u.email_verified_at, p.patient_id, d.doctor_id, d.professional_title
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN doctors d ON d.user_id = u.id
      WHERE u.email = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(executor, id) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.user_id, u.full_name, u.email, u.role, u.account_status, u.email_verified_at,
            p.patient_id, d.doctor_id, d.professional_title
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN doctors d ON d.user_id = u.id
      WHERE u.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findUserPasswordById(executor, id, { forUpdate = false } = {}) {
  const [rows] = await executor.execute(
    `SELECT id, password_hash FROM users WHERE id = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updatePasswordHash(executor, userId, passwordHash) {
  await executor.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
}

export async function findPatientByIdentityIndex(executor, blindIndex, { forUpdate = false } = {}) {
  const [rows] = await executor.execute(
    `SELECT id FROM patients WHERE identity_number_blind_index = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [blindIndex],
  );
  return rows[0] ?? null;
}

export async function insertUser(executor, user) {
  const [result] = await executor.execute(
    `INSERT INTO users (user_id, full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'Patient')`,
    [user.userId, user.fullName, user.email, user.passwordHash],
  );
  return result.insertId;
}

export async function insertPatient(executor, patient) {
  await executor.execute(
    `INSERT INTO patients (
       patient_id, user_id, identity_number_ciphertext,
       identity_number_blind_index, identity_number_key_version,
       date_of_birth, gender, phone_ciphertext, phone_blind_index,
       phone_key_version, address_ciphertext, address_key_version,
       registration_date
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)`,
    [
      patient.patientId, patient.userDatabaseId, patient.identityCiphertext,
      patient.identityBlindIndex, patient.identityKeyVersion,
      patient.dateOfBirth, patient.gender, patient.phoneCiphertext,
      patient.phoneBlindIndex, patient.phoneKeyVersion,
      patient.addressCiphertext, patient.addressKeyVersion,
    ],
  );
}

export async function updateLastLogin(executor, userId) {
  await executor.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [userId]);
}

export async function insertRefreshToken(executor, token) {
  await executor.execute(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [token.userId, token.tokenHash, token.expiresAt],
  );
}

export async function findRefreshTokenForUpdate(executor, tokenHash) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = ? FOR UPDATE`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function revokeRefreshToken(executor, tokenId) {
  await executor.execute(
    "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP), last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
    [tokenId],
  );
}

export async function revokeAllRefreshTokens(executor, userId) {
  const [result] = await executor.execute(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
    [userId],
  );
  return result.affectedRows;
}

export async function invalidatePasswordResetTokens(executor, userId, exceptId = null) {
  const params = [userId];
  let except = "";
  if (exceptId !== null) {
    except = " AND id <> ?";
    params.push(exceptId);
  }
  await executor.execute(
    `UPDATE password_reset_tokens SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
      WHERE user_id = ? AND used_at IS NULL${except}`,
    params,
  );
}

export async function insertPasswordResetToken(executor, token) {
  await executor.execute(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))",
    [token.userId, token.tokenHash, token.ttlMinutes],
  );
}

export async function findPasswordResetTokenForUpdate(executor, tokenHash) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, expires_at, used_at, (expires_at <= CURRENT_TIMESTAMP) AS is_expired
       FROM password_reset_tokens WHERE token_hash = ? FOR UPDATE`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(executor, tokenId) {
  await executor.execute(
    "UPDATE password_reset_tokens SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP) WHERE id = ?",
    [tokenId],
  );
}

export async function insertAuditLog(executor, event) {
  await executor.execute(
    `INSERT INTO security_audit_logs (user_id, event_type, outcome, ip_address_hash, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [event.userId ?? null, event.eventType, event.outcome, event.ipAddressHash ?? null, JSON.stringify(event.metadata ?? {})],
  );
}
