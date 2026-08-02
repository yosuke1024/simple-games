/**
 * Daily Challenge — implements docs/MEMORY_MATCH_RULES.md §7.
 * Uses the device's local date only; no server time, no network.
 *
 * The board is the Medium layout every day. A weekday curve would turn the
 * calendar into lucky and unlucky days, which is pressure the brand refuses.
 * There is no streak: the record kept is which days were solved, not a chain
 * to protect (§7, docs/PRODUCT_PRINCIPLES.md).
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
  return `memory-daily-${dateString}`;
}

/** Every day is the 4×5 board (§7). */
export const DAILY_DIFFICULTY: Difficulty = 'medium';

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
