/**
 * Daily Challenge — implements docs/NUMBER_RECALL_RULES.md §9.
 * Uses the device's local date only; no server time, no network.
 *
 * Size and tile count are fixed every day. A weekday curve would turn the
 * calendar into lucky and unlucky days, which is pressure the brand refuses.
 * There is no streak: the record kept is which days were finished, not a chain
 * to protect (§9, docs/PRODUCT_PRINCIPLES.md).
 */
import type { Size } from './types';

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The attempt number is part of the seed for the same reason it is on a level
 * (§8): a retry inside the same day must be a different layout, or it would be
 * a re-read of the answer just shown.
 */
export function dailySeed(dateString: string, attempt: number): string {
  return `recall-daily-${dateString}-r${Math.max(0, Math.floor(attempt))}`;
}

/** Every day is nine tiles on a 5x5 (§9). */
export const DAILY_SIZE: Size = 5;
export const DAILY_TILES = 9;

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
