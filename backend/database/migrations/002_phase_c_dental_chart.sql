CREATE TABLE IF NOT EXISTS dental_chart_definitions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  definition_id VARCHAR(40) NOT NULL UNIQUE,
  code VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  display_color CHAR(7) NOT NULL,
  symbol_key VARCHAR(40) NULL,
  pattern_key VARCHAR(40) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_development BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_dental_chart_definition_color CHECK (display_color REGEXP '^#[0-9A-Fa-f]{6}$'),
  INDEX idx_dental_chart_definitions_active (is_active, category, label)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dental_chart_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_id VARCHAR(40) NOT NULL UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL,
  clinical_record_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  tooth_number CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  definition_id BIGINT UNSIGNED NOT NULL,
  remark_ciphertext MEDIUMTEXT NULL,
  amendment_reason_ciphertext TEXT NULL,
  encryption_key_version SMALLINT UNSIGNED NULL,
  supersedes_entry_id BIGINT UNSIGNED NULL UNIQUE,
  amended_by_user_id BIGINT UNSIGNED NULL,
  amended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dental_chart_entries_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dental_chart_entries_record FOREIGN KEY (clinical_record_id) REFERENCES clinical_records(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dental_chart_entries_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dental_chart_entries_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dental_chart_entries_definition FOREIGN KEY (definition_id) REFERENCES dental_chart_definitions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dental_chart_entries_superseded FOREIGN KEY (supersedes_entry_id) REFERENCES dental_chart_entries(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dental_chart_entries_amending_user FOREIGN KEY (amended_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_dental_chart_tooth_number CHECK (tooth_number IN ('18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28','38','37','36','35','34','33','32','31','41','42','43','44','45','46','47','48')),
  INDEX idx_dental_chart_patient_tooth (patient_id, tooth_number, created_at),
  INDEX idx_dental_chart_record_created (clinical_record_id, created_at),
  INDEX idx_dental_chart_doctor_created (doctor_id, created_at),
  INDEX idx_dental_chart_definition (definition_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dental_chart_entry_surfaces (
  dental_chart_entry_id BIGINT UNSIGNED NOT NULL,
  surface ENUM('Mesial','Distal','Buccal','Facial','Lingual','Palatal','Occlusal','Incisal','Whole') NOT NULL,
  PRIMARY KEY (dental_chart_entry_id, surface),
  CONSTRAINT fk_dental_chart_surfaces_entry FOREIGN KEY (dental_chart_entry_id) REFERENCES dental_chart_entries(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
