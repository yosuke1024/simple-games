/**
 * The five techniques of docs/FUTOSHIKI_RULES.md §7, pinned one at a time, and
 * the promise that holds them together: the solver never writes a digit the
 * puzzle does not have, and never rules out one it does.
 *
 * Each isolation case is built so that only the technique under test can fire,
 * which is fiddlier than it sounds — the ladder is consulted cheapest first,
 * so a case a cheaper technique also solves tests the cheaper one. The two
 * pair cases were searched for rather than invented (a naked pair on a short
 * line usually coincides with a hidden single, which fires first) and the
 * grids below are the positions that search returned.
 */
import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import { createRng, shuffled } from './rng';
import { TECHNIQUES, findStep, findHint, isFullyDetermined, solve } from './solver';
import { EMPTY, cellCount, type Constraint, type Size } from './types';

const grid = (...rows: string[]): number[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === '.' ? EMPTY : Number(character)));

const emptyGrid = (size: Size): number[] => new Array<number>(cellCount(size)).fill(EMPTY);

describe('technique 1 — the sign (§7)', () => {
  it('takes the largest digit off the small side and the smallest off the large side', () => {
    expect(findStep(emptyGrid(4), 4, [{ less: 0, greater: 1 }])).toEqual({
      kind: 'elimination',
      technique: 'inequality',
      eliminations: [
        { index: 0, digits: [4] },
        { index: 1, digits: [1] },
      ],
      line: null,
      constraints: [0],
      support: [0, 1],
    });
  });

  /**
   * The chain of §7, which is the same rule read k times: with three signs
   * pointing along one row of four, the row has only one ordering left. Run to
   * a fixpoint the pairwise rule reaches it — nothing else in this board is
   * settled, which is what makes it a test of the chain rather than of the
   * board.
   */
  it('settles a whole row from a chain of signs, and nothing else', () => {
    const chain: Constraint[] = [
      { less: 0, greater: 1 },
      { less: 1, greater: 2 },
      { less: 2, greater: 3 },
    ];
    const result = solve(emptyGrid(4), 4, chain);
    expect(result.grid.slice(0, 4)).toEqual([1, 2, 3, 4]);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    expect(result.grid.slice(4).every((value) => value === EMPTY)).toBe(true);
  });

  it('points the other way just as hard', () => {
    const result = solve(emptyGrid(4), 4, [
      { less: 3, greater: 2 },
      { less: 2, greater: 1 },
      { less: 1, greater: 0 },
    ]);
    expect(result.grid.slice(0, 4)).toEqual([4, 3, 2, 1]);
  });
});

describe('technique 2 — one digit left for this cell (§7)', () => {
  it('names the cell and needs no line to justify it', () => {
    // Row 0 rules out 2 and 3; the 1 at the foot of column 0 rules out 1.
    expect(findStep(grid('.23.', '....', '....', '1...'), 4, [])).toEqual({
      kind: 'placement',
      technique: 'naked-single',
      index: 0,
      value: 4,
      line: null,
      constraints: [],
      support: [0],
    });
  });
});

describe('technique 3 — one cell left for this digit (§7)', () => {
  it('names the line the digit was cornered in', () => {
    // Columns 1, 2 and 3 each hold a 1 already, so row 0's 1 has one home
    // left — and that cell is still open to all four digits, which is what
    // keeps technique 2 from firing first.
    expect(findStep(grid('....', '.1..', '..1.', '...1'), 4, [])).toEqual({
      kind: 'placement',
      technique: 'hidden-single',
      index: 0,
      value: 1,
      line: { axis: 'row', index: 0 },
      constraints: [],
      support: [1, 2, 3],
    });
  });
});

describe('technique 4 — a naked pair (§7)', () => {
  it('empties two digits out of the rest of the line', () => {
    // Column 1: cells 6 and 11 are both down to {4,5} — 6 sits in a row
    // holding 1 and 3, 11 in a row holding 3 and 1, and the column already
    // has its 2. Between them they use 4 and 5 up, so the two cells below
    // cannot have either.
    expect(findStep(grid('.2.1.', '1..3.', '3.1..', '...4.', '.....'), 5, [])).toEqual({
      kind: 'elimination',
      technique: 'naked-pair',
      eliminations: [
        { index: 16, digits: [5] },
        { index: 21, digits: [4, 5] },
      ],
      line: { axis: 'col', index: 1 },
      constraints: [],
      support: [6, 11],
    });
  });
});

describe('technique 5 — a hidden pair (§7)', () => {
  it('clears everything else out of the two cells the pair has left', () => {
    // In row 0 the digits 1 and 5 fit nowhere but cells 2 and 4: column 0
    // holds both already, and so do columns 1 and 3. Those two cells are
    // therefore that pair, whatever else they were open to.
    expect(findStep(grid('.....', '51...', '.5.14', '...5.', '1....'), 5, [])).toEqual({
      kind: 'elimination',
      technique: 'hidden-pair',
      eliminations: [
        { index: 2, digits: [2, 3, 4] },
        { index: 4, digits: [2, 3] },
      ],
      line: { axis: 'row', index: 0 },
      constraints: [],
      support: [2, 4],
    });
  });
});

