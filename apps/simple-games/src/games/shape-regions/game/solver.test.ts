/**
 * The two solvers of docs/SHAPE_REGIONS_RULES.md §7 and §8: placement
 * enumeration on boards drawn by hand, the count of solutions on boards with
 * none, one and two, each technique in isolation, and the promise that holds
 * them together — the techniques never fix a cell the puzzle does not have.
 */
import { describe, expect, it } from 'vitest';
import { addCells, initialAssignment, isSolved } from './engine';
import { generatePuzzle } from './generator';
import { enumeratePlacements } from './placements';
import { countSolutions, findHint, findStep, gradeLayout, solve, solverWork } from './solver';
import { UNASSIGNED, type Layout } from './types';

const layout = (width: number, height: number, clues: Layout['clues']): Layout => ({
  width,
  height,
  clues,
});

describe('placement enumeration (§7)', () => {
  it('lays every allowed shape over the clue, inside the board', () => {
    const centre = layout(3, 3, [{ index: 4, size: 2, shape: null }]);
    // Order follows the catalog, which is not part of the contract: compare sets.
    const cellsOf = (list: readonly { cells: readonly number[] }[]) =>
      list.map((p) => p.cells.join(',')).sort();
    expect(cellsOf(enumeratePlacements(centre)[0]!)).toEqual(['1,4', '3,4', '4,5', '4,7']);

    const lines = enumeratePlacements(layout(3, 3, [{ index: 4, size: 3, shape: 'line' }]))[0]!;
    expect(cellsOf(lines)).toEqual(['1,4,7', '3,4,5']);

    // Every L-tromino in a 2×2 box holding the centre, minus the ones that
    // leave the centre out: four boxes, three each.
    const corners = enumeratePlacements(layout(3, 3, [{ index: 4, size: 3, shape: 'corner' }]))[0]!;
    expect(corners).toHaveLength(12);
    expect(corners.every((p) => p.cells.includes(4))).toBe(true);
  });

  it('never covers another clue, and numbers placements per region', () => {
    const two = layout(3, 1, [
      { index: 0, size: null, shape: 'line' },
      { index: 2, size: 2, shape: null },
    ]);
    const [a, b] = enumeratePlacements(two);
    // {0,1,2} would cover the second clue.
    expect(a!.map((p) => p.cells)).toEqual([[0, 1]]);
    expect(b!.map((p) => p.cells)).toEqual([[1, 2]]);
    expect(a![0]!.region).toBe(0);
    expect(b![0]!.region).toBe(1);
    expect(a![0]!.id).toBe(0);
  });

  it('narrows to the clue: size only, shape only, or both', () => {
    const at = (size: number | null, shape: Layout['clues'][number]['shape']) =>
      enumeratePlacements(layout(5, 5, [{ index: 12, size, shape }]))[0]!.length;
    expect(at(5, 'tee')).toBeLessThan(at(5, null));
    expect(at(5, 'tee')).toBeLessThan(at(null, 'tee'));
    expect(at(null, null)).toBeGreaterThan(at(null, 'tee'));
  });
});

