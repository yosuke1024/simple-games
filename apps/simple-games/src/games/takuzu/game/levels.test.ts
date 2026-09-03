/**
 * The level table of docs/TAKUZU_RULES.md §7, pinned so a refactor cannot
 * silently reshuffle 100 puzzles under players' progress.
 */
import { describe, expect, it } from 'vitest';
import {
  clampLevel,
  FREE_TIER_LEVEL,
  FREE_TIERS,
  freeTierForSize,
  givensRatioForLevel,
  levelSeed,
  MAX_LEVEL,
  sizeForLevel,
} from './levels';
import { cellCount } from './types';

/** Where each band starts and ends (§7) — the one place these numbers live. */
const BOUNDARIES = [
  [1, 20, 6],
  [21, 60, 8],
  [61, MAX_LEVEL, 10],
] as const;

describe('levels (§7)', () => {
  it('pins the band table', () => {
    for (const [from, to, size] of BOUNDARIES) {
      expect(sizeForLevel(from), `level ${from}`).toBe(size);
      expect(sizeForLevel(to), `level ${to}`).toBe(size);
    }

    expect(givensRatioForLevel(1)).toBeCloseTo(0.5);
    expect(givensRatioForLevel(20)).toBeCloseTo(0.31);
    expect(givensRatioForLevel(21)).toBeCloseTo(0.45);
    expect(givensRatioForLevel(60)).toBeCloseTo(0.28);
    expect(givensRatioForLevel(61)).toBeCloseTo(0.4);
    expect(givensRatioForLevel(MAX_LEVEL)).toBeCloseTo(0.27);
  });

  it('hands over fewer cells the further up a band a level sits', () => {
    for (const [from, to] of BOUNDARIES) {
      for (let level = from; level < to; level++) {
        expect(givensRatioForLevel(level + 1), `level ${level} to ${level + 1}`).toBeLessThan(
          givensRatioForLevel(level),
        );
      }
    }
  });

  /**
   * The curve is measured in cells rather than in ratio, for Nonogram §6's
   * reason: a ratio step means nothing on its own, and a threshold written in
   * ratios can silently pass a curve so slow that dozens of levels in a row
   * draw the same board. What a player notices is whether the next level hands
   * them a different number of digits. One level must never move that by a
   * whole cell — and across a band it must move by several, or the band is a
   * plateau.
   */
  it('moves by less than a cell per level, and by several across a band', () => {
    const givens = (level: number): number =>
      givensRatioForLevel(level) * cellCount(sizeForLevel(level));

    for (const [from, to] of BOUNDARIES) {
      for (let level = from; level < to; level++) {
        const step = Math.abs(givens(level + 1) - givens(level));
        expect(step, `level ${level} to ${level + 1}`).toBeLessThan(1);
      }
      expect(givens(from) - givens(to), `band ${from}-${to}`).toBeGreaterThan(1);
    }
  });

  /**
   * A size change is the one deliberate step up in the list (§7). The ratio
   * steps back up with it, because the same ratio on a larger board is already
   * the harder puzzle — but never back above where the previous band started,
   * or the climb would have been for nothing.
   */
  it('steps the ratio up at a size change, but never past the band before it', () => {
    for (let i = 1; i < BOUNDARIES.length; i++) {
      const [previousFrom, previousTo] = BOUNDARIES[i - 1]!;
      const [from] = BOUNDARIES[i]!;
      expect(sizeForLevel(from)).toBeGreaterThan(sizeForLevel(previousTo));
      expect(givensRatioForLevel(from)).toBeGreaterThan(givensRatioForLevel(previousTo));
      expect(givensRatioForLevel(from)).toBeLessThan(givensRatioForLevel(previousFrom));
    }
  });

  it('clamps and seeds deterministically', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(101)).toBe(MAX_LEVEL);
    expect(clampLevel(7.9)).toBe(7);
    expect(levelSeed(42)).toBe('takuzu-level-42');
    expect(levelSeed(0)).toBe('takuzu-level-1');
    expect(levelSeed(999)).toBe(`takuzu-level-${MAX_LEVEL}`);
  });
});

describe('free play tiers (§7「フリープレイ」)', () => {
  it('borrows one level from inside each band', () => {
    expect(FREE_TIER_LEVEL).toEqual({ easy: 10, medium: 50, hard: 95 });
    expect(FREE_TIERS.map((tier) => sizeForLevel(FREE_TIER_LEVEL[tier]))).toEqual([6, 8, 10]);
  });

  /**
   * A saved free board carries its size and nothing else about its tier, so
   * the size has to name the tier on its own — which holds exactly as long as
   * the three representative levels sit in three different bands.
   */
  it('reads the tier back from the size', () => {
    for (const tier of FREE_TIERS) {
      expect(freeTierForSize(sizeForLevel(FREE_TIER_LEVEL[tier]))).toBe(tier);
    }
  });
});
