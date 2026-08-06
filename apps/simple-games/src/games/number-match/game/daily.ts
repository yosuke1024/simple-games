/**
 * Daily Challenge seed — implements docs/NUMBER_MATCH_RULES.md §10.
 * Uses the device's local date only; no server time, no network.
 */
import { createRng } from './rng';

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The deterministic seed for a given local date string. */
export function dailySeed(dateString: string): string {
  return `daily-${dateString}`;
}

/**
 * The first daily to carry stones and wilds (§16).
 *
 * Earlier days stay undecorated. Past dailies remain replayable and their best
 * scores are already saved (§14), so changing those boards would leave scores
 * standing against boards that no longer exist.
 */
export const DAILY_DECORATIONS_FROM = '2026-08-01';

export interface DailyDecorations {
  readonly stoneCount: number;
  readonly wildCount: number;
}

/**
 * How many stones and wilds a daily board holds: 0–2 of each, from the date
 * alone, so every player sees the same board and no day needs storing.
 */
export function dailyDecorations(dateString: string): DailyDecorations {
  // ISO dates compare correctly as strings.
  if (dateString < DAILY_DECORATIONS_FROM) return { stoneCount: 0, wildCount: 0 };
  const rng = createRng(`daily-deco-${dateString}`);
  return { stoneCount: Math.floor(rng() * 3), wildCount: Math.floor(rng() * 3) };
}

/**
 * Difference in calendar days between two local YYYY-MM-DD strings (b - a).
 * Used for streak calculation; treats strings as local dates at noon to
 * avoid DST edge cases.
 */
/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const shifted = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta);
  return localDateString(shifted);
}

export function dayDifference(a: string, b: string): number {
  const parse = (s: string): number => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}
