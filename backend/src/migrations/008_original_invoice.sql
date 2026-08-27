-- ---------------------------------------------------------------------------
-- 008_original_invoice.sql
--
-- Run with:  npm run migrate:008
--
-- The runner skips "column already exists" (1060) on its own, so this file
-- is safe to run as many times as you like.
--
--   Until an order is shipped, the customer/admin see the auto-generated
--   (temp) invoice, same as today. Once the admin books DTDC and uploads
--   the original invoice PDF, that file is shown everywhere instead.
-- ---------------------------------------------------------------------------

ALTER TABLE `orders` ADD COLUMN `original_invoice_url` VARCHAR(500) NULL AFTER `invoice_number`;