describe('counting solutions (§8)', () => {
  it('finds none when the sizes cannot add up', () => {
    expect(
      countSolutions(
        layout(2, 2, [
          { index: 0, size: 2, shape: null },
          { index: 3, size: 3, shape: null },
        ]),
      ),
    ).toBe(0);
  });

  it('finds exactly one when the clues pin the board', () => {
    // A cannot go down (that is B's clue), so A goes right and B is the rest.
    expect(
      countSolutions(
        layout(2, 2, [
          { index: 0, size: 2, shape: null },
          { index: 2, size: 2, shape: null },
        ]),
      ),
    ).toBe(1);
  });

  it('finds two when two dominoes can lie either way', () => {
    expect(
      countSolutions(
        layout(2, 2, [
          { index: 0, size: 2, shape: 'line' },
          { index: 3, size: 2, shape: 'line' },
        ]),
      ),
    ).toBe(2);
  });

  it('stops counting at the limit', () => {
    const ambiguous = layout(1, 5, [
      { index: 0, size: null, shape: 'line' },
      { index: 4, size: null, shape: 'line' },
    ]);
    expect(countSolutions(ambiguous, 1)).toBe(1);
    expect(countSolutions(ambiguous, 5)).toBe(2);
  });

  it('agrees with a plain search on generated boards', () => {
    // A blunt enumerator — region by region, no propagation — is the
    // independent reading the fast counter is checked against.
    const plain = (target: Layout): number => {
      const base = enumeratePlacements(target);
      const cells = target.width * target.height;
      const taken = new Array<boolean>(cells).fill(false);
      let found = 0;
      const place = (region: number): void => {
        if (found > 2) return;
        if (region === base.length) {
          if (taken.every(Boolean)) found++;
          return;
        }
        for (const placement of base[region]!) {
          if (placement.cells.some((cell) => taken[cell])) continue;
          for (const cell of placement.cells) taken[cell] = true;
          place(region + 1);
          for (const cell of placement.cells) taken[cell] = false;
        }
      };
      place(0);
      return found;
    };

    for (let i = 1; i <= 6; i++) {
      const puzzle = generatePuzzle(`shape-regions-easy-count-${i}`, 'easy');
      expect(countSolutions(puzzle), `easy-count-${i}`).toBe(1);
      expect(plain(puzzle), `easy-count-${i} (plain)`).toBe(1);
      // Widen one clue to both sides missing and compare the two readings.
      const loosened: Layout = {
        ...puzzle,
        clues: puzzle.clues.map((clue, k) => (k === 0 ? { ...clue, size: null } : clue)),
      };
      expect(Math.min(countSolutions(loosened, 3), 3)).toBe(Math.min(plain(loosened), 3));
    }
  });
});

describe('technique 1 — forced cell (§7)', () => {
  it('gives a cell to the only region that can still reach it', () => {
    // B is a domino at the right end, so B never reaches cell 1: only A can.
    const step = findStep(
      layout(5, 1, [
        { index: 0, size: null, shape: 'line' },
        { index: 4, size: 2, shape: null },
      ]),
      [0, -1, -1, -1, 1],
    );
    expect(step).toEqual({
      technique: 'forced-cell',
      region: 0,
      cells: [1],
      reason: [0, 1, 2, 3],
    });
  });

  it('reports a contradiction when a cell has no region left', () => {
    // Two dominoes can never cover three cells in a row.
    const result = solve(
      layout(3, 1, [
        { index: 0, size: 2, shape: null },
        { index: 2, size: 2, shape: null },
      ]),
      [0, -1, 1],
      false,
    );
    expect(result.contradiction).toBe(true);
    expect(result.solved).toBe(false);
  });
});

describe('technique 2 — sole placement (§7)', () => {
  it('fixes a region that has one way left to lie', () => {
    // Cell 1 is reachable by both, so T1 is silent; A's only placement decides.
    const step = findStep(
      layout(3, 1, [
        { index: 0, size: 2, shape: null },
        { index: 2, size: null, shape: 'line' },
      ]),
      [0, -1, 1],
    );
    expect(step).toEqual({ technique: 'sole-placement', region: 0, cells: [1], reason: [0, 1] });
  });
});

describe('technique 3 — common cells (§7)', () => {
  it('fixes the cells every placement of a region shares', () => {
    // Two lines from either end: A reaches 1, 2, 3 and B reaches 1, 2, 3, so
    // T1 and T2 are silent. Every line from A holds cell 1.
    const step = findStep(
      layout(5, 1, [
        { index: 0, size: null, shape: 'line' },
        { index: 4, size: null, shape: 'line' },
      ]),
      [0, -1, -1, -1, 1],
    );
    expect(step).toEqual({
      technique: 'common-cells',
      region: 0,
      cells: [1],
      reason: [0, 1, 2, 3],
    });
  });

  it('stops where the board is genuinely ambiguous', () => {
    const ambiguous = layout(5, 1, [
      { index: 0, size: null, shape: 'line' },
      { index: 4, size: null, shape: 'line' },
    ]);
    const result = solve(ambiguous, initialAssignment(ambiguous), true);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    expect(result.fixed).toEqual([0, 0, UNASSIGNED, 1, 1]);
  });
});

