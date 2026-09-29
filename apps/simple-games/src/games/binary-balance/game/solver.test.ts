/**
 * The five techniques of docs/BINARY_BALANCE_RULES.md §7, one at a time, the
 * counting search of §6, the grader, and the hint's order (§8).
 */
import { describe, expect, it } from 'vitest';
import { createDifficultySession } from './session';
import {
  buildLayout,
  countSolutions,
  findHint,
  findSteps,
  grade,
  legalLines,
  legalMasks,
  solve,
  TIER_TECHNIQUES,
  type SolveStep,
} from './solver';
import { EMPTY, other, type Link, type Mark } from './types';

/** '0' circle, '1' square, '.' empty, row-major; spaces are ignored. */
const board = (text: string): Mark[] =>
  [...text.replace(/\s/g, '')].map((c) => (c === '0' ? 0 : c === '1' ? 1 : EMPTY));

const empty6 = (): Mark[] => board('.'.repeat(36));
const link = (dir: 'h' | 'v', index: number, same: boolean): Link => ({ dir, index, same });

const steps = (cells: Mark[], links: Link[], techniques = TIER_TECHNIQUES.hard): SolveStep[] => {
  const found = findSteps(cells, buildLayout(links, 6), techniques);
  if (found === 'contradiction') throw new Error('unexpected contradiction');
  return found;
};

describe('the legal-line alphabet (§6)', () => {
  it('is 14 lines at 6 wide', () => {
    expect(legalMasks(6)).toHaveLength(14);
  });

  it('holds only balanced lines with no three alike', () => {
    for (const line of legalLines(6)) {
      expect(line.filter((cell) => cell === 1)).toHaveLength(3);
      expect(line.join('')).not.toMatch(/000|111/);
    }
  });
});

describe('the techniques (§7)', () => {
  it('T1 fills the gap beside a pair, and inside one', () => {
    const cells = empty6();
    cells[0] = cells[1] = 0;
    const [first] = steps(cells, []);
    expect(first).toMatchObject({ index: 2, value: 1, technique: 'pair-gap', support: [0, 1] });

    const gap = empty6();
    gap[6] = gap[8] = 1;
    expect(steps(gap, [])[0]).toMatchObject({ index: 7, value: 0, technique: 'pair-gap' });
  });

  it('T2 fills a line that already holds half of one mark', () => {
    const cells = board('0..0.0' + '.'.repeat(30));
    const found = steps(cells, [], ['line-count']);
    expect(found.map((step) => step.index)).toEqual([1, 2, 4]);
    expect(found.every((step) => step.value === 1 && step.technique === 'line-count')).toBe(true);
    expect(found[0]!.support).toEqual([0, 3, 5]);
  });

  it('T3 copies across = and flips across ×', () => {
    const cells = empty6();
    cells[0] = 1;
    expect(steps(cells, [link('h', 0, true)])[0]).toMatchObject({
      index: 1,
      value: 1,
      technique: 'link',
      support: [0],
      link: 0,
    });
    expect(steps(cells, [link('v', 0, false)])[0]).toMatchObject({
      index: 6,
      value: 0,
      technique: 'link',
      line: { axis: 'col', index: 0 },
    });
  });

  it('T4 settles what every legal completion of a line agrees on', () => {
    // 0 _ _ _ _ 0 finishes only as 011010 or 010110: both put squares at 1 and 4.
    const cells = board('0....0' + '.'.repeat(30));
    expect(steps(cells, [], TIER_TECHNIQUES.easy)).toEqual([]);
    const found = steps(cells, [], TIER_TECHNIQUES.medium);
    expect(found.map((step) => [step.index, step.value, step.technique])).toEqual([
      [1, 1, 'line-completion'],
      [4, 1, 'line-completion'],
    ]);
  });

  it('T4 reads links inside the line and to decided cells off it', () => {
    // A row with nothing written: alone it settles nothing. A × between cells
    // 2 and 3 and a = from cell 0 up to a decided circle below change that.
    const cells = empty6();
    cells[6] = 0;
    const found = steps(cells, [link('h', 2, false), link('v', 0, true)], ['line-completion']);
    expect(found.some((step) => step.index === 0 && step.value === 0)).toBe(true);
  });

  it('T5 finds the hypothesis the lower tiers cannot, and it is the answer', () => {
    const session = createDifficultySession('hard', 'binary-balance-hard-golden');
    const layout = buildLayout(session.links, session.size);
    const stuck = solve(session.givens, layout, TIER_TECHNIQUES.medium);
    expect(stuck.solved).toBe(false);
    const found = findSteps(stuck.board, layout, TIER_TECHNIQUES.hard, true);
    expect(found).not.toBe('contradiction');
    const [step] = found as SolveStep[];
    expect(step!.technique).toBe('hypothesis');
    expect(step!.value).toBe(session.solution[step!.index]);
  });
});

