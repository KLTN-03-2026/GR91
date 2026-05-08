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
import { hotelRouter }   from './routes/hotel.js';

import { errorHandler } from './middleware/error.js';

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
app.use('/api/hotel',    hotelRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Global error handler
app.use(errorHandler);

// @ts-ignore
import killPort from 'kill-port';

async function startServer(port: number, retries = 5) {
  try {
    // Tự động dọn dẹp port lỗi (zombie) từ gốc trước khi chạy
    await killPort(port);
  } catch (err) {
    // Không cần xử lý nếu port đang trống
  }

  const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      if (retries > 0) {
        console.warn(`⏳ Port ${port} busy, retrying in 1s... (${retries} attempts left)`);
        setTimeout(() => startServer(port, retries - 1), 1000);
      } else {
        console.error(`❌ Port ${port} is still in use after retries.`);
        console.error(`   Run this to fix: npx kill-port ${port}`);
        process.exit(1);
      }
    } else {
      throw err;
    }
  });

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    server.close(() => {
      console.log('✅ Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  
  // Bắt lỗi crash đột ngột để giải phóng port
  process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

startServer(Number(PORT));
