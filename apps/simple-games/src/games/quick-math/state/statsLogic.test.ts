import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession, type QuickMathSession } from '../game';
import { progressSchema, statsSchema } from '../storage/schemas';
import {
  applyCleared,
  applyClearToProgress,
  applyGameStart,
  applyPlayTime,
  bucketFor,
  clearedDailyCount,
  clearedLevelCount,
} from './statsLogic';

const finished = (session: QuickMathSession, seconds: number, misses = 0): QuickMathSession => ({
  ...session,
  status: 'cleared',
  solvedCount: session.questions.length,
  elapsedSeconds: seconds,
  missCount: misses,
});

describe('which bucket a set counts in (docs/QUICK_MATH_RULES.md §10)', () => {
  it('sorts levels into their band', () => {
    expect(bucketFor(createLevelSession(5))).toBe('addSub');
    expect(bucketFor(createLevelSession(25))).toBe('multiply');
    expect(bucketFor(createLevelSession(45))).toBe('divide');
    expect(bucketFor(createLevelSession(65))).toBe('missing');
    expect(bucketFor(createLevelSession(95))).toBe('mixed');
  });

  it('keeps dailies out of every band', () => {
    // A twenty-question day must not compete with a ten-question level for a
    // band's fastest time.
    expect(bucketFor(createDailySession('2026-08-07'))).toBe('daily');
  });
});

describe('statistics', () => {
  it('counts a started set against its bucket', () => {
    const stats = applyGameStart(statsSchema.defaultValue(), 'multiply');
    expect(stats.multiply.played).toBe(1);
    expect(stats.addSub.played).toBe(0);
    expect(stats.daily.played).toBe(0);
  });

  it('records a finish, its best time and its wrong answers', () => {
    const session = finished(createLevelSession(25), 48, 3);
    const stats = applyCleared(applyGameStart(statsSchema.defaultValue(), 'multiply'), session);
    expect(stats.multiply.cleared).toBe(1);
    expect(stats.multiply.bestSeconds).toBe(48);
    expect(stats.multiply.totalMisses).toBe(3);
  });

  it('keeps only the faster of two finishes', () => {
    let stats = statsSchema.defaultValue();
    stats = applyCleared(stats, finished(createLevelSession(25), 60));
    stats = applyCleared(stats, finished(createLevelSession(25), 41));
    stats = applyCleared(stats, finished(createLevelSession(25), 90));
    expect(stats.multiply.bestSeconds).toBe(41);
    expect(stats.multiply.cleared).toBe(3);
  });

  it('adds wrong answers up rather than keeping a fewest-mistakes record', () => {
    // §4: a "fewest mistakes" best is set by answering slowly.
    let stats = statsSchema.defaultValue();
    stats = applyCleared(stats, finished(createLevelSession(1), 30, 6));
    stats = applyCleared(stats, finished(createLevelSession(1), 30, 1));
    expect(stats.addSub.totalMisses).toBe(7);
  });

  it('books play time separately, so a finish cannot double-count seconds', () => {
    let stats = applyPlayTime(statsSchema.defaultValue(), 'addSub', 20);
    stats = applyCleared(applyPlayTime(stats, 'addSub', 10), finished(createLevelSession(1), 30));
    expect(stats.addSub.totalPlaySeconds).toBe(30);
  });

  it('ignores a non-positive play-time booking', () => {
    const stats = statsSchema.defaultValue();
    expect(applyPlayTime(stats, 'addSub', 0)).toBe(stats);
    expect(applyPlayTime(stats, 'addSub', -5)).toBe(stats);
  });
});

describe('progress (docs/QUICK_MATH_RULES.md §6, §7)', () => {
  it('unlocks the next level and records the time', () => {
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 25),
    );
    expect(outcome.progress.highestUnlocked).toBe(2);
    expect(outcome.progress.bestSeconds['1']).toBe(25);
    expect(outcome.isNewBest).toBe(true);
  });

  it('improves a record on a replay without moving the frontier backwards', () => {
    let progress = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 25),
    ).progress;
    progress = applyClearToProgress(progress, finished(createLevelSession(2), 30)).progress;
    const replay = applyClearToProgress(progress, finished(createLevelSession(1), 18));
    expect(replay.isNewBest).toBe(true);
    expect(replay.progress.bestSeconds['1']).toBe(18);
    expect(replay.progress.highestUnlocked).toBe(3);
  });

  it('leaves the record alone when the replay was slower', () => {
    const first = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createLevelSession(1), 18),
    ).progress;
    const slower = applyClearToProgress(first, finished(createLevelSession(1), 40));
    expect(slower.isNewBest).toBe(false);
    expect(slower.progress.bestSeconds['1']).toBe(18);
  });

  it('never unlocks past the end of the ladder', () => {
    const outcome = applyClearToProgress(
      { ...progressSchema.defaultValue(), highestUnlocked: 100 },
      finished(createLevelSession(100), 70),
    );
    expect(outcome.progress.highestUnlocked).toBe(100);
  });

  it('keeps dailies on their own date and out of the level ladder', () => {
    const outcome = applyClearToProgress(
      progressSchema.defaultValue(),
      finished(createDailySession('2026-08-07'), 95),
    );
    expect(outcome.progress.dailySeconds['2026-08-07']).toBe(95);
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
    // No streak field exists to check — that is the point (§7).
    expect(Object.keys(progress)).toEqual([
      'schemaVersion',
      'highestUnlocked',
      'bestSeconds',
      'dailySeconds',
    ]);
  });
});