describe('solving (§5, §7)', () => {
  it('reports a board that cannot be finished', () => {
    // T1 makes cell 1 a square; the = to the circle beside it says circle.
    const cells = board('0.0...' + '.'.repeat(30));
    const result = solve(cells, buildLayout([link('h', 0, true)], 6), TIER_TECHNIQUES.hard);
    expect(result.contradiction).toBe(true);
    expect(result.solved).toBe(false);
  });

  it('grades in one flow: a board the cheapest set finishes is Easy', () => {
    const session = createDifficultySession('easy', 'binary-balance-easy-golden');
    expect(grade(session.solution, buildLayout(session.links, 6))).toBe('easy');
  });
});

describe('the counting search (§6)', () => {
  it('stops at the limit on an open board, and finds one on a full one', () => {
    expect(countSolutions(empty6(), buildLayout([], 6), 2)).toBe(2);
    const session = createDifficultySession('medium', 'binary-balance-medium-golden');
    const layout = buildLayout(session.links, 6);
    expect(countSolutions(session.solution, layout)).toBe(1);
    expect(countSolutions(session.givens, layout)).toBe(1);
  });

  it('counts through repeated rows, which this game allows (§3)', () => {
    // Givens that pin every column pattern except by repeated rows.
    const repeating = board(`
      010101
      010101
      101010
      101010
      010101
      101010
    `);
    expect(countSolutions(repeating, buildLayout([], 6))).toBe(1);
  });
});

describe('the hint (§8)', () => {
  const session = createDifficultySession('easy', 'binary-balance-easy-golden');
  const { givens, links, solution, size } = session;

  it('points at a broken rule first', () => {
    // Row 1 of this board is '..0...': three squares on its open end break rule 1.
    const marks = board('.'.repeat(36));
    marks[3] = marks[4] = marks[5] = 1;
    expect(findHint(givens, marks, links, solution, size)).toEqual({
      kind: 'violation',
      cells: [3, 4, 5],
      links: [],
    });
  });

  it('names the link a broken rule runs through', () => {
    const open = board('.'.repeat(36));
    const marks = board('01' + '.'.repeat(34));
    const answer = board('010101 010101 101010 101010 010101 101010') as (0 | 1)[];
    expect(findHint(open, marks, [link('h', 0, true)], answer, 6)).toEqual({
      kind: 'violation',
      cells: [0, 1],
      links: [0],
    });
  });

  it('then a mark that cannot be right — the first in row order', () => {
    const open = givens.map((given, index) => (given === EMPTY ? index : -1)).filter((i) => i >= 0);
    // Find two cells whose wrong mark breaks nothing on its own.
    const quiet = open.filter((index) => {
      const marks = board('.'.repeat(36));
      marks[index] = other(solution[index]!);
      return findHint(givens, marks, links, solution, size)?.kind === 'wrong';
    });
    expect(quiet.length).toBeGreaterThanOrEqual(2);
    const marks = board('.'.repeat(36));
    marks[quiet[1]!] = other(solution[quiet[1]!]!);
    marks[quiet[0]!] = other(solution[quiet[0]!]!);
    expect(findHint(givens, marks, links, solution, size)).toEqual({
      kind: 'wrong',
      index: quiet[0],
    });
  });

  it('then the next step, which is the answer, and it writes nothing', () => {
    const marks = board('.'.repeat(36));
    const before = [...marks];
    const hint = findHint(givens, marks, links, solution, size);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      expect(hint.step.value).toBe(solution[hint.step.index]);
      expect(givens[hint.step.index]).toBe(EMPTY);
    }
    expect(marks).toEqual(before);
  });

  it('has nothing to say on a finished board', () => {
    const marks = givens.map((given, index) => (given === EMPTY ? solution[index]! : EMPTY));
    expect(findHint(givens, marks, links, solution, size)).toBeNull();
  });
});
