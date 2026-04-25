/**
 * PB01 - Đăng nhập
 * PB02 - Đăng ký
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();
const SECRET = process.env.JWT_SECRET ?? 'dev_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN ?? '7d';

// ── PB02: Đăng ký ────────────────────────────────────────────────────────────
authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, full_name, email, phone, password } = req.body;
  if (!username || !email || !password || !full_name)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  const conn = await pool.getConnection();
  try {
    // Kiểm tra email/username trùng
    const [exists] = await conn.execute(
      'SELECT user_id FROM users WHERE email = ? OR username = ?',
      [email, username]
    ) as any[];
    if (exists.length > 0)
      return res.status(409).json({ error: 'Email hoặc username đã tồn tại' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await conn.execute(
      'INSERT INTO users (username, password, full_name, email, phone) VALUES (?,?,?,?,?)',
      [username, hashed, full_name, email, phone ?? null]
    ) as any[];

    const userId = result.insertId;

    // Gán role USER mặc định (role_id = 3)
    await conn.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?,3)', [userId]);

    // Ghi activity log
    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?,?)',
      [userId, 'REGISTER']
    );

    const token = jwt.sign({ userId, role: 'USER' }, SECRET, { expiresIn: EXPIRES } as any);
    res.status(201).json({ token, user: { userId, username, full_name, email, role: 'USER' } });
  } finally {
    conn.release();
  }
});

// ── PB01: Đăng nhập ──────────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ error: 'Thiếu tên đăng nhập/email hoặc mật khẩu' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT u.*, r.role_name FROM users u LEFT JOIN user_roles ur ON u.user_id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.role_id WHERE u.email = ? OR u.username = ?',
      [identifier, identifier]
    ) as any[];

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Tên đăng nhập/email không tồn tại' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Mật khẩu không đúng' });

    await conn.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?,?)',
      [user.user_id, 'LOGIN']
    );

    const token = jwt.sign(
      { userId: user.user_id, role: user.role_name ?? 'USER' },
      SECRET,
      { expiresIn: EXPIRES } as any
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role_name ?? 'USER',
      },
    });
  } finally {
    conn.release();
  }
});

// ── Lấy thông tin user hiện tại ───────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT u.user_id, u.username, u.full_name, u.email, u.phone, u.created_at, r.role_name FROM users u LEFT JOIN user_roles ur ON u.user_id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.role_id WHERE u.user_id = ?',
      [req.userId!]
    ) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy user' });
    
    const user = rows[0];
    res.json({
      userId: user.user_id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      role: user.role_name ?? 'USER'
    });
  } finally {
    conn.release();
  }
});
