-- ---------------------------------------------------------------------------
-- 009_category_position.sql
--
-- Run with:  npm run migrate:009
--
-- Lets the admin decide the display order of categories on the frontend
-- (mega-menu, category grid, etc). Lower position shows first. Existing
-- categories default to 0, so nothing changes until the admin sets a value.
-- ---------------------------------------------------------------------------

ALTER TABLE `categories` ADD COLUMN `position` INT NOT NULL DEFAULT 0 AFTER `status`;
ALTER TABLE `categories` ADD INDEX `idx_categories_position` (`position`);
