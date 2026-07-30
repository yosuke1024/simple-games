/**
 * Pure daily-backlog logic. Today is always open; an older day opens once the
 * day after it has been solved, so the backlog unlocks one step at a time
 * (docs/SUDOKU_RULES.md §10) — a record of what was played, never a streak to
 * protect.
 */
import { addDays } from '../game';
import type { Progress } from '../storage/schemas';

/** How far back the daily backlog is ever listed. */
export const DAILY_BACKLOG_LIMIT = 30;

export function canPlayDaily(progress: Progress, date: string, today: string): boolean {
  if (date === today) return true;
  if (date > today) return false;
  return progress.dailyTimes[addDays(date, 1)] !== undefined;
}

/** Dates currently open, newest first. */
export function availableDailyDates(
  progress: Progress,
  today: string,
  limit: number = DAILY_BACKLOG_LIMIT,
): string[] {
  const dates = [today];
  let cursor = today;
  while (dates.length < limit && progress.dailyTimes[cursor] !== undefined) {
    cursor = addDays(cursor, -1);
    dates.push(cursor);
  }
  return dates;
}
