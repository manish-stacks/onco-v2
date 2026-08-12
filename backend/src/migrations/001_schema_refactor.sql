-- ============================================================================
-- MIGRATION 001 — oncohealthmart schema refactor
-- ============================================================================
-- Kya karti hai:
--   1. Saari cp_* tables ko clean naam deti hai (cp_order -> orders)
--   2. Web + App ke order details EK order_items table me merge
--   3. Temp order tables khatam — ab sirf ek `orders` table hai
--   4. Web + App prescriptions EK `prescriptions` table me, images JSON array
--   5. Proper inventory (numeric stock + inventory_logs audit trail)
--   6. Wishlist, order_status_logs, coupon_usages, product_reviews
--
-- ⚠ Ye file DOBARA CHALANE PE SAFE hai. Saare data-copy steps guard ke saath
--   hain — jo rows pehle se copy ho chuki hain wo dobara insert nahi hotin.
--   Adhoori migration ke baad bas `npm run migrate` phir se chala do.
--
-- CHALANE SE PEHLE:
--   1. Backup lo:        mysqldump -u USER -p DBNAME > backup.sql
--   2. Backend band karo (warna ALTER metadata lock pe atak jaata hai)
--   3. Local pe ho to pehle trim karo — 34k orders pe UPDATE 12 minute leta hai:
--        npm run trim -- --orders=50
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- STEP 1 — Tables ka rename (instant, data copy nahi hota)
-- ============================================================================
RENAME TABLE `cp_customer`          TO `customers`;
RENAME TABLE `cp_product`           TO `products`;
RENAME TABLE `cp_category`          TO `categories`;
RENAME TABLE `cp_product_category`  TO `product_categories`;
RENAME TABLE `cp_order`             TO `orders`;
RENAME TABLE `cp_addresses`         TO `addresses`;
RENAME TABLE `cp_shopping_cart`     TO `cart_items`;
RENAME TABLE `cp_coupon`            TO `coupons`;
RENAME TABLE `cp_coupon_option`     TO `coupon_options`;
RENAME TABLE `cp_admin_master`      TO `admins`;
RENAME TABLE `cp_admin_usertype`    TO `roles`;
RENAME TABLE `cp_admin_permission`  TO `role_permissions`;
RENAME TABLE `cp_banner`            TO `banners`;
RENAME TABLE `cp_settings`          TO `settings`;
RENAME TABLE `cp_reviews`           TO `testimonials`;
RENAME TABLE `cp_shop_by_brand`     TO `brands`;
RENAME TABLE `cp_serviceable_city`  TO `serviceable_cities`;
RENAME TABLE `cp_state`             TO `states`;
RENAME TABLE `cp_country`           TO `countries`;
RENAME TABLE `cp_deals`             TO `deals`;
RENAME TABLE `cp_app_offer`         TO `offers`;
RENAME TABLE `cp_content`           TO `pages`;
RENAME TABLE `cp_contact`           TO `contact_enquiries`;
RENAME TABLE `cp_news_table`        TO `news`;

-- ============================================================================
-- STEP 2 — Nayi tables (khaali banti hain, isliye fast)
-- ============================================================================

