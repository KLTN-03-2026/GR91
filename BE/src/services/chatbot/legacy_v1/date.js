const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayLocalDate() {
  return formatLocalDate(new Date());
}

export function parseDateOnly(dateStr) {
  if (!DATE_RE.test(String(dateStr || ""))) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidDateOnly(dateStr) {
  return Boolean(parseDateOnly(dateStr));
}

export function addDays(dateStr, days) {
  const base = parseDateOnly(dateStr);
  if (!base) return null;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

export function diffNights(checkin, checkout) {
  const start = parseDateOnly(checkin);
  const end = parseDateOnly(checkout);
  if (!start || !end) return null;
  return Math.round((end - start) / 86400000);
}

export function isValidDateRange(checkin, checkout) {
  const nights = diffNights(checkin, checkout);
  return Number.isInteger(nights) && nights > 0;
}

export function fromDayMonth(day, month, year = new Date().getFullYear()) {
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return formatLocalDate(date);
}
