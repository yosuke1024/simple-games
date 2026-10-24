/**
 * Daily Challenge — docs/MAKE_THE_TARGET_RULES.md §8.
 * Uses the device's local date only; no server time, no network.
 *
 * Difficulty is Medium every day: a weekday curve would turn the calendar
 * into lucky and unlucky days, which is pressure the brand refuses. There is
 * no streak, and no way back to an earlier day (§8, docs/PRODUCT_PRINCIPLES.md
 * 「デイリーは今日の 1 問」).
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
  return `make-the-target-daily-${dateString}`;
}

/** Every day is Medium (§8). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a value is a YYYY-MM-DD string naming a real calendar day (§10's `dailyDate`). */
export function isLocalDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DATE.exec(value);
  if (match === null) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Shifts a real local YYYY-MM-DD string by whole days; null for a malformed one. */
export function addDays(dateString: string, delta: number): string | null {
  if (!isLocalDateString(dateString) || !Number.isInteger(delta)) return null;
  const [y, m, d] = dateString.split('-').map(Number) as [number, number, number];
  return localDateString(new Date(y, m - 1, d + delta));
}
