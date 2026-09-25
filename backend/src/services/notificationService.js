import { randomUUID } from "node:crypto";
import {
  encryptField,
  decryptField,
} from "./fieldEncryptionService.js";

import {
  listNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  insertNotification,
} from "../models/notificationModel.js";
import { AppError } from "../utils/AppError.js";

const MESSAGE_CONTEXT = "notifications.message";

function formatNotification(row) {
  return {
    id: row.notification_id,
    type: row.type,
    title: row.title,
    message: decryptField(row.message_ciphertext, MESSAGE_CONTEXT),
    relatedRoute: row.related_route,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    read: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function getUserNotifications(db, userId) {
  const rows = await listNotificationsForUser(db, userId);

  return rows.map(formatNotification);
}

export async function readNotification(db, notificationId, userId) {
  const updated = await markNotificationAsRead(
    db,
    notificationId,
    userId
  );

  if (!updated) {
    throw new AppError("Notification not found.", 404, "NOTIFICATION_NOT_FOUND");
  }

  return { success: true };
}

export async function readAllNotifications(db, userId) {
  const affectedRows = await markAllNotificationsAsRead(db, userId);

  return {
    success: true,
    updated: affectedRows,
  };
}

export async function createNotification(db, values) {
  const encryptedMessage = encryptField(
    values.message,
    MESSAGE_CONTEXT
  );

  const notificationId = `NTF-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 20)
    .toUpperCase()}`;

  await insertNotification(db, {
    notificationId,
    recipientUserId: values.recipientUserId,
    type: values.type,
    title: values.title,
    messageCiphertext: encryptedMessage.ciphertext,
    keyVersion: encryptedMessage.keyVersion,
    relatedRoute: values.relatedRoute,
    relatedEntityType: values.relatedEntityType,
    relatedEntityId: values.relatedEntityId,
  });

  return notificationId;
}
