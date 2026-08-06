/**
 * Pure daily-backlog logic. Every past day is open (§7): the rules say a
 * player may go back to earlier dates, with no condition attached, so the
 * list is simply the last few weeks. Nothing here counts a run of days.
 *
 * The loose model (like Sliding Puzzle, unlike Sudoku): every daily is the
 * same six colors, so there is no difficulty to ration and nothing behind a
 * gate.
 */
import { addDays } from '../game';

/** How far back the daily backlog is listed. */
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
