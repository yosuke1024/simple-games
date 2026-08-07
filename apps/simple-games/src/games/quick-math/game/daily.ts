/**
 * Daily Challenge — implements docs/QUICK_MATH_RULES.md §7.
 * Uses the device's local date only; no server time, no network.
 *
 * Twenty questions at one fixed difficulty, every day. A weekday curve would
 * turn the calendar into lucky and unlucky days, which is pressure the brand
 * refuses. There is no streak: the record kept is which days were finished,
 * not a chain to protect (§7, docs/PRODUCT_PRINCIPLES.md).
 */
import type { LevelSpec } from './levels';

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `qmath-daily-${dateString}`;
}

/** Twice a level's set: the daily is the longer sitting (§7). */
export const QUESTIONS_PER_DAILY = 20;

/**
 * The daily's difficulty: all four signs, mid-curve ceilings, fixed forever.
 *
 * Written out here rather than borrowed from a level, because no single level
 * is what the daily wants: the ladder spends whole bands on one operator at a
 * time (§6), so "level 50" would be twenty divisions rather than a mixed set.
 * Tying the daily to a level number would also mean re-tuning the ladder
 * silently re-tuned every past day, and those days already have times recorded
 * against them.
 *
 * It is a constant, not a point that moves with the player's progress:
 * everyone gets the same day.
 */
export const dailySpec = (): LevelSpec => ({
  track: 'mixed',
  forms: ['binary', 'missing'],
  ops: ['+', '−', '×', '÷'],
  maxA: 30,
  maxB: 9,
});

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
