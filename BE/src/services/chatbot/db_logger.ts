import { pool } from '../../db/client.js';

export async function logChatMessage(
  sessionId: string,
  userId: number | null,
  sender: 'USER' | 'BOT',
  message: string
): Promise<void> {
  try {
    // 1. Ensure the session exists
    const [existingSession]: any = await pool.query(
      `SELECT session_id FROM chatbot_sessions WHERE session_id = ?`,
      [sessionId]
    );

    if (existingSession.length === 0) {
      await pool.query(
        `INSERT IGNORE INTO chatbot_sessions (session_id, user_id) VALUES (?, ?)`,
        [sessionId, userId]
      );
    }

    // 2. Insert the message
    await pool.query(
      `INSERT INTO chatbot_messages (session_id, sender, message) VALUES (?, ?, ?)`,
      [sessionId, sender, message]
    );
  } catch (error) {
    // We catch the error so it doesn't crash the main app/chatbot flow
    console.error('[DB Logger Error] Failed to log chat message:', error);
  }
}
