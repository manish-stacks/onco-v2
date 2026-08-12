-- ============================================================================
-- MIGRATION 005 — Product brands + merchandising flags
-- ============================================================================
--   • brands ko asli brand master banao (slug, description, product_count)
--   • products.brand_id add karo — company_name free text ki jagah
--   • is_featured flag add karo (deal/top_selling/latest ke saath)
--
-- company_name column HATAYA NAHI ja raha — mapping ke baad bhi audit ke liye
-- rehta hai, aur kisi product ka brand map na ho paye to fallback bana rehta hai.
--
-- Chalao:  npm run migrate:005
-- Uske baad brand mapping:  npm run map-brands          (dry run — sirf report)
--                           npm run map-brands -- --apply
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. brands ko proper master banao
-- ----------------------------------------------------------------------------
ALTER TABLE `brands`
  ADD COLUMN `slug`          VARCHAR(191) DEFAULT NULL AFTER `title`,
  ADD COLUMN `description`   TEXT DEFAULT NULL AFTER `slug`,
  ADD COLUMN `is_featured`   TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = homepage "shop by brand" me dikhega' AFTER `description`,
  ADD COLUMN `product_count` INT(11) NOT NULL DEFAULT 0
    COMMENT 'denormalized — brand mapping ke baad refresh hota hai' AFTER `is_featured`,
  ADD COLUMN `created_at`    TIMESTAMP NOT NULL DEFAULT current_timestamp();

-- Jo brands abhi hain wo sab homepage widget ke liye hi bane the
UPDATE `brands` SET `is_featured` = 1 WHERE `image_url` IS NOT NULL AND `image_url` <> '';

ALTER TABLE `brands` ADD INDEX `idx_brands_slug` (`slug`);
ALTER TABLE `brands` ADD INDEX `idx_brands_featured` (`is_featured`);

-- ----------------------------------------------------------------------------
-- 2. products me brand link + featured flag
-- ----------------------------------------------------------------------------
ALTER TABLE `products`
  ADD COLUMN `brand_id`    INT(11) DEFAULT NULL AFTER `company_name`,
  ADD COLUMN `is_featured` ENUM('0','1') NOT NULL DEFAULT '0' AFTER `latest_product`;

ALTER TABLE `products` ADD INDEX `idx_products_brand` (`brand_id`);
ALTER TABLE `products` ADD INDEX `idx_products_featured` (`is_featured`);

-- Merchandising flags pe filter lagta hai — index se list page tez rehta hai
ALTER TABLE `products` ADD INDEX `idx_products_deal` (`deal_of_the_day`);
ALTER TABLE `products` ADD INDEX `idx_products_top` (`top_selling`);
ALTER TABLE `products` ADD INDEX `idx_products_latest` (`latest_product`);
