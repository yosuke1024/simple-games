/**
 * The six techniques of docs/SUDOKU_6X6_RULES.md §8, the search of §7, and the
 * hint of §5.
 *
 * The fixtures are real dug boards (found by digging `s6-search-<n>` seeds for
 * Hard and keeping the ones whose first non-single step is the technique
 * named). Hidden pair never comes first on a dug board — in 60,000 digs it was
 * always preceded by another technique — so it is held to soundness on its
 * own instead, finder by finder, like every other technique.
 */
import { describe, expect, it } from 'vitest';
import { createBoard } from './engine';
import { digBoard, gridFromString } from './generator';
import { FINDERS, findStep, grade, gradeTier, solvableWithin, type Step } from './grader';
import { findHint } from './hint';
import { computeCandidates, countSolutions, isGridSolved, solve } from './solver';
import { bitOf, CELLS, type Grid } from './types';

interface Fixture {
  readonly givens: Grid;
  readonly solution: Grid;
}
const fixture = (givens: string, solution: string): Fixture => ({
  givens: gridFromString(givens)!,
  solution: gridFromString(solution)!,
});

const POINTING = fixture(
  '......5..4.2........2.63..1..5..42..',
  '423651516432635124142563261345354216',
);
const CLAIMING = fixture(
  '5......2..13.........2.414.....5.4..',
  '531642426513264135315264142356653421',
);
const NAKED_PAIR = fixture(
  '...4..64.....2.3.5.1........3....1.2',
  '235461641523426315513246152634364152',
);

/** Places singles until the first step that is not one; that step. */
function firstHarderStep({ givens, solution }: Fixture): { grid: number[]; step: Step } {
  const grid = [...givens];
  for (;;) {
    const step = findStep(grid);
    if (step === null) throw new Error('stuck without a step');
    if (step.kind === 'elimination') return { grid, step };
    expect(step.digit).toBe(solution[step.index]);
    grid[step.index] = step.digit;
  }
}

/** A step is sound when it never rules out, or places against, the answer. */
function expectSound(step: Step, solution: Grid): void {
  if (step.kind === 'placement') {
    expect(step.digit).toBe(solution[step.index]);
    return;
  }
  expect(step.eliminations.length).toBeGreaterThan(0);
  for (const { index, digits } of step.eliminations) {
    expect(digits, `${step.technique} removes the answer at ${index}`).not.toContain(
      solution[index],
    );
  }
}

describe('the search (§7)', () => {
  it('solves, counts, and refuses a contradiction', () => {
    expect(isGridSolved(POINTING.solution)).toBe(true);
    expect(solve(POINTING.givens)).toEqual([...POINTING.solution]);
    expect(countSolutions(POINTING.givens, 2)).toBe(1);
    expect(countSolutions(new Array<number>(CELLS).fill(0), 2)).toBe(2);
    const broken = [...POINTING.givens];
    broken[0] = broken[6]!;
    broken[1] = broken[6]!;
    expect(computeCandidates(broken)).toBeNull();
    expect(solve(broken)).toBeNull();
  });
});

describe('techniques (§8)', () => {
  it('finds pointing where singles stop, and it is sound', () => {
    const { step } = firstHarderStep(POINTING);
    expect(step.technique).toBe('lockedCandidatesPointing');
    expect(step.unit?.kind).toBe('box');
    expectSound(step, POINTING.solution);
  });

  it('finds claiming where singles stop, and it is sound', () => {
    const { step } = firstHarderStep(CLAIMING);
    expect(step.technique).toBe('lockedCandidatesClaiming');
    expect(['row', 'col']).toContain(step.unit?.kind);
    expectSound(step, CLAIMING.solution);
  });

  it('finds a naked pair where nothing cheaper applies, and it is sound', () => {
    const { step } = firstHarderStep(NAKED_PAIR);
    expect(step.technique).toBe('nakedPair');
    expect(step.kind === 'elimination' && step.pattern).toHaveLength(2);
    expectSound(step, NAKED_PAIR.solution);
  });

  it('holds every finder to soundness on its own, over many partial boards', () => {
    const fired = new Set<string>();
    for (let n = 0; n < 60; n++) {
      const { givens, solution } = digBoard(`sudoku-6x6-sound-${n}`, 'hard');
      // The dug board and a few states on the way to the answer.
      const grid = [...givens];
      for (let k = 0; k < 4; k++) {
        const candidates = computeCandidates(grid)!;
        for (const finder of FINDERS) {
          const step = finder.find(grid, candidates);
          if (step === null) continue;
          fired.add(finder.technique);
          expect(step.technique).toBe(finder.technique);
          expectSound(step, solution);
        }
        const empty = grid.findIndex((value) => value === 0);
        if (empty < 0) break;
        grid[empty] = solution[empty]!;
      }
    }
    // Every technique actually ran somewhere, hidden pair included.
    expect([...fired].sort()).toEqual(FINDERS.map((finder) => finder.technique).sort());
  });
});

describe('grading (§6, §7)', () => {
  it('grades each fixture at the tier its hardest needed technique belongs to', () => {
    expect(gradeTier(POINTING.givens)).toBe('medium');
    expect(gradeTier(CLAIMING.givens)).toBe('medium');
    expect(gradeTier(NAKED_PAIR.givens)).toBe('hard');
    expect(solvableWithin(NAKED_PAIR.givens, 'medium')).toBe(false);
    expect(solvableWithin(NAKED_PAIR.givens, 'hard')).toBe(true);
    const result = grade(NAKED_PAIR.givens);
    expect(result.solvable).toBe(true);
    expect(result.difficulty).toBe('hard');
    expect(result.techniques).toContain('nakedPair');
  });

  it('refuses a board with more than one answer', () => {
    const empty = new Array<number>(CELLS).fill(0);
    expect(gradeTier(empty)).toBeNull();
    expect(solvableWithin(empty, 'hard')).toBe(false);
  });
});

describe('hint (§5)', () => {
  it('points at the next logical step with its reason, and never fills a cell', () => {
    const board = createBoard(POINTING.givens);
    const hint = findHint(board)!;
    expect(hint).not.toBeNull();
    expect(['onlyDigitForCell', 'onlyCellForDigit']).toContain(hint.kind);
    expect(hint.target).toBeDefined();
    expect(hint.digit).toBe(POINTING.solution[hint.target!]);
    expect(board.entries.every((value) => value === 0)).toBe(true);
  });

  it('turns a locked candidate into the sentence that names its line or box', () => {
    const { grid } = firstHarderStep(POINTING);
    const hint = findHint(createBoard(grid))!;
    expect(hint.kind).toBe('digitLockedToLine');
    expect(hint.target).toBeUndefined();
    expect(hint.focus.length).toBeGreaterThanOrEqual(2);
    expect(hint.unit?.kind).toBe('box');
  });

  it('finds nothing on a board the player has contradicted', () => {
    const grid = [...POINTING.givens];
    const empty = grid.findIndex((value) => value === 0);
    // Every digit the cell's peers already rule out, entered anyway.
    const candidates = computeCandidates(grid)!;
    const ruledOut = [1, 2, 3, 4, 5, 6].find((d) => (candidates[empty]! & bitOf(d)) === 0)!;
    grid[empty] = ruledOut;
    expect(findHint(createBoard(grid))).toBeNull();
  });
});
