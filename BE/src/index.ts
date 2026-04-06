import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { authRouter }    from './routes/auth.js';
import { roomRouter }    from './routes/rooms.js';
import { bookingRouter } from './routes/bookings.js';
import { userRouter }    from './routes/users.js';
import { reviewRouter }  from './routes/reviews.js';
import { chatbotRouter } from './routes/chatbot.js';
import { statsRouter }   from './routes/stats.js';

const app  = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json());

app.use('/api/auth',     authRouter);
app.use('/api/rooms',    roomRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/users',    userRouter);
app.use('/api/reviews',  reviewRouter);
app.use('/api/chatbot',  chatbotRouter);
app.use('/api/stats',    statsRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
