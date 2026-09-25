ALTER TABLE appointments
  MODIFY booking_source ENUM('Patient', 'Admin', 'Phone', 'WhatsApp', 'Walk-in') NOT NULL DEFAULT 'Patient';
