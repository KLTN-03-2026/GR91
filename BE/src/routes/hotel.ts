import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';

export const hotelRouter = Router();

// GET /api/hotel/info
hotelRouter.get('/info', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM hotel_info LIMIT 1');
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hotel info not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching hotel info:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
