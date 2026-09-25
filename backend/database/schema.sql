-- Proposed MySQL 8 schema for Klinik Pergigian Rosni Adam.
-- REVIEW FILE ONLY: do not execute until the schema is explicitly approved.
--
-- Design rules:
--   * Deactivation is used instead of deleting accounts or services.
--   * Appointment, clinical, treatment, and security history is retained.
--   * Columns ending in _ciphertext are prepared for authenticated
--     application-level encryption. Encryption keys are never stored here.
--   * Blind indexes are keyed hashes calculated by the application and allow
--     exact matching without storing searchable plaintext.
--   * Patient/Doctor profile creation and role consistency must be enforced in
--     service-layer transactions (Patient -> patient profile, Doctor -> doctor
--     profile, Admin -> no role profile required).

CREATE DATABASE IF NOT EXISTS dental_clinic
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dental_clinic;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash only; never plaintext',
  role ENUM('Patient', 'Doctor', 'Admin') NOT NULL,
  account_status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, account_status)
) ENGINE=InnoDB;

CREATE TABLE patients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  identity_number_ciphertext TEXT NULL,
  identity_number_blind_index CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
  identity_number_key_version SMALLINT UNSIGNED NULL,
  date_of_birth DATE NULL,
  gender ENUM('Female', 'Male', 'Other', 'Prefer not to say') NULL,
  phone_ciphertext TEXT NOT NULL,
  phone_blind_index CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  phone_key_version SMALLINT UNSIGNED NOT NULL,
  address_ciphertext TEXT NULL,
  address_key_version SMALLINT UNSIGNED NULL,
  registration_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patients_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_patients_phone_blind (phone_blind_index)
) ENGINE=InnoDB;

CREATE TABLE patient_clinical_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL UNIQUE,
  medical_history_ciphertext MEDIUMTEXT NULL,
  allergies_ciphertext MEDIUMTEXT NULL,
  current_medications_ciphertext MEDIUMTEXT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_profiles_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  professional_title VARCHAR(100) NOT NULL,
  specialization VARCHAR(150) NULL,
  license_number VARCHAR(80) NOT NULL UNIQUE,
  qualification VARCHAR(255) NULL,
  years_of_experience SMALLINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doctors_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE clinic_information (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinic_name VARCHAR(180) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(254) NOT NULL,
  address VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE dental_services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  icon_key VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_service_duration CHECK (duration_minutes > 0)
) ENGINE=InnoDB;

CREATE TABLE clinic_operating_hours (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  day_of_week ENUM(
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday'
  ) NOT NULL UNIQUE,
  day_order TINYINT UNSIGNED NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  opening_time TIME NULL,
  closing_time TIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_operating_day_order CHECK (day_order BETWEEN 1 AND 7),
  CONSTRAINT chk_operating_times CHECK (
    (is_open = FALSE AND opening_time IS NULL AND closing_time IS NULL)
    OR
    (is_open = TRUE AND opening_time IS NOT NULL AND closing_time IS NOT NULL
      AND opening_time < closing_time)
  )
) ENGINE=InnoDB;

CREATE TABLE doctor_working_hours (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT UNSIGNED NOT NULL,
  day_of_week ENUM(
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday'
  ) NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME NULL,
  end_time TIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_working_hours_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_doctor_working_times CHECK (
    (is_working = FALSE AND start_time IS NULL AND end_time IS NULL)
    OR
    (is_working = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL
      AND start_time < end_time)
  ),
  UNIQUE KEY uq_doctor_working_day (doctor_id, day_of_week)
) ENGINE=InnoDB;

CREATE TABLE appointment_time_slots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT UNSIGNED NULL,
  slot_time TIME NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  doctor_scope BIGINT UNSIGNED
    GENERATED ALWAYS AS (COALESCE(doctor_id, 0)) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_slots_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  UNIQUE KEY uq_slot_scope_time (doctor_scope, slot_time)
) ENGINE=InnoDB;

