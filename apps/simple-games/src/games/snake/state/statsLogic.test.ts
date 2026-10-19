/**
 * The statistics transitions of docs/SNAKE_RULES.md §10: per speed, and
 * nothing a streak could be built from.
 */
import { describe, expect, it } from 'vitest';
import { MAX_SCORE } from '../game';
import { statsSchema } from '../storage/schemas';
import { applyPlayTime, applyRunEnd, applyRunStart, previousBestScore } from './statsLogic';

describe('per-speed statistics (§10)', () => {
  it('counts a run once at its own speed and leaves the others alone', () => {
    const stats = applyRunStart(statsSchema.defaultValue(), 'fast');
    expect(stats.fast.played).toBe(1);
    expect(stats.normal.played).toBe(0);
    expect(stats.slow.played).toBe(0);
  });

  it('books running seconds, and ignores nothing-to-book', () => {
    const base = statsSchema.defaultValue();
    expect(applyPlayTime(base, 'slow', 0)).toBe(base);
    expect(applyPlayTime(base, 'slow', -3)).toBe(base);
    expect(applyPlayTime(base, 'slow', 42).slow.totalPlaySeconds).toBe(42);
  });

  it('a best of zero is no record yet', () => {
    const base = statsSchema.defaultValue();
    expect(previousBestScore(base, 'normal')).toBeNull();
    const after = applyRunEnd(base, 'normal', 7, false).stats;
    expect(previousBestScore(after, 'normal')).toBe(7);
    expect(previousBestScore(after, 'fast')).toBeNull();
  });

  it('moves the best only upwards, and says when it did', () => {
    const first = applyRunEnd(statsSchema.defaultValue(), 'normal', 12, false);
    expect(first.isNewBestScore).toBe(true);
    expect(first.bestScore).toBe(12);
    const lower = applyRunEnd(first.stats, 'normal', 5, false);
    expect(lower.isNewBestScore).toBe(false);
    expect(lower.bestScore).toBe(12);
    expect(lower.stats.normal.bestScore).toBe(12);
    const equal = applyRunEnd(first.stats, 'normal', 12, false);
    expect(equal.isNewBestScore).toBe(false);
  });

  it('counts only a full board as a clear, and the result is a record the schema keeps', () => {
    let stats = applyRunStart(statsSchema.defaultValue(), 'slow');
    stats = applyRunEnd(stats, 'slow', MAX_SCORE, true).stats;
    expect(stats.slow.cleared).toBe(1);
    expect(stats.slow.bestScore).toBe(MAX_SCORE);
    stats = applyRunStart(stats, 'slow');
    stats = applyRunEnd(stats, 'slow', 30, false).stats;
    expect(stats.slow.cleared).toBe(1);
    expect(statsSchema.validate(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
  });

  it('keeps no field a streak could be read from', () => {
    const fields = Object.keys(statsSchema.defaultValue().normal).sort();
    expect(fields).toEqual(['bestScore', 'cleared', 'played', 'totalPlaySeconds']);
  });
});
