/**
 * Daily Challenge — implements docs/SCHULTE_TABLE_RULES.md §8.
 * Uses the device's local date only; no server time, no network.
 *
 * Size and order are fixed every day. A weekday curve would turn the calendar
 * into lucky and unlucky days, which is pressure the brand refuses. There is
 * no streak: the record kept is which days were finished, not a chain to
 * protect (§8, docs/PRODUCT_PRINCIPLES.md).
 */
import type { Order, Size } from './types';

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `schulte-daily-${dateString}`;
}

/** Every day is a 5x5 tapped 1 to 25 (§8). */
export const DAILY_SIZE: Size = 5;
export const DAILY_ORDER: Order = 'ascending';

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
