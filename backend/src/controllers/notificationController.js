import { db } from "../config/database.js";
import { getNotificationPreferences, saveNotificationPreferences } from "../services/notificationPreferencesService.js";

import {
  getUserNotifications,
  readNotification,
  readAllNotifications,
} from "../services/notificationService.js";

export async function getPreferences(req, res) {
  res.set("Cache-Control", "no-store");
  res.json({ status: "success", preferences: await getNotificationPreferences(db, req.user) });
}

export async function savePreferences(req, res) {
  res.set("Cache-Control", "no-store");
  res.json({ status: "success", preferences: await saveNotificationPreferences(db, req.user, req.body) });
}

export async function getNotifications(req, res) {
  const notifications = await getUserNotifications(db, req.user.id);
  res.json({ status: "success", notifications });
}

export async function markAsRead(req, res) {
  const result = await readNotification(db, req.params.notificationId, req.user.id);
  res.json({ status: "success", ...result });
}

export async function markAllAsRead(req, res) {
  const result = await readAllNotifications(db, req.user.id);
  res.json({ status: "success", ...result });
}
