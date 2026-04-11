import { Request, Response, NextFunction } from 'express';

// Lớp Error tùy chỉnh để quản lý Status Code dễ dàng hơn
export class AppError extends Error {
  constructor(public statusCode: number, public message: string) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log lỗi chi tiết ở server cho developer
  console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.error(err);

  // Mặc định là lỗi 500
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Xử lý lỗi MySQL phổ biến
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    statusCode = 409;
    // Trích xuất tên field từ sqlMessage nếu có
    const match = err.sqlMessage?.match(/for key '(.+?)'/);
    const field = match ? match[1].split('.').pop() : 'dữ liệu';
    message = `Đã tồn tại: ${field} này đã được sử dụng.`;
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
    statusCode = 409;
    message = 'Không thể xóa: dữ liệu đang được tham chiếu ở nơi khác.';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    statusCode = 400;
    message = 'Dữ liệu tham chiếu không tồn tại.';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn.';
  }

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    // Chỉ hiện stack trace ở môi trường development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
