import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession, type RecallSession } from '../game';
import { progressSchema, statsSchema } from '../storage/schemas';
import {
  applyCleared,
  applyClearToProgress,
  applyGameStart,
  applyPlayTime,
  clearedDailyCount,
  clearedLevelCount,
} from './statsLogic';

const finished = (session: RecallSession, seconds: number): RecallSession => ({
  ...session,
  status: 'cleared',
  revealedCount: session.tileCount,
  elapsedSeconds: seconds,
});

describe('statistics (docs/NUMBER_RECALL_RULES.md §11)', () => {
  it('counts a started round against its board size', () => {
    const stats = applyGameStart(statsSchema.defaultValue(), 4);
    expect(stats.size4.played).toBe(1);
    expect(stats.size3.played).toBe(0);
  });

  it('counts a retry as a round of its own (§8)', () => {
    // A retry is a new layout, so it is a new question and a new round.
    let stats = statsSchema.defaultValue();
    stats = applyGameStart(stats, 3);
    stats = applyGameStart(stats, 3);
    expect(stats.size3.played).toBe(2);
    expect(stats.size3.cleared).toBe(0);
  });

  it('records a finish and its best time', () => {
    const stats = applyCleared(
      applyGameStart(statsSchema.defaultValue(), 3),
      finished(createLevelSession(1), 9),
    );
    expect(stats.size3.cleared).toBe(1);
    expect(stats.size3.bestSeconds).toBe(9);
  });

  it('counts a first-attempt finish, and does not count a later one', () => {
    let stats = statsSchema.defaultValue();
    stats = applyCleared(stats, finished(createLevelSession(1, 0), 9));
    expect(stats.size3.firstTryClears).toBe(1);

    stats = applyCleared(stats, finished(createLevelSession(1, 2), 7));
    expect(stats.size3.cleared).toBe(2);
    // Still one: the second finish took three tries to get to.
    expect(stats.size3.firstTryClears).toBe(1);
  });

  it('keeps only the faster of two finishes', () => {
    let stats = statsSchema.defaultValue();
    stats = applyCleared(stats, finished(createLevelSession(1), 20));
    stats = applyCleared(stats, finished(createLevelSession(1), 11));
    stats = applyCleared(stats, finished(createLevelSession(1), 30));
    expect(stats.size3.bestSeconds).toBe(11);
  });

  it('books play time separately, so a finish cannot double-count seconds', () => {
    let stats = applyPlayTime(statsSchema.defaultValue(), 3, 6);
    stats = applyCleared(applyPlayTime(stats, 3, 3), finished(createLevelSession(1), 9));
    expect(stats.size3.totalPlaySeconds).toBe(9);
  });

  it('ignores a non-positive play-time booking', () => {
    const stats = statsSchema.defaultValue();
    expect(applyPlayTime(stats, 3, 0)).toBe(stats);
    expect(applyPlayTime(stats, 3, -5)).toBe(stats);
  });
});

describe('progress (docs/NUMBER_RECALL_RULES.md §7, §9)', () => {
  it('unlocks the next level and records the time', () => {
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 10),
    );
    expect(outcome.progress.highestUnlocked).toBe(2);
    expect(outcome.progress.bestSeconds['1']).toBe(10);
    expect(outcome.isNewBest).toBe(true);
  });

  it('records the same level whichever attempt cleared it (§8)', () => {
    // The layout differs per attempt, but the level is what the record is
    // against — the difficulty is identical.
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1, 4), 10),
    );
    expect(outcome.progress.bestSeconds['1']).toBe(10);
    expect(outcome.progress.highestUnlocked).toBe(2);
  });

  it('improves a record on a replay without moving the frontier backwards', () => {
    let progress = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 10),
    ).progress;
    progress = applyClearToProgress(progress, finished(createLevelSession(2), 20)).progress;
    const replay = applyClearToProgress(progress, finished(createLevelSession(1), 6));
    expect(replay.isNewBest).toBe(true);
    expect(replay.progress.bestSeconds['1']).toBe(6);
    expect(replay.progress.highestUnlocked).toBe(3);
  });

  it('leaves the record alone when the replay was slower', () => {
    const first = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 6),
    ).progress;
    const slower = applyClearToProgress(first, finished(createLevelSession(1), 25));
    expect(slower.isNewBest).toBe(false);
    expect(slower.progress.bestSeconds['1']).toBe(6);
  });

  it('never unlocks past the end of the ladder', () => {
    const outcome = applyClearToProgress(
      { ...progressSchema.defaultValue(), highestUnlocked: 100 },
      finished(createLevelSession(100), 40),
    );
    expect(outcome.progress.highestUnlocked).toBe(100);
  });

  it('keeps dailies on their own date and out of the level ladder', () => {
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createDailySession('2026-08-07'), 28),
    );
    expect(outcome.progress.dailySeconds['2026-08-07']).toBe(28);
    expect(outcome.progress.bestSeconds).toEqual({});
    expect(outcome.progress.highestUnlocked).toBe(1);
  });

  it('counts finished levels and dailies without counting a run of days', () => {
    let progress = progressSchema.defaultValue();
    progress = applyClearToProgress(progress, finished(createLevelSession(1), 5)).progress;
    progress = applyClearToProgress(progress, finished(createLevelSession(2), 5)).progress;
    progress = applyClearToProgress(
      progress,
      finished(createDailySession('2026-08-07'), 5),
    ).progress;
    expect(clearedLevelCount(progress)).toBe(2);
    expect(clearedDailyCount(progress)).toBe(1);
    // No streak field exists to check — that is the point (§9).
    expect(Object.keys(progress)).toEqual([
      'schemaVersion',
      'highestUnlocked',
      'bestSeconds',
      'dailySeconds',
    ]);
  });
});
