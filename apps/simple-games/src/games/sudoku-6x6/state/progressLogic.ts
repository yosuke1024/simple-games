/**
 * The daily backlog. The past thirty days are open with no condition attached
 * (docs/SUDOKU_6X6_RULES.md §9), so the list is simply the last thirty days.
 * Nothing here counts a run of days.
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