describe('technique 4 — hypothesis (§7)', () => {
  it('rules out a placement whose consequences contradict, where T1–T3 stall', () => {
    // A hard board by construction (§8): T1–T3 alone do not finish it, T4 does.
    const puzzle = generatePuzzle('shape-regions-hard-golden', 'hard');
    expect(puzzle.grade).toBe('advanced');
    const start = initialAssignment(puzzle);
    const basic = solve(puzzle, start, false);
    expect(basic.solved).toBe(false);
    expect(basic.contradiction).toBe(false);
    const advanced = solve(puzzle, start, true);
    expect(advanced.solved).toBe(true);
    expect(advanced.usedHypothesis).toBe(true);
    expect(advanced.fixed).toEqual([...puzzle.solution]);
  });

  it('offers the first step T4 opens up as the hint, never the guess itself', () => {
    const puzzle = generatePuzzle('shape-regions-hard-golden', 'hard');
    // Walk the board with the hint alone: every step it gives is in the
    // answer, and it reaches the end.
    const board = initialAssignment(puzzle);
    for (let guard = 0; guard < 200; guard++) {
      const step = findStep(puzzle, board);
      if (step === null) break;
      expect(['forced-cell', 'sole-placement', 'common-cells']).toContain(step.technique);
      for (const cell of step.cells) {
        expect(puzzle.solution[cell]).toBe(step.region);
        board[cell] = step.region;
      }
    }
    expect(isSolved(puzzle, board)).toBe(true);
  });
});

describe('the fixpoint and the grade (§7)', () => {
  it('decides nothing on a board where nothing is forced', () => {
    const open = layout(2, 2, [
      { index: 0, size: 2, shape: 'line' },
      { index: 3, size: 2, shape: 'line' },
    ]);
    const result = solve(open, initialAssignment(open), true);
    expect(result.solved).toBe(false);
    expect(result.fixed).toEqual([0, UNASSIGNED, UNASSIGNED, 1]);
    expect(gradeLayout(open)).toBe('unsolved');
  });

  it('finishes a generated puzzle and lands on its solution', () => {
    const puzzle = generatePuzzle('shape-regions-medium-fixpoint', 'medium');
    const result = solve(puzzle, initialAssignment(puzzle), false);
    expect(result.solved).toBe(true);
    expect(result.fixed).toEqual([...puzzle.solution]);
    expect(gradeLayout(puzzle)).toBe('basic');
  });

  it('counts its work, and the same board costs the same twice', () => {
    const puzzle = generatePuzzle('shape-regions-medium-fixpoint', 'medium');
    solverWork.reset();
    gradeLayout(puzzle);
    const first = solverWork.read();
    solverWork.reset();
    gradeLayout(puzzle);
    expect(first).toBeGreaterThan(0);
    expect(solverWork.read()).toBe(first);
  });
});

describe('the hint (§6)', () => {
  it('points at a region that disagrees with the answer before anything else', () => {
    const puzzle = generatePuzzle('shape-regions-easy-golden', 'easy');
    // Grow region 0 into a neighbour that is not its own in the answer.
    const clue = puzzle.clues[0]!.index;
    const wrongCell = [clue - 1, clue + 1, clue - puzzle.width, clue + puzzle.width].find(
      (cell) =>
        cell >= 0 &&
        cell < puzzle.solution.length &&
        Math.abs((cell % puzzle.width) - (clue % puzzle.width)) <= 1 &&
        puzzle.solution[cell] !== 0 &&
        !puzzle.clues.some((c) => c.index === cell),
    );
    expect(wrongCell).toBeDefined();
    const board = addCells(initialAssignment(puzzle), puzzle, 0, [wrongCell!])!;
    expect(findHint(puzzle, puzzle.solution, board)).toEqual({
      kind: 'wrong',
      region: 0,
      cells: [clue, wrongCell!].sort((a, b) => a - b),
    });
  });

  it('gives the next deduction on a board that agrees with the answer', () => {
    const puzzle = generatePuzzle('shape-regions-easy-golden', 'easy');
    const hint = findHint(puzzle, puzzle.solution, initialAssignment(puzzle));
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      for (const cell of hint.step.cells) expect(puzzle.solution[cell]).toBe(hint.step.region);
    }
  });

  it('has nothing to say on a finished board', () => {
    const puzzle = generatePuzzle('shape-regions-easy-golden', 'easy');
    expect(findHint(puzzle, puzzle.solution, puzzle.solution)).toBeNull();
  });
});
