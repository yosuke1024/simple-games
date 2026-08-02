/**
 * Generation guarantees (docs/WATER_SORT_RULES.md §5): every board is valid,
 * proven solvable, starts with no finished tube, and is a pure function of
 * its seed — plus the §5 time budget, kept far below anything a phone would
 * notice.
 *
 * The budget assertions are wall-clock and can go red on a busy machine
 * (CLAUDE.md): re-run idle before believing a failure.
 */
import { describe, expect, it } from 'vitest';
import { isTubeComplete, segmentCount } from './engine';
import { generatePuzzle, tubesToString } from './generator';
import { colorsForLevel, levelSeed, MAX_LEVEL, mixForLevel } from './levels';
import { solve } from './solver';
import { isValidTubes, tubeCount } from './types';

describe('generatePuzzle', () => {
  it('produces a valid, solvable board with no finished tube at every color count', () => {
    for (let colors = 3; colors <= 9; colors++) {
      for (const mix of [0, 0.5, 1]) {
        const puzzle = generatePuzzle(`gen-${colors}`, colors, mix);
        expect(puzzle.tubes.length).toBe(tubeCount(colors));
        expect(isValidTubes(puzzle.tubes, colors)).toBe(true);
        expect(puzzle.tubes.some(isTubeComplete)).toBe(false);
        expect(solve(puzzle.tubes).status).toBe('solved');
      }
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(tubesToString(generatePuzzle('gen-same', 6, 0.5).tubes)).toBe(
      tubesToString(generatePuzzle('gen-same', 6, 0.5).tubes),
    );
    expect(tubesToString(generatePuzzle('gen-a', 6, 0.5).tubes)).not.toBe(
      tubesToString(generatePuzzle('gen-b', 6, 0.5).tubes),
    );
  });

  /**
   * The knob a band's levels ride (§6). A higher mix must never return a tidier
   * board than a lower one on the same seed — that ordering is the whole reason
   * the generator ranks its batch, and it is what stops a band from being a row
   * of levels that only differ by chance.
   */
  it('hands out more jumbled boards as the mix rises', () => {
    for (let colors = 3; colors <= 9; colors++) {
      const seed = `gen-mix-${colors}`;
      const segments = [0, 0.25, 0.5, 0.75, 1].map(
        (mix) => segmentCount(generatePuzzle(seed, colors, mix).tubes) - colors,
      );
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i]!).toBeGreaterThanOrEqual(segments[i - 1]!);
      }
      // The floor on pours has to actually move, or the knob is decoration.
      expect(segments[segments.length - 1]!).toBeGreaterThan(segments[0]!);
    }
  });

  it('generates the band-boundary levels within budget (§5)', () => {
    const boundaries = [1, 8, 9, 22, 23, 40, 41, 60, 61, 78, 79, 92, 93, MAX_LEVEL];
    const start = performance.now();
    for (const level of boundaries) {
      const colors = colorsForLevel(level);
      const puzzle = generatePuzzle(levelSeed(level), colors, mixForLevel(level));
      expect(isValidTubes(puzzle.tubes, colors)).toBe(true);
    }
    // 14 boards. Ranking a batch costs a solve per candidate, which benched at
    // roughly 2ms per finished board across the whole level list on a dev
    // machine; a phone is slower, but a second for one board is a regression.
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('keeps the level table unchanged at every band boundary (§6)', () => {
    const sampled = [1, 8, 9, 22, 23, 40, 41, 60, 61, 78, 79, 92, 93, 100];
    expect(sampled.map(colorsForLevel)).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
    // Each band starts at its tidiest and ends at its most jumbled.
    expect(sampled.map(mixForLevel)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });
});
