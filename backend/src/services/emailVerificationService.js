import { randomBytes } from "node:crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import * as model from "../models/emailVerificationModel.js";
import { findUserByEmail } from "../models/authModel.js";
import { inTransaction } from "./authService.js";
import {
  encryptField,
  decryptField,
} from "./fieldEncryptionService.js";
import {
  sendVerificationEmail,
  sendEmailChangedNotification,
} from "./emailService.js";
import { hashToken } from "../utils/authSecurity.js";
import { writeAudit } from "./auditService.js";
import { AppError } from "../utils/AppError.js";

const CONTEXT = "email_verification_tokens.email";

export const RESEND_MESSAGE =
  "If this address belongs to an eligible account, a verification email will be sent. Please wait a minute before trying again.";


// Check whether a patient has verified their email
export function requireVerifiedPatient(user) {
  if (user.role === "Patient" && !user.email_verified_at) {
    throw new AppError(
      "Please verify your registered email before logging in. You can request another verification email.",
      403,
      "EMAIL_VERIFICATION_REQUIRED"
    );
  }
}


// Prepare a new email verification request
export async function prepareVerification(
  connection,
  user,
  email,
  purpose,
  ipAddress,
  resend = false
) {
  const recentRequest = await model.recentRequest(
    connection,
    user.id,
    env.emailVerificationCooldownSeconds
  );

  // Prevent too many verification requests
  if (recentRequest) {
    if (purpose === "registration") {
      return null;
    }

    throw new AppError(
      "Please wait a minute before requesting another email change.",
      429,
      "VERIFICATION_COOLDOWN"
    );
  }

  // Generate a secure random verification token
  const rawToken = randomBytes(32).toString("base64url");

  // Revoke previous verification tokens
  await model.revokeTokens(connection, user.id);

  // Store only the hashed token in the database
  const tokenHash = hashToken(rawToken);
  const encryptedEmail = encryptField(email, CONTEXT).ciphertext;

  await model.insertToken(connection, {
    userId: user.id,
    tokenHash,
    purpose,
    emailCiphertext: encryptedEmail,
    ttl: env.emailVerificationTtlMinutes,
  });

  // Record verification request in the audit log
  let eventType = "EMAIL_VERIFICATION_REQUESTED";

  if (purpose === "email_change") {
    eventType = "EMAIL_CHANGE_REQUESTED";
  } else if (resend) {
    eventType = "EMAIL_VERIFICATION_RESENT";
  }

  await writeAudit(
    {
      userId: user.id,
      eventType,
      outcome: "Success",
      ipAddress,
    },
    connection
  );

  // Create the verification link
  const frontendOrigin = env.frontendOrigin.replace(/\/$/, "");

  const verificationUrl =
    `${frontendOrigin}/verify-email` +
    `#token=${encodeURIComponent(rawToken)}`;

  return {
    userId: user.id,
    recipientEmail: email,
    recipientName: user.full_name,
    purpose,
    verificationUrl,
    expiresInMinutes: env.emailVerificationTtlMinutes,
  };
}


// Send the verification email
export async function deliverVerification(
  mail,
  ipAddress,
  sender = sendVerificationEmail
) {
  if (!mail) {
    return;
  }

  let sent = false;

  try {
    const result = await sender(mail);
    sent = ["sent", "test"].includes(result.status);
  } catch {
    // SMTP errors and verification links are not logged
  }

  await writeAudit({
    userId: mail.userId,
    eventType: sent
      ? "EMAIL_VERIFICATION_SENT"
      : "EMAIL_VERIFICATION_DELIVERY_FAILED",
    outcome: sent ? "Success" : "Failure",
    ipAddress,
  });
}


// Resend verification email
export async function resendVerification(
  email,
  ipAddress,
  sender
) {
  const normalizedEmail = email.trim().toLowerCase();
  const found = await findUserByEmail(db, normalizedEmail);

  if (found) {
    const mail = await inTransaction(async (connection) => {
      const user = await model.lockUser(connection, found.id);

      if (
        !user ||
        user.email !== normalizedEmail ||
        user.role !== "Patient" ||
        user.account_status !== "Active" ||
        user.email_verified_at
      ) {
        return null;
      }

      return prepareVerification(
        connection,
        user,
        user.email,
        "registration",
        ipAddress,
        true
      );
    });

    await deliverVerification(mail, ipAddress, sender);
  }

  return {
    message: RESEND_MESSAGE,
  };
}


// Prepare a request to change patient email
export async function prepareEmailChange(
  connection,
  userId,
  email,
  ipAddress
) {
  const user = await model.lockUser(connection, userId);

  if (
    !user ||
    user.role !== "Patient" ||
    user.account_status !== "Active"
  ) {
    throw new AppError(
      "Patient account unavailable.",
      403,
      "ACCOUNT_UNAVAILABLE"
    );
  }

  requireVerifiedPatient(user);

  if (email === user.email) {
    return null;
  }

  const owner = await findUserByEmail(connection, email);

  if (owner && owner.id !== user.id) {
    throw new AppError(
      "Email is already in use.",
      409,
      "EMAIL_EXISTS"
    );
  }

  return prepareVerification(
    connection,
    user,
    email,
    "email_change",
    ipAddress
  );
}


