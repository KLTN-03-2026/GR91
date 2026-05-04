import { Router, Request, Response } from 'express';
// @ts-ignore
import { runAgent } from '../services/chatbot/agent.js';
// @ts-ignore
import { connectRedis } from '../services/chatbot/session.js';
import { AuthRequest, optionalAuth } from '../middleware/auth.js';

export const chatbotRouter = Router();
void connectRedis();

// ── POST /api/chatbot/message (Hệ thống cũ - Non-streaming) ───────────────────
chatbotRouter.post('/message', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message, sessionId, context } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'Missing message' });
      return;
    }

    const result = await runAgent(message, {
      sessionId: sessionId || 'default-session',
      context,
      userId: req.userId,
    });

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
