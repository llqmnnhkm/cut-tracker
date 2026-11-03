// Dates are local calendar days stored as 'YYYY-MM-DD'. Arithmetic goes through
// UTC so that timezones and daylight saving can never shift a day.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const pad = (n: number) => String(n).padStart(2, '0');

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(toUtc(iso) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);

export const weekdayIndex = (iso: string) => new Date(toUtc(iso)).getUTCDay();

export const weekdayName = (iso: string) => WEEKDAY_NAMES[weekdayIndex(iso)];

export function shortDate(iso: string): string {
  const d = new Date(toUtc(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
