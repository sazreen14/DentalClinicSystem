CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  preference_key VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, preference_key),
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