-- Web + App ke order items ek jagah
CREATE TABLE IF NOT EXISTS `order_items` (
  `item_id`           INT(11) NOT NULL AUTO_INCREMENT,
  `order_id`          INT(11) NOT NULL,
  `product_id`        INT(11) NOT NULL,
  `product_name`      VARCHAR(255) DEFAULT NULL,
  `product_image`     TEXT DEFAULT NULL,
  `sku`               VARCHAR(50) DEFAULT NULL,
  `hsn_code`          VARCHAR(20) DEFAULT NULL,
  `unit_price`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unit_mrp`          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unit_quantity`     INT(11) NOT NULL DEFAULT 1,
  `line_subtotal`     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tax_percent`       DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `line_total`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `legacy_details_id` INT(11) DEFAULT NULL COMMENT 'audit: purani split tables ka details_id',
  `created_at`        TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at`        TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`item_id`),
  KEY `idx_oi_order` (`order_id`),
  KEY `idx_oi_product` (`product_id`),
  KEY `idx_oi_dedup` (`order_id`,`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Web + App prescriptions ek jagah. images JSON array hai —
-- 1 image ho ya 10, sab fit ho jaati hain (pehle app me 5 fixed columns the)
CREATE TABLE IF NOT EXISTS `prescriptions` (
  `prescription_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `customer_id`       INT(11) DEFAULT NULL,
  `reference_code`    VARCHAR(64) DEFAULT NULL COMMENT 'uuid / public tracking code',
  `title`             VARCHAR(255) DEFAULT NULL,
  `images`            JSON DEFAULT NULL COMMENT 'array of image paths',
  `patient_name`      VARCHAR(255) DEFAULT NULL,
  `doctor_name`       VARCHAR(255) DEFAULT NULL,
  `hospital_name`     VARCHAR(255) DEFAULT NULL,
  `notes`             TEXT DEFAULT NULL,
  `status`            ENUM('Pending','Under Review','Approved','Rejected','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  `rejection_reason`  VARCHAR(1000) DEFAULT NULL,
  `source`            ENUM('web','app') NOT NULL DEFAULT 'web',
  `direct_upload`     TINYINT(1) NOT NULL DEFAULT 0,
  `contact_number`    VARCHAR(20) DEFAULT NULL,
  `reviewed_by`       INT(11) DEFAULT NULL,
  `reviewed_at`       DATETIME DEFAULT NULL,
  `legacy_id`         INT(11) DEFAULT NULL,
  `legacy_table`      VARCHAR(30) DEFAULT NULL,
  `created_at`        TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at`        TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`prescription_id`),
  KEY `idx_presc_customer` (`customer_id`),
  KEY `idx_presc_status` (`status`),
  KEY `idx_presc_ref` (`reference_code`),
  KEY `idx_presc_legacy` (`legacy_table`,`legacy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin jo medicines prescription ke against suggest karta hai
CREATE TABLE IF NOT EXISTS `prescription_medicines` (
  `id`              INT(11) NOT NULL AUTO_INCREMENT,
  `prescription_id` INT(11) NOT NULL,
  `product_id`      INT(11) DEFAULT NULL,
  `medicine_name`   VARCHAR(255) DEFAULT NULL,
  `medicine_link`   TEXT DEFAULT NULL,
  `quantity`        INT(11) NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at`      TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pm_presc` (`prescription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Har stock movement ka audit trail
CREATE TABLE IF NOT EXISTS `inventory_logs` (
  `log_id`          INT(11) NOT NULL AUTO_INCREMENT,
  `product_id`      INT(11) NOT NULL,
  `change_type`     ENUM('purchase','sale','return','adjustment','damage','expiry','initial') NOT NULL,
  `quantity_change` INT(11) NOT NULL COMMENT '+ve = stock aaya, -ve = stock gaya',
  `quantity_before` INT(11) NOT NULL DEFAULT 0,
  `quantity_after`  INT(11) NOT NULL DEFAULT 0,
  `reference_type`  VARCHAR(30) DEFAULT NULL COMMENT 'order / manual / bulk',
  `reference_id`    INT(11) DEFAULT NULL,
  `note`            VARCHAR(500) DEFAULT NULL,
  `changed_by`      VARCHAR(100) DEFAULT NULL,
  `created_at`      TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_inv_product` (`product_id`),
  KEY `idx_inv_type` (`change_type`),
  KEY `idx_inv_created` (`created_at`),
  KEY `idx_inv_ref` (`reference_type`,`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Har order status change ka record
CREATE TABLE IF NOT EXISTS `order_status_logs` (
  `log_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `order_id`   INT(11) NOT NULL,
  `old_status` VARCHAR(50) DEFAULT NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by` VARCHAR(100) DEFAULT NULL,
  `note`       TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `idx_osl_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kisne kaunsa coupon kab use kiya
CREATE TABLE IF NOT EXISTS `coupon_usages` (
  `id`              INT(11) NOT NULL AUTO_INCREMENT,
  `coupon_id`       INT(11) NOT NULL,
  `customer_id`     INT(11) NOT NULL,
  `order_id`        INT(11) DEFAULT NULL,
  `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at`      TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cu_coupon` (`coupon_id`),
  KEY `idx_cu_customer` (`customer_id`),
  KEY `idx_cu_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wishlists` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `customer_id` INT(11) NOT NULL,
  `product_id`  INT(11) NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlist` (`customer_id`,`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer reviews (testimonials se alag — wo manually daale jaate hain)
CREATE TABLE IF NOT EXISTS `product_reviews` (
  `review_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `product_id`  INT(11) NOT NULL,
  `customer_id` INT(11) NOT NULL,
  `order_id`    INT(11) DEFAULT NULL,
  `rating`      TINYINT(1) NOT NULL,
  `title`       VARCHAR(255) DEFAULT NULL,
  `review`      TEXT DEFAULT NULL,
  `status`      ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`review_id`),
  UNIQUE KEY `uq_review` (`product_id`,`customer_id`),
  KEY `idx_pr_product` (`product_id`),
  KEY `idx_pr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_activity_logs` (
  `id`             INT(11) NOT NULL AUTO_INCREMENT,
  `admin_id`       INT(11) DEFAULT NULL,
  `admin_username` VARCHAR(50) DEFAULT NULL,
  `action`         VARCHAR(100) NOT NULL,
  `module`         VARCHAR(50) DEFAULT NULL,
  `record_id`      VARCHAR(50) DEFAULT NULL,
  `description`    VARCHAR(500) DEFAULT NULL,
  `ip_address`     VARCHAR(45) DEFAULT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_aal_admin` (`admin_id`),
  KEY `idx_aal_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agar prescriptions table pichhli baar bin index ke ban gayi thi to ab lag jaaye.
-- Iske bina neeche wala re-point UPDATE full table scan karta hai (34k orders pe
-- 12 minute lagte hain).
ALTER TABLE `prescriptions` ADD INDEX `idx_presc_legacy` (`legacy_table`,`legacy_id`);
ALTER TABLE `order_items`   ADD INDEX `idx_oi_dedup` (`order_id`,`product_id`);
ALTER TABLE `orders`        ADD INDEX `idx_orders_presc` (`prescription_id`);

-- ============================================================================
-- STEP 3 — Purana data naye tables me copy
--
-- Har INSERT me guard hai — jo rows pehle se copy ho chuki hain wo dobara
-- insert nahi hotin. Isliye ye file baar-baar chalayi ja sakti hai.
-- ============================================================================

-- Web order details
INSERT INTO `order_items`
  (`order_id`,`product_id`,`product_name`,`product_image`,`unit_price`,`unit_quantity`,
   `line_subtotal`,`tax_percent`,`tax_amount`,`line_total`,`legacy_details_id`,`created_at`,`updated_at`)
SELECT d.`order_id`, d.`product_id`, LEFT(COALESCE(d.`product_name`,''),255), d.`product_image`,
       d.`unit_price`, d.`unit_quantity`,
       d.`unit_price` * d.`unit_quantity`, d.`tax_percent`, d.`tax_amount`,
       (d.`unit_price` * d.`unit_quantity`) + d.`tax_amount`,
       d.`details_id`, d.`created_at`, d.`updated_at`
FROM `cp_order_details` d
INNER JOIN `orders` o ON o.`order_id` = d.`order_id`
LEFT JOIN `order_items` oi
       ON oi.`order_id` = d.`order_id` AND oi.`product_id` = d.`product_id`
WHERE oi.`item_id` IS NULL;

-- App order details (orphan rows skip — jinka parent order hi nahi hai)
INSERT INTO `order_items`
  (`order_id`,`product_id`,`product_name`,`product_image`,`unit_price`,`unit_quantity`,
   `line_subtotal`,`tax_percent`,`tax_amount`,`line_total`,`legacy_details_id`,`created_at`,`updated_at`)
SELECT d.`order_id`, d.`product_id`, LEFT(COALESCE(d.`product_name`,''),255), d.`product_image`,
       d.`unit_price`, d.`unit_quantity`,
       d.`unit_price` * d.`unit_quantity`, d.`tax_percent`, d.`tax_amount`,
       (d.`unit_price` * d.`unit_quantity`) + d.`tax_amount`,
       d.`details_id`, d.`created_at`, d.`updated_at`
FROM `cp_app_order_details` d
INNER JOIN `orders` o ON o.`order_id` = d.`order_id`
LEFT JOIN `order_items` oi
       ON oi.`order_id` = d.`order_id` AND oi.`product_id` = d.`product_id`
WHERE oi.`item_id` IS NULL;

-- Web prescriptions — single file ek 1-element JSON array ban jaati hai
INSERT INTO `prescriptions`
  (`customer_id`,`title`,`images`,`status`,`source`,`legacy_id`,`legacy_table`,`created_at`)
SELECT s.`customer_id`,
       s.`prescription_name`,
       IF(s.`prescription_file` IS NULL OR s.`prescription_file` = '', JSON_ARRAY(), JSON_ARRAY(s.`prescription_file`)),
       CASE WHEN LOWER(COALESCE(s.`status`,'')) LIKE '%complet%' THEN 'Completed' ELSE 'Pending' END,
       'web', s.`prescription_id`, 'cp_prescription',
       COALESCE(s.`upload_date`, s.`created_at`)
FROM `cp_prescription` s
LEFT JOIN `prescriptions` p
       ON p.`legacy_table` = 'cp_prescription' AND p.`legacy_id` = s.`prescription_id`
WHERE p.`prescription_id` IS NULL;

-- App prescriptions — 5 image columns collapse ho ke ek JSON array
INSERT INTO `prescriptions`
  (`customer_id`,`reference_code`,`images`,`status`,`rejection_reason`,`contact_number`,
   `source`,`direct_upload`,`legacy_id`,`legacy_table`,`created_at`)
SELECT
  CAST(NULLIF(s.`user_id`,'') AS UNSIGNED),
  s.`uuid`,
  JSON_MERGE_PRESERVE(
    JSON_ARRAY(),
    IF(s.`image_1` IS NULL OR s.`image_1`='', JSON_ARRAY(), JSON_ARRAY(s.`image_1`)),
    IF(s.`image_2` IS NULL OR s.`image_2`='', JSON_ARRAY(), JSON_ARRAY(s.`image_2`)),
    IF(s.`image_3` IS NULL OR s.`image_3`='', JSON_ARRAY(), JSON_ARRAY(s.`image_3`)),
    IF(s.`image_4` IS NULL OR s.`image_4`='', JSON_ARRAY(), JSON_ARRAY(s.`image_4`)),
    IF(s.`image_5` IS NULL OR s.`image_5`='', JSON_ARRAY(), JSON_ARRAY(s.`image_5`))
  ),
  CASE
    WHEN LOWER(COALESCE(s.`prescription_status`,'')) LIKE '%complet%' THEN 'Completed'
    WHEN LOWER(COALESCE(s.`prescription_status`,'')) LIKE '%cancel%'  THEN 'Cancelled'
    WHEN LOWER(COALESCE(s.`prescription_status`,'')) LIKE '%reject%'  THEN 'Rejected'
    WHEN LOWER(COALESCE(s.`prescription_status`,'')) LIKE '%approv%'  THEN 'Approved'
    ELSE 'Pending'
  END,
  s.`cancel_reason`, s.`user_connect`,
  'app', s.`direct_upload`, s.`id`, 'cp_app_prescription', s.`created_at`
FROM `cp_app_prescription` s
LEFT JOIN `prescriptions` p
       ON p.`legacy_table` = 'cp_app_prescription' AND p.`legacy_id` = s.`id`
WHERE p.`prescription_id` IS NULL;

-- Suggested medicines
INSERT INTO `prescription_medicines` (`prescription_id`,`medicine_name`,`medicine_link`,`created_at`)
SELECT p.`prescription_id`, m.`medicine_name`, m.`medicine_link`, m.`created_at`
FROM `cp_prescription_medicine` m
INNER JOIN `prescriptions` p
        ON p.`legacy_id` = m.`prescription_id` AND p.`legacy_table` = 'cp_prescription'
LEFT JOIN `prescription_medicines` pm
       ON pm.`prescription_id` = p.`prescription_id`
      AND pm.`medicine_name` <=> m.`medicine_name`
WHERE pm.`id` IS NULL;

-- ============================================================================
-- STEP 4 — Purani tables me naye columns + indexes
-- Table rebuild karte hain, isliye data copy ke BAAD rakhe hain
-- ============================================================================

ALTER TABLE `orders`
  MODIFY `orderFrom` ENUM('web','app') NOT NULL DEFAULT 'web',
  MODIFY `payment_status` ENUM('Unpaid','Paid','Failed','Refunded','Partially Refunded') NOT NULL DEFAULT 'Unpaid',
  ADD COLUMN `coupon_id`        INT(11) DEFAULT NULL AFTER `coupon_code`,
  ADD COLUMN `refund_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `payment_status`,
  ADD COLUMN `refund_reference` VARCHAR(100) DEFAULT NULL AFTER `refund_amount`,
  ADD COLUMN `invoice_number`   VARCHAR(50) DEFAULT NULL AFTER `gst_invoice`,
  ADD COLUMN `delivered_at`     DATETIME DEFAULT NULL AFTER `tracking_datetime`,
  ADD COLUMN `created_at`       TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  ADD COLUMN `updated_at`       TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  ADD INDEX `idx_orders_customer` (`customer_id`),
  ADD INDEX `idx_orders_status` (`status`),
  ADD INDEX `idx_orders_payment_status` (`payment_status`),
  ADD INDEX `idx_orders_from` (`orderFrom`),
  ADD INDEX `idx_orders_date` (`order_date`),
  ADD INDEX `idx_orders_rzp` (`razorpayOrderID`(64)),
  ADD INDEX `idx_orders_dbid` (`databaseOrderID`(64));

ALTER TABLE `products`
  ADD COLUMN `stock_quantity`  INT(11) NOT NULL DEFAULT 0 AFTER `stock`,
  ADD COLUMN `low_stock_alert` INT(11) NOT NULL DEFAULT 10 AFTER `stock_quantity`,
  ADD COLUMN `allow_backorder` TINYINT(1) NOT NULL DEFAULT 0 AFTER `low_stock_alert`,
  ADD COLUMN `batch_number`    VARCHAR(50) DEFAULT NULL AFTER `allow_backorder`,
  ADD COLUMN `expiry_date`     DATE DEFAULT NULL AFTER `batch_number`,
  ADD COLUMN `total_sold`      INT(11) NOT NULL DEFAULT 0 AFTER `expiry_date`,
  ADD INDEX `idx_products_status` (`status`),
  ADD INDEX `idx_products_slug` (`slug`(191)),
  ADD INDEX `idx_products_sku` (`sku`),
  ADD INDEX `idx_products_stock` (`stock`);

ALTER TABLE `coupons`
  ADD COLUMN `max_discount_amount` INT(11) DEFAULT NULL AFTER `minimum_amount`,
  ADD COLUMN `per_customer_limit`  INT(11) DEFAULT NULL AFTER `number_of_total_uses`,
  ADD COLUMN `used_count`          INT(11) NOT NULL DEFAULT 0 AFTER `per_customer_limit`,
  ADD COLUMN `start_date`          DATE DEFAULT NULL AFTER `used_count`,
  ADD UNIQUE KEY `uq_coupon_code` (`coupon_code`);

ALTER TABLE `admins`
  MODIFY `admin_id` INT(11) NOT NULL AUTO_INCREMENT,
  ADD COLUMN `avatar`        VARCHAR(255) DEFAULT NULL AFTER `admin_phone`,
  ADD COLUMN `department`    VARCHAR(100) DEFAULT NULL AFTER `avatar`,
  ADD COLUMN `employee_code` VARCHAR(50) DEFAULT NULL AFTER `department`,
  ADD COLUMN `created_by`    INT(11) DEFAULT NULL AFTER `employee_code`,
  ADD UNIQUE KEY `uq_admin_username` (`admin_username`);

-- NOTE: COMMENT hamesha AFTER se PEHLE aata hai. Ulta likhne pe MariaDB
-- parse error deta hai.
ALTER TABLE `roles`
  ADD COLUMN `description` VARCHAR(255) DEFAULT NULL AFTER `name`,
  ADD COLUMN `is_system`   TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'system role delete nahi ho sakta' AFTER `description`;

ALTER TABLE `role_permissions`
  ADD UNIQUE KEY `uq_role_permission` (`role_id`,`permission`);

ALTER TABLE `customers`
  ADD COLUMN `is_mobile_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `last_login`         DATETIME DEFAULT NULL AFTER `is_mobile_verified`,
  ADD INDEX `idx_cust_mobile` (`mobile`),
  ADD INDEX `idx_cust_status` (`status`);

ALTER TABLE `addresses`
  ADD COLUMN `full_name`  VARCHAR(150) DEFAULT NULL AFTER `user_id`,
  ADD COLUMN `phone`      VARCHAR(20) DEFAULT NULL AFTER `full_name`,
  ADD COLUMN `landmark`   VARCHAR(255) DEFAULT NULL AFTER `stree_address`,
  ADD COLUMN `is_default` TINYINT(1) NOT NULL DEFAULT 0 AFTER `landmark`,
  ADD INDEX `idx_addr_user` (`user_id`);

ALTER TABLE `cart_items`
  ADD INDEX `idx_cart_customer` (`customer_id`);

-- ============================================================================
-- STEP 5 — Backfill
-- ============================================================================

-- orders.prescription_id ko naye prescriptions table ke id se re-point karo.
--
-- `cur.prescription_id IS NULL` wali condition zaroori hai: dobara chalane pe
-- jo orders pehle hi naye id pe point kar rahe hain unhe chhod deta hai. Iske
-- bina ek naya prescription_id galti se kisi purane legacy_id se match kar ke
-- data corrupt kar sakta hai.
UPDATE `orders` o
INNER JOIN `prescriptions` p
        ON p.`legacy_table` = 'cp_prescription' AND p.`legacy_id` = o.`prescription_id`
LEFT JOIN `prescriptions` cur
        ON cur.`prescription_id` = o.`prescription_id`
SET o.`prescription_id` = p.`prescription_id`
WHERE o.`prescription_id` IS NOT NULL
  AND cur.`prescription_id` IS NULL;

-- Purana stock sirf In/Out Stock enum tha. Naye numeric system ko
-- day-one se sensible banane ke liye opening quantity de do.
-- Sirf un rows pe jinka stock_quantity abhi tak 0 hai — dobara chalane pe
-- admin ke set kiye hue numbers wapas 100 na ho jaayein.
UPDATE `products` SET `stock_quantity` = 100
WHERE `stock` = 'In Stock' AND `stock_quantity` = 0;

UPDATE `products` SET `stock_quantity` = 0
WHERE `stock` = 'Out of Stock' AND `stock_quantity` > 0;

-- total_sold purane orders se nikaalo
UPDATE `products` p
INNER JOIN (
  SELECT oi.product_id, SUM(oi.unit_quantity) AS sold
  FROM `order_items` oi
  INNER JOIN `orders` o ON o.order_id = oi.order_id
  WHERE o.status <> 'Cancelled'
  GROUP BY oi.product_id
) s ON s.product_id = p.product_id
SET p.`total_sold` = s.sold;

-- ============================================================================
-- STEP 6 — Foreign keys (data saaf hone ke baad hi lagti hain)
-- ============================================================================
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`)
  REFERENCES `orders`(`order_id`) ON DELETE CASCADE;

ALTER TABLE `order_status_logs`
  ADD CONSTRAINT `fk_osl_order` FOREIGN KEY (`order_id`)
  REFERENCES `orders`(`order_id`) ON DELETE CASCADE;

ALTER TABLE `prescription_medicines`
  ADD CONSTRAINT `fk_pm_presc` FOREIGN KEY (`prescription_id`)
  REFERENCES `prescriptions`(`prescription_id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- STEP 7 — Purani tables hatao
-- ============================================================================
-- Runner counts print karta hai. Verify karne ke BAAD ye manually chalao:
--
--   DROP TABLE cp_order_details, cp_app_order_details, cp_order_temp,
--     cp_temp_order, cp_temp_order_details, cp_prescription,
--     cp_app_prescription, cp_prescription_medicine;
-- ============================================================================
