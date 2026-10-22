/**
 * Daily board — docs/PIPE_LINK_RULES.md §8. Uses the device's local date
 * only; no server time, no network.
 *
 * Medium every day: a weekday curve would turn the calendar into lucky and
 * unlucky days. There is no streak and no past daily — only today's board
 * (docs/PRODUCT_PRINCIPLES.md).
 */
import type { Difficulty } from './types';

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `pipe-link-daily-${dateString}`;
}

/** Every day is medium (§8). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
