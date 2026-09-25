import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import {
  findPatientByIdentityIndex, findPasswordResetTokenForUpdate, findRefreshTokenForUpdate, findUserByEmail,
  findUserById, findUserPasswordById, insertPatient, insertRefreshToken, insertUser,
  insertPasswordResetToken, invalidatePasswordResetTokens, markPasswordResetTokenUsed,
  revokeAllRefreshTokens, revokeRefreshToken, updateLastLogin, updatePasswordHash,
} from "../models/authModel.js";
import { createTokenPair, verifyRefreshToken } from "./tokenService.js";
import { writeAudit } from "./auditService.js";
import { encryptField } from "./fieldEncryptionService.js";
import { createBlindIndex, hashToken } from "../utils/authSecurity.js";
import { createPatientId, createUserId } from "../utils/identifiers.js";
import { normalizeAddress, normalizeIdentityNumber, normalizePhone } from "../utils/sensitiveFieldNormalization.js";
import { AppError } from "../utils/AppError.js";
import { sendPasswordResetEmail } from "./emailService.js";

const INVALID_CREDENTIALS = "Invalid email or password.";
export const PASSWORD_RESET_REQUEST_MESSAGE = "If an account exists for this email, a password reset link has been sent.";

export async function inTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function safeUser(user) {
  const result = {
    userId: user.user_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    accountStatus: user.account_status,
  };
  if (user.role === "Patient") result.patientId = user.patient_id;
  if (user.role === "Doctor") {
    result.doctorId = user.doctor_id;
    if (user.professional_title) result.professionalTitle = user.professional_title;
  }
  return result;
}

export async function registerPatient(input, ipAddress) {
  const email = input.email.trim().toLowerCase();
  const identity = normalizeIdentityNumber(input.identityNumber);
  const phone = normalizePhone(input.phone);
  const address = normalizeAddress(input.address);
  const identityEncrypted = encryptField(identity, "patients.identity_number");
  const phoneEncrypted = encryptField(phone, "patients.phone");
  const addressEncrypted = encryptField(address, "patients.address");
  const identityBlindIndex = createBlindIndex(identity, "identity");
  const phoneBlindIndex = createBlindIndex(phone, "phone");
  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);
  const userId = createUserId();
  const patientId = createPatientId();

  try {
    return await inTransaction(async (connection) => {
      if (await findUserByEmail(connection, email, { forUpdate: true })) throw new AppError("An account with these details already exists.", 409, "ACCOUNT_EXISTS");
      if (await findPatientByIdentityIndex(connection, identityBlindIndex, { forUpdate: true })) throw new AppError("An account with these details already exists.", 409, "ACCOUNT_EXISTS");
      const userDatabaseId = await insertUser(connection, { userId, fullName: input.fullName.trim(), email, passwordHash });
      await insertPatient(connection, {
        patientId, userDatabaseId, identityCiphertext: identityEncrypted.ciphertext,
        identityBlindIndex, identityKeyVersion: identityEncrypted.keyVersion,
        dateOfBirth: input.dateOfBirth, gender: input.gender,
        phoneCiphertext: phoneEncrypted.ciphertext, phoneBlindIndex,
        phoneKeyVersion: phoneEncrypted.keyVersion,
        addressCiphertext: addressEncrypted.ciphertext,
        addressKeyVersion: addressEncrypted.keyVersion,
      });
      await writeAudit({ userId: userDatabaseId, eventType: "PATIENT_REGISTERED", outcome: "Success", ipAddress }, connection);
      return { userId, patientId, fullName: input.fullName.trim(), email, role: "Patient", accountStatus: "Active" };
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw new AppError("An account with these details already exists.", 409, "ACCOUNT_EXISTS");
    throw error;
  }
}

export async function login(input, ipAddress) {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(db, email);
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    await writeAudit({ userId: user?.id, eventType: "LOGIN_FAILED", outcome: "Failure", ipAddress });
    throw new AppError(INVALID_CREDENTIALS, 401, "INVALID_CREDENTIALS");
  }
  if (user.account_status !== "Active") {
    await writeAudit({ userId: user.id, eventType: "ACCOUNT_INACTIVE_LOGIN_ATTEMPT", outcome: "Failure", ipAddress });
    throw new AppError(INVALID_CREDENTIALS, 401, "INVALID_CREDENTIALS");
  }
  const pair = createTokenPair(user);
  await inTransaction(async (connection) => {
    await insertRefreshToken(connection, { userId: user.id, tokenHash: pair.refresh.hash, expiresAt: pair.refresh.expiresAt });
    await updateLastLogin(connection, user.id);
    await writeAudit({ userId: user.id, eventType: "LOGIN_SUCCESS", outcome: "Success", ipAddress }, connection);
  });
  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, refreshExpiresAt: pair.refresh.expiresAt, user: safeUser(user) };
}

