/**
 * The statistics transitions (docs/MAKE_THE_TARGET_RULES.md §9): per
 * difficulty, the daily kept apart, the total a sum of the buckets, no streak
 * — and the two rules that live only here: a retry of a solved problem moves
 * no record, and a daily is booked under its problem's date.
 */
import { describe, expect, it } from 'vitest';
import { restartSession, undo, withElapsed } from '../game';
import { toPersisted, toSession } from '../storage/gamePersistence';
import { gameSchema, statsSchema } from '../storage/schemas';
import { dailyGame, freeGame, MISS, play, SAVED_AT, SOLVE } from '../ui/test-helpers';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  bucketOf,
  dailiesCleared,
  totalPlaySeconds,
} from './statsLogic';

const empty = () => statsSchema.defaultValue();
/** A Free Play clear in `seconds`. */
const clear = (seconds: number, difficulty: 'easy' | 'medium' = 'easy') =>
  play(withElapsed(freeGame(difficulty), seconds), ...SOLVE);
/** A clear of a retry of a solved problem, in `seconds`. */
const repeatClear = (seconds: number) =>
  play(withElapsed(restartSession(clear(90))!, seconds), ...SOLVE);

describe('statistics (§9)', () => {
  it('books a daily into its own bucket, never into medium', () => {
    expect(bucketOf(freeGame('medium'))).toBe('medium');
    expect(bucketOf(dailyGame('2026-10-21'))).toBe('daily');
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
    expect(applyPlayTime(before, 'hard', Number.NaN)).toBe(before);
  });

  it('a first clear sets the record, with nothing to compare against', () => {
    const first = applySolved(empty(), clear(90));
    expect(first.stats.easy).toMatchObject({ solved: 1, bestSeconds: 90 });
    expect(first.comparison).toEqual({ previousSeconds: null, isNewBest: true, bestSeconds: 90 });
  });

  it('a faster clear moves the record; an equal or slower one does not', () => {
    const first = applySolved(empty(), clear(90)).stats;
    const faster = applySolved(first, clear(60));
    expect(faster.comparison).toEqual({ previousSeconds: 90, isNewBest: true, bestSeconds: 60 });
    expect(faster.stats.easy.bestSeconds).toBe(60);

    // A tie is not a new record (strictly faster only).
    const tie = applySolved(faster.stats, clear(60));
    expect(tie.comparison).toEqual({ previousSeconds: 60, isNewBest: false, bestSeconds: 60 });
    const slower = applySolved(tie.stats, clear(78));
    expect(slower.comparison).toEqual({ previousSeconds: 60, isNewBest: false, bestSeconds: 60 });
    expect(slower.stats.easy).toMatchObject({ solved: 4, bestSeconds: 60 });
  });

  it('a retry of a solved problem counts as solved and moves no record, however fast', () => {
    const before = applySolved(empty(), clear(90)).stats;
    const retry = repeatClear(5);
    expect(retry.repeat).toBe(true);
    const after = applySolved(before, retry);
    expect(after.comparison).toBeNull();
    expect(after.stats.easy).toMatchObject({ solved: 2, bestSeconds: 90 });
    // With no record at all it still sets none.
    expect(applySolved(empty(), retry).stats.easy.bestSeconds).toBeNull();
  });

  it('keeps a retry a retry through a missed board, an Undo and a save (§9, §10)', () => {
    const missed = play(restartSession(clear(90))!, ...MISS);
    const again = restartSession(missed)!;
    expect(again.repeat).toBe(true);
    const resumed = toSession(gameSchema.validate(toPersisted(again, SAVED_AT)))!;
    expect(resumed.repeat).toBe(true);
    const cleared = play(withElapsed(resumed, 3), ...SOLVE);
    expect(applySolved(applySolved(empty(), clear(90)).stats, cleared).comparison).toBeNull();
  });

  it('a retry of a problem never solved is not a repeat, and can set the record', () => {
    const missed = play(freeGame(), ...MISS);
    expect(undo(missed)?.status).toBe('playing');
    const retry = restartSession(missed)!;
    expect(retry.repeat).toBe(false);
    const cleared = play(withElapsed(retry, 40), ...SOLVE);
    const first = applySolved(applySolved(empty(), clear(90)).stats, cleared);
    expect(first.comparison?.isNewBest).toBe(true);
    expect(first.stats.easy.bestSeconds).toBe(40);
  });

  it('records a daily under its problem’s date, once: a later clear that day moves nothing', () => {
    const daily = play(withElapsed(dailyGame('2026-10-21'), 200), ...SOLVE);
    const first = applySolved(empty(), daily);
    expect(first.stats.dailyTimes).toEqual({ '2026-10-21': 200 });
    expect(first.comparison).toEqual({ previousSeconds: null, isNewBest: true, bestSeconds: 200 });
    expect(first.stats.medium.solved).toBe(0);

    const again = applySolved(
      first.stats,
      play(withElapsed(dailyGame('2026-10-21'), 50), ...SOLVE),
    );
    expect(again.comparison).toBeNull();
    expect(again.stats.dailyTimes['2026-10-21']).toBe(200);

    // Finished after midnight, it is still the problem's day that is booked.
    const nextDay = applySolved(
      again.stats,
      play(withElapsed(dailyGame('2026-10-22'), 80), ...SOLVE),
    );
    expect(nextDay.stats.dailyTimes).toEqual({ '2026-10-21': 200, '2026-10-22': 80 });
    expect(dailiesCleared(nextDay.stats)).toBe(2);
    expect(Object.keys(nextDay.stats)).not.toContain('streak');
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
