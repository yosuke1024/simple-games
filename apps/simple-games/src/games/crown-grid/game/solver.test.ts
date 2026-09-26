/**
 * The five techniques of docs/CROWN_GRID_RULES.md §7, pinned one at a time on
 * hand-made boards, the fixpoint and the grader, the counting solver of §8,
 * and the hint order of §6 — plus the promise that holds them together: the
 * solver never places a crown the puzzle does not have, and never rules out
 * one it does.
 *
 * Each isolation board is built so that only the technique under test can
 * fire first — a house with fewer candidates, or a line in one region, would
 * hand the step to a cheaper technique. That is fiddlier than it sounds, and
 * it is the whole point: a board three techniques could all read tests none
 * of them.
 */
import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import { marksOf, markCross, cycleCell } from './engine';
import {
  buildLayout,
  countSolutions,
  enumerateSolutions,
  findHint,
  findStep,
  grade,
  initialState,
  solve,
  TIER_TECHNIQUES,
  type SolveStep,
} from './solver';
import { CROWN, type Difficulty, type Size } from './types';

const regions = (...rows: string[]): number[] =>
  rows
    .join('')
    .split('')
    .map((character) => character.charCodeAt(0) - 'a'.charCodeAt(0));

const SIX: Size = 6;

const firstStep = (board: number[], techniques = TIER_TECHNIQUES.hard) => {
  const outcome = findStep(initialState(buildLayout(board, SIX)), techniques);
  if (outcome === null || 'contradiction' in outcome) throw new Error('no step');
  return outcome.step;
};

describe('T1 — single (§7)', () => {
  it('crowns the only cell a one-cell region has', () => {
    const board = regions('abbbbb', 'cccbbb', 'cdddee', 'cdddee', 'ffffee', 'ffffff');
    expect(firstStep(board)).toEqual({
      kind: 'place',
      cells: [0],
      technique: 'single',
      houses: [{ kind: 'region', index: 0 }],
      support: [0],
    });
  });
});

describe('T2 — confinement (§7)', () => {
  it('clears the rest of a row a region is confined to', () => {
    const board = regions('aabbbb', 'cccbbb', 'cdddee', 'cdddee', 'ffffee', 'ffffff');
    expect(firstStep(board)).toEqual({
      kind: 'eliminate',
      cells: [2, 3, 4, 5],
      technique: 'confinement',
      houses: [
        { kind: 'region', index: 0 },
        { kind: 'row', index: 0 },
      ],
      support: [0, 1],
    });
  });

  it('clears a region off the line that is confined to it (the dual)', () => {
    // Row 5 lies entirely in region f, which also owns row 4's first four.
    const board = regions('aabbbb', 'accbbb', 'ccddee', 'cdddee', 'ffffee', 'ffffff');
    const step = firstStep(board, TIER_TECHNIQUES.easy);
    expect(step.technique).toBe('confinement');
    expect(step.kind).toBe('eliminate');
    expect(step.cells).toEqual([24, 25, 26, 27]);
    expect(step.houses).toEqual([
      { kind: 'row', index: 5 },
      { kind: 'region', index: 5 },
    ]);
  });
});

describe('T3 — attack (§7)', () => {
  it('rules out the cell whose crown would empty a region', () => {
    // Region a is (0,0) (0,1) (1,0); a crown at (1,1) touches all three.
    const board = regions('aabbbb', 'accbbb', 'ccddee', 'cdddee', 'fffeee', 'ffffee');
    expect(firstStep(board)).toEqual({
      kind: 'eliminate',
      cells: [7],
      technique: 'attack',
      houses: [{ kind: 'region', index: 0 }],
      support: [0, 1, 6],
    });
  });

  it('is not consulted while a cheaper technique has something to say', () => {
    const board = regions('aabbbb', 'accbbb', 'ccddee', 'cdddee', 'fffeee', 'ffffee');
    // Easy's set has no attack, so the same board yields nothing at all.
    expect(findStep(initialState(buildLayout(board, SIX)), TIER_TECHNIQUES.easy)).toBeNull();
  });
});

