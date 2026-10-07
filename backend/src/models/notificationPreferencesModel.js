export async function getStoredPreferences(executor, userId) {
  const [rows] = await executor.execute(
    "SELECT preference_key, enabled FROM notification_preferences WHERE user_id = ?",
    [userId],
  );
  return Object.fromEntries(rows.map(row => [row.preference_key, Boolean(row.enabled)]));
}

export async function upsertPreferences(executor, userId, preferences) {
  const entries = Object.entries(preferences);
  await executor.execute(
    `INSERT INTO notification_preferences (user_id, preference_key, enabled)
     VALUES ${entries.map(() => "(?, ?, ?)").join(", ")}
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
    entries.flatMap(([key, value]) => [userId, key, value]),
  );
}
