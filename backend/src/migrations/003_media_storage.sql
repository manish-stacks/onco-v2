-- ============================================================================
-- MIGRATION 003 — Media storage / S3 migration
-- ============================================================================
--   • media_migration_items — har image ka apna row, status ke saath.
--     Isi wajah se migration batch me chal sakti hai aur beech me ruk jaye
--     to wahin se aage badhti hai.
--
-- Chalao:  npm run migrate:003
-- ============================================================================

CREATE TABLE IF NOT EXISTS `media_migration_items` (
  `id`           INT(11) NOT NULL AUTO_INCREMENT,
  `source_table` VARCHAR(60) NOT NULL,
  `pk_column`    VARCHAR(60) NOT NULL,
  `record_id`    INT(11) NOT NULL,
  `column_name`  VARCHAR(60) NOT NULL,
  -- -1 = normal column, 0+ = JSON array ka index.
  -- NULL isliye NAHI: MySQL ka UNIQUE index NULL ko duplicate nahi maanta,
  -- to har scan pe saari rows dobara insert ho jaati hain.
  `json_index`   INT(11) NOT NULL DEFAULT -1,
  `folder`       VARCHAR(60) DEFAULT NULL,
  `old_value`    VARCHAR(500) NOT NULL,
  `source_url`   VARCHAR(700) NOT NULL,
  `new_value`    VARCHAR(500) DEFAULT NULL,
  `status`       ENUM('pending','done','failed','skipped') NOT NULL DEFAULT 'pending',
  `attempts`     INT(11) NOT NULL DEFAULT 0,
  `error`        VARCHAR(500) DEFAULT NULL,
  `processed_at` DATETIME DEFAULT NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  -- Ek hi image dobara queue na ho, chahe scan kitni baar chalao
  UNIQUE KEY `uq_media_item` (`source_table`,`record_id`,`column_name`,`json_index`),
  KEY `idx_mmi_status` (`status`),
  KEY `idx_mmi_table` (`source_table`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;