/**
 * The two solvers of docs/BOX_REGIONS_RULES.md §6–§8: placement enumeration
 * on boards drawn by hand, the count of solutions on boards with none, one
 * and two, the technique solver and its grades, and the Hint — wrong box
 * first, then a step, never a step about a clue being its own, and always a
 * step while the drawn boxes agree with the answer.
 */
import { describe, expect, it } from 'vitest';
import { drawRect, initialAssignment, isSolved, regionCells, tapCell } from './engine';
import { generatePuzzle } from './generator';
import { enumeratePlacements } from './placements';
import { rectOfCells } from './rects';
import {
  agreesWithSolution,
  countSolutions,
  findHint,
  findStep,
  gradeLayout,
  solve,
  solverWork,
} from './solver';
import { UNASSIGNED, type Layout, type Puzzle } from './types';

const layout = (width: number, height: number, clues: Layout['clues']): Layout => ({
  width,
  height,
  clues,
});

/** The 3×3 of engine.test.ts: a 2×2 square, a tall pair, a wide row. */
const SMALL: Puzzle = {
  width: 3,
  height: 3,
  clues: [
    { index: 0, size: 4, kind: 'square' },
    { index: 5, size: 2, kind: 'tall' },
    { index: 7, size: 3, kind: 'wide' },
  ],
  solution: [0, 0, 1, 0, 0, 1, 2, 2, 2],
};

/** Draws one region of the answer, corner to corner — or taps it, for a 1×1. */
function drawAnswer(puzzle: Puzzle, assignment: readonly number[], region: number): number[] {
  const cells = regionCells(puzzle.solution, region);
  const next =
    cells.length === 1
      ? tapCell(assignment, puzzle, cells[0]!)
      : drawRect(assignment, puzzle, cells[0]!, cells[cells.length - 1]!);
  return next ?? [...assignment];
}

describe('placement enumeration (§7)', () => {
  it('lists every rectangle around the clue that answers to it', () => {
    const cellsOf = (list: readonly { cells: readonly number[] }[]) =>
      list.map((p) => p.cells.join(',')).sort();
    const two = enumeratePlacements(layout(3, 3, [{ index: 4, size: 2, kind: 'free' }]))[0]!;
    expect(cellsOf(two)).toEqual(['1,4', '3,4', '4,5', '4,7']);

    const tall = enumeratePlacements(layout(3, 3, [{ index: 4, size: null, kind: 'tall' }]))[0]!;
    expect(tall.every((p) => p.cells.includes(4))).toBe(true);
    expect(tall.every((p) => p.rect.height > p.rect.width)).toBe(true);
    // 1×2 twice, 1×3 once, 2×3 twice.
    expect(tall).toHaveLength(5);

    // A clue that says nothing on a 3×3 centre: every rectangle holding it.
    const any = enumeratePlacements(layout(3, 3, [{ index: 4, size: null, kind: 'free' }]))[0]!;
    expect(any).toHaveLength(16);
  });

  it('never covers another clue, and numbers placements per region', () => {
    const [a, b] = enumeratePlacements(
      layout(3, 1, [
        { index: 0, size: null, kind: 'wide' },
        { index: 2, size: 1, kind: 'free' },
      ]),
    );
    expect(a!.map((p) => p.cells)).toEqual([[0, 1]]);
    expect(b!.map((p) => p.cells)).toEqual([[2]]);
    expect(a![0]!.region).toBe(0);
    expect(b![0]!.region).toBe(1);
    expect(a![0]!.id).toBe(0);
  });

  it('never offers more than twelve cells', () => {
    const big = enumeratePlacements(layout(7, 7, [{ index: 24, size: null, kind: 'free' }]))[0]!;
    expect(Math.max(...big.map((p) => p.cells.length))).toBe(12);
  });
});

describe('counting solutions (§8)', () => {
  it('finds none when the sizes cannot add up', () => {
    expect(
      countSolutions(
        layout(2, 2, [
          { index: 0, size: 2, kind: 'free' },
          { index: 3, size: 3, kind: 'free' },
        ]),
      ),
    ).toBe(0);
  });

  it('finds exactly one when the clues pin the board', () => {
    expect(countSolutions(SMALL)).toBe(1);
  });

  it('stops at two when the board is ambiguous', () => {
    // Two clues on a 2×2 that say nothing: split across or down.
    expect(
      countSolutions(
        layout(2, 2, [
          { index: 0, size: null, kind: 'free' },
          { index: 3, size: null, kind: 'free' },
        ]),
      ),
    ).toBe(2);
  });
});

