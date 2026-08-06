/**
 * Technique-by-technique fixtures. Each position is built so that exactly one
 * technique is the cheapest that applies, which is what makes the grader's
 * tier judgement (docs/SUDOKU_RULES.md §6) evidence rather than a guess.
 *
 * Tier agreement for whole puzzles lives in generator.test.ts, where the
 * generator's own guarantee is the thing under test.
 */
import { describe, expect, it } from 'vitest';
import { gridFromString } from './generator';
import { findStep, grade, TECHNIQUE_TIER, type Technique } from './grader';
import { boxOf, colOf, indexOf, rowOf, type Grid } from './types';

const parse = (text: string): Grid => {
  const grid = gridFromString(text.replace(/[^0-9.]/g, ''));
  if (grid === null) throw new Error('bad fixture');
  return grid;
};

/** Classic singles-only puzzle. */
const EASY = parse(`
  530070000
  600195000
  098000060
  800060003
  400803001
  700020006
  060000280
  000419005
  000080079
`);

describe('naked single', () => {
  // Eight digits in row 0 leave the ninth cell exactly one candidate.
  const grid = parse(`
    123456780
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
  `);

  it('names the cell and needs no unit to justify it', () => {
    const step = findStep(grid);
    expect(step).not.toBeNull();
    if (step === null || step.kind !== 'placement') throw new Error('expected a placement');
    expect(step.technique).toBe('nakedSingle');
    expect(step.index).toBe(indexOf(0, 8));
    expect(step.digit).toBe(9);
    expect(step.unit).toBeUndefined();
  });
});

describe('hidden single', () => {
  /**
   * Eight 4s, one per row from rows 1-8, covering every column except 2. Row 0
   * therefore has a single seat for 4 — at (0,2) — while that cell still
   * admits eight digits, so it is hidden rather than naked.
   */
  const grid = parse(`
    000000000
    000000040
    000040000
    000000400
    400000000
    000004000
    000000004
    000400000
    040000000
  `);

  it('points at the only seat a digit has left in a unit', () => {
    const step = findStep(grid);
    expect(step).not.toBeNull();
    if (step === null || step.kind !== 'placement') throw new Error('expected a placement');
    expect(step.technique).toBe('hiddenSingle');
    expect(step.digit).toBe(4);
    expect(step.index).toBe(indexOf(0, 2));
    // The reason is the row, and the hint must be able to show it.
    expect(step.unit).toEqual({ kind: 'row', index: 0 });
  });
});

describe('locked candidates — pointing', () => {
  /**
   * Box 0's lower two rows are full of other digits, so its only seats for 1
   * are the three cells of row 0 — and the rest of row 0 cannot hold a 1.
   *
   * The exclusion is done by filling those cells rather than by placing 1s
   * elsewhere in the band: a 1 anywhere in rows 1-2 would also sit in box 1 or
   * box 2 and quietly remove 1 from the very cells the elimination targets.
   */
  const grid = parse(`
    000000000
    234000000
    567000000
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
  `);

  it('eliminates the digit from the line outside the box', () => {
    const step = findStep(grid);
    expect(step).not.toBeNull();
    if (step === null || step.kind !== 'elimination') throw new Error('expected an elimination');
    expect(step.technique).toBe('lockedCandidatesPointing');
    expect(step.digits).toEqual([1]);
    expect(step.unit).toEqual({ kind: 'box', index: 0 });
    // The pattern sits in box 0, all of it on row 0.
    expect(step.pattern.every((cell) => boxOf(cell) === 0 && rowOf(cell) === 0)).toBe(true);
    // Every target is on row 0 but outside box 0.
    expect(step.eliminations.every(({ index }) => rowOf(index) === 0 && boxOf(index) !== 0)).toBe(
      true,
    );
    expect(step.eliminations.length).toBeGreaterThan(0);
  });
});

