export function formatVND(amount: number | string | null | undefined): string {
  const num = Math.round(Number(amount) || 0);
  return num.toLocaleString('vi-VN') + ' VNĐ';
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateBookingId(): string {
  return 'SH' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN');
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  // MySQL TIME trả về dạng "HH:MM:SS", chỉ lấy HH:MM
  return timeStr.substring(0, 5);
}

// ── Phone validation ──────────────────────────────────────────────────────────
// Chấp nhận: 0xxxxxxxxx (10 số) hoặc +84xxxxxxxxx / 84xxxxxxxxx
const phoneRegex = /^(\+84|84|0)(3|5|7|8|9)[0-9]{8}$/;

export function isValidPhone(phone: string): boolean {
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function normalizePhone(phone: string): string {
  // Chuẩn hóa về dạng 0xxxxxxxxx
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('84') && cleaned.length === 11) return '0' + cleaned.slice(2);
  return cleaned;
}

export const PHONE_ERROR_MSG = 'Số điện thoại không hợp lệ. Vui lòng nhập đúng định dạng Việt Nam (VD: 0901234567)';
