-- ============================================================
--  Small Clinic Management & Cash-Control PWA
--  MySQL / MariaDB schema
-- ============================================================
--  Core principle:
--    Doctor creates the financial obligation (visit/charge).
--    Cashier only collects it (payment).
--    Everything is append-only and auditable.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+05:30';

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(120)  NOT NULL,
    username      VARCHAR(60)   NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          ENUM('doctor','cashier') NOT NULL,
    status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
    last_login_at DATETIME      NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_users_username (username),
    KEY idx_users_role (role),
    KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- auth_tokens  (opaque bearer tokens, stored hashed)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      INT UNSIGNED NOT NULL,
    token_hash   CHAR(64)     NOT NULL,
    ip_address   VARCHAR(45)  NULL,
    user_agent   VARCHAR(255) NULL,
    expires_at   DATETIME     NOT NULL,
    last_used_at DATETIME     NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_tokens_hash (token_hash),
    KEY idx_tokens_user (user_id),
    KEY idx_tokens_expires (expires_at),
    CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- patients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    patient_code  VARCHAR(20)  NOT NULL,
    full_name     VARCHAR(160) NOT NULL,
    phone         VARCHAR(30)  NULL,
    address       VARCHAR(255) NULL,
    date_of_birth DATE         NULL,
    gender        ENUM('male','female','other') NULL,
    notes         VARCHAR(500) NULL,
    created_by    INT UNSIGNED NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_patient_code (patient_code),
    KEY idx_patients_name (full_name),
    KEY idx_patients_phone (phone),
    CONSTRAINT fk_patients_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- visits  (a consultation / charge created by a doctor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    visit_number        VARCHAR(30)   NOT NULL,
    patient_id          INT UNSIGNED  NOT NULL,
    doctor_id           INT UNSIGNED  NOT NULL,
    consultation_fee    DECIMAL(10,2) NOT NULL,
    status              ENUM('pending_payment','paid','cancelled') NOT NULL DEFAULT 'pending_payment',
    visit_date          DATE          NOT NULL,
    cancelled_at        DATETIME      NULL,
    cancelled_by        INT UNSIGNED  NULL,
    cancellation_reason VARCHAR(500)  NULL,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_visit_number (visit_number),
    KEY idx_visits_patient (patient_id),
    KEY idx_visits_doctor (doctor_id),
    KEY idx_visits_status (status),
    KEY idx_visits_date (visit_date),
    KEY idx_visits_status_date (status, visit_date),
    CONSTRAINT fk_visits_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
    CONSTRAINT fk_visits_doctor  FOREIGN KEY (doctor_id)  REFERENCES users (id)    ON DELETE RESTRICT,
    CONSTRAINT fk_visits_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_visits_fee CHECK (consultation_fee >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- payments  (immutable financial records)
-- A visit can have at most ONE active (paid) payment, enforced
-- by the generated `active` column + unique key below.
-- Voided payments are kept forever; they are never deleted.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    payment_number VARCHAR(30)   NOT NULL,
    visit_id       INT UNSIGNED  NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash','card','bank_transfer') NOT NULL,
    collected_by   INT UNSIGNED  NOT NULL,
    paid_at        DATETIME      NOT NULL,
    payment_date   DATE          NOT NULL,
    status         ENUM('paid','voided') NOT NULL DEFAULT 'paid',
    voided_at      DATETIME      NULL,
    voided_by      INT UNSIGNED  NULL,
    void_reason    VARCHAR(500)  NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active         TINYINT(1) AS (CASE WHEN status = 'paid' THEN 1 ELSE NULL END) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_payment_number (payment_number),
    UNIQUE KEY uniq_active_payment_per_visit (visit_id, active),
    KEY idx_payments_visit (visit_id),
    KEY idx_payments_date (payment_date),
    KEY idx_payments_status (status),
    KEY idx_payments_collected_by (collected_by),
    KEY idx_payments_date_status (payment_date, status),
    CONSTRAINT fk_payments_visit        FOREIGN KEY (visit_id)     REFERENCES visits (id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_collected_by FOREIGN KEY (collected_by) REFERENCES users (id)  ON DELETE RESTRICT,
    CONSTRAINT fk_payments_voided_by    FOREIGN KEY (voided_by)    REFERENCES users (id)  ON DELETE SET NULL,
    CONSTRAINT chk_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- audit_logs  (append-only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NULL,
    action      VARCHAR(60)  NOT NULL,
    entity_type VARCHAR(40)  NULL,
    entity_id   INT UNSIGNED NULL,
    old_values  JSON         NULL,
    new_values  JSON         NULL,
    ip_address  VARCHAR(45)  NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_user (user_id),
    KEY idx_audit_action (action),
    KEY idx_audit_entity (entity_type, entity_id),
    KEY idx_audit_created (created_at),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- clinic_settings  (single row, id = 1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_settings (
    id             TINYINT UNSIGNED NOT NULL DEFAULT 1,
    clinic_name    VARCHAR(160) NOT NULL DEFAULT 'Clinic',
    address        VARCHAR(255) NOT NULL DEFAULT '',
    phone          VARCHAR(60)  NOT NULL DEFAULT '',
    email          VARCHAR(120) NOT NULL DEFAULT '',
    logo_url       VARCHAR(255) NOT NULL DEFAULT '',
    receipt_footer VARCHAR(255) NOT NULL DEFAULT 'Thank you. Get well soon.',
    currency       VARCHAR(10)  NOT NULL DEFAULT 'LKR',
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- counters  (atomic sequence source for codes / numbers)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS counters (
    name  VARCHAR(60) NOT NULL,
    value BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO counters (name, value) VALUES ('patient_code', 0)
    ON DUPLICATE KEY UPDATE name = name;
INSERT INTO counters (name, value) VALUES ('visit_number', 0)
    ON DUPLICATE KEY UPDATE name = name;
INSERT INTO counters (name, value) VALUES ('payment_number', 0)
    ON DUPLICATE KEY UPDATE name = name;
INSERT INTO clinic_settings (id) VALUES (1)
    ON DUPLICATE KEY UPDATE id = id;