CREATE TABLE clinic_closed_dates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  closed_date DATE NOT NULL UNIQUE,
  reason VARCHAR(255) NOT NULL,
  category VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE doctor_blocked_times (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT UNSIGNED NOT NULL,
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_blocked_times_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_blocked_time_range CHECK (start_time < end_time),
  INDEX idx_blocked_doctor_date (doctor_id, blocked_date, start_time, end_time)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id VARCHAR(32) NOT NULL UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  dental_service_id BIGINT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled')
    NOT NULL DEFAULT 'Pending',
  patient_note_ciphertext MEDIUMTEXT NULL,
  cancellation_reason_ciphertext TEXT NULL,
  cancelled_by ENUM('Patient', 'Admin') NULL,
  reschedule_reason_ciphertext TEXT NULL,
  original_date DATE NULL,
  original_time TIME NULL,
  booking_source ENUM('Patient', 'Admin', 'Phone', 'WhatsApp', 'Walk-in') NOT NULL DEFAULT 'Patient',
  encryption_key_version SMALLINT UNSIGNED NULL,
  active_slot TINYINT GENERATED ALWAYS AS (
    CASE WHEN status IN ('Pending', 'Confirmed') THEN 1 ELSE NULL END
  ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_service
    FOREIGN KEY (dental_service_id) REFERENCES dental_services(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- This guards identical active start times only. It does not detect duration
  -- overlap. Booking/rescheduling must lock and transactionally compare the
  -- requested interval against active appointments using duration_minutes.
  UNIQUE KEY uq_active_doctor_slot (
    doctor_id, appointment_date, appointment_time, active_slot
  ),
  INDEX idx_appointments_patient_date (patient_id, appointment_date),
  INDEX idx_appointments_doctor_date (doctor_id, appointment_date),
  INDEX idx_appointments_status_date (status, appointment_date)
) ENGINE=InnoDB;

CREATE TABLE appointment_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNSIGNED NOT NULL,
  action ENUM('Created', 'Confirmed', 'Rescheduled', 'Cancelled', 'Completed')
    NOT NULL,
  previous_date DATE NULL,
  previous_time TIME NULL,
  new_date DATE NULL,
  new_time TIME NULL,
  previous_status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NULL,
  new_status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NULL,
  reason_ciphertext TEXT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  changed_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointment_history_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointment_history_user
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_appointment_history_timeline (appointment_id, created_at)
) ENGINE=InnoDB;

-- One clinical_records row represents one clinical encounter. It belongs to a
-- patient and doctor and normally references one appointment. A patient can
-- accumulate many encounters; an appointment can have at most one encounter.
CREATE TABLE clinical_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  record_id VARCHAR(32) NOT NULL UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL UNIQUE,
  diagnosis_ciphertext MEDIUMTEXT NULL,
  treatment_plan_ciphertext MEDIUMTEXT NULL,
  prescriptions_ciphertext MEDIUMTEXT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  record_status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_records_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_records_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_records_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_records_patient_updated (patient_id, updated_at)
) ENGINE=InnoDB;

