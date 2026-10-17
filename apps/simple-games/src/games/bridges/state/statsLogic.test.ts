/**
 * The statistics transitions (docs/BRIDGES_RULES.md §11): per difficulty,
 * the daily kept apart, the total a sum of the buckets, and no streak.
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

const empty = () => statsSchema.defaultValue();
const easy = createDifficultySession('easy', 'bridges-easy-stats');
const daily = createDailySession('2026-10-17');

describe('statistics (§11)', () => {
  it('books a daily into its own bucket, never into medium', () => {
    expect(bucketOf(easy)).toBe('easy');
    expect(bucketOf(daily)).toBe('daily');
    const started = applyGameStart(applyGameStart(empty(), 'daily'), 'medium');
    expect(started.daily.played).toBe(1);
    expect(started.medium.played).toBe(1);
  });

  it('adds play time without touching the input, and ignores nothing-to-add', () => {
    const before = empty();
    const after = applyPlayTime(before, 'hard', 30);
    expect(after.hard.totalPlaySeconds).toBe(30);
    expect(before.hard.totalPlaySeconds).toBe(0);
    expect(applyPlayTime(before, 'hard', 0)).toBe(before);
  });

  it('counts a Free Play clear and keeps the fastest time', () => {
    const first = applySolved(empty(), withElapsedSeconds(easy, 90));
    expect(first.isNewBest).toBe(true);
    expect(first.stats.easy).toMatchObject({ solved: 1, bestSeconds: 90 });
    expect(previousBestFor(first.stats, easy)).toBe(90);
    const slower = applySolved(first.stats, withElapsedSeconds(easy, 120));
    expect(slower.isNewBest).toBe(false);
    expect(slower.bestSeconds).toBe(90);
    expect(slower.stats.easy.solved).toBe(2);
    const faster = applySolved(slower.stats, withElapsedSeconds(easy, 60));
    expect(faster.isNewBest).toBe(true);
    expect(faster.stats.easy.bestSeconds).toBe(60);
  });

  it('records a daily clear as a date, best per day, and nothing about runs of days', () => {
    expect(previousBestFor(empty(), daily)).toBeNull();
    const first = applySolved(empty(), withElapsedSeconds(daily, 200));
    expect(first.stats.dailyTimes).toEqual({ '2026-10-17': 200 });
    expect(first.stats.medium.solved).toBe(0);
    const again = applySolved(first.stats, withElapsedSeconds(daily, 150));
    expect(again.isNewBest).toBe(true);
    expect(again.stats.dailyTimes['2026-10-17']).toBe(150);
    expect(dailiesCleared(again.stats)).toBe(1);
    expect(Object.keys(again.stats)).not.toContain('streak');
  });

  it('totals play time across every mode, daily included', () => {
    let stats = empty();
    stats = applyPlayTime(stats, 'easy', 10);
    stats = applyPlayTime(stats, 'medium', 20);
    stats = applyPlayTime(stats, 'hard', 30);
    stats = applyPlayTime(stats, 'daily', 40);
    expect(totalPlaySeconds(stats)).toBe(100);
  });
});
