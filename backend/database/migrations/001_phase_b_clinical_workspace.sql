ALTER TABLE clinical_records
  ADD COLUMN encounter_at DATETIME NULL AFTER appointment_id,
  ADD COLUMN completed_at DATETIME NULL AFTER encounter_at;

UPDATE clinical_records cr
LEFT JOIN appointments a ON a.id = cr.appointment_id
SET cr.encounter_at = COALESCE(
  TIMESTAMP(a.appointment_date, a.appointment_time),
  cr.created_at
)
WHERE cr.encounter_at IS NULL;

CREATE TABLE IF NOT EXISTS patient_clinical_instructions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instruction_id VARCHAR(40) NOT NULL UNIQUE,
  clinical_record_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  instruction_type ENUM('Medication','Follow-up','General Care') NOT NULL,
  title VARCHAR(180) NOT NULL,
  content_ciphertext MEDIUMTEXT NOT NULL,
  encryption_key_version SMALLINT UNSIGNED NOT NULL,
  publication_status ENUM('Draft','Published','Withdrawn') NOT NULL DEFAULT 'Draft',
  published_at DATETIME NULL,
  withdrawn_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patient_instructions_record
    FOREIGN KEY (clinical_record_id) REFERENCES clinical_records(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_patient_instructions_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_patient_instructions_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_patient_instructions_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_patient_instructions_patient_status (patient_id, publication_status, published_at),
  INDEX idx_patient_instructions_record_created (clinical_record_id, created_at)
) ENGINE=InnoDB;
