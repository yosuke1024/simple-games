/**
 * Pure daily-backlog logic. Every past day is open (docs/FUTOSHIKI_RULES.md
 * §9): the rules say the last thirty days are available unconditionally, with
 * no chain unlocking one day from the day before it, so the list is simply the
 * last few weeks. Nothing here counts a run of days.
 *
 * The chained form is Sudoku's alone. It turns a backlog into homework — every
 * day you skipped stands between you and the one you want — and new titles do
 * not take it (Nonogram and Takuzu did not either).
 */
import { addDays } from '../game';

/** How far back the daily backlog is listed (§9). */
export const DAILY_BACKLOG_LIMIT = 30;

/** Dates currently open, newest first. Never a day that has not arrived. */
export function availableDailyDates(today: string, limit: number = DAILY_BACKLOG_LIMIT): string[] {
  const dates = [today];
  let cursor = today;
  while (dates.length < limit) {
    cursor = addDays(cursor, -1);
    dates.push(cursor);
  }
  return dates;
}
