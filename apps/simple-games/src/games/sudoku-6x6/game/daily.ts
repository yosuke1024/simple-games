/**
 * Daily Challenge — implements docs/SUDOKU_6X6_RULES.md §9.
 * Uses the device's local date only; no server time, no network.
 *
 * Difficulty is fixed at medium every day. A weekday curve would turn the
 * calendar into lucky and unlucky days, which is pressure the brand refuses.
 * There is no streak: the record kept is which days were solved, not a chain
 * to protect (docs/PRODUCT_PRINCIPLES.md).
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
  return `sudoku-6x6-daily-${dateString}`;
}

/** Every day is medium (§9). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
