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
import { isTubeComplete } from './engine';
import { generatePuzzle, tubesToString } from './generator';
import { colorsForLevel, levelSeed, MAX_LEVEL } from './levels';
import { solve } from './solver';
import { isValidTubes, tubeCount } from './types';

describe('generatePuzzle', () => {
  it('produces a valid, solvable board with no finished tube at every color count', () => {
    for (let colors = 3; colors <= 9; colors++) {
      const puzzle = generatePuzzle(`gen-${colors}`, colors);
      expect(puzzle.tubes.length).toBe(tubeCount(colors));
      expect(isValidTubes(puzzle.tubes, colors)).toBe(true);
      expect(puzzle.tubes.some(isTubeComplete)).toBe(false);
      expect(solve(puzzle.tubes).status).toBe('solved');
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(tubesToString(generatePuzzle('gen-same', 6).tubes)).toBe(
      tubesToString(generatePuzzle('gen-same', 6).tubes),
    );
    expect(tubesToString(generatePuzzle('gen-a', 6).tubes)).not.toBe(
      tubesToString(generatePuzzle('gen-b', 6).tubes),
    );
  });

  it('generates the band-boundary levels within budget (§5)', () => {
    const boundaries = [1, 30, 31, 120, 121, 300, 301, 500, 501, 700, 701, 850, 851, MAX_LEVEL];
    const start = performance.now();
    for (const level of boundaries) {
      const colors = colorsForLevel(level);
      const puzzle = generatePuzzle(levelSeed(level), colors);
      expect(isValidTubes(puzzle.tubes, colors)).toBe(true);
    }
    // 14 boards, benched at well under 5ms each on a dev machine; a phone is
    // slower, but a whole second for one board would still be a regression.
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('keeps the level table unchanged at every band boundary (§6)', () => {
    const sampled = [1, 30, 31, 120, 121, 300, 301, 500, 501, 700, 701, 850, 851, 999];
    expect(sampled.map(colorsForLevel)).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
  });
});
