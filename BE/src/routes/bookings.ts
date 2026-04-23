import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { createPaymentUrl, verifyReturnUrl, verifyIpnCall, normalizeIp } from '../services/vnpay.js';
import type { PoolConnection } from 'mysql2/promise';


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

function normalizePaymentPercent(value: unknown): 30 | 50 | 100 {
  const num = Number(value);
  if (num === 30 || num === 50 || num === 100) return num;
  return 100;
}

async function updateInventoryStatusForBooking(
  conn: PoolConnection,
  bookingId: number,
  status: 'AVAILABLE' | 'PENDING' | 'BOOKED',
) {
  // Lấy thông tin phòng và ngày từ booking_rooms
  const [rooms] = await conn.execute(
    'SELECT room_id, check_in, check_out FROM booking_rooms WHERE booking_id = ?',
    [bookingId]
  ) as any[];

  if (!rooms.length) return;

  for (const r of rooms) {
    const days: string[] = [];
    const cur = new Date(r.check_in);
    const end = new Date(r.check_out);
    while (cur < end) {
      days.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    if (!days.length) continue;

    // Batch upsert vào room_inventory
    const placeholders = days.map(() => '(?,?,?,?)').join(',');
    const vals: any[] = [];
    days.forEach((d) => vals.push(r.room_id, d, status, status === 'AVAILABLE' ? null : bookingId));

    await conn.execute(
      `INSERT INTO room_inventory (room_id, date, status, booking_id)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE 
         status = VALUES(status), 
         booking_id = VALUES(booking_id)`,
      vals
    );
  }
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
          SET ri.status = 'AVAILABLE', ri.booking_id = NULL
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

function getQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function toQueryRecord(query: Record<string, unknown>): Record<string, string> {
  const entries = Object.entries(query)
    .map(([key, value]) => [key, getQueryValue(value)] as const)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');

  return Object.fromEntries(entries);
}

async function syncVNPayTransaction(
  conn: PoolConnection,
  params: {
    bookingId: number;
    amount: number;
    transactionNo?: string | null;
    transactionStatus: 'SUCCESS' | 'FAILED';
    action: 'RETURN' | 'IPN_CALLBACK';
    rawData: Record<string, string>;
  },
) {
  const [rows] = await conn.execute(
    'SELECT booking_id, total_price, status, paid_amount, remaining_amount, payment_policy FROM bookings WHERE booking_id = ? FOR UPDATE',
    [params.bookingId],
  ) as any[];

  const booking = rows[0];
  if (!booking) {
    return { ok: false as const, code: 'NOT_FOUND' };
  }

  if (Number(booking.total_price) !== Number(params.amount)) {
    return { ok: false as const, code: 'INVALID_AMOUNT', booking };
  }

  const [upsertResult] = await conn.execute(
    `INSERT INTO payment_transactions (booking_id, amount, method, gateway, order_id, trans_id, status)
     VALUES (?, ?, 'VNPAY', 'vnpay', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       amount = VALUES(amount),
       method = VALUES(method),
       gateway = VALUES(gateway),
       trans_id = VALUES(trans_id),
       status = VALUES(status)`,
    [params.bookingId, params.amount, String(params.bookingId), params.transactionNo ?? null, params.transactionStatus],
  ) as any[];

  const insertedPaymentId = Number(upsertResult?.insertId ?? 0);
  let paymentId = insertedPaymentId;

  if (!paymentId) {
    const [paymentRows] = await conn.execute(
      `SELECT payment_id
       FROM payment_transactions
       WHERE order_id = ?
       ORDER BY payment_id DESC
       LIMIT 1`,
      [String(params.bookingId)],
    ) as any[];
    paymentId = Number(paymentRows[0]?.payment_id ?? 0);
  }

  if (!paymentId) {
    throw new Error('Không tìm thấy payment transaction để ghi log');
  }

  if (params.transactionStatus === 'SUCCESS') {
    const totalPrice = Number(booking.total_price ?? 0);
    const currentPaid = Number(booking.paid_amount ?? 0);
    const nextPaid = Math.min(totalPrice, currentPaid + Number(params.amount));
    const nextRemaining = Math.max(0, totalPrice - nextPaid);
    const nextStatus = nextRemaining === 0 ? 'CONFIRMED' : 'PARTIALLY_PAID';

    await conn.execute(
      `UPDATE bookings
       SET status = ?,
           paid_amount = ?,
           remaining_amount = ?,
           expires_at = NULL
       WHERE booking_id = ?`,
      [nextStatus, nextPaid, nextRemaining, params.bookingId],
    );

    await updateInventoryStatusForBooking(conn, params.bookingId, 'BOOKED');
  }

  if (params.transactionStatus === 'FAILED' && booking.status === 'PENDING') {
    await conn.execute(
      `UPDATE bookings
       SET paid_amount = 0,
           remaining_amount = total_price
       WHERE booking_id = ?`,
      [params.bookingId],
    );
  }

  const eventType =
    params.transactionStatus === 'SUCCESS'
      ? 'SUCCESS'
      : params.action === 'IPN_CALLBACK'
        ? 'WEBHOOK_VERIFIED'
        : 'FAILED';

  await conn.execute(
    `INSERT INTO payment_logs (payment_id, event_type, status, message, gateway_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      paymentId,
      eventType,
      params.transactionStatus,
      params.action === 'IPN_CALLBACK' ? 'VNPay IPN callback processed' : 'VNPay return processed',
      JSON.stringify(params.rawData),
    ],
  );

  const [updatedRows] = await conn.execute(
    'SELECT booking_id, status, total_price, paid_amount, remaining_amount FROM bookings WHERE booking_id = ?',
    [params.bookingId],
  ) as any[];

  return { ok: true as const, booking: updatedRows[0] };
}

// ─────────────────────────────────────────────────────────────────────────────
// VNPay INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/bookings/vnpay-return
 * Return URL — browser redirect về sau khi thanh toán.
 * Có verify chữ ký để tránh hiển thị sai trạng thái trên UI.
 * Nếu IPN chưa kịp về thì route này vẫn đồng bộ DB theo cách idempotent.
 */
bookingRouter.get('/vnpay-return', async (req: any, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const query = toQueryRecord(req.query);
    const bookingIdRaw = query.vnp_TxnRef;

    if (!bookingIdRaw) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin giao dịch', code: 'MISSING_PARAMS' });
    }

    const bookingId = Number(bookingIdRaw);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã đặt phòng không hợp lệ', code: 'INVALID_BOOKING_ID' });
    }

    const verify = verifyReturnUrl(query);

    if (!verify.isVerified) {
      return res.status(400).json({
        success: false,
        verified: false,
        booking_id: bookingId,
        response_code: query.vnp_ResponseCode ?? null,
        status: 'FAILED',
        message: verify.message || 'Chữ ký giao dịch không hợp lệ',
      });
    }

    const amount = Number(query.vnp_Amount ?? 0) / 100;
    const txStatus = verify.isSuccess ? 'SUCCESS' : 'FAILED';

    await conn.beginTransaction();
    const result = await syncVNPayTransaction(conn, {
      bookingId,
      amount,
      transactionNo: query.vnp_TransactionNo ?? null,
      transactionStatus: txStatus,
      action: 'RETURN',
      rawData: query,
    });

    if (!result.ok) {
      await conn.rollback();
      if (result.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, verified: true, booking_id: bookingId, status: 'FAILED', message: 'Không tìm thấy đặt phòng' });
      }
      return res.status(400).json({ success: false, verified: true, booking_id: bookingId, status: 'FAILED', message: 'Số tiền giao dịch không khớp' });
    }

    await conn.commit();
    const finalStatus = result.booking.status;

    res.json({
      success:      verify.isSuccess && ['CONFIRMED', 'PARTIALLY_PAID'].includes(finalStatus),
      verified:     true,
      booking_id:   bookingId,
      response_code: query.vnp_ResponseCode ?? null,
      status:       finalStatus,
      message:      verify.message,
    });
  } catch (err: any) {
    try { await conn.rollback(); } catch {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/bookings/vnpay-ipn
 * Webhook server-to-server từ VNPay — nơi DUY NHẤT update DB.
 */
bookingRouter.get('/vnpay-ipn', async (req: any, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const query = toQueryRecord(req.query);
    const verify = verifyIpnCall(query);
    const bookingIdRaw = query.vnp_TxnRef;
    const amount = Number(query.vnp_Amount ?? 0) / 100;

    if (!verify.isVerified) {
      return res.json({ RspCode: '97', Message: 'Invalid Checksum' });
    }

    const bookingId = Number(bookingIdRaw);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }

    await conn.beginTransaction();
    const result = await syncVNPayTransaction(conn, {
      bookingId,
      amount,
      transactionNo: query.vnp_TransactionNo ?? null,
      transactionStatus: verify.isSuccess ? 'SUCCESS' : 'FAILED',
      action: 'IPN_CALLBACK',
      rawData: query,
    });

    if (!result.ok) {
      await conn.rollback();
      if (result.code === 'NOT_FOUND') {
        return res.json({ RspCode: '01', Message: 'Order not found' });
      }
      return res.json({ RspCode: '04', Message: 'Invalid amount' });
    }

    await conn.commit();
    res.json({ RspCode: '00', Message: 'Success' });

  } catch (err: any) {
    await conn.rollback();
    console.error('[VNPay IPN Error]', err);
    res.json({ RspCode: '99', Message: 'Unknown error' });
  } finally {
    conn.release();
  }
});

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
        SELECT b.booking_id, b.status, b.total_price, b.payment_policy, b.paid_amount, b.remaining_amount, b.created_at, b.expires_at,
               u.full_name, u.email, u.phone,
               br.check_in, br.check_out, br.check_in_time, br.check_out_time,
               br.price AS room_price,
               rt.type_id, rt.name AS room_type, r.room_id, r.room_number,
               MIN(ri.url) AS room_image,
               (SELECT pt.method FROM payment_transactions pt WHERE pt.booking_id = b.booking_id ORDER BY pt.payment_id DESC LIMIT 1) AS payment_method,
               (SELECT pt.status FROM payment_transactions pt WHERE pt.booking_id = b.booking_id ORDER BY pt.payment_id DESC LIMIT 1) AS payment_status
        FROM bookings b
        LEFT JOIN users u          ON b.user_id = u.user_id
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r          ON br.room_id = r.room_id
        LEFT JOIN room_types rt    ON r.type_id = rt.type_id
        LEFT JOIN room_images ri   ON ri.room_id = r.room_id
        ${where}
        GROUP BY b.booking_id, b.payment_policy, b.paid_amount, b.remaining_amount, u.full_name, u.email, u.phone,
                 br.check_in, br.check_out, br.check_in_time, br.check_out_time,
                 br.price, rt.type_id, rt.name, r.room_id, r.room_number
        ORDER BY b.created_at DESC
      `;
    } else {
      sql = `
        SELECT b.booking_id, b.status, b.total_price, b.payment_policy, b.paid_amount, b.remaining_amount, b.created_at, b.expires_at,
               br.check_in, br.check_out, br.check_in_time, br.check_out_time,
               br.price AS room_price,
               rt.type_id, rt.name AS room_type, r.room_id, r.room_number,
               MIN(ri.url) AS room_image,
               (SELECT pt.method FROM payment_transactions pt WHERE pt.booking_id = b.booking_id ORDER BY pt.payment_id DESC LIMIT 1) AS payment_method,
               (SELECT pt.status FROM payment_transactions pt WHERE pt.booking_id = b.booking_id ORDER BY pt.payment_id DESC LIMIT 1) AS payment_status
        FROM bookings b
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r          ON br.room_id = r.room_id
        LEFT JOIN room_types rt    ON r.type_id = rt.type_id
        LEFT JOIN room_images ri   ON ri.room_id = r.room_id
        WHERE b.user_id = ?
        GROUP BY b.booking_id, b.payment_policy, b.paid_amount, b.remaining_amount, br.check_in, br.check_out, br.check_in_time, br.check_out_time,
                 br.price, rt.type_id, rt.name, r.room_id, r.room_number
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
      SELECT b.booking_id, b.status, b.total_price, b.payment_policy, b.paid_amount, b.remaining_amount, b.created_at, b.expires_at,
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
  const { room_id, check_in, check_out, check_in_time, check_out_time, guests, payment_percent } = req.body;

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
      SELECT inventory_id, date, status, price
      FROM room_inventory
      WHERE room_id = ? AND date >= ? AND date < ?
      FOR UPDATE
    `, [room_id, check_in, check_out]) as any[];

    const inv = invRows as any[];
    const hasInventory = inv.length > 0;

    // 3. Kiểm tra availability dựa trên inventory đã lock
    if (hasInventory) {
      const conflictedDays = inv.filter((r: any) => ['BOOKED', 'PENDING', 'BLOCKED'].includes(String(r.status)));
      if (conflictedDays.length > 0 || inv.length < nights) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          message: 'Selected dates are not available',
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
          message: 'Selected dates are not available',
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
    const paymentPercent = normalizePaymentPercent(payment_percent);
    const upfrontAmount = Math.round(totalPrice * paymentPercent / 100);
    const paymentPolicy = paymentPercent === 100 ? 'FULL' : 'DEPOSIT';
    const paymentType = paymentPercent === 100 ? 'FULL' : 'DEPOSIT';

    // 5. Insert booking với expires_at = NOW + 10 phút
    const [bookingResult] = await conn.execute(`
      INSERT INTO bookings (user_id, total_price, paid_amount, remaining_amount, status, expires_at, payment_policy)
      VALUES (?, ?, 0, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)
    `, [req.userId!, totalPrice, totalPrice, paymentPolicy]) as any[];
    const bookingId = (bookingResult as any).insertId;

    // 6. Insert booking_rooms
    await conn.execute(
      `INSERT INTO booking_rooms (booking_id, room_id, check_in, check_out, check_in_time, check_out_time, price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, room_id, check_in, check_out, check_in_time ?? null, check_out_time ?? null, basePrice]
    );

    // 7. Đánh dấu room_inventory: PENDING để block các booking khác trong thời gian giữ chỗ
    if (hasInventory) {
      await conn.execute(`
        UPDATE room_inventory
        SET status = 'PENDING', booking_id = ?
        WHERE room_id = ? AND date >= ? AND date < ?
      `, [bookingId, room_id, check_in, check_out]);
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
      `INSERT INTO payment_transactions (booking_id, amount, method, gateway, type, order_id, status)
       VALUES (?, ?, 'UNPAID', 'cash', ?, ?, 'PENDING')`,
      [bookingId, upfrontAmount, paymentType, String(bookingId)]
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
      amount_due_now: upfrontAmount,
      payment_percent: paymentPercent,
      payment_policy: paymentPolicy,
      paid_amount: 0,
      remaining_amount: totalPrice,
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
      `UPDATE payment_transactions
       SET method = 'CASH', gateway = 'cash', status = 'SUCCESS'
       WHERE booking_id = ? AND status = 'PENDING'`,
      [req.params.id]
    );

    // Cập nhật booking → CONFIRMED, xóa expires_at
    await conn.execute(
      `UPDATE bookings
       SET status = 'CONFIRMED',
           paid_amount = total_price,
           remaining_amount = 0,
           expires_at = NULL
       WHERE booking_id = ?`,
      [req.params.id]
    );

    await updateInventoryStatusForBooking(conn, Number(req.params.id), 'BOOKED');

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


/**
 * GET /api/bookings/:id/status
 * Endpoint nhẹ để FE polling trạng thái
 */
bookingRouter.get('/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT booking_id, status, user_id FROM bookings WHERE booking_id = ?',
      [req.params.id]
    ) as any[];

    const booking = rows[0];
    if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (req.userRole !== 'ADMIN' && booking.user_id !== req.userId)
      return res.status(403).json({ success: false, message: 'Forbidden' });

    res.json({
      success: true,
      booking_id: booking.booking_id,
      status: booking.status, // PENDING, PARTIALLY_PAID, CONFIRMED, CANCELLED, COMPLETED
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/bookings/:id/vnpay
 * Tạo URL thanh toán VNPay và trả về cho FE redirect.
 */
bookingRouter.post('/:id/vnpay', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT booking_id, total_price, paid_amount, remaining_amount, status, payment_policy, expires_at FROM bookings WHERE booking_id = ? AND user_id = ?',
      [req.params.id, req.userId ?? 0]
    ) as any[];

    const booking = rows[0];
    if (!booking)
      return res.status(404).json({ success: false, message: 'Không tìm thấy đặt phòng' });
    if (!['PENDING', 'PARTIALLY_PAID'].includes(booking.status))
      return res.status(400).json({ success: false, message: 'Booking không ở trạng thái có thể thanh toán' });
    if (booking.status === 'PENDING' && booking.expires_at && new Date(booking.expires_at) < new Date())
      return res.status(410).json({ success: false, message: 'Đặt phòng đã hết hạn thanh toán' });

    let finalAmount = booking.status === 'PARTIALLY_PAID'
      ? Number(booking.remaining_amount ?? 0)
      : 0;
    let paymentType = booking.status === 'PARTIALLY_PAID' ? 'REMAINING' : (booking.payment_policy === 'DEPOSIT' ? 'DEPOSIT' : 'FULL');

    if (booking.status !== 'PARTIALLY_PAID') {
      const [pendingRows] = await conn.execute(
        `SELECT amount, type
         FROM payment_transactions
         WHERE booking_id = ? AND status = 'PENDING'
         ORDER BY payment_id DESC
         LIMIT 1`,
        [booking.booking_id],
      ) as any[];

      if (pendingRows[0]) {
        finalAmount = Number(pendingRows[0].amount ?? 0);
        paymentType = pendingRows[0].type ?? paymentType;
      }
    }

    if (!finalAmount || finalAmount <= 0) {
      finalAmount = booking.status === 'PARTIALLY_PAID' ? Number(booking.remaining_amount ?? 0) : Number(booking.total_price);
    }

    const rawIp  = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ipAddr = normalizeIp(Array.isArray(rawIp) ? rawIp[0] : String(rawIp));

    await conn.execute(
      `UPDATE payment_transactions
       SET method = 'VNPAY',
           gateway = 'vnpay',
           order_id = ?,
           trans_id = NULL,
           amount = ?,
           type = ?,
           status = 'PENDING'
       WHERE booking_id = ? AND (status = 'PENDING' OR gateway = 'vnpay')`,
      [String(booking.booking_id), finalAmount, paymentType, booking.booking_id],
    );

    const paymentUrl = createPaymentUrl({
      bookingId: booking.booking_id,
      amount:    finalAmount,
      ipAddr,
      expireAt: booking.status === 'PENDING' && booking.expires_at ? new Date(booking.expires_at) : null,
    });

    res.json({ success: true, paymentUrl });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});




// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/status (Admin)
// ─────────────────────────────────────────────────────────────────────────────
bookingRouter.patch('/:id/status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const valid = ['PENDING', 'PARTIALLY_PAID', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!valid.includes(status))
    return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ', code: 'INVALID_STATUS' });

  const conn = await pool.getConnection();
  try {
    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', [status, req.params.id]);
    if (status === 'CANCELLED') {
      await updateInventoryStatusForBooking(conn, Number(req.params.id), 'AVAILABLE');
    } else if (status === 'PENDING') {
      await updateInventoryStatusForBooking(conn, Number(req.params.id), 'PENDING');
    } else {
      await updateInventoryStatusForBooking(conn, Number(req.params.id), 'BOOKED');
    }
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

    // Khôi phục room_inventory nếu booking đang giữ phòng
    if (['PENDING', 'PARTIALLY_PAID', 'CONFIRMED'].includes((rows as any[])[0].status)) {
      await updateInventoryStatusForBooking(conn, Number(req.params.id), 'AVAILABLE');
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN & CHECK-IN/OUT EXTENSIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/bookings/daily-plan (Admin)
 * Lấy danh sách khách Check-in và Check-out trong ngày hôm nay.
 */
bookingRouter.get('/daily-plan', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await conn.execute(`
      SELECT b.booking_id, b.status, u.full_name, u.phone,
             br.check_in, br.check_out, br.check_in_time, br.check_out_time,
             r.room_number, r.room_id, rt.name as room_type,
             r.status as room_status
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN booking_rooms br ON b.booking_id = br.booking_id
      JOIN rooms r ON br.room_id = r.room_id
      JOIN room_types rt ON r.type_id = rt.type_id
      WHERE (br.check_in = ? AND b.status = 'CONFIRMED')
         OR (br.check_out = ? AND b.status = 'CONFIRMED')
      ORDER BY br.check_out ASC
    `, [today, today]) as any[];

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

/**
 * PATCH /api/bookings/:id/check-in
 * Khách tự check-in hoặc Admin thực hiện.
 */
bookingRouter.patch('/:id/check-in', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [rows] = await conn.execute(`
      SELECT b.booking_id, b.user_id, b.status, br.room_id, br.check_in
      FROM bookings b
      JOIN booking_rooms br ON b.booking_id = br.booking_id
      WHERE b.booking_id = ?
    `, [req.params.id]) as any[];

    const booking = rows[0];
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đặt phòng' });

    if (req.userRole !== 'ADMIN' && booking.user_id !== req.userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ để check-in' });
    }

    const today = new Date().toISOString().split('T')[0];
    const checkInDate = new Date(booking.check_in).toISOString().split('T')[0];
    
    if (req.userRole !== 'ADMIN' && today !== checkInDate) {
      return res.status(400).json({ success: false, message: 'Chưa đến ngày nhận phòng' });
    }

    await conn.execute('UPDATE rooms SET status = ? WHERE room_id = ?', ['MAINTENANCE', booking.room_id]);

    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [req.userId!, `CHECK_IN:${req.params.id}`]
    );

    await conn.commit();
    res.json({ success: true, message: 'Nhận phòng thành công' });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

/**
 * PATCH /api/bookings/:id/check-out (Admin)
 */
bookingRouter.patch('/:id/check-out', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [rows] = await conn.execute(`
      SELECT b.booking_id, b.total_price, br.room_id, rt.base_price, br.check_out
      FROM bookings b
      JOIN booking_rooms br ON b.booking_id = br.booking_id
      JOIN rooms r ON br.room_id = r.room_id
      JOIN room_types rt ON r.type_id = rt.type_id
      WHERE b.booking_id = ?
    `, [req.params.id]) as any[];

    const booking = rows[0];
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    const now = new Date();
    const currentHour = now.getHours();
    let extraFee = 0;
    let description = 'Check-out đúng hạn';

    if (currentHour >= 12 && currentHour < 15) {
      extraFee = Math.round(booking.base_price * 0.3);
      description = 'Trả muộn (12:00-15:00) +30%';
    } else if (currentHour >= 15 && currentHour < 18) {
      extraFee = Math.round(booking.base_price * 0.5);
      description = 'Trả muộn (15:00-18:00) +50%';
    } else if (currentHour >= 18) {
      extraFee = Math.round(booking.base_price * 1.0);
      description = 'Trả muộn sau 18:00 +100%';
    }

    await conn.execute(
      'UPDATE bookings SET status = ?, total_price = total_price + ? WHERE booking_id = ?',
      ['COMPLETED', extraFee, req.params.id]
    );

    await conn.execute('UPDATE rooms SET status = ? WHERE room_id = ?', ['CLEANING', booking.room_id]);

    await conn.execute(`
      UPDATE room_inventory ri
      JOIN booking_rooms br ON ri.room_id = br.room_id
        AND ri.date >= br.check_in AND ri.date < br.check_out
      SET ri.status = 'AVAILABLE', ri.booking_id = NULL
      WHERE br.booking_id = ?
    `, [req.params.id]);

    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [req.userId!, `CHECK_OUT:${req.params.id}:FEE:${extraFee}`]
    );

    await conn.commit();
    res.json({ 
      success: true, 
      extraFee, 
      description,
      totalFinal: Number(booking.total_price) + extraFee
    });
  } catch (e: any) {
    await conn.rollback();
    res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});
