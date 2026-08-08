/**
 * The three techniques of docs/TAKUZU_RULES.md §5, pinned one at a time, and
 * the promise that holds them together: the solver never writes a digit the
 * puzzle does not have.
 *
 * Each isolation case is built so that only the technique under test can fire.
 * That is fiddlier than it sounds — two equal digits anywhere leave a pair for
 * technique 1 to read — and it is the whole point: a case that three
 * techniques could all solve tests none of them.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_GIVENS_RATIO, DAILY_SIZE, dailySeed } from './daily';
import { emptyMarks } from './engine';
import { generatePuzzle } from './generator';
import { givensRatioForLevel, levelSeed, sizeForLevel } from './levels';
import { findHint, findStep, findSteps, solve } from './solver';
import { EMPTY, ONE, ZERO, type Mark, type Size } from './types';

const board = (...rows: string[]): Mark[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === '.' ? EMPTY : character === '0' ? ZERO : ONE));

const EMPTY_ROWS = ['......', '......', '......', '......', '......'];

describe('technique 1 — the pair and the gap (§5)', () => {
  it('closes a pair from the right', () => {
    const step = findStep(board('11....', ...EMPTY_ROWS), 6);
    expect(step).toEqual({
      index: 2,
      value: ZERO,
      technique: 'no-triple',
      line: { axis: 'row', index: 0 },
      against: null,
      support: [0, 1],
    });
  });

  it('closes a pair from the left', () => {
    const step = findStep(board('.11...', ...EMPTY_ROWS), 6);
    expect(step?.index).toBe(0);
    expect(step?.value).toBe(ZERO);
    expect(step?.support).toEqual([1, 2]);
  });

  it('fills the gap between two of a kind', () => {
    const step = findStep(board('0.0...', ...EMPTY_ROWS), 6);
    expect(step?.index).toBe(1);
    expect(step?.value).toBe(ONE);
    expect(step?.technique).toBe('no-triple');
  });

  it('reads columns the same way it reads rows', () => {
    const step = findStep(board('.0....', '.0....', ...EMPTY_ROWS.slice(0, 4)), 6);
    expect(step).toEqual({
      index: 13,
      value: ONE,
      technique: 'no-triple',
      line: { axis: 'col', index: 1 },
      against: null,
      support: [1, 7],
    });
  });
});

describe('technique 2 — counting the line (§5)', () => {
  it('gives the rest of the line to the other digit', () => {
    const step = findStep(board('10101.', ...EMPTY_ROWS), 6);
    expect(step).toEqual({
      index: 5,
      value: ZERO,
      technique: 'line-count',
      line: { axis: 'row', index: 0 },
      against: null,
      support: [0, 2, 4],
    });
  });

  it('says nothing while a line is short of its half', () => {
    expect(findStep(board('1.0.1.', ...EMPTY_ROWS), 6)).toBeNull();
  });
});

describe('technique 3 — no line twice (§5)', () => {
  // Rows 0 and 3, with two blank rows between them: neighbouring rows would
  // stack equal digits into the columns and hand the deduction to technique 1.
  const TWO_SHORT = board('010101', '......', '......', '0101..', '......', '......');

  it('forces the only ending that is not a repeat', () => {
    expect(findSteps(TWO_SHORT, 6)).toEqual([
      {
        index: 22,
        value: ONE,
        technique: 'unique-line',
        line: { axis: 'row', index: 3 },
        against: { axis: 'row', index: 0 },
        support: [0, 1, 2, 3, 4, 5],
      },
      {
        index: 23,
        value: ZERO,
        technique: 'unique-line',
        line: { axis: 'row', index: 3 },
        against: { axis: 'row', index: 0 },
        support: [0, 1, 2, 3, 4, 5],
      },
    ]);
  });

  it('ignores a finished line that disagrees on a cell already written', () => {
    // Row 0 differs from row 3 in a cell row 3 has already filled, so it was
    // never one of row 3's two endings and forbids neither of them.
    expect(
      findStep(board('011010', '......', '......', '0101..', '......', '......'), 6),
    ).toBeNull();
  });

  it('leaves a line short of two of the same digit to counting', () => {
    // Row 3 needs two ones, not one of each, so its two endings are not two —
    // they are one, and counting is what proves it. This is the ordering that
    // makes technique 3's balance guard unreachable in practice: a line two
    // short of anything but one of each has already reached half of the other.
    const steps = findSteps(board('010101', '......', '......', '..0100', '......', '......'), 6);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => step.technique === 'line-count')).toBe(true);
  });
});

describe('the fixpoint (§5)', () => {
  it('decides nothing at all on an empty board', () => {
    const result = solve(emptyMarks(6), 6);
    expect(result.proved).toBe(0);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
  });

  it('finishes a generated puzzle, and lands on its solution', () => {
    const puzzle = generatePuzzle('takuzu-solver-fixpoint', 8, 0.4);
    const result = solve(puzzle.givens, 8);
    expect(result.solved).toBe(true);
    expect(result.contradiction).toBe(false);
    expect(result.board).toEqual([...puzzle.solution]);
  });
});

/**
 * The claim the whole no-guess guarantee rests on: every technique is sound,
 * so every digit the solver writes is the digit the puzzle has. Checked one
 * step at a time rather than on the finished board — a wrong step that a later
 * step happens to cancel would still be a wrong step.
 */
describe('the solver never writes a wrong digit (§5)', () => {
  const cases: Array<[string, Size, string, number]> = [
    ['level 1', sizeForLevel(1), levelSeed(1), givensRatioForLevel(1)],
    ['level 40', sizeForLevel(40), levelSeed(40), givensRatioForLevel(40)],
    ['level 100', sizeForLevel(100), levelSeed(100), givensRatioForLevel(100)],
    ['a daily', DAILY_SIZE, dailySeed('2026-08-08'), DAILY_GIVENS_RATIO],
  ];

  for (const [name, size, seed, ratio] of cases) {
    it(`agrees with the solution at every step of ${name}`, () => {
      const puzzle = generatePuzzle(seed, size, ratio);
      const working = [...puzzle.givens];
      let steps = 0;
      for (let step = findStep(working, size); step !== null; step = findStep(working, size)) {
        expect(working[step.index], `step ${steps} rewrote a cell`).toBe(EMPTY);
        expect(step.value, `step ${steps} at cell ${step.index}`).toBe(puzzle.solution[step.index]);
        working[step.index] = step.value;
        steps++;
      }
      expect(working).toEqual([...puzzle.solution]);
      expect(steps).toBeGreaterThan(0);
    });
  }
});

describe('the hint (§8)', () => {
  const puzzle = generatePuzzle('takuzu-hint', 6, 0.45);

  it('offers a step, with the line that proves it', () => {
    const hint = findHint([...puzzle.givens], 6);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      expect(hint.step.value).toBe(puzzle.solution[hint.step.index]);
      expect(hint.step.support.length).toBeGreaterThan(0);
    }
  });

  it('points at the broken line first, before any deduction (§8)', () => {
    const broken = [...puzzle.givens];
    broken[0] = ZERO;
    broken[1] = ZERO;
    broken[2] = ZERO;
    // There is still a cell the techniques would happily prove — and offering
    // it would be teaching a deduction built on digits that are already wrong.
    expect(findStep(broken, 6)).not.toBeNull();
    expect(findHint(broken, 6)).toEqual({ kind: 'violation', line: { axis: 'row', index: 0 } });
  });

  it('offers nothing once the board is finished', () => {
    expect(findHint([...puzzle.solution], 6)).toBeNull();
  });
});
