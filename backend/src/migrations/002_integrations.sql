-- ============================================================================
-- MIGRATION 002 — Integrations
-- ============================================================================
--   • otp_logs        — OTP history (admin panel me dikhta hai, support ke liye)
--   • device_tokens   — FCM push notification tokens
--   • notification_logs — har WhatsApp/SMS/push ka record (debug ke liye)
--   • shipments       — DTDC booking + tracking
--   • orders me payment_gateway column (razorpay | payu)
--
-- Chalao:  npm run migrate:002
-- ============================================================================

-- ----------------------------------------------------------------------------
-- OTP log — admin support team ko dikhta hai jab customer bole "OTP nahi aaya"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `otp_logs` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `mobile`      VARCHAR(20) NOT NULL,
  `otp`         VARCHAR(10) NOT NULL,
  `purpose`     ENUM('login','signup','reset','verify') NOT NULL DEFAULT 'login',
  `customer_id` INT(11) DEFAULT NULL,
  `channel`     ENUM('sms','whatsapp','both') NOT NULL DEFAULT 'sms',
  `provider`    VARCHAR(30) DEFAULT NULL COMMENT 'fast2sms / buzwap / dev',
  `delivered`   TINYINT(1) NOT NULL DEFAULT 0,
  `provider_response` TEXT DEFAULT NULL,
  `source`      ENUM('web','app') NOT NULL DEFAULT 'web',
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `expires_at`  DATETIME DEFAULT NULL,
  `used_at`     DATETIME DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_otp_mobile` (`mobile`),
  KEY `idx_otp_created` (`created_at`),
  KEY `idx_otp_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- FCM device tokens — customer app aur admin panel dono ke
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `token`       VARCHAR(255) NOT NULL,
  `customer_id` INT(11) DEFAULT NULL,
  `admin_id`    INT(11) DEFAULT NULL,
  `platform`    ENUM('android','ios','web') NOT NULL DEFAULT 'android',
  `device_info` VARCHAR(255) DEFAULT NULL,
  `is_active`   TINYINT(1) NOT NULL DEFAULT 1,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token` (`token`),
  KEY `idx_dt_customer` (`customer_id`),
  KEY `idx_dt_admin` (`admin_id`),
  KEY `idx_dt_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Har notification ka record — kya gaya, kisko, kaam kiya ya nahi
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `channel`     ENUM('whatsapp','sms','push','email') NOT NULL,
  `template`    VARCHAR(60) DEFAULT NULL,
  `recipient`   VARCHAR(120) DEFAULT NULL,
  `customer_id` INT(11) DEFAULT NULL,
  `order_id`    INT(11) DEFAULT NULL,
  `params`      TEXT DEFAULT NULL,
  `success`     TINYINT(1) NOT NULL DEFAULT 0,
  `response`    TEXT DEFAULT NULL,
  `error`       VARCHAR(500) DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_nl_channel` (`channel`),
  KEY `idx_nl_order` (`order_id`),
  KEY `idx_nl_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- DTDC shipments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shipments` (
  `shipment_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `order_id`      INT(11) NOT NULL,
  `courier`       VARCHAR(30) NOT NULL DEFAULT 'DTDC',
  `awb_number`    VARCHAR(60) DEFAULT NULL,
  `service_type`  VARCHAR(40) DEFAULT NULL COMMENT 'B2C PRIORITY / B2C PREMIUM',
  `load_type`     VARCHAR(30) DEFAULT 'NON-DOCUMENT',
  `cod_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `declared_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `weight`        DECIMAL(6,2) NOT NULL DEFAULT 0.50,
  `length`        INT(11) DEFAULT 10,
  `width`         INT(11) DEFAULT 15,
  `height`        INT(11) DEFAULT 15,
  `num_pieces`    INT(11) NOT NULL DEFAULT 1,
  `status`        ENUM('Booked','In Transit','Out for Delivery','Delivered','Failed','Cancelled','RTO') NOT NULL DEFAULT 'Booked',
  `last_scan`     VARCHAR(255) DEFAULT NULL,
  `last_location` VARCHAR(120) DEFAULT NULL,
  `last_scan_at`  DATETIME DEFAULT NULL,
  `label_url`     VARCHAR(255) DEFAULT NULL,
  `booked_by`     VARCHAR(100) DEFAULT NULL,
  `request_payload`  TEXT DEFAULT NULL,
  `response_payload` TEXT DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at`    TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`shipment_id`),
  KEY `idx_ship_order` (`order_id`),
  KEY `idx_ship_awb` (`awb_number`),
  KEY `idx_ship_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Har scan ka history (webhook + manual track dono se bharta hai)
CREATE TABLE IF NOT EXISTS `shipment_scans` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `shipment_id` INT(11) DEFAULT NULL,
  `awb_number`  VARCHAR(60) NOT NULL,
  `action_code` VARCHAR(30) DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `origin`      VARCHAR(120) DEFAULT NULL,
  `destination` VARCHAR(120) DEFAULT NULL,
  `scan_at`     DATETIME DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ss_awb` (`awb_number`),
  KEY `idx_ss_shipment` (`shipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Orders — kaunsa gateway use hua
-- ----------------------------------------------------------------------------
ALTER TABLE `orders`
  ADD COLUMN `payment_gateway` ENUM('razorpay','payu','cod','manual') DEFAULT NULL AFTER `payment_mode`,
  ADD COLUMN `gateway_order_id` VARCHAR(120) DEFAULT NULL AFTER `payment_gateway`,
  ADD INDEX `idx_orders_gateway_oid` (`gateway_order_id`);

-- Purane razorpay orders ko tag kar do
UPDATE `orders` SET `payment_gateway` = 'razorpay'
WHERE `razorpayOrderID` IS NOT NULL AND `razorpayOrderID` <> '' AND `payment_gateway` IS NULL;

UPDATE `orders` SET `payment_gateway` = 'cod'
WHERE `payment_mode` = 'cod' AND `payment_gateway` IS NULL;

UPDATE `orders` SET `gateway_order_id` = `razorpayOrderID`
WHERE `gateway_order_id` IS NULL AND `razorpayOrderID` IS NOT NULL AND `razorpayOrderID` <> '';

-- ----------------------------------------------------------------------------
-- Customers — WhatsApp opt-in
-- ----------------------------------------------------------------------------
ALTER TABLE `customers`
  ADD COLUMN `whatsapp_optin` TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_mobile_verified`;
