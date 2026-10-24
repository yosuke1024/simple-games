/**
 * The bundled fallback boards of docs/LOOP_PUZZLE_RULES.md §8 step 6, proven
 * rather than trusted: each one is what this generator makes from its seed,
 * has exactly one loop by both the search and the independent oracle, and
 * grades to its own tier.
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED_BOARDS } from './bundled';
import { isSolved } from './engine';
import { TIERS, bundledPuzzle, generatePuzzle, meetsTier } from './generator';
import { decodeClues, encodeClues } from './serialize';
import { countSolutions, gradeOf, solverWork } from './solver';
import { oracleCount } from './test-helpers';
import { DIFFICULTIES, PRESETS } from './types';

describe('bundled boards (§8, step 6)', () => {
  for (const difficulty of DIFFICULTIES) {
    const preset = PRESETS[difficulty];
    it(`${difficulty}: every board comes from its seed, has one loop, and meets its tier`, () => {
      expect(BUNDLED_BOARDS[difficulty].length).toBeGreaterThanOrEqual(4);
      for (const board of BUNDLED_BOARDS[difficulty]) {
        // Provenance: the generator still makes exactly this board from this seed.
        const made = generatePuzzle(board.seed, difficulty);
        expect(made.fallback, board.seed).toBe(false);
        expect(encodeClues(made.clues), board.seed).toBe(board.clues);

        const clues = decodeClues(board.clues, preset.width, preset.height)!;
        const layout = { ...preset, clues };
        const search = countSolutions(layout);
        expect(search, board.seed).toMatchObject({ count: 1, complete: true });
        const oracle = oracleCount(layout);
        expect(oracle.count, board.seed).toBe(1);
        expect(oracle.complete).toBe(true);
        expect(oracle.solution).toEqual(search.solution);
        expect(isSolved(layout, search.solution!)).toBe(true);

        const graded = gradeOf(layout)!;
        expect(graded.grade, board.seed).toBe(TIERS[difficulty].level);
        expect(
          meetsTier({ layout, solution: search.solution!, ...graded }, TIERS[difficulty]),
          board.seed,
        ).toBe(true);
      }
    });
  }

  /**
   * The fallback's own cost is part of the generation bound (§8): it runs
   * after the work budget is spent, so it must stay small. Measured at most
   * 3,448 (Hard); the gate leaves room and no more.
   */
  it('checks a bundled board on the way out for a few thousand work at most', () => {
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<string>();
      for (let i = 0; seen.size < BUNDLED_BOARDS[difficulty].length && i < 400; i++) {
        const before = solverWork.read();
        const candidate = bundledPuzzle(`cost-${i}`, difficulty);
        const work = solverWork.read() - before;
        seen.add(encodeClues(candidate.layout.clues));
        expect(work, `${difficulty} cost-${i}`).toBeLessThan(4_000);
      }
      expect(seen.size).toBe(BUNDLED_BOARDS[difficulty].length);
    }
  });

  it('picks a board by the seed, the same one every time', () => {
    const a = bundledPuzzle('some-seed', 'hard');
    const b = bundledPuzzle('some-seed', 'hard');
    expect(a).toEqual(b);
    const picked = new Set(
      Array.from({ length: 40 }, (_, i) =>
        encodeClues(bundledPuzzle(`pick-${i}`, 'medium').layout.clues),
      ),
    );
    expect(picked.size).toBe(BUNDLED_BOARDS.medium.length);
  });
});
