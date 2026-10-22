/**
 * The statistics transitions (docs/PIPE_LINK_RULES.md §8): a start counts a
 * play, seconds are booked once, a clear moves the best only when it beats
 * it, and the daily keeps its own bucket and its days — a set, not a run.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createDifficultySession, withElapsedSeconds } from '../game';
import { statsSchema } from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  bucketOf,
  dailiesCleared,
  previousBestFor,
  totalPlaySeconds,
} from './statsLogic';

const easy = createDifficultySession('easy', 'pipe-link-easy-stats');
const daily = createDailySession('2026-10-22');

describe('statistics transitions', () => {
  it('books a daily into its own bucket, never into Medium (§8)', () => {
    expect(bucketOf(easy)).toBe('easy');
    expect(bucketOf(daily)).toBe('daily');
    const started = applyGameStart(statsSchema.defaultValue(), bucketOf(daily));
    expect(started.daily.played).toBe(1);
    expect(started.medium.played).toBe(0);
  });

  it('adds play time, and nothing for zero or less', () => {
    const base = statsSchema.defaultValue();
    expect(applyPlayTime(base, 'easy', 0)).toBe(base);
    expect(applyPlayTime(base, 'easy', -4)).toBe(base);
    const next = applyPlayTime(base, 'hard', 30);
    expect(next.hard.totalPlaySeconds).toBe(30);
    expect(base.hard.totalPlaySeconds).toBe(0);
    expect(totalPlaySeconds(applyPlayTime(next, 'daily', 12))).toBe(42);
  });

  it('moves the best only when a clear beats it', () => {
    const first = applySolved(statsSchema.defaultValue(), withElapsedSeconds(easy, 90));
    expect(first).toMatchObject({ isNewBest: true, bestSeconds: 90 });
    expect(first.stats.easy).toMatchObject({ solved: 1, bestSeconds: 90 });
    expect(previousBestFor(first.stats, easy)).toBe(90);
    const slower = applySolved(first.stats, withElapsedSeconds(easy, 120));
    expect(slower).toMatchObject({ isNewBest: false, bestSeconds: 90 });
    expect(slower.stats.easy.solved).toBe(2);
    const faster = applySolved(slower.stats, withElapsedSeconds(easy, 45));
    expect(faster).toMatchObject({ isNewBest: true, bestSeconds: 45 });
  });

  it('keeps the daily’s days as a set with each day’s best, and no streak', () => {
    const once = applySolved(statsSchema.defaultValue(), withElapsedSeconds(daily, 200));
    expect(once.stats.dailyTimes).toEqual({ '2026-10-22': 200 });
    const again = applySolved(once.stats, withElapsedSeconds(daily, 150));
    expect(again.stats.dailyTimes).toEqual({ '2026-10-22': 150 });
    expect(dailiesCleared(again.stats)).toBe(1);
    expect(again.stats.medium.solved).toBe(0);
    expect(Object.keys(again.stats)).not.toContain('streak');
  });
});
