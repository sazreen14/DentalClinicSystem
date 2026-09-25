ALTER TABLE users MODIFY email VARCHAR(254) NULL;
ALTER TABLE patients MODIFY date_of_birth DATE NULL, MODIFY gender ENUM('Female', 'Male', 'Other', 'Prefer not to say') NULL;
ALTER TABLE patients ADD COLUMN contact_email VARCHAR(254) NULL;