describe('the fixpoint (§7)', () => {
  it('decides nothing at all on an empty board with no signs', () => {
    const result = solve(emptyGrid(5), 5, []);
    expect(result.proved).toBe(0);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    expect(result.techniques).toEqual([]);
  });

  it('finishes a generated puzzle, lands on its answer, and names what it used', () => {
    const puzzle = generatePuzzle('futoshiki-solver-fixpoint', 6, { constraints: 24, givens: 9 });
    const result = solve(puzzle.givens, 6, puzzle.constraints);
    expect(result.solved).toBe(true);
    expect(result.contradiction).toBe(false);
    expect(result.grid).toEqual([...puzzle.solution]);
    expect(result.proved).toBe(cellCount(6) - puzzle.givensCount);
    expect(result.techniques.every((technique) => TECHNIQUES.includes(technique))).toBe(true);
    expect(result.techniques).toContain('inequality');
  });

  it('calls a board that already breaks a rule a contradiction, without guessing at it', () => {
    expect(solve(grid('11..', '....', '....', '....'), 4, []).contradiction).toBe(true);
    expect(
      solve(grid('21..', '....', '....', '....'), 4, [{ less: 0, greater: 1 }]).contradiction,
    ).toBe(true);
  });

  it('knows a finished board from an unfinishable one', () => {
    expect(isFullyDetermined(grid('1234', '2341', '3412', '4123'), 4, [])).toBe(true);
    expect(isFullyDetermined(grid('1234', '2341', '3412'), 4, [])).toBe(false);
    expect(isFullyDetermined(emptyGrid(4), 4, [])).toBe(false);
  });
});

/**
 * The claim the whole no-guess guarantee rests on: every technique is sound.
 * Checked one position at a time rather than only on the finished board — a
 * wrong step that a later step happens to cancel would still be a wrong step,
 * and an elimination that removes the right digit would hide the answer
 * without ever writing a wrong one.
 *
 * The positions are the givens plus a growing, seed-shuffled prefix of the
 * answer, so the walk covers the whole board from "barely started" to "one
 * cell left" — every one of them a board a player could actually be looking at.
 */
describe('the solver never writes a wrong digit, or rules out a right one (§7)', () => {
  const cases: Array<[string, Size, { constraints: number; givens: number }]> = [
    ['a 4×4', 4, { constraints: 10, givens: 4 }],
    ['a 5×5', 5, { constraints: 15, givens: 5 }],
    ['a 6×6', 6, { constraints: 23, givens: 9 }],
    ['a 7×7', 7, { constraints: 30, givens: 12 }],
  ];

  for (const [name, size, spec] of cases) {
    it(`agrees with the answer at every position of ${name}`, () => {
      const puzzle = generatePuzzle(`futoshiki-sound-${size}`, size, spec);
      const open = puzzle.givens.reduce<number[]>((acc, given, index) => {
        if (given === EMPTY) acc.push(index);
        return acc;
      }, []);
      const order = shuffled(open, createRng(`futoshiki-sound-order-${size}`));
      const working = [...puzzle.givens];
      let steps = 0;

      for (const next of [null, ...order]) {
        if (next !== null) working[next] = puzzle.solution[next]!;
        const step = findStep(working, size, puzzle.constraints);
        if (step === null) continue;
        steps++;
        if (step.kind === 'placement') {
          expect(working[step.index], `rewrote cell ${step.index}`).toBe(EMPTY);
          expect(step.value, `cell ${step.index}`).toBe(puzzle.solution[step.index]);
          continue;
        }
        for (const { index, digits } of step.eliminations) {
          expect(digits, `cell ${index} lost its own answer`).not.toContain(puzzle.solution[index]);
        }
      }
      expect(steps).toBeGreaterThan(0);
    });
  }
});

describe('the hint (§6)', () => {
  const puzzle = generatePuzzle('futoshiki-hint', 5, { constraints: 16, givens: 6 });

  it('offers the next step, with what justifies it', () => {
    const hint = findHint([...puzzle.givens], 5, puzzle.constraints);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      expect(hint.step.support.length).toBeGreaterThan(0);
    }
  });

  it('points at a sign the player has pointed the wrong way, naming the sign', () => {
    const broken = [...puzzle.givens];
    const { less, greater } = puzzle.constraints[0]!;
    broken[less] = puzzle.solution[greater]!;
    broken[greater] = puzzle.solution[less]!;
    // Nothing can be deduced from a board like this — the candidate sets it
    // would start from are contradictory — so the break is not merely first,
    // it is all there is (§6).
    expect(findStep(broken, 5, puzzle.constraints)).toBeNull();
    expect(findHint(broken, 5, puzzle.constraints)).toEqual({
      kind: 'violation',
      line: null,
      constraints: [0],
      cells: [less, greater],
    });
  });

  it('points at the line when a digit has been written twice in it', () => {
    const hint = findHint(grid('1.1.', '....', '....', '....'), 4, []);
    expect(hint).toEqual({
      kind: 'violation',
      line: { axis: 'row', index: 0 },
      constraints: [],
      cells: [0, 2],
    });
  });

  it('offers nothing once the board is finished', () => {
    expect(findHint([...puzzle.solution], 5, puzzle.constraints)).toBeNull();
  });

  it('offers nothing when legal digits have left a cell with no digit at all', () => {
    // Cell 3 wants the 4 its own column has already taken. Nothing is against
    // a rule yet, and there is nothing to say either.
    expect(findHint(grid('123.', '...4', '....', '....'), 4, [])).toBeNull();
  });
});
