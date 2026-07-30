/**
 * The level table of docs/NONOGRAM_RULES.md §6, pinned so a refactor cannot
 * silently reshuffle 999 puzzles under players' progress.
 */
import { describe, expect, it } from 'vitest';
import { clampLevel, fillRateForLevel, levelSeed, MAX_LEVEL, sizeForLevel } from './levels';

describe('levels (§6)', () => {
  it('pins the band table', () => {
    expect(sizeForLevel(1)).toBe(5);
    expect(sizeForLevel(120)).toBe(5);
    expect(sizeForLevel(121)).toBe(10);
    expect(sizeForLevel(MAX_LEVEL)).toBe(10);

    expect(fillRateForLevel(1)).toBeCloseTo(0.6);
    expect(fillRateForLevel(120)).toBeCloseTo(0.55);
    expect(fillRateForLevel(121)).toBeCloseTo(0.6);
    expect(fillRateForLevel(500)).toBeCloseTo(0.55);
    expect(fillRateForLevel(501)).toBeCloseTo(0.55);
    expect(fillRateForLevel(MAX_LEVEL)).toBeCloseTo(0.48);
  });

  it('moves gently: neighbouring levels never jump within a band', () => {
    for (const level of [2, 60, 200, 400, 600, 800, 998]) {
      const step = Math.abs(fillRateForLevel(level + 1) - fillRateForLevel(level));
      expect(step).toBeLessThan(0.001);
    }
  });

  it('clamps and seeds deterministically', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(1000)).toBe(MAX_LEVEL);
    expect(levelSeed(42)).toBe('nono-level-42');
  });
});
