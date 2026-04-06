import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const statsRouter = Router();

// GET /api/stats (Admin)
statsRouter.get('/', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { start_date, end_date } = _req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    let whereClause = "WHERE status != 'CANCELLED'";
    if (start_date && end_date) {
      whereClause += " AND created_at BETWEEN ? AND ?";
      params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
    }

    // 1. Total revenue & booking count
    const [rev] = await conn.execute(`
      SELECT COALESCE(SUM(total_price), 0) AS totalRevenue,
             COUNT(*) AS bookingCount
      FROM bookings
      ${whereClause}
    `, params) as any[];

    // 2. Room stats (Active & Vacant today)
    const today = new Date().toISOString().split('T')[0];
    const [rooms] = await conn.execute(`
      SELECT 
        (SELECT COUNT(*) FROM rooms WHERE status = 'ACTIVE') AS totalRooms,
        (SELECT COUNT(*) FROM rooms r WHERE r.status = 'ACTIVE' AND r.room_id NOT IN (
          SELECT br.room_id FROM booking_rooms br
          JOIN bookings b ON b.booking_id = br.booking_id
          WHERE b.status NOT IN ('CANCELLED')
            AND br.check_in <= ? AND br.check_out > ?
        )) AS vacantRooms
    `, [today, today]) as any[];

    // 3. User stats
    const [users] = await conn.execute(`
      SELECT COUNT(*) AS userCount FROM users
    `) as any[];

    // 4. Recent bookings (latest 5)
    const [recent] = await conn.execute(`
      SELECT b.booking_id, b.status, b.total_price, b.created_at,
             u.full_name, rt.name AS room_type, r.room_number
      FROM bookings b
      LEFT JOIN users u          ON b.user_id = u.user_id
      LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
      LEFT JOIN rooms r          ON br.room_id = r.room_id
      LEFT JOIN room_types rt    ON r.type_id = rt.type_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `) as any[];

    res.json({
      totalRevenue: Number(rev[0].totalRevenue),
      bookingCount: Number(rev[0].bookingCount),
      totalRooms: Number(rooms[0].totalRooms),
      vacantRooms: Number(rooms[0].vacantRooms),
      userCount: Number(users[0].userCount),
      recentBookings: recent,
    });
  } finally {
    conn.release();
  }
});
