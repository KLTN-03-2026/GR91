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
