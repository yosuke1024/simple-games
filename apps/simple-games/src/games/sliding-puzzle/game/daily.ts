/**
 * Daily Challenge — implements docs/SLIDING_PUZZLE_RULES.md §7.
 * Uses the device's local date only; no server time, no network.
 *
 * Size and depth are fixed every day. A weekday curve would turn the calendar
 * into lucky and unlucky days, which is pressure the brand refuses. There is no
 * streak: the record kept is which days were solved, not a chain to protect
 * (§7, docs/PRODUCT_PRINCIPLES.md).
 */
import type { Size } from './types';

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `slide-daily-${dateString}`;
}

/** Every day is a 4x4 shuffled 200 steps (§7). */
export const DAILY_SIZE: Size = 4;
export const DAILY_DEPTH = 200;

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}

/**
 * Difference in calendar days between two local YYYY-MM-DD strings (b - a).
 * Parsed at noon UTC so daylight-saving shifts cannot round a day away.
 */
export function dayDifference(a: string, b: string): number {
  const parse = (s: string): number => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}
