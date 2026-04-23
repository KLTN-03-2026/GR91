-- ============================================================
-- Smart Hotel — Safe Payment Schema Migration v2
-- Date: 2026-04-19
-- Author: Schema Audit (Antigravity)
-- Run against: smart_hotel (MySQL 8.0.45)
-- ============================================================
-- SAFETY GUARANTEES:
--   - NO DROP TABLE / DROP COLUMN
--   - NO data loss
--   - All ENUM modifications only EXTEND existing values
--   - All new columns/indexes are idempotent via IF NOT EXISTS checks
--   - FK types verified: payment_logs.payment_id INT = payment_transactions.payment_id INT ✅
-- ============================================================

USE smart_hotel;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- BLOCK 1: bookings.status — Add explicit DEFAULT 'PENDING'
-- ============================================================
-- Purpose: The NOT NULL column currently has no explicit DEFAULT.
-- MySQL implicitly uses first ENUM value, but being explicit is
-- safer for ORMs and strict modes.
ALTER TABLE `bookings`
  MODIFY COLUMN `status`
    ENUM('PENDING','CONFIRMED','COMPLETED','CANCELLED','PARTIALLY_PAID')
    COLLATE utf8mb4_unicode_ci
    NOT NULL
    DEFAULT 'PENDING';

-- ============================================================
-- BLOCK 2: payment_transactions.status — Extend ENUM for
-- future MoMo flows (REFUNDED, TIMEOUT, CANCELLED)
-- ============================================================
ALTER TABLE `payment_transactions`
  MODIFY COLUMN `status`
    ENUM('PENDING','SUCCESS','FAILED','REFUNDED','TIMEOUT','CANCELLED')
    COLLATE utf8mb4_unicode_ci
    NOT NULL
    DEFAULT 'PENDING';

-- ============================================================
-- BLOCK 3: payment_transactions — Index idempotency_key
-- ============================================================
-- Used for deduplication lookups on every payment request.
-- MySQL 8: ALTER TABLE ... ADD INDEX IF NOT EXISTS not supported without procedure.
-- Wrap in a stored procedure for idempotent execution:

DROP PROCEDURE IF EXISTS `_add_idx_idempotency_key`;
DELIMITER $$
CREATE PROCEDURE `_add_idx_idempotency_key`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'smart_hotel'
      AND TABLE_NAME   = 'payment_transactions'
      AND INDEX_NAME   = 'idx_idempotency_key'
  ) THEN
    ALTER TABLE `payment_transactions`
      ADD INDEX `idx_idempotency_key` (`idempotency_key`);
  END IF;
END$$
DELIMITER ;
CALL `_add_idx_idempotency_key`();
DROP PROCEDURE IF EXISTS `_add_idx_idempotency_key`;

-- ============================================================
-- BLOCK 4: payment_transactions — Drop redundant non-unique
-- indexes (UNIQUE KEY already serves as index)
-- ============================================================

DROP PROCEDURE IF EXISTS `_drop_redundant_momo_indexes`;
DELIMITER $$
CREATE PROCEDURE `_drop_redundant_momo_indexes`()
BEGIN
  -- Drop idx_momo_order_id if it exists AND is non-unique
  -- (the UNIQUE KEY idx_unique_order_id is sufficient)
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'smart_hotel'
      AND TABLE_NAME   = 'payment_transactions'
      AND INDEX_NAME   = 'idx_momo_order_id'
      AND NON_UNIQUE   = 1
  ) THEN
    ALTER TABLE `payment_transactions` DROP INDEX `idx_momo_order_id`;
  END IF;

  -- Drop idx_momo_request_id if it exists AND is non-unique
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'smart_hotel'
      AND TABLE_NAME   = 'payment_transactions'
      AND INDEX_NAME   = 'idx_momo_request_id'
      AND NON_UNIQUE   = 1
  ) THEN
    ALTER TABLE `payment_transactions` DROP INDEX `idx_momo_request_id`;
  END IF;
END$$
DELIMITER ;
CALL `_drop_redundant_momo_indexes`();
DROP PROCEDURE IF EXISTS `_drop_redundant_momo_indexes`;

-- ============================================================
-- BLOCK 5: payment_logs — Performance indexes
-- ============================================================

DROP PROCEDURE IF EXISTS `_add_payment_log_indexes`;
DELIMITER $$
CREATE PROCEDURE `_add_payment_log_indexes`()
BEGIN
  -- Index on created_at for time-range audit queries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'smart_hotel'
      AND TABLE_NAME   = 'payment_logs'
      AND INDEX_NAME   = 'idx_payment_logs_created'
  ) THEN
    ALTER TABLE `payment_logs`
      ADD INDEX `idx_payment_logs_created` (`created_at`);
  END IF;

  -- Index on event_type for webhook filter queries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'smart_hotel'
      AND TABLE_NAME   = 'payment_logs'
      AND INDEX_NAME   = 'idx_payment_logs_event'
  ) THEN
    ALTER TABLE `payment_logs`
      ADD INDEX `idx_payment_logs_event` (`event_type`);
  END IF;
