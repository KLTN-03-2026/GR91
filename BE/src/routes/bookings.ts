import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const bookingRouter = Router();

// GET /api/bookings
bookingRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    let sql: string;
    let params: any[];

    if (req.userRole === 'ADMIN') {
      const { start_date, end_date } = req.query;
      params = [];
      let where = '';
      if (start_date && end_date) {
        where = 'WHERE b.created_at BETWEEN ? AND ?';
        params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
      }

      sql = `
        SELECT b.booking_id, b.status, b.total_price, b.created_at,
               u.full_name, u.email,
               br.check_in, br.check_out, br.price AS room_price,
               rt.name AS room_type, r.room_number
        FROM bookings b
        LEFT JOIN users u          ON b.user_id = u.user_id
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r          ON br.room_id = r.room_id
        LEFT JOIN room_types rt    ON r.type_id = rt.type_id
        ${where}
        ORDER BY b.created_at DESC
      `;
    } else {
      sql = `
        SELECT b.booking_id, b.status, b.total_price, b.created_at,
               br.check_in, br.check_out, br.price AS room_price,
               rt.name AS room_type, r.room_number,
               ri.url AS room_image
        FROM bookings b
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r          ON br.room_id = r.room_id
        LEFT JOIN room_types rt    ON r.type_id = rt.type_id
        LEFT JOIN room_images ri   ON ri.room_id = r.room_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
      `;
      params = [req.userId!];
    }

    const [rows] = await conn.execute(sql, params) as any[];
    res.json(rows);
  } finally {
    conn.release();
  }
});

// GET /api/bookings/:id
bookingRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [bookings] = await conn.execute(`
      SELECT b.*, u.full_name, u.email, u.phone
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = ?
    `, [req.params.id]) as any[];

    if (!bookings[0]) return res.status(404).json({ error: 'Không tìm thấy đặt phòng' });

    const [rooms] = await conn.execute(`
      SELECT br.*, rt.name AS room_type, r.room_number, ri.url AS image
      FROM booking_rooms br
      LEFT JOIN rooms r        ON br.room_id = r.room_id
      LEFT JOIN room_types rt  ON r.type_id = rt.type_id
      LEFT JOIN room_images ri ON ri.room_id = r.room_id
      WHERE br.booking_id = ?
    `, [req.params.id]) as any[];

    const [guests] = await conn.execute(
      'SELECT * FROM booking_guests WHERE booking_id = ?', [req.params.id]
    ) as any[];

    const [payments] = await conn.execute(
      'SELECT * FROM payment_transactions WHERE booking_id = ?', [req.params.id]
    ) as any[];

    res.json({ ...bookings[0], rooms, guests, payments });
  } finally {
    conn.release();
  }
});

// POST /api/bookings
bookingRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { room_id, check_in, check_out, guests, payment_method } = req.body;
  if (!room_id || !check_in || !check_out)
    return res.status(400).json({ error: 'Thiếu thông tin đặt phòng' });

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [roomRows] = await conn.execute(`
      SELECT r.room_id, rt.base_price FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      WHERE r.room_id = ? AND r.status = 'ACTIVE'
    `, [room_id]) as any[];
    if (!roomRows[0]) return res.status(404).json({ error: 'Phòng không tồn tại' });

    const [conflict] = await conn.execute(`
      SELECT 1 FROM booking_rooms br
      JOIN bookings b ON b.booking_id = br.booking_id
      WHERE br.room_id = ? AND b.status NOT IN ('CANCELLED')
        AND br.check_in < ? AND br.check_out > ?
    `, [room_id, check_out, check_in]) as any[];
    if ((conflict as any[]).length > 0)
      return res.status(409).json({ error: 'Phòng đã được đặt trong khoảng thời gian này' });

    const nights = Math.max(1, Math.ceil(
      (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
    ));
    const roomPrice  = roomRows[0].base_price * nights;
    const totalPrice = Math.round(roomPrice * 1.15);

    const [bookingResult] = await conn.execute(
      'INSERT INTO bookings (user_id, total_price, status) VALUES (?,?,?)',
      [req.userId!, totalPrice, 'PENDING']
    ) as any[];
    const bookingId = bookingResult.insertId;

    await conn.execute(
      'INSERT INTO booking_rooms (booking_id, room_id, check_in, check_out, price) VALUES (?,?,?,?,?)',
      [bookingId, room_id, check_in, check_out, roomPrice]
    );

    if (Array.isArray(guests)) {
      for (const g of guests) {
        await conn.execute(
          'INSERT INTO booking_guests (booking_id, full_name, phone, email) VALUES (?,?,?,?)',
          [bookingId, g.full_name, g.phone ?? null, g.email ?? null]
        );
      }
    }

    await conn.execute(
      'INSERT INTO payment_transactions (booking_id, amount, method, status) VALUES (?,?,?,?)',
      [bookingId, totalPrice, payment_method ?? 'CASH', 'PENDING']
    );

    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?,?)',
      [req.userId!, `CREATE_BOOKING:${bookingId}`]
    );

    await conn.commit();
    res.status(201).json({ booking_id: bookingId, total_price: totalPrice });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PATCH /api/bookings/:id/status (Admin)
bookingRouter.patch('/:id/status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const valid = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const conn = await pool.getConnection();
  try {
    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', [status, req.params.id]);
    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?,?)',
      [req.userId!, `UPDATE_BOOKING:${req.params.id}:${status}`]
    );
    res.json({ success: true });
  } finally {
    conn.release();
  }
});

// DELETE /api/bookings/:id (Hủy)
bookingRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT * FROM bookings WHERE booking_id = ? AND user_id = ?',
      [req.params.id, req.userId!]
    ) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đặt phòng' });
    if (rows[0].status === 'COMPLETED')
      return res.status(400).json({ error: 'Không thể hủy đặt phòng đã hoàn thành' });

    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', ['CANCELLED', req.params.id]);
    res.json({ success: true });
  } finally {
    conn.release();
  }
});

// DELETE /api/bookings/:id/hard (Admin)
bookingRouter.delete('/:id/hard', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM bookings WHERE booking_id = ?', [req.params.id]);
    res.json({ success: true });
  } finally {
    conn.release();
  }
});
