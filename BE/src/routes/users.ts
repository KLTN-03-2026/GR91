import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const userRouter = Router();

// Helper: lấy role của user
async function getUserRole(userId: number | string): Promise<string | null> {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT r.role_name FROM users u
       LEFT JOIN user_roles ur ON u.user_id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.role_id
       WHERE u.user_id = ?`,
      [userId]
    ) as any[];
    return rows[0]?.role_name ?? null;
  } finally { conn.release(); }
}

// GET /api/users (Admin)
userRouter.get('/', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { start_date, end_date } = req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    let whereClause = '';
    if (start_date && end_date) {
      whereClause = 'WHERE u.created_at BETWEEN ? AND ?';
      params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
    }
    const [rows] = await conn.execute(`
      SELECT u.user_id, u.username, u.full_name, u.email, u.phone, u.created_at,
             r.role_name,
             COUNT(DISTINCT b.booking_id)    AS total_bookings,
             COALESCE(SUM(b.total_price), 0) AS total_spent
      FROM users u
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN roles r       ON ur.role_id = r.role_id
      LEFT JOIN bookings b    ON b.user_id = u.user_id AND b.status != 'CANCELLED'
      ${whereClause}
      GROUP BY u.user_id, r.role_name
      ORDER BY u.created_at DESC
    `, params) as any[];
    res.json(rows.map((u: any) => ({
      userId:         u.user_id,
      username:       u.username,
      full_name:      u.full_name,
      email:          u.email,
      phone:          u.phone,
      created_at:     u.created_at,
      role:           u.role_name ?? 'USER',
      total_bookings: u.total_bookings,
      total_spent:    u.total_spent,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

// GET /api/users/:id
userRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'ADMIN' && req.userId !== Number(req.params.id))
    return res.status(403).json({ error: 'Forbidden' });
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT u.user_id, u.username, u.full_name, u.email, u.phone, u.created_at, r.role_name
      FROM users u
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN roles r       ON ur.role_id = r.role_id
      WHERE u.user_id = ?
    `, [req.params.id]) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

// PATCH /api/users/:id
userRouter.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'ADMIN' && req.userId !== Number(req.params.id))
    return res.status(403).json({ error: 'Forbidden' });

  // Admin không thể sửa admin khác
  if (req.userRole === 'ADMIN' && req.userId !== Number(req.params.id)) {
    try {
      const targetRole = await getUserRole(req.params.id);
      if (targetRole === 'ADMIN')
        return res.status(403).json({ error: 'Không thể chỉnh sửa tài khoản Admin' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message ?? 'Lỗi server' });
    }
  }

  const { full_name, phone } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        phone     = COALESCE(?, phone)
       WHERE user_id = ?`,
      [full_name ?? null, phone ?? null, req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

// GET /api/users/:id/bookings
userRouter.get('/:id/bookings', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'ADMIN' && req.userId !== Number(req.params.id))
    return res.status(403).json({ error: 'Forbidden' });
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT b.booking_id, b.status, b.total_price, b.created_at,
             br.check_in, br.check_out,
             rt.name AS room_type, r.room_number, ri.url AS room_image
      FROM bookings b
      LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
      LEFT JOIN rooms r          ON br.room_id = r.room_id
      LEFT JOIN room_types rt    ON r.type_id = rt.type_id
      LEFT JOIN room_images ri   ON ri.room_id = r.room_id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [req.params.id]) as any[];
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

// DELETE /api/users/:id (Admin) — soft delete: xóa nếu không có booking, ngược lại ẩn
userRouter.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    // Chặn xóa admin
    const targetRole = await getUserRole(req.params.id);
    if (targetRole === 'ADMIN')
      return res.status(403).json({ error: 'Không thể xóa tài khoản Admin' });

    // Kiểm tra có booking không
    const [bookings] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM bookings WHERE user_id = ?',
      [req.params.id]
    ) as any[];

    if (bookings[0].cnt > 0) {
      // Soft delete: ẩn tài khoản thay vì xóa cứng để giữ toàn vẹn dữ liệu
      await conn.execute(
        `UPDATE users SET
          username  = CONCAT('deleted_', user_id),
          email     = CONCAT('deleted_', user_id, '@removed.local'),
          password  = '',
          full_name = '[Đã xóa]',
          phone     = NULL
         WHERE user_id = ?`,
        [req.params.id]
      );
      // Xóa role
      await conn.execute('DELETE FROM user_roles WHERE user_id = ?', [req.params.id]);
    } else {
      // Hard delete nếu không có dữ liệu liên quan
      await conn.execute('DELETE FROM user_roles WHERE user_id = ?', [req.params.id]);
      await conn.execute('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    }

    res.json({ success: true });
  } catch (e: any) {
    // Bắt FK constraint error
    if ((e as any).code === 'ER_ROW_IS_REFERENCED_2' || (e as any).errno === 1451) {
      return res.status(409).json({ error: 'Không thể xóa: tài khoản có dữ liệu liên quan' });
    }
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

// PATCH /api/users/:id/password
userRouter.patch('/:id/password', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'ADMIN' && req.userId !== Number(req.params.id))
    return res.status(403).json({ error: 'Forbidden' });

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT password FROM users WHERE user_id = ?',
      [req.params.id]
    ) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });

    const hashed = await bcrypt.hash(new_password, 10);
    await conn.execute('UPDATE users SET password = ? WHERE user_id = ?', [hashed, req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});
