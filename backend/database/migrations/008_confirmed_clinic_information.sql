START TRANSACTION;

UPDATE clinic_information
SET clinic_name = 'Klinik Pergigian Rosni Adam',
    phone = '019-281 7109',
    email = 'kprosniadam06@gmail.com',
    address = 'B1-10, Ground Floor, Plaza Dwitasik, 56000 Cheras, Bandar Sri Permaisuri, Kuala Lumpur'
ORDER BY id
LIMIT 1;

INSERT INTO clinic_information (clinic_name, phone, email, address)
SELECT 'Klinik Pergigian Rosni Adam', '019-281 7109', 'kprosniadam06@gmail.com',
       'B1-10, Ground Floor, Plaza Dwitasik, 56000 Cheras, Bandar Sri Permaisuri, Kuala Lumpur'
WHERE NOT EXISTS (SELECT 1 FROM clinic_information);

UPDATE clinic_operating_hours
SET opening_time = '09:00:00', closing_time = '18:00:00'
WHERE is_open = TRUE;

UPDATE appointment_time_slots
SET is_enabled = FALSE
WHERE slot_time >= '13:00:00' AND slot_time < '14:00:00';

COMMIT;
