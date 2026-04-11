import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const bookingRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// PRICE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tính phí check-in sớm dựa trên giờ check-in.
 * Trả về tỉ lệ phụ phí (0, 0.3, 0.5) nhân với giá 1 đêm.
 */
function calcEarlyFee(checkInTime: string | null | undefined, basePerNight: number): number {
  if (!checkInTime) return 0;
  const hour = parseInt(checkInTime.split(':')[0], 10);
  if (hour >= 5  && hour < 9)  return Math.round(basePerNight * 0.5); // 05:00–09:00 → +50%
  if (hour >= 9  && hour < 14) return Math.round(basePerNight * 0.3); // 09:00–14:00 → +30%
  return 0;
}

/**
 * Tính phí check-out muộn dựa trên giờ check-out.
 * Trả về tỉ lệ phụ phí nhân với giá 1 đêm.
 */
function calcLateFee(checkOutTime: string | null | undefined, basePerNight: number): number {
  if (!checkOutTime) return 0;
  const hour = parseInt(checkOutTime.split(':')[0], 10);
  if (hour >= 12 && hour < 15) return Math.round(basePerNight * 0.3); // 12:00–15:00 → +30%
  if (hour >= 15 && hour < 18) return Math.round(basePerNight * 0.5); // 15:00–18:00 → +50%
  if (hour >= 18)              return Math.round(basePerNight * 1.0); // 18:00+      → +100%
  return 0;
}

/** Tính số đêm giữa 2 ngày (tối thiểu 1) */
function calcNights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.floor(ms / 86400000));
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-RELEASE EXPIRED BOOKINGS (chạy mỗi 60 giây)
// ─────────────────────────────────────────────────────────────────────────────
async function releaseExpiredBookings() {
  const conn = await pool.getConnection();
  try {
    // Tìm booking PENDING đã hết hạn
    const [expired] = await conn.execute(`
      SELECT b.booking_id
      FROM bookings b
      WHERE b.status = 'PENDING'
        AND b.expires_at IS NOT NULL
        AND b.expires_at < NOW()
    `) as any[];

    for (const row of expired as any[]) {
      await conn.beginTransaction();
      try {
        // Khôi phục room_inventory
        await conn.execute(`
          UPDATE room_inventory ri
          JOIN booking_rooms br ON ri.room_id = br.room_id
            AND ri.date >= br.check_in AND ri.date < br.check_out
          SET ri.is_available = 1
          WHERE br.booking_id = ?
        `, [row.booking_id]);

        // Huỷ booking
        await conn.execute(
          `UPDATE bookings SET status = 'CANCELLED' WHERE booking_id = ?`,
          [row.booking_id]
        );

        await conn.commit();
      } catch {
        await conn.rollback();
      }
    }
  } catch (e) {
    console.error('[AutoRelease] Error:', e);
  } finally {
    conn.release();
  }
}

