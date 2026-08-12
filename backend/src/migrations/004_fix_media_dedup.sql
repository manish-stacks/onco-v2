-- ============================================================================
-- MIGRATION 004 — media_migration_items ka duplicate bug fix
-- ============================================================================
-- Problem:
--   UNIQUE KEY (source_table, record_id, column_name, json_index) tha, lekin
--   MySQL/MariaDB me UNIQUE index NULL ko duplicate nahi maanta — har NULL
--   apne aap me alag value hai. Non-JSON columns me json_index NULL rehta hai,
--   isliye INSERT IGNORE kabhi dedupe kar hi nahi paaya aur har scan pe saari
--   rows dobara insert ho rahi thi.
--   (22 categories x 2 columns x 9 scans = 396 rows)
--
-- Fix:
--   json_index ko NOT NULL DEFAULT -1 kar do. -1 ka matlab "JSON array nahi hai".
--   Ab unique key sach me kaam karegi.
--
-- Chalao:  npm run migrate:004
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Pehle duplicates hatao
-- ----------------------------------------------------------------------------

-- Jahan ek hi image ki done aur pending dono rows hain, wahan pending/failed hatao
DELETE dup FROM `media_migration_items` dup
INNER JOIN `media_migration_items` keep
   ON keep.`source_table` = dup.`source_table`
  AND keep.`record_id`    = dup.`record_id`
  AND keep.`column_name`  = dup.`column_name`
  AND COALESCE(keep.`json_index`, -1) = COALESCE(dup.`json_index`, -1)
  AND keep.`status` = 'done'
  AND dup.`status` <> 'done';

-- Baaki duplicates me sabse purani (lowest id) rakho
DELETE dup FROM `media_migration_items` dup
INNER JOIN `media_migration_items` keep
   ON keep.`source_table` = dup.`source_table`
  AND keep.`record_id`    = dup.`record_id`
  AND keep.`column_name`  = dup.`column_name`
  AND COALESCE(keep.`json_index`, -1) = COALESCE(dup.`json_index`, -1)
  AND keep.`id` < dup.`id`;

-- ----------------------------------------------------------------------------
-- 2. NULL ko -1 se badlo
-- ----------------------------------------------------------------------------
UPDATE `media_migration_items` SET `json_index` = -1 WHERE `json_index` IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Column NOT NULL karo aur unique key dobara lagao
--    (index pehle drop karna zaroori hai, warna MODIFY pe lock lag sakta hai)
-- ----------------------------------------------------------------------------
ALTER TABLE `media_migration_items` DROP INDEX `uq_media_item`;

ALTER TABLE `media_migration_items`
  MODIFY `json_index` INT(11) NOT NULL DEFAULT -1
  COMMENT '-1 = normal column, 0+ = JSON array ka index';

ALTER TABLE `media_migration_items`
  ADD UNIQUE KEY `uq_media_item` (`source_table`,`record_id`,`column_name`,`json_index`);