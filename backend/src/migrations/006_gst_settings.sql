-- ---------------------------------------------------------------------------
-- 006_gst_settings.sql
--
-- Admin-controlled GST. Two columns on the single `settings` row:
--
--   default_gst   the GST percent to use (0 / 5 / 12 / 18 / 28)
--   gst_override  1 = force default_gst on every product, ignoring products.product_gst
--                 0 = only use default_gst where a product has no rate of its own
--
-- Safe to re-run: the migration runner skips "column already exists" (1060).
-- ---------------------------------------------------------------------------

ALTER TABLE `settings` ADD COLUMN `default_gst` DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE `settings` ADD COLUMN `gst_override` TINYINT(1) NOT NULL DEFAULT 0;

-- Seed the existing row with the most common rate so nothing changes silently.
-- gst_override stays 0, so per-product rates keep winning until the admin
-- turns the override on from Settings.
UPDATE `settings` SET `default_gst` = 18 WHERE `default_gst` = 0;
