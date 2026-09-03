-- ---------------------------------------------------------------------------
-- 010_newsletter_coupon_visibility.sql
--
-- Run with:  npm run migrate:010
--
-- 1) New table for the footer/homepage "Subscribe" newsletter form.
-- 2) `coupons.is_public` — lets the admin keep a coupon Active (so it still
--    works when a customer types the code at checkout) while hiding it from
--    the public "available coupons" list. Existing coupons default to
--    visible (1), so nothing changes until the admin turns one off.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `email`       VARCHAR(150) NOT NULL,
  `status`      ENUM('active','unsubscribed') NOT NULL DEFAULT 'active',
  `source`      VARCHAR(50) DEFAULT 'website',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_newsletter_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `coupons` ADD COLUMN `is_public` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`;