// Request patient email change
export async function requestEmailChange(
  userId,
  email,
  ipAddress,
  sender
) {
  const normalizedEmail = email.trim().toLowerCase();

  const mail = await inTransaction((connection) =>
    prepareEmailChange(
      connection,
      userId,
      normalizedEmail,
      ipAddress
    )
  );

  await deliverVerification(mail, ipAddress, sender);

  return {
    message: mail
      ? "Check your new email to confirm the change. Your current email remains active."
      : "This is already your current email.",
  };
}


// Get pending email change
export async function getPendingEmail(userId) {
  const row = await model.pendingChange(db, userId);

  if (!row) {
    return null;
  }

  return decryptField(row.email_ciphertext, CONTEXT);
}


// Verify the email using the token from the verification link
export async function verifyEmail(
  rawToken,
  ipAddress,
  notificationSender = sendEmailChangedNotification
) {
  try {
    // Validate token format
    const validTokenFormat =
      typeof rawToken === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(rawToken);

    if (!validTokenFormat) {
      throw new AppError(
        "This verification link is invalid.",
        400,
        "INVALID_VERIFICATION_TOKEN"
      );
    }

    const hash = hashToken(rawToken);

    const result = await inTransaction(async (connection) => {
      const found = await model.tokenByHash(
        connection,
        hash
      );

      if (!found) {
        throw new AppError(
          "This verification link is invalid.",
          400,
          "INVALID_VERIFICATION_TOKEN"
        );
      }

      const user = await model.lockUser(
        connection,
        found.user_id
      );

      const token = await model.tokenByHash(
        connection,
        hash,
        true
      );

      // Check account and token status
      if (
        !user ||
        user.role !== "Patient" ||
        user.account_status !== "Active" ||
        token.revoked_at
      ) {
        throw new AppError(
          "This verification link is invalid or revoked.",
          400,
          "INVALID_VERIFICATION_TOKEN"
        );
      }

      // Prevent token reuse
      if (token.used_at) {
        throw new AppError(
          "This email has already been verified. This link cannot be used again.",
          409,
          "ALREADY_VERIFIED"
        );
      }

      // Check token expiry
      if (token.expired) {
        throw new AppError(
          "This verification link has expired. Request a new link.",
          400,
          "EXPIRED_VERIFICATION_TOKEN"
        );
      }

      // Decrypt the email stored with the token
      const email = decryptField(
        token.email_ciphertext,
        CONTEXT
      );

      if (
        token.purpose === "registration" &&
        (user.email_verified_at || email !== user.email)
      ) {
        throw new AppError(
          "This verification link is invalid.",
          400,
          "INVALID_VERIFICATION_TOKEN"
        );
      }

      // Make sure the email is not used by another account
      const owner = await findUserByEmail(
        connection,
        email
      );

      if (owner && owner.id !== user.id) {
        throw new AppError(
          "Email is already in use. Request a different email change.",
          409,
          "EMAIL_EXISTS"
        );
      }

      // Mark the email as verified
      await connection.execute(
        `UPDATE users
         SET email = ?, email_verified_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [email, user.id]
      );

      // Mark verification token as used
      await connection.execute(
        `UPDATE email_verification_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [token.id]
      );

      // Revoke any remaining verification tokens
      await model.revokeTokens(
        connection,
        user.id
      );

      const verificationEvent =
        token.purpose === "registration"
          ? "EMAIL_VERIFIED"
          : "EMAIL_CHANGE_VERIFIED";

      await writeAudit(
        {
          userId: user.id,
          eventType: verificationEvent,
          outcome: "Success",
          ipAddress,
        },
        connection
      );

      const message =
        token.purpose === "registration"
          ? "Email verified successfully. You can now log in."
          : "Your new email is verified and is now your login email.";

      return {
        userId: user.id,
        previousEmail: user.email,
        message,
        purpose: token.purpose,
      };
    });

    // Notify the previous email after an email change
    if (result.purpose === "email_change") {
      let sent = false;

      try {
        const notificationResult =
          await notificationSender({
            recipientEmail: result.previousEmail,
          });

        sent = ["sent", "test"].includes(
          notificationResult.status
        );
      } catch {
        // Email change remains valid even if notification fails
      }

      await writeAudit({
        userId: result.userId,
        eventType: sent
          ? "EMAIL_CHANGE_NOTIFICATION_SENT"
          : "EMAIL_CHANGE_NOTIFICATION_FAILED",
        outcome: sent ? "Success" : "Failure",
        ipAddress,
      });
    }

    return {
      message: result.message,
      purpose: result.purpose,
    };
  } catch (error) {
    const errorCode =
      error.code === "ER_DUP_ENTRY"
        ? "EMAIL_EXISTS"
        : error.code || "VERIFICATION_FAILED";

    await writeAudit({
      eventType: "EMAIL_VERIFICATION_FAILED",
      outcome: "Failure",
      ipAddress,
      metadata: {
        code: errorCode,
      },
    });

    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError(
        "Email is already in use. Request a different email change.",
        409,
        "EMAIL_EXISTS"
      );
    }

    throw error;
  }
}