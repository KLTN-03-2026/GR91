export function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
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
