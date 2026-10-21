/**
 * Dates for the Daily Challenge (docs/TANGRAM_RULES.md §6「デイリー」).
 * The device's local date only; no server time, no network.
 */

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a value is a YYYY-MM-DD string naming a real calendar date (§8 `bad-mode`). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_SHAPE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * The day a YYYY-MM-DD date is, counted from 1970-01-01 = 0 (§6): the
 * date's year, month and day through `Date.UTC`, divided by 86,400,000.
 * UTC has no daylight saving, so the division is exact. Null for anything
 * that is not a calendar date (`isCalendarDate`) — never a guessed day.
 */
export function dayNumber(dateString: string): number | null {
  if (!isCalendarDate(dateString)) return null;
  const [y, m, d] = dateString.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
