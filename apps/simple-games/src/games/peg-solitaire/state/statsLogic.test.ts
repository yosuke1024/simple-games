/**
 * The statistics' arithmetic (docs/PEG_SOLITAIRE_RULES.md §10): games begun
 * per board, the fewest pegs left, perfect clears counted once per game —
 * however often the clear is undone and made again — and play time booked
 * only once.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema, type Stats } from '../storage/schemas';
import { applyGameEnd, applyGameStart, applyPlayTime } from './statsLogic';

const fresh = (): Stats => statsSchema.defaultValue();

describe('statistics (§10)', () => {
  it('counts a game begun on its own board only', () => {
    const next = applyGameStart(fresh(), 'triangle');
    expect(next.triangle.played).toBe(1);
    expect(next.english.played).toBe(0);
  });

  it('adds whole unbooked seconds, and nothing for none', () => {
    const base = fresh();
    expect(applyPlayTime(base, 0)).toBe(base);
    expect(applyPlayTime(base, -3)).toBe(base);
    expect(applyPlayTime(base, Number.NaN)).toBe(base);
    expect(applyPlayTime(base, 9.8).totalPlaySeconds).toBe(9);
    expect(base.totalPlaySeconds).toBe(0);
  });

  it('keeps the fewest pegs left, and says when it improved on an earlier record', () => {
    const first = applyGameEnd(fresh(), 'english', { kind: 'stuck', remaining: 6 }, false);
    expect(first.stats.english.best).toBe(6);
    expect(first.previousBest).toBeNull();
    // The first finish is a record, not an improvement on one.
    expect(first.improved).toBe(false);

    const worse = applyGameEnd(first.stats, 'english', { kind: 'stuck', remaining: 9 }, false);
    expect(worse.stats.english.best).toBe(6);
    expect(worse.improved).toBe(false);

    const better = applyGameEnd(worse.stats, 'english', { kind: 'single', remaining: 1 }, false);
    expect(better.stats.english.best).toBe(1);
    expect(better.previousBest).toBe(6);
    expect(better.improved).toBe(true);
    expect(better.stats.english.perfect).toBe(0);
    expect(better.stats.triangle).toEqual(fresh().triangle);
  });

  it('counts a perfect clear, and booking the same finish again cannot lower anything', () => {
    const once = applyGameEnd(fresh(), 'triangle', { kind: 'perfect', remaining: 1 }, false);
    expect(once.stats.triangle).toEqual({ played: 0, best: 1, perfect: 1 });
    expect(once.firstClear).toBe(true);
    // A one-peg finish after Undo books again; the min holds.
    const again = applyGameEnd(once.stats, 'triangle', { kind: 'single', remaining: 1 }, true);
    expect(again.stats.triangle).toEqual({ played: 0, best: 1, perfect: 1 });
    expect(again.improved).toBe(false);
    expect(again.firstClear).toBe(false);
  });

  it('counts a game’s clear once, however often it is undone and made again (§6, §10)', () => {
    const PERFECT = { kind: 'perfect', remaining: 1 } as const;
    let stats = applyGameStart(fresh(), 'triangle');
    const first = applyGameEnd(stats, 'triangle', PERFECT, false);
    stats = first.stats;
    expect(first.firstClear).toBe(true);
    // Undo, then the same clear again — and again, by way of a stuck finish.
    for (const outcome of [PERFECT, { kind: 'stuck', remaining: 3 } as const, PERFECT]) {
      const booking = applyGameEnd(stats, 'triangle', outcome, true);
      expect(booking.firstClear).toBe(false);
      expect(booking.improved).toBe(false);
      stats = booking.stats;
    }
    // One game begun, one clear, one peg the fewest: nothing counted twice.
    expect(stats.triangle).toEqual({ played: 1, best: 1, perfect: 1 });
    // A new game's clear is a clear of its own.
    stats = applyGameStart(stats, 'triangle');
    expect(applyGameEnd(stats, 'triangle', PERFECT, false).stats.triangle).toEqual({
      played: 2,
      best: 1,
      perfect: 2,
    });
  });

  it('lets a better finish after an Undo improve the fewest-left record, like any finish', () => {
    let stats = applyGameStart(fresh(), 'english');
    const stuck = applyGameEnd(stats, 'english', { kind: 'stuck', remaining: 5 }, false);
    expect(stuck.stats.english.best).toBe(5);
    // Undone and played to fewer pegs: the same game, a better finish.
    const better = applyGameEnd(stuck.stats, 'english', { kind: 'stuck', remaining: 3 }, false);
    expect(better.stats.english).toEqual({ played: 1, best: 3, perfect: 0 });
    expect(better.improved).toBe(true);
    // A clear that was undone and then finished worse leaves the record at one.
    stats = applyGameEnd(better.stats, 'english', { kind: 'perfect', remaining: 1 }, false).stats;
    const worse = applyGameEnd(stats, 'english', { kind: 'stuck', remaining: 4 }, true);
    expect(worse.stats.english).toEqual({ played: 1, best: 1, perfect: 1 });
    expect(worse.improved).toBe(false);
  });

  it('never changes the record it was handed', () => {
    const base = fresh();
    applyGameStart(base, 'english');
    applyGameEnd(base, 'english', { kind: 'perfect', remaining: 1 }, false);
    applyPlayTime(base, 5);
    expect(base).toEqual(fresh());
  });

  it('writes only records the schema accepts', () => {
    let stats = fresh();
    stats = applyGameStart(stats, 'english');
    stats = applyGameEnd(stats, 'english', { kind: 'perfect', remaining: 1 }, false).stats;
    stats = applyGameEnd(stats, 'triangle', { kind: 'stuck', remaining: 13 }, false).stats;
    stats = applyPlayTime(stats, 30);
    expect(statsSchema.validate(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
  });
});