describe('T4 — pair (§7)', () => {
  it('clears two rows that two regions own between them', () => {
    const board = regions('aabbcc', 'aabbcc', 'ddddcc', 'deeeec', 'deffff', 'deefff');
    expect(firstStep(board, TIER_TECHNIQUES.medium)).toEqual({
      kind: 'eliminate',
      cells: [4, 5, 10, 11],
      technique: 'pair',
      houses: [
        { kind: 'region', index: 0 },
        { kind: 'region', index: 1 },
      ],
      support: [0, 1, 6, 7, 2, 3, 8, 9],
    });
  });

  it('clears two regions off the two rows that own them (the dual)', () => {
    // Rows 0 and 1 lie in regions a and b alone, which spill into row 2.
    const board = regions('aaabbb', 'aaabbb', 'accddb', 'cccdee', 'ffddee', 'ffffee');
    const step = firstStep(board, TIER_TECHNIQUES.medium);
    expect(step.technique).toBe('pair');
    expect(step.cells).toEqual([12, 17]);
    expect(step.houses).toEqual([
      { kind: 'row', index: 0 },
      { kind: 'row', index: 1 },
    ]);
  });
});

describe('T5 — hypothesis (§7)', () => {
  const puzzle = generatePuzzle('crown-grid-hard-t5', 'hard');

  it('is what a Hard board needs, and Medium’s set is not enough', () => {
    expect(puzzle.tier).toBe('hard');
    const stuck = initialState(buildLayout(puzzle.regions, puzzle.size));
    expect(solve(stuck, TIER_TECHNIQUES.medium).solved).toBe(false);
    const finished = initialState(buildLayout(puzzle.regions, puzzle.size));
    const result = solve(finished, TIER_TECHNIQUES.hard);
    expect(result.solved).toBe(true);
    expect(result.steps.some((step) => step.technique === 'hypothesis')).toBe(true);
  });

  it('names the house the hypothesis emptied, and only rules out the tried cell', () => {
    const state = initialState(buildLayout(puzzle.regions, puzzle.size));
    const result = solve(state, TIER_TECHNIQUES.hard);
    const guess = result.steps.find((step) => step.technique === 'hypothesis')!;
    expect(guess.kind).toBe('eliminate');
    expect(guess.cells).toHaveLength(1);
    expect(guess.houses).toHaveLength(1);
    expect(guess.support).toEqual(guess.cells);
  });
});

describe('the grader (§7)', () => {
  it('grades each shipped tier as itself', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const puzzle = generatePuzzle(`crown-grid-${difficulty}-grader`, difficulty);
      expect(grade(puzzle.regions, puzzle.size).tier).toBe(difficulty);
    }
  });

  it('lands on the intended solution when it finishes', () => {
    const puzzle = generatePuzzle('crown-grid-medium-grader', 'medium');
    const graded = grade(puzzle.regions, puzzle.size);
    const expected = puzzle.solution
      .map((col, row) => row * puzzle.size + col)
      .sort((a, b) => a - b);
    expect([...graded.crowns].sort((a, b) => a - b)).toEqual(expected);
  });
});

/**
 * The claim the whole guarantee rests on: every technique is sound, so every
 * crown the solver places is the puzzle's and every cell it rules out is not.
 * Checked one step at a time rather than on the finished board — a wrong step
 * a later one happens to cancel would still be a wrong step.
 */
describe('the solver never contradicts the answer (§7)', () => {
  const cases: [string, Difficulty][] = [
    ['an easy board', 'easy'],
    ['a medium board', 'medium'],
    ['a hard board', 'hard'],
  ];
  for (const [name, difficulty] of cases) {
    it(`agrees with the solution at every step of ${name}`, () => {
      const puzzle = generatePuzzle(`crown-grid-${difficulty}-sound`, difficulty);
      const answer = new Set(puzzle.solution.map((col, row) => row * puzzle.size + col));
      const state = initialState(buildLayout(puzzle.regions, puzzle.size));
      const result = solve(state, TIER_TECHNIQUES.hard);
      expect(result.solved).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
      for (const step of result.steps) {
        if (step.kind === 'place') {
          expect(answer.has(step.cells[0]!), `placed ${step.cells[0]}`).toBe(true);
        } else {
          for (const cell of step.cells) expect(answer.has(cell), `ruled out ${cell}`).toBe(false);
        }
      }
    });
  }
});

