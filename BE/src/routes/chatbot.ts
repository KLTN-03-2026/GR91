import { Router, Request, Response } from 'express';
// @ts-ignore
import { runAgent } from '../services/chatbot/agent.js';
import { optionalAuth } from '../middleware/auth.js';

export const chatbotRouter = Router();

// ── POST /api/chatbot/message (Hệ thống cũ - Non-streaming) ───────────────────
chatbotRouter.post('/message', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, sessionId } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'Missing message' });
      return;
    }

    const result = await runAgent(message, sessionId || 'default-session');

    res.json({
      success: true,
      data: {
        message: result.text,
        rooms: result.rooms || []
      }
    });
  } catch (error) {
    console.error('Chatbot API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while processing the chatbot message'
    });
  }
});
