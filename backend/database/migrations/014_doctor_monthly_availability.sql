CREATE TABLE doctor_monthly_availability (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT UNSIGNED NOT NULL,
  week_of_month TINYINT UNSIGNED NOT NULL,
  day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_monthly_availability_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_monthly_availability_week CHECK (week_of_month BETWEEN 1 AND 5),
  UNIQUE KEY uq_doctor_monthly_weekday (doctor_id,week_of_month,day_of_week)
) ENGINE=InnoDB;
