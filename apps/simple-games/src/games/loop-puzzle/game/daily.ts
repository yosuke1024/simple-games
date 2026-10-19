/**
 * Daily Challenge — implements docs/LOOP_PUZZLE_RULES.md §9.
 * Uses the device's local date only; no server time, no network.
 *
 * Difficulty is fixed at medium every day. A weekday curve would turn the
 * calendar into lucky and unlucky days, which is pressure the brand refuses.
 * There is no streak: the record kept is which days were completed, not a
 * chain to protect (§9, docs/PRODUCT_PRINCIPLES.md).
 */
import type { Difficulty } from './types';

/**
 * Formats a date as local YYYY-MM-DD. Expects a valid Date — the device
 * clock's `new Date()`; an invalid one would format as `NaN-NaN-NaN`.
 */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `loop-puzzle-daily-${dateString}`;
}

/** Every day is medium (§9). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The year, month and day of a YYYY-MM-DD string naming a real calendar day; null otherwise. */
function parseLocalDate(text: unknown): [number, number, number] | null {
  if (typeof text !== 'string') return null;
  const match = LOCAL_DATE.exec(text);
  if (match === null) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return [y, m, d];
}

/** Whether a value is a YYYY-MM-DD string naming a real calendar day (§12's `dailyDate`). */
export const isLocalDateString = (value: unknown): value is string =>
  parseLocalDate(value) !== null;

/** Shifts a local YYYY-MM-DD string by whole days. Null for a malformed date or a fractional shift. */
export function addDays(dateString: string, delta: number): string | null {
  const parts = parseLocalDate(dateString);
  if (parts === null || !Number.isInteger(delta)) return null;
  const [y, m, d] = parts;
  return localDateString(new Date(y, m - 1, d + delta));
}

/**
 * Difference in calendar days between two local YYYY-MM-DD strings (b - a),
 * or null when either is malformed. Parsed at noon UTC so daylight-saving
 * shifts cannot round a day away.
 */
export function dayDifference(a: string, b: string): number | null {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  if (pa === null || pb === null) return null;
  const at = ([y, m, d]: [number, number, number]): number => Date.UTC(y, m - 1, d, 12);
  return Math.round((at(pb) - at(pa)) / 86_400_000);
}
