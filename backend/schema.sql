-- Smart Salon Database Schema
-- V1 Freeze — Finalized for current frontend

CREATE DATABASE IF NOT EXISTS smart_salon
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_salon;

-- ============================================================
-- DROP ORDER (reverse of creation to respect foreign keys)
-- ============================================================
DROP TRIGGER IF EXISTS trg_adm_notif_customer_reg;
DROP TRIGGER IF EXISTS trg_adm_notif_appt_booked;
DROP TRIGGER IF EXISTS trg_adm_notif_appt_update;
DROP TABLE IF EXISTS admin_notifications;
DROP TABLE IF EXISTS customer_notifications;
DROP TABLE IF EXISTS barber_notifications;
DROP TABLE IF EXISTS appointment_services;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS barbers;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS admins;

-- ============================================================
-- 1. customers
-- ============================================================
CREATE TABLE customers (
  customer_id    INT            NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(100)   NOT NULL,
  email          VARCHAR(150)   NOT NULL,
  phone          VARCHAR(20)    DEFAULT NULL,
  password_hash  VARCHAR(255)   NOT NULL,
  profile_image  VARCHAR(500)   DEFAULT NULL,
  account_status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login     TIMESTAMP      DEFAULT NULL,

  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. services
-- ============================================================
CREATE TABLE services (
  service_id       INT             NOT NULL AUTO_INCREMENT,
  service_name     VARCHAR(100)    NOT NULL,
  description      TEXT            DEFAULT NULL,
  price            DECIMAL(10, 2)  NOT NULL,
  duration_minutes INT             NOT NULL,
  image_url        VARCHAR(500)    DEFAULT NULL,
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. barbers
-- ============================================================
CREATE TABLE barbers (
  barber_id        INT             NOT NULL AUTO_INCREMENT,
  barber_name      VARCHAR(100)    NOT NULL,
  email            VARCHAR(150)    NOT NULL,
  phone            VARCHAR(20)     DEFAULT NULL,
  password_hash    VARCHAR(255)    NOT NULL,
  specialization   VARCHAR(150)    DEFAULT NULL,
  experience_years INT             DEFAULT NULL,
  image_url        VARCHAR(500)    DEFAULT NULL,
  is_available     TINYINT(1)      NOT NULL DEFAULT 1,
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login       TIMESTAMP       DEFAULT NULL,

  PRIMARY KEY (barber_id),
  UNIQUE KEY uq_barbers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. appointments
-- ============================================================
CREATE TABLE appointments (
  appointment_id   INT             NOT NULL AUTO_INCREMENT,
  customer_id      INT             NOT NULL,
  barber_id        INT             DEFAULT NULL,
  appointment_date DATE            NOT NULL,
  appointment_time TIME            NOT NULL,
  status           ENUM('pending','pending_approval','confirmed','completed','no_show','reschedule_proposed','rejected','cancelled') NOT NULL DEFAULT 'pending_approval',
  total_amount     DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  advance_paid     DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  customer_notes   TEXT            DEFAULT NULL,
  proposed_date    DATE            DEFAULT NULL,
  proposed_time    TIME            DEFAULT NULL,
  reschedule_reason TEXT           DEFAULT NULL,
  completed_at     TIMESTAMP       DEFAULT NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (appointment_id),
  KEY idx_appointments_customer_id      (customer_id),
  KEY idx_appointments_barber_id        (barber_id),
  KEY idx_appointments_appointment_date (appointment_date),

  CONSTRAINT fk_appointments_customer
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_appointments_barber
    FOREIGN KEY (barber_id) REFERENCES barbers (barber_id)
    ON DELETE SET NULL ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. appointment_services  (junction: one appointment, many services)
-- ============================================================
CREATE TABLE appointment_services (
  id             INT            NOT NULL AUTO_INCREMENT,
  appointment_id INT            NOT NULL,
  service_id     INT            NOT NULL,
  service_price  DECIMAL(10, 2) NOT NULL,

  PRIMARY KEY (id),
  KEY idx_appt_services_appointment_id (appointment_id),

  CONSTRAINT fk_appt_services_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments (appointment_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_appt_services_service
    FOREIGN KEY (service_id) REFERENCES services (service_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. notifications
-- ============================================================
CREATE TABLE notifications (
  notification_id   INT          NOT NULL AUTO_INCREMENT,
  customer_id       INT          NOT NULL,
  title             VARCHAR(200) NOT NULL,
  message           TEXT         NOT NULL,
  notification_type VARCHAR(50)  DEFAULT NULL,
  is_read           TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (notification_id),
  KEY idx_notifications_customer_id (customer_id),
  KEY idx_notifications_is_read     (is_read),

  CONSTRAINT fk_notifications_customer
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. barber_notifications
-- ============================================================
CREATE TABLE barber_notifications (
  id              INT           NOT NULL AUTO_INCREMENT,
  barber_id       INT           NOT NULL,
  customer_id     INT           DEFAULT NULL,
  appointment_id  INT           DEFAULT NULL,
  type            VARCHAR(50)   NOT NULL,
  title           VARCHAR(200)  NOT NULL,
  message         TEXT          NOT NULL,
  is_read         TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_bn_barber_id      (barber_id),
  KEY idx_bn_appointment_id (appointment_id),
  KEY idx_bn_is_read        (is_read),

  CONSTRAINT fk_bn_barber FOREIGN KEY (barber_id) REFERENCES barbers (barber_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. customer_notifications
-- ============================================================
CREATE TABLE customer_notifications (
  id              INT           NOT NULL AUTO_INCREMENT,
  customer_id     INT           NOT NULL,
  barber_id       INT           DEFAULT NULL,
  appointment_id  INT           DEFAULT NULL,
  type            VARCHAR(50)   NOT NULL,
  title           VARCHAR(200)  NOT NULL,
  message         TEXT          NOT NULL,
  is_read         TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_cn_customer_id    (customer_id),
  KEY idx_cn_appointment_id (appointment_id),
  KEY idx_cn_is_read        (is_read),

  CONSTRAINT fk_cn_customer FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. admins
-- ============================================================
CREATE TABLE admins (
  admin_id      INT            NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(100)   NOT NULL,
  email         VARCHAR(150)   NOT NULL,
  password_hash VARCHAR(255)   NOT NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login    TIMESTAMP      DEFAULT NULL,

  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. admin_notifications  (admin event log + notification feed)
-- ============================================================
CREATE TABLE admin_notifications (
  id         INT           NOT NULL AUTO_INCREMENT,
  type       VARCHAR(50)   NOT NULL,
  sub_type   VARCHAR(50)   DEFAULT NULL,
  title      VARCHAR(200)  NOT NULL,
  message    TEXT          NOT NULL,
  is_read    TINYINT(1)    NOT NULL DEFAULT 0,
  ref_id     INT           DEFAULT NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_adm_notif_read    (is_read),
  KEY idx_adm_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA — services
-- ============================================================
INSERT INTO services (service_name, description, price, duration_minutes, image_url, status) VALUES
  ('Haircut',        'Classic to contemporary cuts tailored to your face shape and personal style.',    299.00, 30, 'service_images/hair_cutting.jpg', 'active'),
  ('Beard Grooming', 'Precise shaping, trimming, and conditioning for a perfectly groomed beard.',     249.00, 20, 'service_images/beard_groom.jpg',  'active'),
  ('Styling',        'Professional finishing with premium products for casual to formal looks.',        349.00, 25, 'service_images/hair_styling.jpg', 'active'),
  ('Shaving',        'Smooth, precise shaving with hot towel treatment for a clean and fresh finish.', 199.00, 15, 'service_images/shaving.jpg',      'active');

-- ============================================================
-- SEED DATA — barbers
-- Temp password for all seeded barbers: barber@123
-- Hash: bcrypt, 10 rounds
-- ============================================================
INSERT INTO barbers (barber_name, email, phone, password_hash, specialization, experience_years, image_url, is_available, status) VALUES
  ('Atul Sharma', 'atul.sharma@smartsalon.com',  '+91 98765 00001', '$2b$10$r2zA5zOJJo1g0qjKauLAVue2yuS4r9GaPVtpgt45SIwyKDaLn1fUi', 'Haircut, Styling, Beard', NULL, 'barber_images/Jitu-Photo-low.jpg',             1, 'active'),
  ('Rahul Verma', 'rahul.verma@smartsalon.com',  '+91 98765 00002', '$2b$10$r2zA5zOJJo1g0qjKauLAVue2yuS4r9GaPVtpgt45SIwyKDaLn1fUi', 'Shaving, Beard Grooming',  NULL, 'barber_images/shutterstock_1324485902.jpg',     1, 'active'),
  ('Karan Mehta', 'karan.mehta@smartsalon.com',  '+91 98765 00003', '$2b$10$r2zA5zOJJo1g0qjKauLAVue2yuS4r9GaPVtpgt45SIwyKDaLn1fUi', 'Haircut, Color',           NULL, 'barber_images/shutterstock_2411368769.jpg',     1, 'active'),
  ('Dev Patel',   'dev.patel@smartsalon.com',    '+91 98765 00004', '$2b$10$r2zA5zOJJo1g0qjKauLAVue2yuS4r9GaPVtpgt45SIwyKDaLn1fUi', 'Styling, Beard, Shaving',  NULL, 'barber_images/shutterstock_2618678419.jpg',     1, 'active');

-- ============================================================
-- SEED DATA — admins
-- Default password: admin@123
-- Hash: bcrypt, 10 rounds
-- CHANGE THIS PASSWORD IN PRODUCTION
-- ============================================================
INSERT INTO admins (full_name, email, password_hash, status) VALUES
  ('Admin', 'admin@smartsalon.in', '$2b$10$HPSNuhPu.rNhE1scwL0ZQuKWbWn.1UnXkNz6DdoeuD/k99saCkxEO', 'active');

-- ============================================================
-- TRIGGERS — auto-generate admin_notifications for key events
-- ============================================================
DELIMITER ;;

CREATE TRIGGER trg_adm_notif_customer_reg
AFTER INSERT ON customers
FOR EACH ROW
BEGIN
  INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
  VALUES ('customer', 'registered', 'New Customer Registered',
          CONCAT(NEW.full_name, ' created a new account.'), NEW.customer_id);
END;;

CREATE TRIGGER trg_adm_notif_appt_booked
AFTER INSERT ON appointments
FOR EACH ROW
BEGIN
  DECLARE v_cname VARCHAR(100) DEFAULT 'Unknown';
  SELECT IFNULL(full_name, 'Unknown') INTO v_cname
    FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
  INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
  VALUES ('appointment', 'booked', 'New Appointment Booked',
          CONCAT(v_cname, ' booked appointment #', NEW.appointment_id, '.'),
          NEW.appointment_id);
END;;

CREATE TRIGGER trg_adm_notif_appt_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  DECLARE v_cname VARCHAR(100) DEFAULT 'Unknown';
  IF NEW.status != OLD.status THEN
    SELECT IFNULL(full_name, 'Unknown') INTO v_cname
      FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
    IF NEW.status = 'completed' THEN
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
      VALUES ('appointment', 'completed', 'Appointment Completed',
              CONCAT('Appointment #', NEW.appointment_id, ' for ', v_cname, ' was completed.'),
              NEW.appointment_id);
    ELSEIF NEW.status = 'cancelled' THEN
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
      VALUES ('appointment', 'cancelled', 'Appointment Cancelled',
              CONCAT('Appointment #', NEW.appointment_id, ' for ', v_cname, ' was cancelled.'),
              NEW.appointment_id);
    END IF;
  END IF;
END;;

DELIMITER ;
