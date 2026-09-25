START TRANSACTION;

CREATE TABLE IF NOT EXISTS clinic_recurring_breaks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_clinic_break_interval CHECK (start_time < end_time),
  UNIQUE KEY uq_clinic_break_interval (day_of_week, start_time, end_time),
  INDEX idx_clinic_break_lookup (day_of_week, is_enabled, start_time, end_time)
) ENGINE=InnoDB;

INSERT INTO clinic_recurring_breaks (day_of_week, start_time, end_time, is_enabled)
SELECT day_of_week, '13:00:00', '14:00:00', TRUE
FROM clinic_operating_hours
WHERE is_open = TRUE
ON DUPLICATE KEY UPDATE is_enabled = TRUE;

COMMIT;
