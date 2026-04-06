import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const reviewRouter = Router();

// ── GET /api/reviews?room_type_id= ───────────────────────────────────────────
reviewRouter.get('/', async (req, res) => {
  const { type_id } = req.query;
  const conn = await pool.getConnection();
  try {
    let sql = `
      SELECT rv.review_id, rv.rating, rv.comment, rv.created_at,
             u.full_name, u.username,
             rt.name AS room_type
      FROM reviews rv
      LEFT JOIN users u          ON rv.user_id = u.user_id
      LEFT JOIN bookings b       ON rv.booking_id = b.booking_id
      LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
      LEFT JOIN rooms r          ON br.room_id = r.room_id
      LEFT JOIN room_types rt    ON r.type_id = rt.type_id
    `;
    const params: any[] = [];
    if (type_id) { sql += ' WHERE r.type_id = ?'; params.push(type_id); }
    sql += ' ORDER BY rv.created_at DESC';

    const [rows] = await conn.execute(sql, params) as any[];
    res.json(rows);
  } finally {
    conn.release();
  }
});

// ── POST /api/reviews ─────────────────────────────────────────────────────────
reviewRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { booking_id, rating, comment } = req.body;
  if (!booking_id || !rating) return res.status(400).json({ error: 'Thiếu thông tin đánh giá' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating phải từ 1-5' });

  const conn = await pool.getConnection();
  try {
    // Kiểm tra booking thuộc về user và đã COMPLETED
    const [rows] = await conn.execute(
      `SELECT 1 FROM bookings WHERE booking_id = ? AND user_id = ? AND status = 'COMPLETED'`,
      [booking_id, req.userId]
    ) as any[];
    if (!(rows as any[]).length)
      return res.status(403).json({ error: 'Chỉ đánh giá được đặt phòng đã hoàn thành của bạn' });

    const [result] = await conn.execute(
      'INSERT INTO reviews (booking_id, user_id, rating, comment) VALUES (?,?,?,?)',
      [booking_id, req.userId, rating, comment ?? null]
    ) as any[];
    res.status(201).json({ review_id: result.insertId });
  } finally {
    conn.release();
  }
});
