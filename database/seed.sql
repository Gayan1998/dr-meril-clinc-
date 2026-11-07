-- ============================================================
--  Demo / development seed data
--  Credentials are FAKE demo credentials. Change before use.
--    doctor  / Doctor@123
--    cashier / Cashier@123
-- ============================================================
SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
INSERT INTO users (id, name, username, password_hash, role, status)
VALUES
    (1, 'Dr. Fernando', 'doctor',  '$2y$10$cgXMcVDHbhxcdxzET5.Pq.CicNiioNAIXMGYW6mX938lgidTcvZUG', 'doctor',  'active'),
    (2, 'Cashier User', 'cashier', '$2y$10$yxwNeaqnbbf2RLd8jzbVr.VPpon9kMMOXEd7.gWWs7HRFcQcg.W/e', 'cashier', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ------------------------------------------------------------
-- Clinic settings
-- ------------------------------------------------------------
UPDATE clinic_settings SET
    clinic_name    = 'Meril Medical Centre',
    address        = 'No. 42, Galle Road, Colombo 04',
    phone          = '+94 11 234 5678',
    email          = 'frontdesk@merilmedical.lk',
    receipt_footer = 'Thank you. Please follow the doctor''s advice.',
    currency       = 'LKR'
WHERE id = 1;

-- ------------------------------------------------------------
-- Patients
-- ------------------------------------------------------------
INSERT INTO patients (id, patient_code, full_name, phone, address, date_of_birth, gender, notes, created_by)
VALUES
    (1, 'P000001', 'Kamal Perera',   '0771234567', 'Nugegoda',      '1985-03-12', 'male',   'Hypertension, on medication', 1),
    (2, 'P000002', 'Nimal Silva',    '0712345678', 'Dehiwala',      '1992-07-24', 'male',   NULL, 1),
    (3, 'P000003', 'Amal Fernando',  '0763456789', 'Mount Lavinia', '1978-11-02', 'male',   'Diabetic', 1),
    (4, 'P000004', 'Sanduni Jayawardena', '0754567890', 'Colombo 06', '1996-01-18', 'female', NULL, 1),
    (5, 'P000005', 'Ravi Kumara',    '0785678901', 'Kottawa',       '2001-09-30', 'male',   NULL, 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- ------------------------------------------------------------
-- Today's visits (6 total: 4 paid, 2 pending)
-- ------------------------------------------------------------
INSERT INTO visits (id, visit_number, patient_id, doctor_id, consultation_fee, status, visit_date, created_at)
VALUES
    (1, CONCAT('V-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-0001'), 1, 1, 2000.00, 'paid',            CURDATE(), CONCAT(CURDATE(),' 08:55:00')),
    (2, CONCAT('V-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-0002'), 2, 1, 1500.00, 'paid',            CURDATE(), CONCAT(CURDATE(),' 09:20:00')),
    (3, CONCAT('V-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-0003'), 3, 1, 2500.00, 'paid',            CURDATE(), CONCAT(CURDATE(),' 09:48:00')),
    (4, CONCAT('V-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-0004'), 4, 1, 2000.00, 'paid',            CURDATE(), CONCAT(CURDATE(),' 10:15:00')),
    (5, CONCAT('V-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-0005'), 5, 1, 1500.00, 'pending_payment', CURDATE(), CONCAT(CURDATE(),' 10:42:00')),
    (6, CONCAT('V-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-0006'), 1, 1, 2000.00, 'pending_payment', CURDATE(), CONCAT(CURDATE(),' 11:05:00'))
ON DUPLICATE KEY UPDATE consultation_fee = VALUES(consultation_fee);

-- ------------------------------------------------------------
-- Payments for the 4 paid visits
-- ------------------------------------------------------------
INSERT INTO payments (id, payment_number, visit_id, amount, payment_method, collected_by, paid_at, payment_date, status)
VALUES
    (1, CONCAT('R-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-00001'), 1, 2000.00, 'cash',          2, CONCAT(CURDATE(),' 09:02:00'), CURDATE(), 'paid'),
    (2, CONCAT('R-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-00002'), 2, 1500.00, 'cash',          2, CONCAT(CURDATE(),' 09:25:00'), CURDATE(), 'paid'),
    (3, CONCAT('R-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-00003'), 3, 2500.00, 'card',          2, CONCAT(CURDATE(),' 09:55:00'), CURDATE(), 'paid'),
    (4, CONCAT('R-', DATE_FORMAT(CURDATE(),'%Y%m%d'), '-00004'), 4, 2000.00, 'bank_transfer', 2, CONCAT(CURDATE(),' 10:22:00'), CURDATE(), 'paid')
ON DUPLICATE KEY UPDATE amount = VALUES(amount);

-- ------------------------------------------------------------
-- Keep counters ahead of seeded data
-- ------------------------------------------------------------
INSERT INTO counters (name, value) VALUES ('patient_code', 5)
    ON DUPLICATE KEY UPDATE value = GREATEST(value, 5);
INSERT INTO counters (name, value) VALUES (CONCAT('visit_number:', DATE_FORMAT(CURDATE(),'%Y%m%d')), 6)
    ON DUPLICATE KEY UPDATE value = GREATEST(value, 6);
INSERT INTO counters (name, value) VALUES (CONCAT('payment_number:', DATE_FORMAT(CURDATE(),'%Y%m%d')), 4)
    ON DUPLICATE KEY UPDATE value = GREATEST(value, 4);
