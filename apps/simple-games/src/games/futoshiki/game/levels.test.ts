/**
 * The level table of docs/FUTOSHIKI_RULES.md §9, pinned so a refactor cannot
 * silently reshuffle 100 puzzles under players' progress.
 */
import { describe, expect, it } from 'vitest';
import { adjacentPairs } from './generator';
import {
  MAX_LEVEL,
  clampLevel,
  givensForLevel,
  levelSeed,
  signsForLevel,
  sizeForLevel,
  specForLevel,
} from './levels';
import { cellCount } from './types';

/** Where each band starts and ends, and what it hands over (§9). */
const BANDS = [
  { from: 1, to: 15, size: 4, signs: [12, 8], givens: [6, 2] },
  { from: 16, to: 45, size: 5, signs: [18, 13], givens: [8, 3] },
  { from: 46, to: 80, size: 6, signs: [26, 20], givens: [11, 6] },
  { from: 81, to: MAX_LEVEL, size: 7, signs: [34, 28], givens: [14, 10] },
] as const;

describe('levels (§9)', () => {
  it('pins the band table', () => {
    for (const band of BANDS) {
      expect(sizeForLevel(band.from), `level ${band.from}`).toBe(band.size);
      expect(sizeForLevel(band.to), `level ${band.to}`).toBe(band.size);
      expect([signsForLevel(band.from), signsForLevel(band.to)]).toEqual([...band.signs]);
      expect([givensForLevel(band.from), givensForLevel(band.to)]).toEqual([...band.givens]);
    }
  });

  it('hands generation exactly what the table says', () => {
    expect(specForLevel(1)).toEqual({ constraints: 12, givens: 6 });
    expect(specForLevel(MAX_LEVEL)).toEqual({ constraints: 28, givens: 10 });
  });

  it('never asks for more signs than the board has gaps', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(signsForLevel(level), `level ${level}`).toBeLessThanOrEqual(
        adjacentPairs(sizeForLevel(level)).length,
      );
      expect(givensForLevel(level), `level ${level}`).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * What a player notices between two levels is whether the board hands them a
   * different number of signs or digits. One level must never move either by
   * more than one — and across a band both must move by several, or the band
   * is a plateau with a hundred seeds in it.
   */
  it('moves by at most one per level, and by several across a band', () => {
    for (const band of BANDS) {
      for (let level = band.from; level < band.to; level++) {
        expect(
          signsForLevel(level + 1),
          `signs, level ${level} to ${level + 1}`,
        ).toBeLessThanOrEqual(signsForLevel(level));
        expect(
          givensForLevel(level + 1),
          `givens, level ${level} to ${level + 1}`,
        ).toBeLessThanOrEqual(givensForLevel(level));
        expect(signsForLevel(level) - signsForLevel(level + 1)).toBeLessThanOrEqual(1);
        expect(givensForLevel(level) - givensForLevel(level + 1)).toBeLessThanOrEqual(1);
      }
      expect(
        signsForLevel(band.from) - signsForLevel(band.to),
        `band ${band.from}`,
      ).toBeGreaterThanOrEqual(4);
      expect(
        givensForLevel(band.from) - givensForLevel(band.to),
        `band ${band.from}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  /**
   * A size change is the one deliberate step up in the list (§9). Both dials
   * step back up with it, because the same share of a larger board is already
   * the harder puzzle — but never back above where the previous band started,
   * or the climb would have been for nothing. Measured as shares, since the
   * counts rise with the board whatever the curve does.
   */
  it('steps both dials up at a size change, but never past the band before it', () => {
    const givensShare = (level: number): number =>
      givensForLevel(level) / cellCount(sizeForLevel(level));
    const signsShare = (level: number): number =>
      signsForLevel(level) / adjacentPairs(sizeForLevel(level)).length;

    for (let i = 1; i < BANDS.length; i++) {
      const previous = BANDS[i - 1]!;
      const band = BANDS[i]!;
      expect(band.size).toBeGreaterThan(previous.size);
      for (const share of [givensShare, signsShare]) {
        expect(share(band.from)).toBeGreaterThan(share(previous.to));
        expect(share(band.from)).toBeLessThan(share(previous.from));
      }
    }
  });

  it('clamps and seeds deterministically', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(101)).toBe(MAX_LEVEL);
    expect(clampLevel(7.9)).toBe(7);
    expect(levelSeed(42)).toBe('futoshiki-level-42');
    expect(levelSeed(0)).toBe('futoshiki-level-1');
    expect(levelSeed(999)).toBe(`futoshiki-level-${MAX_LEVEL}`);
    expect(sizeForLevel(0)).toBe(4);
    expect(sizeForLevel(999)).toBe(7);
  });
});
