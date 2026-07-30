/**
 * The daily backlog of docs/GAME_2048_RULES.md §6: today is always open, older
 * days open one at a time, and nothing anywhere counts a run of them.
 */
import { describe, expect, it } from 'vitest';
import { progressSchema, type Progress } from '../storage/schemas';
import { availableDailyDates, canPlayDaily, DAILY_BACKLOG_LIMIT } from './progressLogic';

const TODAY = '2026-08-10';

const progressWith = (...dates: readonly string[]): Progress => ({
  ...progressSchema.defaultValue(),
  dailyScores: Object.fromEntries(dates.map((date) => [date, 1000])),
});

describe('which days can be played', () => {
  it('always opens today, and never a day that has not happened', () => {
    const empty = progressSchema.defaultValue();
    expect(canPlayDaily(empty, TODAY, TODAY)).toBe(true);
    expect(canPlayDaily(empty, '2026-08-11', TODAY)).toBe(false);
    expect(canPlayDaily(empty, '2026-09-01', TODAY)).toBe(false);
  });

  it('opens an older day only once the day after it has been played', () => {
    const empty = progressSchema.defaultValue();
    expect(canPlayDaily(empty, '2026-08-09', TODAY)).toBe(false);

    const played = progressWith(TODAY);
    expect(canPlayDaily(played, '2026-08-09', TODAY)).toBe(true);
    // And no further: the backlog opens one step at a time.
    expect(canPlayDaily(played, '2026-08-08', TODAY)).toBe(false);
    expect(canPlayDaily(progressWith(TODAY, '2026-08-09'), '2026-08-08', TODAY)).toBe(true);
  });

  it('crosses a month boundary the same as any other day', () => {
    expect(canPlayDaily(progressWith('2026-08-01'), '2026-07-31', '2026-08-01')).toBe(true);
  });
});

describe('the list of open days', () => {
  it('is today alone until a day has been played', () => {
    expect(availableDailyDates(progressSchema.defaultValue(), TODAY)).toEqual([TODAY]);
  });

  it('walks backwards, newest first, one day per day played', () => {
    expect(availableDailyDates(progressWith(TODAY), TODAY)).toEqual([TODAY, '2026-08-09']);
    expect(availableDailyDates(progressWith(TODAY, '2026-08-09'), TODAY)).toEqual([
      TODAY,
      '2026-08-09',
      '2026-08-08',
    ]);
  });

  it('stops at the backlog limit however long the history is', () => {
    const everyDay = Array.from({ length: 200 }, (_, i) =>
      new Date(2026, 7, 10 - i).toISOString().slice(0, 10),
    );
    const dates = availableDailyDates(progressWith(...everyDay), TODAY);
    expect(dates.length).toBeLessThanOrEqual(DAILY_BACKLOG_LIMIT);
    // Newest first, and no day repeated.
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates[0]).toBe(TODAY);
  });
});
