-- ---------------------------------------------------------------------------
-- 007_pos_gateways_gst.sql
--
-- Run with:  npm run migrate:007
--
-- The runner skips "column already exists" (1060), "index already exists"
-- (1061) and "foreign key already exists" (1826) on its own, so this file is
-- safe to run as many times as you like.
--
--   1. settings.default_gst / gst_override   -- the GST that was not saving
--   2. settings.is_razorpay / is_payu        -- enable/disable each gateway
--   3. orders.payment_gateway widened        -- POS stores Cash / UPI / Card ...
--   4. orders.patient_name / doctor_name / hospital_name
-- ---------------------------------------------------------------------------

-- 1. GST settings ------------------------------------------------------------
ALTER TABLE `settings` ADD COLUMN `default_gst`  DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE `settings` ADD COLUMN `gst_override` TINYINT(1)   NOT NULL DEFAULT 0;

-- 2. Payment gateway toggles (both ON by default) ----------------------------
ALTER TABLE `settings` ADD COLUMN `is_razorpay` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `settings` ADD COLUMN `is_payu`     TINYINT(1) NOT NULL DEFAULT 1;

-- 3. orders.payment_gateway was ENUM('razorpay','payu','cod','manual').
--    POS writes the counter payment method into it (Cash, UPI, Card,
--    Bank Transfer, offline), which an ENUM silently rejects. Widen it.
ALTER TABLE `orders` MODIFY `payment_gateway` VARCHAR(30) DEFAULT NULL;

-- 4. Patient / doctor / hospital on the order itself --------------------------
ALTER TABLE `orders` ADD COLUMN `patient_name`  VARCHAR(255) DEFAULT NULL AFTER `customer_name`;
ALTER TABLE `orders` ADD COLUMN `doctor_name`   VARCHAR(255) DEFAULT NULL AFTER `patient_name`;
ALTER TABLE `orders` ADD COLUMN `hospital_name` VARCHAR(255) DEFAULT NULL AFTER `doctor_name`;

-- 5. Seed values --------------------------------------------------------------
-- gst_override stays 0, so per-product rates keep winning until the admin
-- turns the override on from Settings -> Tax (GST).
UPDATE `settings` SET `default_gst` = 18 WHERE `default_gst` = 0;

UPDATE `settings` SET `is_razorpay` = 1 WHERE `is_razorpay` IS NULL;
UPDATE `settings` SET `is_payu`     = 1 WHERE `is_payu`     IS NULL;

-- Backfill patient_name on old orders so the admin order page is not blank.
UPDATE `orders` SET `patient_name` = `customer_name`
WHERE (`patient_name` IS NULL OR `patient_name` = '') AND `customer_name` IS NOT NULL;