// Khởi động job tự động giải phóng phòng
setInterval(releaseExpiredBookings, 60_000);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    let sql: string;
    let params: any[] = [];

    if (req.userRole === 'ADMIN') {
      const { start_date, end_date } = req.query;
      let where = '';
      if (start_date && end_date) {
        where = 'WHERE b.created_at BETWEEN ? AND ?';
        params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
      }
      sql = `
        SELECT b.booking_id, b.status, b.total_price, b.created_at, b.expires_at,
               u.full_name, u.email, u.phone,
               br.check_in, br.check_out, br.check_in_time, br.check_out_time,
               br.price AS room_price,
               rt.name AS room_type, r.room_number,
               MIN(ri.url) AS room_image
        FROM bookings b
        LEFT JOIN users u          ON b.user_id = u.user_id
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r          ON br.room_id = r.room_id
        LEFT JOIN room_types rt    ON r.type_id = rt.type_id
        LEFT JOIN room_images ri   ON ri.room_id = r.room_id
        ${where}
        GROUP BY b.booking_id, u.full_name, u.email, u.phone,
                 br.check_in, br.check_out, br.check_in_time, br.check_out_time,
                 br.price, rt.name, r.room_number
        ORDER BY b.created_at DESC
      `;
    } else {
      sql = `
        SELECT b.booking_id, b.status, b.total_price, b.created_at, b.expires_at,
               br.check_in, br.check_out, br.check_in_time, br.check_out_time,
               br.price AS room_price,
               rt.name AS room_type, r.room_number,
               MIN(ri.url) AS room_image
        FROM bookings b
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r          ON br.room_id = r.room_id
        LEFT JOIN room_types rt    ON r.type_id = rt.type_id
        LEFT JOIN room_images ri   ON ri.room_id = r.room_id
        WHERE b.user_id = ?
        GROUP BY b.booking_id, br.check_in, br.check_out, br.check_in_time, br.check_out_time,
                 br.price, rt.name, r.room_number
        ORDER BY b.created_at DESC
      `;
      params = [req.userId!];
    }

    const [rows] = await conn.execute(sql, params) as any[];
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings/:id
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [bookings] = await conn.execute(`
      SELECT b.booking_id, b.status, b.total_price, b.created_at, b.expires_at,
             u.full_name, u.email, u.phone
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = ?
    `, [req.params.id]) as any[];

    if (!bookings[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy đặt phòng', code: 'NOT_FOUND' });

    if (req.userRole !== 'ADMIN') {
      const [own] = await conn.execute(
        'SELECT user_id FROM bookings WHERE booking_id = ?', [req.params.id]
      ) as any[];
      if ((own as any[])[0]?.user_id !== req.userId)
        return res.status(403).json({ success: false, message: 'Forbidden', code: 'FORBIDDEN' });
    }

    const [rooms] = await conn.execute(`
      SELECT br.booking_room_id, br.room_id, br.check_in, br.check_out,
             br.check_in_time, br.check_out_time, br.price,
             rt.name AS room_type, r.room_number,
             MIN(ri.url) AS image
      FROM booking_rooms br
      LEFT JOIN rooms r        ON br.room_id = r.room_id
      LEFT JOIN room_types rt  ON r.type_id = rt.type_id
      LEFT JOIN room_images ri ON ri.room_id = r.room_id
      WHERE br.booking_id = ?
      GROUP BY br.booking_room_id, br.room_id, br.check_in, br.check_out,
               br.check_in_time, br.check_out_time, br.price, rt.name, r.room_number
    `, [req.params.id]) as any[];

    const [guests]   = await conn.execute('SELECT * FROM booking_guests WHERE booking_id = ?', [req.params.id]) as any[];
    const [payments] = await conn.execute('SELECT * FROM payment_transactions WHERE booking_id = ?', [req.params.id]) as any[];

    const firstRoom = (rooms as any[])[0];
    res.json({
      ...bookings[0],
      check_in:       firstRoom?.check_in       ?? null,
      check_out:      firstRoom?.check_out      ?? null,
      check_in_time:  firstRoom?.check_in_time  ?? null,
      check_out_time: firstRoom?.check_out_time ?? null,
      room_price:     firstRoom?.price          ?? null,
      room_type:      firstRoom?.room_type      ?? null,
      room_number:    firstRoom?.room_number    ?? null,
      rooms,
      guests,
      payments,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings — tạo booking mới (transaction-safe, dùng room_inventory)
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { room_id, check_in, check_out, check_in_time, check_out_time, guests, payment_method } = req.body;

  if (!room_id || !check_in || !check_out)
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đặt phòng', code: 'MISSING_FIELDS' });

  if (new Date(check_in) >= new Date(check_out))
    return res.status(400).json({ success: false, message: 'Ngày nhận phòng phải trước ngày trả phòng', code: 'INVALID_DATES' });

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    // 1. Kiểm tra phòng tồn tại và đang hoạt động
    const [roomRows] = await conn.execute(`
      SELECT r.room_id, rt.base_price
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      WHERE r.room_id = ? AND r.status = 'ACTIVE'
    `, [room_id]) as any[];

    if (!(roomRows as any[]).length)
      return res.status(404).json({ success: false, message: 'Phòng không tồn tại hoặc không hoạt động', code: 'ROOM_NOT_FOUND' });

    const nights = calcNights(check_in, check_out);

    // 2. Lock rows trong room_inventory (nếu có) để tránh double booking
    const [invRows] = await conn.execute(`
      SELECT inventory_id, date, is_available, price
      FROM room_inventory
      WHERE room_id = ? AND date >= ? AND date < ?
      FOR UPDATE
    `, [room_id, check_in, check_out]) as any[];

    const inv = invRows as any[];
    const hasInventory = inv.length > 0;

    // 3. Kiểm tra availability
    if (hasInventory) {
      // Có inventory → dùng inventory làm nguồn sự thật
      const availableDays = inv.filter((r: any) => r.is_available === 1);
      if (availableDays.length < nights) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          message: 'Phòng không còn trống trong khoảng thời gian này',
          code: 'ROOM_NOT_AVAILABLE',
        });
      }
    } else {
      // Không có inventory → fallback: kiểm tra conflict qua booking_rooms
      const [conflict] = await conn.execute(`
        SELECT 1 FROM booking_rooms br
        JOIN bookings b ON b.booking_id = br.booking_id
        WHERE br.room_id = ?
          AND b.status NOT IN ('CANCELLED')
          AND br.check_in < ? AND br.check_out > ?
        LIMIT 1
      `, [room_id, check_out, check_in]) as any[];

      if ((conflict as any[]).length > 0) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          message: 'Phòng đã được đặt trong khoảng thời gian này',
          code: 'ROOM_NOT_AVAILABLE',
        });
      }
    }

    // 4. Tính giá: ưu tiên từ room_inventory, fallback về base_price
    const basePerNight = hasInventory
      ? Math.round(inv.reduce((s: number, r: any) => s + Number(r.price || roomRows[0].base_price), 0) / inv.length)
      : roomRows[0].base_price;

    const basePrice = basePerNight * nights;
    const earlyFee  = calcEarlyFee(check_in_time, basePerNight);
    const lateFee   = calcLateFee(check_out_time, basePerNight);
    const totalPrice = Math.round((basePrice + earlyFee + lateFee) * 1.15); // +15% VAT+service

    // 5. Insert booking với expires_at = NOW + 10 phút
    const [bookingResult] = await conn.execute(`
      INSERT INTO bookings (user_id, total_price, status, expires_at)
      VALUES (?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 10 MINUTE))
    `, [req.userId!, totalPrice]) as any[];
    const bookingId = (bookingResult as any).insertId;

    // 6. Insert booking_rooms
    await conn.execute(
      `INSERT INTO booking_rooms (booking_id, room_id, check_in, check_out, check_in_time, check_out_time, price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, room_id, check_in, check_out, check_in_time ?? null, check_out_time ?? null, basePrice]
    );

    // 7. Đánh dấu room_inventory là không còn trống (chỉ khi có inventory)
    if (hasInventory) {
      await conn.execute(`
        UPDATE room_inventory
        SET is_available = 0
        WHERE room_id = ? AND date >= ? AND date < ?
      `, [room_id, check_in, check_out]);
    }

    // 8. Insert guests
    if (Array.isArray(guests)) {
      for (const g of guests) {
        await conn.execute(
          'INSERT INTO booking_guests (booking_id, full_name, phone) VALUES (?, ?, ?)',
          [bookingId, g.full_name, g.phone ?? null]
        );
      }
    }

    // 9. Insert payment transaction (PENDING)
    await conn.execute(
      `INSERT INTO payment_transactions (booking_id, amount, method, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [bookingId, totalPrice, payment_method ?? 'CASH']
    );

    // 10. Activity log
    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [req.userId!, `CREATE_BOOKING:${bookingId}`]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      booking_id: bookingId,
      total_price: totalPrice,
      base_price: basePrice,
      early_fee: earlyFee,
      late_fee: lateFee,
      nights,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/pay — thanh toán booking
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.patch('/:id/pay', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    // Kiểm tra booking tồn tại và thuộc về user (hoặc admin)
    const [rows] = await conn.execute(
      'SELECT booking_id, status, user_id, expires_at FROM bookings WHERE booking_id = ?',
      [req.params.id]
    ) as any[];

    const booking = (rows as any[])[0];
    if (!booking)
      return res.status(404).json({ success: false, message: 'Không tìm thấy đặt phòng', code: 'NOT_FOUND' });

    if (req.userRole !== 'ADMIN' && booking.user_id !== req.userId)
      return res.status(403).json({ success: false, message: 'Forbidden', code: 'FORBIDDEN' });

    if (booking.status !== 'PENDING')
      return res.status(400).json({ success: false, message: 'Chỉ có thể thanh toán đặt phòng đang chờ xử lý', code: 'INVALID_STATUS' });

    // Kiểm tra hết hạn
    if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(410).json({ success: false, message: 'Đặt phòng đã hết hạn thanh toán', code: 'BOOKING_EXPIRED' });
    }

    // Cập nhật payment → SUCCESS
    await conn.execute(
      `UPDATE payment_transactions SET status = 'SUCCESS' WHERE booking_id = ? AND status = 'PENDING'`,
      [req.params.id]
    );

    // Cập nhật booking → CONFIRMED, xóa expires_at
    await conn.execute(
      `UPDATE bookings SET status = 'CONFIRMED', expires_at = NULL WHERE booking_id = ?`,
      [req.params.id]
    );

    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [req.userId!, `PAY_BOOKING:${req.params.id}`]
    );

    await conn.commit();
    res.json({ success: true, booking_id: Number(req.params.id), status: 'CONFIRMED' });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: e.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/status (Admin)
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.patch('/:id/status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const valid = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!valid.includes(status))
    return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ', code: 'INVALID_STATUS' });

  const conn = await pool.getConnection();
  try {
    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', [status, req.params.id]);
    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [req.userId!, `UPDATE_BOOKING:${req.params.id}:${status}`]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/bookings/:id — user hủy booking
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [rows] = await conn.execute(
      'SELECT * FROM bookings WHERE booking_id = ? AND user_id = ?',
      [req.params.id, req.userId!]
    ) as any[];

    if (!(rows as any[])[0])
      return res.status(404).json({ success: false, message: 'Không tìm thấy đặt phòng', code: 'NOT_FOUND' });

    if ((rows as any[])[0].status === 'COMPLETED')
      return res.status(400).json({ success: false, message: 'Không thể hủy đặt phòng đã hoàn thành', code: 'INVALID_STATUS' });

    // Khôi phục room_inventory nếu booking đang PENDING hoặc CONFIRMED
    if (['PENDING', 'CONFIRMED'].includes((rows as any[])[0].status)) {
      await conn.execute(`
        UPDATE room_inventory ri
        JOIN booking_rooms br ON ri.room_id = br.room_id
          AND ri.date >= br.check_in AND ri.date < br.check_out
        SET ri.is_available = 1
        WHERE br.booking_id = ?
          AND EXISTS (SELECT 1 FROM room_inventory WHERE room_id = ri.room_id LIMIT 1)
      `, [req.params.id]);
    }

    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', ['CANCELLED', req.params.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: e.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/bookings/:id/hard (Admin xóa cứng)
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.delete('/:id/hard', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM bookings WHERE booking_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2')
      return res.status(409).json({ success: false, message: 'Không thể xóa: booking có dữ liệu liên quan', code: 'HAS_REFERENCES' });
    res.status(500).json({ success: false, message: e.message ?? 'Lỗi server', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});
