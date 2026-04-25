-- Migration: Thêm CHECKED_IN vào ENUM status của bảng bookings
-- Chạy: mysql -u root -p smart_hotel < BE/migrations/add_checked_in_status.sql

ALTER TABLE `bookings`
  MODIFY COLUMN `status` ENUM(
    'PENDING',
    'CONFIRMED',
    'CHECKED_IN',
    'COMPLETED',
    'CANCELLED',
    'PARTIALLY_PAID'
  ) COLLATE utf8mb4_unicode_ci NOT NULL;
