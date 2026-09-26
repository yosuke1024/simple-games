/**
 * The statistics transitions (docs/HIT_AND_BLOW_RULES.md §7): a start counts
 * as played, only a solve books guesses, and the fewest guesses only moves
 * down.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema } from '../storage/schemas';
import { applyGameStart, applyPlayTime, applySolved, averageGuesses } from './statsLogic';

describe('statistics (§7)', () => {
  it('counts a start as played, and nothing else', () => {
    const stats = applyGameStart(statsSchema.defaultValue(), 'normal');
    expect(stats.normal).toEqual({ played: 1, solved: 0, bestGuesses: null, totalGuesses: 0 });
    expect(averageGuesses(stats, 'normal')).toBeNull();
  });

  it('books a solve, its guesses, and the best — which only moves down', () => {
    let stats = statsSchema.defaultValue();
    const first = applySolved(stats, 'easy', 6);
    expect(first).toMatchObject({ previousBest: null, isNewBest: true, best: 6 });
    stats = first.stats;
    const worse = applySolved(stats, 'easy', 8);
    expect(worse).toMatchObject({ previousBest: 6, isNewBest: false, best: 6 });
    stats = worse.stats;
    const better = applySolved(stats, 'easy', 4);
    expect(better).toMatchObject({ previousBest: 6, isNewBest: true, best: 4 });
    stats = better.stats;
    expect(stats.easy).toMatchObject({ solved: 3, bestGuesses: 4, totalGuesses: 18 });
    expect(averageGuesses(stats, 'easy')).toBe(6);
    // The other difficulties are untouched.
    expect(stats.hard).toEqual(statsSchema.defaultValue().hard);
  });

  it('books play time on its own, and ignores nothing to book', () => {
    const stats = statsSchema.defaultValue();
    expect(applyPlayTime(stats, 0)).toBe(stats);
    expect(applyPlayTime(stats, 12).totalPlaySeconds).toBe(12);
  });

  it('never mutates the record it was given', () => {
    const stats = statsSchema.defaultValue();
    applyGameStart(stats, 'easy');
    applySolved(stats, 'easy', 3);
    expect(stats).toEqual(statsSchema.defaultValue());
  });
});
