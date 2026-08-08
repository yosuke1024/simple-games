/**
 * The level table of docs/KAKURO_RULES.md §9, pinned so a refactor cannot
 * silently reshuffle 100 puzzles under players' progress.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_SIZE, DAILY_SPEC, dailySeed } from './daily';
import {
  MAX_LEVEL,
  blocksForLevel,
  clampLevel,
  interiorCount,
  levelSeed,
  sizeForLevel,
  specForLevel,
  whiteForLevel,
  whiteRatioForLevel,
} from './levels';
import { MAX_RUN, MIN_RUN } from './types';

/** Where each band starts and ends, and how finely it chops the board (§9). */
const BANDS = [
  { from: 1, to: 20, size: 6, blocks: [12, 8], white: [13, 17] },
  { from: 21, to: 65, size: 8, blocks: [30, 24], white: [19, 25] },
  { from: 66, to: MAX_LEVEL, size: 10, blocks: [56, 44], white: [25, 37] },
] as const;

describe('levels (§9)', () => {
  it('pins the band table', () => {
    for (const band of BANDS) {
      expect(sizeForLevel(band.from), `level ${band.from}`).toBe(band.size);
      expect(sizeForLevel(band.to), `level ${band.to}`).toBe(band.size);
      expect([blocksForLevel(band.from), blocksForLevel(band.to)]).toEqual([...band.blocks]);
      expect([whiteForLevel(band.from), whiteForLevel(band.to)]).toEqual([...band.white]);
    }
  });

  it('hands generation exactly what the table says', () => {
    expect(specForLevel(1)).toEqual({ blocks: 12 });
    expect(specForLevel(MAX_LEVEL)).toEqual({ blocks: 44 });
    expect(interiorCount(6)).toBe(25);
    expect(interiorCount(8)).toBe(49);
    expect(interiorCount(10)).toBe(81);
  });

  /**
   * The dial has to stay inside what a board can hold: a layout cannot have
   * more clue cells than it has interior cells, and it needs enough white ones
   * left for at least one run.
   */
  it('never asks for more clue cells than the interior has', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const interior = interiorCount(sizeForLevel(level));
      expect(blocksForLevel(level), `level ${level}`).toBeGreaterThanOrEqual(0);
      expect(blocksForLevel(level), `level ${level}`).toBeLessThan(interior);
      expect(whiteForLevel(level), `level ${level}`).toBeGreaterThanOrEqual(MIN_RUN);
      // A board can never need a run longer than its interior is wide (§1).
      expect(sizeForLevel(level) - 1).toBeLessThanOrEqual(MAX_RUN);
    }
  });

  /**
   * What a player notices between two levels is whether the board hands them a
   * different number of cells to fill. One level must never move it by more
   * than one — and across a band it must move by several, or the band is a
   * plateau with a hundred seeds in it.
   */
  it('moves by at most one cell per level, and by several across a band', () => {
    for (const band of BANDS) {
      for (let level = band.from; level < band.to; level++) {
        // Harder means more white cells, so the clue-cell count only falls.
        expect(blocksForLevel(level + 1), `level ${level} to ${level + 1}`).toBeLessThanOrEqual(
          blocksForLevel(level),
        );
        expect(blocksForLevel(level) - blocksForLevel(level + 1)).toBeLessThanOrEqual(1);
      }
      expect(
        blocksForLevel(band.from) - blocksForLevel(band.to),
        `band ${band.from}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  /**
   * A size change is the one deliberate step down in the list (§9): the same
   * white share on a larger board is already the harder puzzle, because every
   * run is longer and one deduction has further to travel. Measured as a
   * share, since the counts rise with the board whatever the curve does.
   */
  it('steps the white share down at a size change, and climbs inside every band', () => {
    for (let index = 1; index < BANDS.length; index++) {
      const previous = BANDS[index - 1]!;
      const band = BANDS[index]!;
      expect(band.size).toBeGreaterThan(previous.size);
      // Down from where the band before it ended, and down from where it began.
      expect(whiteRatioForLevel(band.from)).toBeLessThan(whiteRatioForLevel(previous.to));
      expect(whiteRatioForLevel(band.from)).toBeLessThan(whiteRatioForLevel(previous.from));
    }
    for (const band of BANDS) {
      expect(whiteRatioForLevel(band.to)).toBeGreaterThan(whiteRatioForLevel(band.from));
    }
  });

  it('clamps and seeds deterministically', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(101)).toBe(MAX_LEVEL);
    expect(clampLevel(7.9)).toBe(7);
    expect(levelSeed(42)).toBe('kakuro-level-42');
    expect(levelSeed(0)).toBe('kakuro-level-1');
    expect(levelSeed(999)).toBe(`kakuro-level-${MAX_LEVEL}`);
    expect(sizeForLevel(0)).toBe(6);
    expect(sizeForLevel(999)).toBe(10);
  });

  /**
   * The daily sits in the middle of the 8×8 band (§9) — the same board level
   * 43 asks for, which is what "a shape the player already recognises" means
   * in numbers rather than in prose.
   */
  it('puts the daily at the midpoint of the band it borrows', () => {
    expect(DAILY_SIZE).toBe(8);
    expect(DAILY_SPEC).toEqual({ blocks: blocksForLevel(43) });
    expect(sizeForLevel(43)).toBe(DAILY_SIZE);
    expect(dailySeed('2026-08-01')).toBe('kakuro-daily-2026-08-01');
  });
});
