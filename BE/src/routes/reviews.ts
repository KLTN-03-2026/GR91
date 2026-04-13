import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const reviewRouter = Router();

// ── GET /api/reviews?type_id= — public, chỉ VISIBLE ──────────────────────────
reviewRouter.get('/', async (req, res) => {
  const { type_id } = req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = ['VISIBLE'];
    let where = "WHERE rv.status = ?";
    if (type_id) { where += ' AND rv.room_type_id = ?'; params.push(Number(type_id)); }

    const [rows] = await conn.execute(`
      SELECT rv.review_id, rv.rating, rv.comment, rv.created_at, rv.status,
             u.full_name, u.username,
             rt.name AS room_type
      FROM reviews rv
      LEFT JOIN users u       ON rv.user_id = u.user_id
      LEFT JOIN room_types rt ON rv.room_type_id = rt.type_id
      ${where}
      ORDER BY rv.created_at DESC
    `, params) as any[];
    res.json(rows);
  } finally {
    conn.release();
  }
});

// ── GET /api/reviews/my ───────────────────────────────────────────────────────
reviewRouter.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT review_id, booking_id, room_type_id, rating, comment, created_at, status FROM reviews WHERE user_id = ?',
      [req.userId!]
    ) as any[];
    res.json(rows);
  } finally {
    conn.release();
  }
});

// ── GET /api/reviews/admin/stats ──────────────────────────────────────────────
reviewRouter.get('/admin/stats', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT
        COUNT(*)                 AS total,
        SUM(status = 'VISIBLE')  AS visible,
        SUM(status = 'HIDDEN')   AS hidden,
        ROUND(AVG(rating), 1)    AS avg_rating,
        SUM(rating = 5)          AS five_star,
        SUM(rating = 4)          AS four_star,
        SUM(rating = 3)          AS three_star,
        SUM(rating <= 2)         AS low_star
      FROM reviews
    `) as any[];
    res.json(rows[0]);
  } finally {
    conn.release();
  }
});

// ── GET /api/reviews/admin — admin xem tất cả + filter ───────────────────────
reviewRouter.get('/admin', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status, type_id, rating, room_id } = req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    const where: string[] = [];
    if (status)  { where.push('rv.status = ?');       params.push(String(status)); }
    if (type_id) { where.push('rv.room_type_id = ?'); params.push(Number(type_id)); }
    if (rating)  { where.push('rv.rating = ?');       params.push(Number(rating)); }
    if (room_id) { where.push('br.room_id = ?');      params.push(Number(room_id)); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await conn.execute(`
      SELECT rv.review_id, rv.rating, rv.comment, rv.created_at, rv.status,
             rv.booking_id, rv.room_type_id,
             u.full_name, u.username, u.email,
             rt.name AS room_type,
             r.room_number, r.floor, r.room_id,
             MIN(ri.url) AS room_image
      FROM reviews rv
      LEFT JOIN users u          ON rv.user_id = u.user_id
      LEFT JOIN room_types rt    ON rv.room_type_id = rt.type_id
      LEFT JOIN bookings b       ON rv.booking_id = b.booking_id
      LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
      LEFT JOIN rooms r          ON br.room_id = r.room_id
      LEFT JOIN room_images ri   ON ri.room_id = r.room_id
      ${whereClause}
      GROUP BY rv.review_id, rv.rating, rv.comment, rv.created_at, rv.status,
               rv.booking_id, rv.room_type_id,
               u.full_name, u.username, u.email,
               rt.name, r.room_number, r.floor, r.room_id
      ORDER BY rv.created_at DESC
    `, params.length ? params : undefined) as any[];
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
    const [rows] = await conn.execute(`
      SELECT r.type_id AS room_type_id
      FROM bookings b
      JOIN booking_rooms br ON br.booking_id = b.booking_id
      JOIN rooms r          ON r.room_id = br.room_id
      WHERE b.booking_id = ? AND b.user_id = ? AND b.status = 'COMPLETED'
      LIMIT 1
    `, [booking_id, req.userId!]) as any[];

    if (!(rows as any[]).length)
      return res.status(403).json({ error: 'Chỉ đánh giá được đặt phòng đã hoàn thành của bạn' });

    const [existing] = await conn.execute(
      'SELECT review_id FROM reviews WHERE booking_id = ? AND user_id = ?',
      [booking_id, req.userId!]
    ) as any[];
    if ((existing as any[]).length)
      return res.status(409).json({ error: 'Bạn đã đánh giá đặt phòng này rồi' });

    const room_type_id = (rows as any[])[0].room_type_id;
    const [result] = await conn.execute(
      `INSERT INTO reviews (booking_id, user_id, room_type_id, rating, comment, status)
       VALUES (?, ?, ?, ?, ?, 'VISIBLE')`,
      [booking_id, req.userId!, room_type_id, rating, comment ?? null]
    ) as any[];

    res.status(201).json({ review_id: (result as any).insertId });
  } finally {
    conn.release();
  }
});

// ── PATCH /api/reviews/:id — user sửa review ─────────────────────────────────
reviewRouter.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rating, comment } = req.body;
  if (!rating) return res.status(400).json({ error: 'Thiếu rating' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating phải từ 1-5' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT review_id FROM reviews WHERE review_id = ? AND user_id = ?',
      [req.params.id, req.userId!]
    ) as any[];
    if (!(rows as any[]).length)
      return res.status(403).json({ error: 'Không có quyền chỉnh sửa đánh giá này' });

    await conn.execute(
      'UPDATE reviews SET rating = ?, comment = ? WHERE review_id = ?',
      [rating, comment ?? null, req.params.id]
    );
    res.json({ success: true });
  } finally {
    conn.release();
  }
});

// ── PATCH /api/reviews/:id/visibility — admin ẩn/hiện ────────────────────────
reviewRouter.patch('/:id/visibility', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['VISIBLE', 'HIDDEN'].includes(status))
    return res.status(400).json({ error: 'status phải là VISIBLE hoặc HIDDEN' });

  const conn = await pool.getConnection();
  try {
    await conn.execute('UPDATE reviews SET status = ? WHERE review_id = ?', [status, req.params.id]);
    res.json({ success: true });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/reviews/:id — admin xoá ──────────────────────────────────────
reviewRouter.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM reviews WHERE review_id = ?', [req.params.id]);
    res.json({ success: true });
  } finally {
    conn.release();
  }
});