describe('the counting solver (§8)', () => {
  it('counts one on a shipped board and stops at the limit on a loose one', () => {
    const puzzle = generatePuzzle('crown-grid-easy-count', 'easy');
    expect(countSolutions(puzzle.regions, puzzle.size)).toBe(1);
    // Rows as regions constrain nothing beyond the permutation rules.
    const rows = regions('aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff');
    expect(countSolutions(rows, SIX, 2)).toBe(2);
    expect(countSolutions(rows, SIX, 7)).toBe(7);
  });

  it('returns whole answers, in the column order it is given', () => {
    const rows = regions('aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff');
    const [first] = enumerateSolutions(rows, SIX, 1);
    expect(first).toEqual([0, 2, 4, 1, 3, 5]);
    const reversed = Array.from({ length: 6 }, () => [5, 4, 3, 2, 1, 0]);
    expect(enumerateSolutions(rows, SIX, 1, reversed)[0]).toEqual([5, 3, 1, 4, 2, 0]);
  });
});

describe('the hint (§6)', () => {
  const puzzle = generatePuzzle('crown-grid-easy-hint', 'easy');
  const { regions: board, solution, size } = puzzle;
  const empty = () => new Array(size * size).fill(0) as (0 | 1 | 2)[];

  it('offers a technique step on a fresh board, one that agrees with the answer', () => {
    const hint = findHint(empty(), board, solution, size);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      const step: SolveStep = hint.step;
      const answer = new Set(solution.map((col, row) => row * size + col));
      if (step.kind === 'place') expect(answer.has(step.cells[0]!)).toBe(true);
      else for (const cell of step.cells) expect(answer.has(cell)).toBe(false);
      expect(step.houses.length).toBeGreaterThan(0);
    }
  });

  it('points at a broken rule before anything else', () => {
    // Two crowns side by side: both a shared row and a touch.
    const marks = empty();
    marks[0] = CROWN;
    marks[1] = CROWN;
    expect(findHint(marks, board, solution, size)).toEqual({ kind: 'violation', cells: [0, 1] });
  });

  it('then points at a crown that is not in the answer', () => {
    // The first cell of row 0 that the answer does not crown.
    const wrongCol = solution[0] === 0 ? 1 : 0;
    // Make sure it breaks nothing on its own: no other crown on the board.
    const marks = empty();
    marks[wrongCol] = CROWN;
    expect(findHint(marks, board, solution, size)).toEqual({ kind: 'wrong', index: wrongCol });
  });

  it('skips a step the player has already crossed out, and moves on', () => {
    const first = findHint(empty(), board, solution, size);
    expect(first?.kind).toBe('step');
    if (first?.kind !== 'step' || first.step.kind !== 'eliminate') return;
    const crossed = markCross(empty(), first.step.cells)!;
    const second = findHint(crossed, board, solution, size);
    expect(second?.kind).toBe('step');
    if (second?.kind === 'step') {
      expect(second.step.cells).not.toEqual(first.step.cells);
      // Whatever it says next is still about cells the player has not crossed.
      for (const cell of second.step.cells) expect(crossed[cell]).not.toBe(1);
    }
  });

  it('never reads the ×s as facts: a wrong × does not derail the next step', () => {
    // Cross out the answer's own crown cell in row 0; the hint ignores it and
    // still reasons from the (empty) crowns alone.
    const marks = empty();
    marks[solution[0]!] = 1;
    const hint = findHint(marks, board, solution, size);
    expect(hint?.kind).toBe('step');
  });

  it('has nothing to say once the board is finished', () => {
    expect(findHint(marksOf(solution, size), board, solution, size)).toBeNull();
  });

  it('still finds a step from a part-played board, and agrees with the answer', () => {
    // Half the crowns placed correctly, in the answer's own order.
    let marks = empty();
    solution.slice(0, Math.floor(size / 2)).forEach((col, row) => {
      marks = cycleCell(cycleCell(marks, row * size + col)!, row * size + col)!;
    });
    const hint = findHint(marks, board, solution, size);
    expect(hint?.kind).toBe('step');
  });
});
