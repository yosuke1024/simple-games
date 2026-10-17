/**
 * The statistics transitions (§10): a start counts once, play time is booked
 * as it accrues and never twice, a clear moves the best only downwards, and
 * a daily also records its day — a set of dates, never a streak.
 */
import { describe, expect, it } from 'vitest';
import { createDailySession, createDifficultySession } from '../game';
import { statsSchema } from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  dailiesCleared,
  previousBestFor,
  totalPlaySeconds,
} from './statsLogic';

const easy = createDifficultySession('easy', 'loop-puzzle-easy-stats');
const daily = createDailySession('2026-10-17');

describe('statistics transitions (§10)', () => {
  it('counts a start, and books only positive play time', () => {
    const started = applyGameStart(statsSchema.defaultValue(), 'easy');
    expect(started.easy.played).toBe(1);
    expect(applyPlayTime(started, 'easy', 0)).toBe(started);
    expect(applyPlayTime(started, 'easy', 12).easy.totalPlaySeconds).toBe(12);
  });

  it('keeps the fastest clear per difficulty, and says when it moved', () => {
    const first = applySolved(statsSchema.defaultValue(), { ...easy, elapsedSeconds: 80 });
    expect(first.isNewBest).toBe(true);
    expect(first.stats.easy).toMatchObject({ solved: 1, bestSeconds: 80 });
    const slower = applySolved(first.stats, { ...easy, elapsedSeconds: 95 });
    expect(slower.isNewBest).toBe(false);
    expect(slower.bestSeconds).toBe(80);
    expect(previousBestFor(slower.stats, easy)).toBe(80);
  });

  it('books a daily into medium and onto its day — a count of days, no streak', () => {
    const outcome = applySolved(statsSchema.defaultValue(), { ...daily, elapsedSeconds: 61 });
    expect(outcome.stats.medium.solved).toBe(1);
    expect(outcome.stats.dailyTimes).toEqual({ '2026-10-17': 61 });
    expect(dailiesCleared(outcome.stats)).toBe(1);
    expect(previousBestFor(outcome.stats, daily)).toBe(61);
    expect(Object.keys(outcome.stats)).not.toContain('streak');
  });

  it('adds the three difficulties for the play time of every board', () => {
    let stats = applyPlayTime(statsSchema.defaultValue(), 'easy', 10);
    stats = applyPlayTime(stats, 'medium', 20);
    stats = applyPlayTime(stats, 'hard', 30);
    expect(totalPlaySeconds(stats)).toBe(60);
  });
});
