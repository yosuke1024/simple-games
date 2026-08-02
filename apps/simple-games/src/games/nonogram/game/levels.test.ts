/**
 * The level table of docs/NONOGRAM_RULES.md §6, pinned so a refactor cannot
 * silently reshuffle 100 puzzles under players' progress.
 */
import { describe, expect, it } from 'vitest';
import { cellCount } from './types';
import { clampLevel, fillRateForLevel, levelSeed, MAX_LEVEL, sizeForLevel } from './levels';

describe('levels (§6)', () => {
  it('pins the band table', () => {
    expect(sizeForLevel(1)).toBe(5);
    expect(sizeForLevel(20)).toBe(5);
    expect(sizeForLevel(21)).toBe(10);
    expect(sizeForLevel(MAX_LEVEL)).toBe(10);

    expect(fillRateForLevel(1)).toBeCloseTo(0.6);
    expect(fillRateForLevel(20)).toBeCloseTo(0.55);
    expect(fillRateForLevel(21)).toBeCloseTo(0.6);
    expect(fillRateForLevel(60)).toBeCloseTo(0.54);
    expect(fillRateForLevel(61)).toBeCloseTo(0.54);
    expect(fillRateForLevel(MAX_LEVEL)).toBeCloseTo(0.48);
  });

  /**
   * The reason the curve is measured in cells rather than in fill rate: a rate
   * step means nothing on its own, and the old assertion (a bare "< 0.001")
   * silently passed a curve so slow that hundreds of levels in a row drew the
   * same board. What a player can actually notice is whether the next level
   * asks them to fill a different number of squares. One level must never move
   * that by a whole cell — and across a band it must move by several, or the
   * band is a plateau.
   */
  it('moves by less than a cell per level, and by several across a band', () => {
    const expectedCells = (level: number): number =>
      fillRateForLevel(level) * cellCount(sizeForLevel(level));

    for (let level = 1; level < MAX_LEVEL; level++) {
      // Skip the two size changes: those are the deliberate steps up (§6).
      if (sizeForLevel(level + 1) !== sizeForLevel(level)) continue;
      const step = Math.abs(expectedCells(level + 1) - expectedCells(level));
      expect(step, `level ${level} to ${level + 1}`).toBeLessThan(1);
    }

    for (const [from, to] of [
      [1, 20],
      [21, 60],
      [61, MAX_LEVEL],
    ] as const) {
      const span = expectedCells(from) - expectedCells(to);
      expect(span, `band ${from}-${to}`).toBeGreaterThan(1);
    }
  });

  it('clamps and seeds deterministically', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(101)).toBe(MAX_LEVEL);
    expect(levelSeed(42)).toBe('nono-level-42');
  });
});
