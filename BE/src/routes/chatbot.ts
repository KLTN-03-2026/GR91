import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

export const chatbotRouter = Router();

// Keyword-based bot replies (có thể thay bằng Gemini API sau)
const BOT_RESPONSES: Record<string, string> = {
  'phòng trống':      'Bạn có thể xem danh sách phòng trống tại /api/rooms?check_in=...&check_out=...',
  'hủy phòng':        'Bạn có thể hủy miễn phí trước 48 giờ nhận phòng. Sau thời gian đó tính phí 1 đêm.',
  'nhận phòng':       'Giờ nhận phòng từ 14:00, trả phòng trước 12:00.',
  'trả phòng':        'Giờ nhận phòng từ 14:00, trả phòng trước 12:00.',
  'giá':              'Giá phòng dao động từ 500.000đ đến 5.000.000đ/đêm tùy loại phòng.',
  'thanh toán':       'Chúng tôi hỗ trợ thanh toán qua MOMO, VNPAY, thẻ tín dụng và tiền mặt.',
  'liên hệ':          'Hotline: 0909999999 | Email: contact@sunrisehotel.com | Phục vụ 24/7.',
};

function getBotReply(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, reply] of Object.entries(BOT_RESPONSES)) {
    if (lower.includes(key)) return reply;
  }
  return 'Cảm ơn bạn đã liên hệ! Để được hỗ trợ chi tiết, vui lòng gọi hotline 0909999999.';
}

// ── POST /api/chatbot/session  (Tạo session mới) ─────────────────────────────
chatbotRouter.post('/session', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId ?? null;
  const sessionId = crypto.randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'INSERT INTO chatbot_sessions (session_id, user_id) VALUES (?,?)',
      [sessionId, userId]
    );
    res.status(201).json({ session_id: sessionId });
  } finally {
    conn.release();
  }
});

// ── POST /api/chatbot/message  (Gửi tin nhắn) ────────────────────────────────
chatbotRouter.post('/message', async (req: Request, res: Response) => {
  const { session_id, message } = req.body;
  if (!session_id || !message) return res.status(400).json({ error: 'Thiếu session_id hoặc message' });

  const conn = await pool.getConnection();
  try {
    // Kiểm tra session tồn tại
    const [sessions] = await conn.execute(
      'SELECT 1 FROM chatbot_sessions WHERE session_id = ?', [session_id]
    ) as any[];
    if (!(sessions as any[]).length)
      return res.status(404).json({ error: 'Session không tồn tại' });

    // Lưu tin nhắn user
    await conn.execute(
      'INSERT INTO chatbot_messages (session_id, sender, message) VALUES (?,?,?)',
      [session_id, 'USER', message]
    );

    // Tạo và lưu reply của bot
    const botReply = getBotReply(message);
    await conn.execute(
      'INSERT INTO chatbot_messages (session_id, sender, message) VALUES (?,?,?)',
      [session_id, 'BOT', botReply]
    );

    res.json({ reply: botReply });
  } finally {
    conn.release();
  }
});

// ── GET /api/chatbot/history/:session_id  (Lịch sử chat) ─────────────────────
chatbotRouter.get('/history/:session_id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT sender, message, sent_at FROM chatbot_messages WHERE session_id = ? ORDER BY sent_at ASC',
      [req.params.session_id]
    ) as any[];
    res.json(rows);
  } finally {
    conn.release();
  }
});