END$$
DELIMITER ;
CALL `_add_payment_log_indexes`();
DROP PROCEDURE IF EXISTS `_add_payment_log_indexes`;

-- ============================================================
-- BLOCK 6: bookings — Performance index for payment reconciliation
-- ============================================================

DROP PROCEDURE IF EXISTS `_add_bookings_payment_index`;
DELIMITER $$
CREATE PROCEDURE `_add_bookings_payment_index`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'smart_hotel'
      AND TABLE_NAME   = 'bookings'
      AND INDEX_NAME   = 'idx_bookings_paid_remaining'
  ) THEN
    ALTER TABLE `bookings`
      ADD INDEX `idx_bookings_paid_remaining` (`paid_amount`, `remaining_amount`);
  END IF;
END$$
DELIMITER ;
CALL `_add_bookings_payment_index`();
DROP PROCEDURE IF EXISTS `_add_bookings_payment_index`;

-- ============================================================
-- BLOCK 7: Ensure payment_logs table exists (idempotent)
-- No effect if table already exists.
-- ============================================================
CREATE TABLE IF NOT EXISTS `payment_logs` (
  `log_id`       BIGINT        NOT NULL AUTO_INCREMENT,
  `payment_id`   INT           NOT NULL,
  `event_type`   ENUM('INITIATE','WEBHOOK_RECEIVED','WEBHOOK_VERIFIED','SUCCESS','FAILED','REFUND')
                 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status`       ENUM('PENDING','SUCCESS','FAILED')
                 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message`      TEXT          COLLATE utf8mb4_unicode_ci,
  `gateway_data` JSON          DEFAULT NULL,
  `created_at`   TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `payment_id` (`payment_id`),
  CONSTRAINT `payment_logs_ibfk_1`
    FOREIGN KEY (`payment_id`)
    REFERENCES `payment_transactions` (`payment_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOCK 8: Archive stale backup tables (optional, safe rename)
-- Comment out if you want to keep original names.
-- ============================================================
-- RENAME TABLE `bookings_backup`             TO `bookings_backup_20260417`;
-- RENAME TABLE `payment_transactions_backup` TO `payment_transactions_backup_20260417`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- POST-MIGRATION VALIDATION
-- Run these queries and verify all results match expectations.
-- ============================================================

-- V1: No orphaned payment_logs rows
SELECT 'V1' AS check_name,
       COUNT(*) AS orphaned_logs,
       IF(COUNT(*) = 0, 'PASS ✅', 'FAIL ❌') AS result
FROM payment_logs pl
LEFT JOIN payment_transactions pt ON pl.payment_id = pt.payment_id
WHERE pt.payment_id IS NULL;

-- V2: No orphaned payment_transactions rows
SELECT 'V2' AS check_name,
       COUNT(*) AS orphaned_txns,
       IF(COUNT(*) = 0, 'PASS ✅', 'FAIL ❌') AS result
FROM payment_transactions pt
LEFT JOIN bookings b ON pt.booking_id = b.booking_id
WHERE b.booking_id IS NULL AND pt.booking_id IS NOT NULL;

-- V3: No NULL payment_policy in bookings
SELECT 'V3' AS check_name,
       COUNT(*) AS null_policy_rows,
       IF(COUNT(*) = 0, 'PASS ✅', 'FAIL ❌') AS result
FROM bookings WHERE payment_policy IS NULL;

-- V4: No NULL paid_amount in bookings
SELECT 'V4' AS check_name,
       COUNT(*) AS null_paid_rows,
       IF(COUNT(*) = 0, 'PASS ✅', 'FAIL ❌') AS result
FROM bookings WHERE paid_amount IS NULL;

-- V5: FK type match — must both be INT
SELECT 'V5' AS check_name,
  c1.COLUMN_TYPE AS payment_logs_payment_id_type,
  c2.COLUMN_TYPE AS payment_transactions_payment_id_type,
  IF(c1.COLUMN_TYPE = c2.COLUMN_TYPE, 'PASS ✅', 'FAIL ❌') AS result
FROM information_schema.COLUMNS c1
JOIN information_schema.COLUMNS c2
  ON c2.TABLE_SCHEMA = 'smart_hotel'
  AND c2.TABLE_NAME  = 'payment_transactions'
  AND c2.COLUMN_NAME = 'payment_id'
WHERE c1.TABLE_SCHEMA = 'smart_hotel'
  AND c1.TABLE_NAME   = 'payment_logs'
  AND c1.COLUMN_NAME  = 'payment_id';

-- V6: Status distribution (no data integrity issues)
SELECT 'bookings_status'  AS tbl, status, COUNT(*) AS cnt FROM bookings          GROUP BY status
UNION ALL
SELECT 'payment_status'   AS tbl, status, COUNT(*) AS cnt FROM payment_transactions GROUP BY status;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
