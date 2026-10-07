import { getStoredPreferences, upsertPreferences } from "../models/notificationPreferencesModel.js";
import { AppError } from "../utils/AppError.js";

const defaults = {
  Patient: { appointmentReminder: true, emailNotifications: true },
  Doctor: { appointments: true, followUps: true, system: false },
  Admin: { appointment: true, cancellation: true, reschedule: true, newPatient: true, security: true },
};

function defaultsFor(role) {
  if (!Object.hasOwn(defaults, role)) throw new AppError("Notification preferences are unavailable for this role.", 403, "FORBIDDEN");
  return defaults[role];
}

export async function getNotificationPreferences(executor, user) {
  const allowed = defaultsFor(user.role);
  const stored = await getStoredPreferences(executor, user.id);
  return Object.fromEntries(Object.entries(allowed).map(([key, fallback]) => [key, stored[key] ?? fallback]));
}

export async function saveNotificationPreferences(executor, user, preferences) {
  const allowed = defaultsFor(user.role);
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)
      || !Object.keys(preferences).length
      || Object.entries(preferences).some(([key, value]) => !Object.hasOwn(allowed, key) || typeof value !== "boolean")) {
    throw new AppError("Provide supported notification preferences with boolean values only.", 400, "INVALID_NOTIFICATION_PREFERENCES");
  }
  await upsertPreferences(executor, user.id, preferences);
  return getNotificationPreferences(executor, user);
}
