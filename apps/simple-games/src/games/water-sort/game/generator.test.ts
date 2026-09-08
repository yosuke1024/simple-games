/**
 * Generation guarantees (docs/WATER_SORT_RULES.md §5): every board is valid,
 * proven solvable, starts with no finished tube, and is a pure function of
 * its seed — plus the §5 time budget, kept far below anything a phone would
 * notice.
 *
 * The budget below is asserted on deterministic work, not the clock — see
 * the comment on the budget test itself (issue #158).
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

  /**
   * §5 budgets generation in milliseconds on the device. This used to assert
   * that budget against `performance.now()` over these 14 boards, which
   * measures the runner it happened to land on rather than generation
   * itself — under `pnpm test`'s parallel forks the wall clock for the exact
   * same work swings by tens of milliseconds while the work stays identical
   * (see the numbers below). This repository already settled that question
   * for its other generators (docs/SUDOKU_RULES.md §7, issue #158): assert
   * the deterministic work instead — solver DFS nodes, which `solver.ts`
   * exposes per call as `solverCost` and `generator.ts` sums per board into
   * `Puzzle.solverNodes` — and print the milliseconds §5 quotes rather than
   * asserting them.
   *
   * Measured on this machine (`vitest run` alone, 3 repeats, nodes identical
   * every time): solverNodes across all 100 levels — p50 264, p90 537, worst
   * 2,426 (level 99, 9 colors). Across just the 14 boundary boards tested
   * below the worst is 743 (level 79); the wall clock for that same 743-node
   * board ranged 6.1ms–15.1ms across repeats. The budget below is ~2x the
   * worst seen over all 100 levels, not just these 14 boards, so a harder
   * board elsewhere in the level list would still trip it.
   */
  it('generates the band-boundary levels within budget (§5)', () => {
    const boundaries = [1, 8, 9, 22, 23, 40, 41, 60, 61, 78, 79, 92, 93, MAX_LEVEL];
    // ~2x the worst solverNodes measured across all 100 levels (2,426 at
    // level 99) — see the comment above for how that number was found.
    const NODE_BUDGET = 5_000;
    const start = performance.now();
    for (const level of boundaries) {
      const colors = colorsForLevel(level);
      const puzzle = generatePuzzle(levelSeed(level), colors, mixForLevel(level));
      expect(isValidTubes(puzzle.tubes, colors)).toBe(true);
      expect(puzzle.solverNodes, `level ${level} solverNodes`).toBeLessThan(NODE_BUDGET);
    }
    // Reported for a reader, not judged: see the comment above.
    console.log(
      `[water-sort boundaries] n=${boundaries.length} ms=${(performance.now() - start).toFixed(2)} ` +
        `(node budget ${NODE_BUDGET} per board) — reported, not asserted`,
    );
  });

  it('keeps the level table unchanged at every band boundary (§6)', () => {
    const sampled = [1, 8, 9, 22, 23, 40, 41, 60, 61, 78, 79, 92, 93, 100];
    expect(sampled.map(colorsForLevel)).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
    // Each band starts at its tidiest and ends at its most jumbled.
    expect(sampled.map(mixForLevel)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });
});
