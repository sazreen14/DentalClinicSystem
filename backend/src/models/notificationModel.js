export async function listNotificationsForUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT notification_id, type, title, message_ciphertext,
            related_route, related_entity_type, related_entity_id,
            is_read, read_at, created_at
       FROM notifications
      WHERE recipient_user_id = ?
      ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  return rows;
}

export async function markNotificationAsRead(executor, notificationId, userId) {
  const [result] = await executor.execute(
    `UPDATE notifications
        SET is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE notification_id = ? AND recipient_user_id = ?`,
    [notificationId, userId],
  );
  return result.affectedRows > 0;
}

export async function markAllNotificationsAsRead(executor, userId) {
  const [result] = await executor.execute(
    `UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE recipient_user_id = ? AND is_read = FALSE`,
    [userId],
  );
  return result.affectedRows;
}

export async function insertNotification(executor, values) {
  const [result] = await executor.execute(
    `INSERT INTO notifications (
       notification_id, recipient_user_id, type, title,
       message_ciphertext, encryption_key_version,
       related_route, related_entity_type, related_entity_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.notificationId, values.recipientUserId, values.type, values.title,
      values.messageCiphertext, values.keyVersion, values.relatedRoute ?? null,
      values.relatedEntityType ?? null, values.relatedEntityId ?? null,
    ],
  );
  return result.insertId;
}

export async function listActiveAdminUserIds(executor) {
  const [rows] = await executor.execute(
    "SELECT id FROM users WHERE role = 'Admin' AND account_status = 'Active'",
  );
  return rows.map((row) => row.id);
}