describe('locked candidates — claiming', () => {
  /**
   * Seven clues in row 0 leave 8 and 9 only in columns 7 and 8 — both inside
   * box 2 — so the rest of box 2 cannot hold an 8.
   */
  const grid = parse(`
    123456700
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
    000000000
  `);

  it('eliminates the digit from the box outside the line', () => {
    const step = findStep(grid);
    expect(step).not.toBeNull();
    if (step === null || step.kind !== 'elimination') throw new Error('expected an elimination');
    expect(step.technique).toBe('lockedCandidatesClaiming');
    expect(step.unit).toEqual({ kind: 'row', index: 0 });
    expect(step.pattern.every((cell) => rowOf(cell) === 0 && boxOf(cell) === 2)).toBe(true);
    // Targets are inside box 2 but off row 0.
    expect(step.eliminations.every(({ index }) => boxOf(index) === 2 && rowOf(index) !== 0)).toBe(
      true,
    );
  });
});

describe('technique tiers', () => {
  it('assigns every technique to a tier', () => {
    const techniques: Technique[] = [
      'nakedSingle',
      'hiddenSingle',
      'lockedCandidatesPointing',
      'lockedCandidatesClaiming',
      'nakedPair',
      'hiddenPair',
      'nakedTriple',
      'hiddenTriple',
      'xWing',
    ];
    for (const technique of techniques) {
      expect(TECHNIQUE_TIER[technique]).toMatch(/^(easy|medium|hard)$/);
    }
  });

  it('keeps singles easy, locked candidates medium, and every subset hard', () => {
    // Subsets sit in hard rather than medium because medium is meant to be
    // scan-and-place: pointing and claiming still read off the grid, while a
    // pair or an X-Wing asks the player to reason about candidate sets
    // (docs/SUDOKU_RULES.md §6).
    expect(TECHNIQUE_TIER.nakedSingle).toBe('easy');
    expect(TECHNIQUE_TIER.hiddenSingle).toBe('easy');
    expect(TECHNIQUE_TIER.lockedCandidatesPointing).toBe('medium');
    expect(TECHNIQUE_TIER.lockedCandidatesClaiming).toBe('medium');
    expect(TECHNIQUE_TIER.nakedPair).toBe('hard');
    expect(TECHNIQUE_TIER.hiddenPair).toBe('hard');
    expect(TECHNIQUE_TIER.nakedTriple).toBe('hard');
    expect(TECHNIQUE_TIER.xWing).toBe('hard');
  });
});

describe('grade', () => {
  it('grades a singles-only puzzle as easy and finishes it', () => {
    const result = grade(EASY);
    expect(result.solvable).toBe(true);
    expect(result.difficulty).toBe('easy');
    expect(result.techniques.every((t) => TECHNIQUE_TIER[t] === 'easy')).toBe(true);
    expect(result.steps).toBeGreaterThan(0);
  });

  it('reports an already-solved grid as solvable in zero steps', () => {
    const solved = parse(`
      534678912
      672195348
      198342567
      859761423
      426853791
      713924856
      961537284
      287419635
      345286179
    `);
    const result = grade(solved);
    expect(result.solvable).toBe(true);
    expect(result.steps).toBe(0);
    expect(result.techniques).toEqual([]);
  });

  it('reports a contradictory grid as unsolvable rather than throwing', () => {
    expect(grade(parse('55' + '0'.repeat(79))).solvable).toBe(false);
  });

  it('refuses a puzzle that would need guessing', () => {
    // Two clues determine nothing: no supported technique reaches the end, so
    // the grader must say so instead of guessing (§6 guarantees no guessing).
    const sparse = parse('1' + '0'.repeat(40) + '2' + '0'.repeat(39));
    expect(grade(sparse).solvable).toBe(false);
  });

  it('never contradicts the puzzle it was given', () => {
    // Each reported placement must land on an empty cell of the input.
    const step = findStep(EASY);
    expect(step).not.toBeNull();
    if (step === null || step.kind !== 'placement') throw new Error('expected a placement');
    expect(EASY[step.index]).toBe(0);
    expect(colOf(step.index)).toBeLessThan(9);
  });

  it('returns no step for a board with nothing determined and no contradiction', () => {
    expect(findStep(parse('1' + '0'.repeat(80)))).toBeNull();
  });
});
