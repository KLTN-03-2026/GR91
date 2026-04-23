-- 1. Cập nhật bảng bookings: thêm paid_amount và remaining_amount
ALTER TABLE bookings 
ADD COLUMN paid_amount INT DEFAULT 0 AFTER total_price,
ADD COLUMN remaining_amount INT DEFAULT 0 AFTER paid_amount;

-- Update remaining_amount cho các booking hiện có
UPDATE bookings SET remaining_amount = total_price - paid_amount;

-- 2. Cập nhật bảng payment_transactions: thêm gateway, order_id, trans_id
ALTER TABLE payment_transactions
ADD COLUMN gateway VARCHAR(50) DEFAULT 'CASH' AFTER method,
ADD COLUMN order_id VARCHAR(100) NULL AFTER gateway,
ADD COLUMN trans_id VARCHAR(100) NULL AFTER order_id;

-- 3. Tạo bảng payment_logs để theo dõi audit log
CREATE TABLE IF NOT EXISTS payment_logs (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    booking_id  INT,
    gateway     VARCHAR(50),
    action      VARCHAR(100),
    raw_data    JSON,
    status      VARCHAR(50), -- SUCCESS, FAILED, ERROR
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
);
