import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession, type SchulteSession } from '../game';
import { progressSchema, statsSchema } from '../storage/schemas';
import {
  applyMisses,
  applyCleared,
  applyClearToProgress,
  applyGameStart,
  applyPlayTime,
  clearedDailyCount,
  clearedLevelCount,
} from './statsLogic';

const finished = (session: SchulteSession, seconds: number, misses: number): SchulteSession => ({
  ...session,
  status: 'cleared',
  tappedCount: session.values.length,
  elapsedSeconds: seconds,
  missCount: misses,
});

describe('statistics (docs/SCHULTE_TABLE_RULES.md §10)', () => {
  it('counts a started round against its board size', () => {
    const stats = applyGameStart(statsSchema.defaultValue(), 4);
    expect(stats.size4.played).toBe(1);
    expect(stats.size3.played).toBe(0);
    expect(stats.size5.played).toBe(0);
  });

  it('records a finish and its best time', () => {
    const session = finished(createLevelSession(1), 12, 3);
    const stats = applyCleared(applyGameStart(statsSchema.defaultValue(), 3), session);
    expect(stats.size3.cleared).toBe(1);
    expect(stats.size3.bestSeconds).toBe(12);
    // Not the wrong taps: those are booked as they happen, by `applyMisses`,
    // because a round that is killed while backgrounded never reaches a finish.
    expect(stats.size3.totalMisses).toBe(0);
  });

  it('keeps only the faster of two finishes', () => {
    let stats = statsSchema.defaultValue();
    stats = applyCleared(stats, finished(createLevelSession(1), 20, 0));
    stats = applyCleared(stats, finished(createLevelSession(1), 14, 0));
    stats = applyCleared(stats, finished(createLevelSession(1), 31, 0));
    expect(stats.size3.bestSeconds).toBe(14);
    expect(stats.size3.cleared).toBe(3);
  });

  it('adds wrong taps up rather than keeping a fewest-misses record', () => {
    // §9: a "fewest misses" best is set by tapping slowly, so the total is the
    // only shape this number is allowed to take.
    let stats = statsSchema.defaultValue();
    stats = applyMisses(stats, 3, 4);
    stats = applyMisses(stats, 3, 1);
    expect(stats.size3.totalMisses).toBe(5);
  });

  it('books wrong taps separately, so a finish cannot double-count them', () => {
    // The mirror of the play-time rule below: both totals accumulate during
    // the round, and the finish adds neither of them again.
    let stats = applyMisses(statsSchema.defaultValue(), 3, 2);
    stats = applyCleared(applyMisses(stats, 3, 1), finished(createLevelSession(1), 12, 3));
    expect(stats.size3.totalMisses).toBe(3);
  });

  it('ignores a non-positive miss booking', () => {
    const stats = statsSchema.defaultValue();
    expect(applyMisses(stats, 3, 0)).toBe(stats);
    expect(applyMisses(stats, 3, -2)).toBe(stats);
  });

  it('books play time separately, so a finish cannot double-count seconds', () => {
    let stats = applyPlayTime(statsSchema.defaultValue(), 3, 9);
    stats = applyCleared(applyPlayTime(stats, 3, 3), finished(createLevelSession(1), 12, 0));
    expect(stats.size3.totalPlaySeconds).toBe(12);
  });

  it('ignores a non-positive play-time booking', () => {
    const stats = statsSchema.defaultValue();
    expect(applyPlayTime(stats, 3, 0)).toBe(stats);
    expect(applyPlayTime(stats, 3, -5)).toBe(stats);
  });

  it('keeps the wrong taps of a round the player walked away from', () => {
    // §11: an abandoned round counts as played but never as cleared — and its
    // wrong taps happened all the same.
    const stats = applyMisses(applyGameStart(statsSchema.defaultValue(), 5), 5, 2);
    expect(stats.size5.played).toBe(1);
    expect(stats.size5.cleared).toBe(0);
    expect(stats.size5.totalMisses).toBe(2);
  });
});

describe('progress (docs/SCHULTE_TABLE_RULES.md §7, §8)', () => {
  it('unlocks the next level and records the time', () => {
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 11, 0),
    );
    expect(outcome.progress.highestUnlocked).toBe(2);
    expect(outcome.progress.bestSeconds['1']).toBe(11);
    expect(outcome.isNewBest).toBe(true);
    expect(outcome.bestSeconds).toBe(11);
  });

  it('improves a record on a replay without moving the frontier backwards', () => {
    let progress = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 11, 0),
    ).progress;
    progress = applyClearToProgress(progress, finished(createLevelSession(2), 20, 0)).progress;
    expect(progress.highestUnlocked).toBe(3);

    const replay = applyClearToProgress(progress, finished(createLevelSession(1), 8, 0));
    expect(replay.isNewBest).toBe(true);
    expect(replay.progress.bestSeconds['1']).toBe(8);
    expect(replay.progress.highestUnlocked).toBe(3);
  });

  it('leaves the record alone when the replay was slower', () => {
    const first = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 8, 0),
    ).progress;
    const slower = applyClearToProgress(first, finished(createLevelSession(1), 30, 0));
    expect(slower.isNewBest).toBe(false);
    expect(slower.bestSeconds).toBe(8);
    expect(slower.progress.bestSeconds['1']).toBe(8);
  });

  it('never unlocks past the end of the ladder', () => {
    const outcome = applyClearToProgress(
      { ...progressSchema.defaultValue(), highestUnlocked: 100 },
      finished(createLevelSession(100), 40, 0),
    );
    expect(outcome.progress.highestUnlocked).toBe(100);
  });

  it('keeps dailies on their own date and out of the level ladder', () => {
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createDailySession('2026-08-07'), 33, 1),
    );
    expect(outcome.progress.dailySeconds['2026-08-07']).toBe(33);
    expect(outcome.progress.bestSeconds).toEqual({});
    expect(outcome.progress.highestUnlocked).toBe(1);
  });

  it('counts finished levels and dailies without counting a run of days', () => {
    let progress = progressSchema.defaultValue();
    progress = applyClearToProgress(progress, finished(createLevelSession(1), 5, 0)).progress;
    progress = applyClearToProgress(progress, finished(createLevelSession(2), 5, 0)).progress;
    progress = applyClearToProgress(
      progress,
      finished(createDailySession('2026-08-07'), 5, 0),
    ).progress;
    expect(clearedLevelCount(progress)).toBe(2);
    expect(clearedDailyCount(progress)).toBe(1);
    // No streak field exists to check — that is the point (§8).
    expect(Object.keys(progress)).toEqual([
      'schemaVersion',
      'highestUnlocked',
      'bestSeconds',
      'dailySeconds',
    ]);
  });
});
