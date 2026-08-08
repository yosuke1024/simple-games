/**
 * Daily Challenge — implements docs/TAKUZU_RULES.md §7.
 * Uses the device's local date only; no server time, no network.
 *
 * Size and givens ratio are fixed every day. A weekday curve would turn the
 * calendar into lucky and unlucky days, which is pressure the brand refuses.
 * There is no streak: the record kept is which days were solved, not a chain
 * to protect (docs/PRODUCT_PRINCIPLES.md).
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
  return `takuzu-daily-${dateString}`;
}

/**
 * Every day is an 8×8 at the middle of that band's range (§7): the size the
 * level list spends forty levels on, and a ratio a player who has walked those
 * levels already recognises — roughly level 40. A daily is one puzzle a day,
 * so it is the one place where "the same shape every time" is the point.
 */
export const DAILY_SIZE: Size = 8;
export const DAILY_GIVENS_RATIO = 0.36;

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
