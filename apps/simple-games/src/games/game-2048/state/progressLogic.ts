/**
 * Pure daily-backlog logic. Today is always open; an older day opens once the
 * day after it has been played out, so the backlog unlocks one step at a time
 * (docs/GAME_2048_RULES.md §6) — a record of what was played, never a streak
 * to protect.
 *
 * "Played out" means the day has a recorded score, which happens when its game
 * ends or is started over. A 2048 board has no solved state to wait for, so
 * finishing the day is the nearest honest equivalent of Sudoku's clear.
 */
import { addDays } from '../game';
import type { Progress } from '../storage/schemas';

/** How far back the daily backlog is ever listed. */
export const DAILY_BACKLOG_LIMIT = 30;

export function canPlayDaily(progress: Progress, date: string, today: string): boolean {
  if (date === today) return true;
  if (date > today) return false;
  return progress.dailyScores[addDays(date, 1)] !== undefined;
}

/** Dates currently open, newest first. */
export function availableDailyDates(
  progress: Progress,
  today: string,
  limit: number = DAILY_BACKLOG_LIMIT,
): string[] {
  const dates = [today];
  let cursor = today;
  while (dates.length < limit && progress.dailyScores[cursor] !== undefined) {
    cursor = addDays(cursor, -1);
    dates.push(cursor);
  }
  return dates;
}