describe('the technique solver (§7)', () => {
  it('settles a basic board on its own answer', () => {
    const result = solve(SMALL, initialAssignment(SMALL), false);
    expect(result.solved).toBe(true);
    expect(result.fixed).toEqual(SMALL.solution);
    expect(gradeLayout(SMALL)).toBe('basic');
  });

  it('grades a shipped hard board as needing T4', () => {
    const hard = generatePuzzle('box-regions-hard-solver', 'hard');
    expect(gradeLayout(hard)).toBe('advanced');
    expect(solve(hard, initialAssignment(hard), false).solved).toBe(false);
    const full = solve(hard, initialAssignment(hard), true);
    expect(full.solved).toBe(true);
    expect(full.usedHypothesis).toBe(true);
    expect(full.fixed).toEqual([...hard.solution]);
  });

  it('counts its work the same way every time', () => {
    solverWork.reset();
    countSolutions(SMALL);
    const first = solverWork.read();
    solverWork.reset();
    countSolutions(SMALL);
    expect(solverWork.read()).toBe(first);
    expect(first).toBeGreaterThan(0);
  });
});

describe('the hint (§6)', () => {
  it('points at a drawn box that is not the answer’s box first', () => {
    // a drawn 2×1 instead of 2×2: legal-looking, but not the answer.
    const board = drawRect(initialAssignment(SMALL), SMALL, 0, 1)!;
    expect(findHint(SMALL, SMALL.solution, board)).toEqual({
      kind: 'wrong',
      region: 0,
      cells: [0, 1],
    });
    expect(agreesWithSolution(SMALL.solution, board)).toBe(false);
  });

  it('never spends a step on a clue cell being its own', () => {
    const step = findStep(SMALL, initialAssignment(SMALL))!;
    expect(step).not.toBeNull();
    const clueCells = SMALL.clues.map((clue) => clue.index);
    expect(step.cells.every((cell) => clueCells.includes(cell))).toBe(false);
  });

  it('names the last box to draw, cell by cell or whole', () => {
    let board = drawAnswer(SMALL, initialAssignment(SMALL), 0);
    board = drawAnswer(SMALL, board, 1);
    const hint = findHint(SMALL, SMALL.solution, board);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      expect(hint.step.region).toBe(2);
      expect(hint.step.cells.every((cell) => [6, 7, 8].includes(cell))).toBe(true);
    }
  });

  it('still names a box to draw once every cell is settled but not drawn', () => {
    // An undrawn 1×1: its one cell is settled from the start (it is a clue),
    // yet the player still has to draw it — so the hint says so.
    const unit: Puzzle = {
      width: 3,
      height: 1,
      clues: [
        { index: 0, size: 2, kind: 'wide' },
        { index: 2, size: 1, kind: 'square' },
      ],
      solution: [0, 0, 1],
    };
    const board = drawAnswer(unit, initialAssignment(unit), 0);
    expect(findHint(unit, unit.solution, board)).toEqual({
      kind: 'step',
      step: { technique: 'sole-placement', region: 1, cells: [2], reason: [2] },
    });
  });

  it('says nothing on a finished board', () => {
    expect(findHint(SMALL, SMALL.solution, SMALL.solution)).toBeNull();
  });

  it('always has a true step while the drawn boxes agree with the answer', () => {
    // Follow the hint on real boards of every tier: each step's cells are the
    // answer's, and drawing the step's box moves on until the board is done.
    for (const [seed, difficulty] of [
      ['box-regions-easy-hints', 'easy'],
      ['box-regions-medium-hints', 'medium'],
      ['box-regions-hard-hints', 'hard'],
    ] as const) {
      const puzzle = generatePuzzle(seed, difficulty);
      let board = initialAssignment(puzzle);
      for (let guard = 0; guard <= puzzle.clues.length && !isSolved(puzzle, board); guard++) {
        const hint = findHint(puzzle, puzzle.solution, board);
        expect(hint?.kind, seed).toBe('step');
        if (hint?.kind !== 'step') break;
        const { region, cells } = hint.step;
        expect(
          cells.every((cell) => puzzle.solution[cell] === region),
          seed,
        ).toBe(true);
        board = drawAnswer(puzzle, board, region);
      }
      expect(isSolved(puzzle, board), seed).toBe(true);
      expect(board.every((region) => region !== UNASSIGNED)).toBe(true);
      expect(rectOfCells(regionCells(board, 0), puzzle.width)).not.toBeNull();
    }
  });
});