export async function refresh(rawToken, ipAddress) {
  const payload = verifyRefreshToken(rawToken);
  return inTransaction(async (connection) => {
    const stored = await findRefreshTokenForUpdate(connection, hashToken(rawToken));
    if (!stored || stored.revoked_at || new Date(stored.expires_at) <= new Date() || String(stored.user_id) !== payload.sub) throw new AppError("Invalid or expired refresh token.", 401, "INVALID_REFRESH_TOKEN");
    const user = await findUserById(connection, stored.user_id);
    if (!user || user.account_status !== "Active") throw new AppError("Invalid or expired refresh token.", 401, "INVALID_REFRESH_TOKEN");
    const pair = createTokenPair(user);
    await revokeRefreshToken(connection, stored.id);
    await insertRefreshToken(connection, { userId: user.id, tokenHash: pair.refresh.hash, expiresAt: pair.refresh.expiresAt });
    await writeAudit({ userId: user.id, eventType: "TOKEN_REFRESH", outcome: "Success", ipAddress }, connection);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, refreshExpiresAt: pair.refresh.expiresAt };
  });
}

export async function logout(rawToken, ipAddress) {
  verifyRefreshToken(rawToken);
  return inTransaction(async (connection) => {
    const stored = await findRefreshTokenForUpdate(connection, hashToken(rawToken));
    if (!stored || stored.revoked_at) throw new AppError("Invalid or expired refresh token.", 401, "INVALID_REFRESH_TOKEN");
    await revokeRefreshToken(connection, stored.id);
    await writeAudit({ userId: stored.user_id, eventType: "LOGOUT", outcome: "Success", ipAddress }, connection);
  });
}

export async function logoutAll(userId, ipAddress) {
  return inTransaction(async (connection) => {
    await revokeAllRefreshTokens(connection, userId);
    await writeAudit({ userId, eventType: "LOGOUT_ALL", outcome: "Success", ipAddress }, connection);
  });
}

export async function getCurrentUser(userId) {
  const user = await findUserById(db, userId);
  if (!user || user.account_status !== "Active") throw new AppError("Authenticated account is unavailable.", 401, "ACCOUNT_UNAVAILABLE");
  return safeUser(user);
}

export async function changePassword(userId, input, ipAddress) {
  try {
    return await inTransaction(async (connection) => {
      const user = await findUserPasswordById(connection, userId, { forUpdate: true });
      if (!user || !(await bcrypt.compare(input.currentPassword, user.password_hash))) {
        throw new AppError("Current password is incorrect.", 400, "INVALID_CURRENT_PASSWORD");
      }
      const passwordHash = await bcrypt.hash(input.newPassword, env.bcryptSaltRounds);
      await updatePasswordHash(connection, userId, passwordHash);
      await writeAudit({ userId, eventType: "PASSWORD_CHANGED", outcome: "Success", ipAddress }, connection);
      return { message: "Password updated successfully." };
    });
  } catch (error) {
    if (error.code === "INVALID_CURRENT_PASSWORD") {
      await writeAudit({ userId, eventType: "PASSWORD_CHANGE_FAILED", outcome: "Failure", ipAddress });
    }
    throw error;
  }
}

export async function forgotPassword(input, ipAddress, emailSender = sendPasswordResetEmail) {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(db, email);
  if (!user || user.account_status !== "Active") {
    if (user) await writeAudit({ userId: user.id, eventType: "PASSWORD_RESET_REQUESTED", outcome: "Success", ipAddress });
    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  await inTransaction(async (connection) => {
    await invalidatePasswordResetTokens(connection, user.id);
    await insertPasswordResetToken(connection, { userId: user.id, tokenHash, ttlMinutes: env.passwordResetTokenTtlMinutes });
    await writeAudit({ userId: user.id, eventType: "PASSWORD_RESET_REQUESTED", outcome: "Success", ipAddress }, connection);
  });

  try {
    const resetUrl = `${env.frontendOrigin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const result = await emailSender({
      recipientEmail: user.email,
      recipientName: user.full_name,
      resetUrl,
      expiresInMinutes: env.passwordResetTokenTtlMinutes,
    });
    if (result.status !== "sent" && result.status !== "test") {
      await writeAudit({ userId: user.id, eventType: "PASSWORD_RESET_EMAIL_NOT_SENT", outcome: "Failure", ipAddress, metadata: { status: result.status } });
    }
  } catch {
    await writeAudit({ userId: user.id, eventType: "PASSWORD_RESET_EMAIL_FAILED", outcome: "Failure", ipAddress });
  }
  return { message: PASSWORD_RESET_REQUEST_MESSAGE };
}

export async function resetPassword(input, ipAddress) {
  const tokenHash = hashToken(input.token);
  return inTransaction(async (connection) => {
    const stored = await findPasswordResetTokenForUpdate(connection, tokenHash);
    if (!stored) throw new AppError("This password reset link is invalid.", 400, "INVALID_RESET_TOKEN");
    if (stored.used_at) throw new AppError("This password reset link has already been used.", 400, "USED_RESET_TOKEN");
    if (Boolean(stored.is_expired)) {
      await markPasswordResetTokenUsed(connection, stored.id);
      throw new AppError("This password reset link has expired.", 400, "EXPIRED_RESET_TOKEN");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, env.bcryptSaltRounds);
    await updatePasswordHash(connection, stored.user_id, passwordHash);
    await markPasswordResetTokenUsed(connection, stored.id);
    await invalidatePasswordResetTokens(connection, stored.user_id, stored.id);
    await revokeAllRefreshTokens(connection, stored.user_id);
    await writeAudit({ userId: stored.user_id, eventType: "PASSWORD_RESET_COMPLETED", outcome: "Success", ipAddress }, connection);
    return { message: "Your password has been updated. You can now log in using your new password." };
  });
}
