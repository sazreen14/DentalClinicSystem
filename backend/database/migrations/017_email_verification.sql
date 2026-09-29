-- Existing patients must verify too; no assumed ownership of legacy addresses.
ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL;

CREATE TABLE email_verification_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  purpose ENUM('registration', 'email_change') NOT NULL,
  email_ciphertext TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_email_verification_user_created (user_id, created_at),
  INDEX idx_email_verification_expiry (expires_at)
) ENGINE=InnoDB;