-- Clinical notes are append-only. A correction is inserted as a new row that
-- references the row it supersedes, preserving the original text and author.
CREATE TABLE clinical_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinical_record_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  visit_date DATE NOT NULL,
  treatment_service VARCHAR(150) NOT NULL,
  diagnosis_ciphertext MEDIUMTEXT NULL,
  clinical_note_ciphertext MEDIUMTEXT NOT NULL,
  action_taken_ciphertext MEDIUMTEXT NULL,
  prescription_ciphertext MEDIUMTEXT NULL,
  follow_up_recommendation_ciphertext MEDIUMTEXT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  supersedes_clinical_note_id BIGINT UNSIGNED NULL,
  amendment_reason_ciphertext TEXT NULL,
  amended_by_user_id BIGINT UNSIGNED NULL,
  amended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_record
    FOREIGN KEY (clinical_record_id) REFERENCES clinical_records(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_notes_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_notes_superseded
    FOREIGN KEY (supersedes_clinical_note_id) REFERENCES clinical_notes(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_notes_amending_user
    FOREIGN KEY (amended_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_notes_record_date (clinical_record_id, visit_date)
) ENGINE=InnoDB;

-- Treatment history follows the same append-only correction model as notes.
CREATE TABLE treatment_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinical_record_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  treatment_date DATE NOT NULL,
  treatment_name VARCHAR(150) NOT NULL,
  treatment_status ENUM(
    'Planned', 'In Progress', 'Completed', 'Follow-up Required'
  ) NOT NULL,
  diagnosis_ciphertext MEDIUMTEXT NULL,
  procedure_performed_ciphertext MEDIUMTEXT NULL,
  notes_ciphertext MEDIUMTEXT NULL,
  prescription_ciphertext MEDIUMTEXT NULL,
  follow_up_recommendation_ciphertext MEDIUMTEXT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  supersedes_treatment_id BIGINT UNSIGNED NULL,
  amendment_reason_ciphertext TEXT NULL,
  amended_by_user_id BIGINT UNSIGNED NULL,
  amended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_treatments_record
    FOREIGN KEY (clinical_record_id) REFERENCES clinical_records(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_treatments_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_treatments_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_treatments_superseded
    FOREIGN KEY (supersedes_treatment_id) REFERENCES treatment_history(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_treatments_amending_user
    FOREIGN KEY (amended_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_treatments_record_date (clinical_record_id, treatment_date)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(40) NOT NULL UNIQUE,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message_ciphertext TEXT NOT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  related_route VARCHAR(255) NULL,
  related_entity_type VARCHAR(80) NULL,
  related_entity_id VARCHAR(64) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (recipient_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_notifications_recipient_read (
    recipient_user_id, is_read, created_at
  )
) ENGINE=InnoDB;

-- Minimal JWT refresh-session storage. Only a one-way token hash is stored.
-- Revoking a row supports secure logout without storing a plaintext token.
CREATE TABLE refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_refresh_tokens_user_active (user_id, revoked_at, expires_at)
) ENGINE=InnoDB;

-- Password recovery stores only a one-way SHA-256 token hash. Raw reset
-- tokens are sent by email and never persisted.
CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_password_reset_tokens_user_active (user_id, used_at, expires_at)
) ENGINE=InnoDB;

-- Compact authentication/security audit trail. metadata must never contain
-- passwords, raw tokens, encryption keys, or decrypted clinical information.
CREATE TABLE security_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(80) NOT NULL,
  outcome ENUM('Success', 'Failure') NOT NULL,
  ip_address_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_security_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_security_audit_user_date (user_id, created_at),
  INDEX idx_security_audit_event_date (event_type, created_at)
) ENGINE=InnoDB;

-- Availability is calculated, never stored as a permanent availability result:
-- clinic_operating_hours
-- + doctor_working_hours
-- + enabled appointment_time_slots
-- - clinic_closed_dates
-- - doctor_blocked_times
-- - overlapping Pending/Confirmed appointments
-- = available appointment slots.
--
-- Duration-aware overlap checks must run inside the booking/rescheduling
-- transaction. The service should lock relevant doctor/date appointment rows,
-- join dental_services.duration_minutes, and reject intersecting time ranges.

INSERT INTO clinic_operating_hours (
  day_of_week, day_order, is_open, opening_time, closing_time
) VALUES
  ('Monday', 1, TRUE, '09:00:00', '18:00:00'),
  ('Tuesday', 2, TRUE, '09:00:00', '18:00:00'),
  ('Wednesday', 3, TRUE, '09:00:00', '18:00:00'),
  ('Thursday', 4, TRUE, '09:00:00', '18:00:00'),
  ('Friday', 5, TRUE, '09:00:00', '18:00:00'),
  ('Saturday', 6, TRUE, '09:00:00', '17:00:00'),
  ('Sunday', 7, FALSE, NULL, NULL)
ON DUPLICATE KEY UPDATE
  is_open = VALUES(is_open),
  opening_time = VALUES(opening_time),
  closing_time = VALUES(closing_time);
