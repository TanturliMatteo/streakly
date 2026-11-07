import type { Weekday } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time date key, e.g. `2026-11-07`. */
export function toKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date) {
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

export function formatTime(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Mon → Sun order, for pickers and calendars. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function describeDays(days: Weekday[]) {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  const sorted = WEEK_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (sorted.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ');
}
