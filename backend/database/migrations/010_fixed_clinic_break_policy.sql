START TRANSACTION;

ALTER TABLE clinic_recurring_breaks
  ADD COLUMN is_fixed BOOLEAN NOT NULL DEFAULT FALSE AFTER is_enabled;

UPDATE clinic_recurring_breaks b
JOIN clinic_operating_hours h ON h.day_of_week=b.day_of_week AND h.is_open=TRUE
SET b.is_fixed=TRUE, b.is_enabled=TRUE
WHERE b.start_time='13:00:00' AND b.end_time='14:00:00';

COMMIT;
