/**
 * The six techniques of docs/KAKURO_RULES.md §7, and the promise that holds
 * them together: the solver never writes a digit the puzzle does not have, and
 * never rules out one it does.
 *
 * The first three rungs are pinned one at a time on boards small enough to
 * check by hand. The last three cannot be — and that is a finding rather than
 * a gap, measured and pinned at the bottom of this file: from a position
 * expressible as entries alone, one of the cheap three always has something to
 * say first. They are exercised where they actually fire, inside `solve`, on
 * named boards that do not finish without them.
 */
import { describe, expect, it } from 'vitest';
import { buildRuns } from './engine';
import { generatePuzzle } from './generator';
import { levelSeed, sizeForLevel, specForLevel } from './levels';
import { createRng, shuffled } from './rng';
import {
  computeCandidates,
  findHint,
  findStep,
  findSteps,
  isFixedPartition,
  isFullyDetermined,
  partitionsFor,
  runDigits,
  solve,
  TECHNIQUES,
} from './solver';
import { BLOCK, EMPTY, MAX_RUN, MIN_RUN, WHITE, digitsOf, type Layout } from './types';

const layoutOf = (...rows: string[]): Layout => ({
  width: rows[0]!.length,
  height: rows.length,
  cells: rows
    .join('')
    .split('')
    .map((character) => (character === '#' ? BLOCK : WHITE)),
});

const gridOf = (...rows: string[]): number[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === '.' ? EMPTY : Number(character)));

const tableOf = (layout: Layout, solution: number[]) => buildRuns(layout, solution)!;
const emptyGrid = (layout: Layout): number[] =>
  new Array<number>(layout.width * layout.height).fill(EMPTY);

/**
 * The whole of the partition table, which §7 states as arithmetic rather than
 * as a measurement: over lengths 2..9 there are 120 (length, sum) pairs a run
 * can have, and 34 of them admit exactly one digit set.
 */
describe('the table everything is built on (§7)', () => {
  it('has 120 legal (length, sum) pairs, 34 of them fixed', () => {
    let pairs = 0;
    let fixed = 0;
    const perLength: number[] = [];
    for (let length = MIN_RUN; length <= MAX_RUN; length++) {
      let here = 0;
      for (let sum = 0; sum <= 45; sum++) {
        if (partitionsFor(length, sum).masks.length === 0) continue;
        pairs++;
        here++;
        if (isFixedPartition(length, sum)) fixed++;
      }
      perLength.push(here);
    }
    expect(pairs).toBe(120);
    expect(fixed).toBe(34);
    expect(perLength).toEqual([15, 19, 21, 21, 19, 15, 9, 1]);
  });

  /**
   * The three sizes reach different depths of that table, because the longest
   * run a board can hold is its interior width (§1). Only the 10×10 gets the
   * eight- and nine-cell rows, which are the ten pairs that are always fixed.
   */
  it('gives each board size the slice of the table its runs can reach', () => {
    const reach = (longest: number): [number, number] => {
      let pairs = 0;
      let fixed = 0;
      for (let length = MIN_RUN; length <= longest; length++) {
        for (let sum = 0; sum <= 45; sum++) {
          if (partitionsFor(length, sum).masks.length === 0) continue;
          pairs++;
          if (isFixedPartition(length, sum)) fixed++;
        }
      }
      return [pairs, fixed];
    };
    expect(reach(5)).toEqual([76, 16]);
    expect(reach(7)).toEqual([110, 24]);
    expect(reach(9)).toEqual([120, 34]);
  });

  it('knows the combinations a player keeps at their elbow', () => {
    expect(digitsOf(runDigits(2, 16))).toEqual([7, 9]);
    expect(digitsOf(runDigits(3, 6))).toEqual([1, 2, 3]);
    expect(digitsOf(runDigits(9, 45))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(digitsOf(runDigits(2, 10))).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
    // Sums no run of that length can make hold nothing, and never throw —
    // which is what lets every technique read the table without a range check.
    expect(partitionsFor(2, 1).masks).toEqual([]);
    expect(partitionsFor(2, 18).masks).toEqual([]);
    expect(partitionsFor(20, 20).masks).toEqual([]);
    expect(partitionsFor(-1, 5).masks).toEqual([]);
    // A run with nothing left to place has exactly one way to place nothing,
    // and that is the entry `tightAllowed` reads on a finished run.
    expect(partitionsFor(0, 0).masks).toEqual([0]);
  });
});

/**
 * The worked example of §3, which is also the smallest legal Kakuro: four
 * white cells, four clues, no digits handed over, and every cell settled
 * without a guess.
 *
 *     #  ↓12 ↓3
 *     →11  a   b
 *     →4   c   d
 */
describe('technique 1 — the fixed partition (§7, ①)', () => {
  const LAYOUT = layoutOf('###', '#..', '#..');
  const SOLUTION = gridOf('...', '.92', '.31');
  const TABLE = tableOf(LAYOUT, SOLUTION);

  it('names the run whose length and sum leave one digit set', () => {
    // 4 across two cells is {1,3} and nothing else, so seven digits go.
    expect(findStep(emptyGrid(LAYOUT), TABLE)).toEqual({
      kind: 'elimination',
      technique: 'fixed-partition',
      eliminations: [
        { index: 7, digits: [2, 4, 5, 6, 7, 8, 9] },
        { index: 8, digits: [2, 4, 5, 6, 7, 8, 9] },
      ],
      runs: [1],
      support: [],
    });
  });

  it('finishes the whole example from an empty board, exactly as §3 tells it', () => {
    const result = solve(emptyGrid(LAYOUT), TABLE);
    expect(result.solved).toBe(true);
    expect(result.contradiction).toBe(false);
    expect(result.proved).toBe(4);
    expect(result.entries).toEqual(SOLUTION);
    expect(result.techniques).toEqual(['fixed-partition', 'intersection', 'naked-single']);
    expect(isFullyDetermined(emptyGrid(LAYOUT), TABLE)).toBe(true);
  });
});

describe('technique 2 — the intersection (§7, ②)', () => {
  /**
   * The same four cells with every clue moved off the ends of the table — 5
   * and 7 across two cells, 6 and 6 down two — so no run is a fixed partition
   * and the cheaper rung has nothing to say. The board is not a puzzle this
   * game would ship (those sums admit two answers), which is the point: it
   * isolates the rung instead of testing a board.
   */
  const LAYOUT = layoutOf('###', '#..', '#..');
  const SOLUTION = gridOf('...', '.14', '.52');
  const TABLE = tableOf(LAYOUT, SOLUTION);

  it('leaves the cheaper rung nothing to say', () => {
    for (const run of TABLE.runs) expect(isFixedPartition(run.cells.length, run.sum)).toBe(false);
  });

  it('keeps only the digits both runs allow, and names both as the reason', () => {
    const step = findStep(emptyGrid(LAYOUT), TABLE);
    expect(step?.technique).toBe('intersection');
    if (step?.kind !== 'elimination') throw new Error('expected an elimination');
    // Cell 4 is on 5-across-two ({1,2,3,4}) and 6-down-two ({1,2,4,5}), so
    // only 1, 2 and 4 survive both.
    expect(step.eliminations).toEqual([{ index: 4, digits: [3, 5, 6, 7, 8, 9] }]);
    expect(step.runs).toEqual([0, 2]);
  });
});

describe('technique 3 — one digit left for this cell (§7, ③)', () => {
  /**
   * Level 14 with one cell rubbed out. A naked single needs the two cheaper
   * rungs to be silent, which needs the candidate sets already narrow, which
   * on a real board means very nearly finished — this position was searched
   * for rather than invented, the way Futoshiki §7's pair cases were.
   */
  const LAYOUT = layoutOf('######', '####..', '####..', '###...', '#.....', '#..#..');
  const SOLUTION = gridOf('......', '....39', '....13', '...467', '.49278', '.87.54');
  const TABLE = tableOf(LAYOUT, SOLUTION);
  const POSITION = gridOf('......', '....39', '....13', '...467', '.492.8', '.87.54');

  it('names the cell and the two runs that emptied it', () => {
    expect(findStep(POSITION, TABLE)).toEqual({
      kind: 'placement',
      technique: 'naked-single',
      index: 28,
      value: 7,
      runs: [3, 9],
      support: [28],
    });
  });

  it('is the last cell of a board the techniques finish on their own', () => {
    expect(isFullyDetermined(emptyGrid(LAYOUT), TABLE)).toBe(true);
    expect(solve(POSITION, TABLE).entries).toEqual(SOLUTION);
  });
});

/**
 * The deep three fire inside a solve, once the cheaper rungs have narrowed the
 * candidate sets below what rule 1 alone gives. Each is named on a board that
 * does not finish without it — which is the strongest statement available
 * about a technique: take it out and these boards need a guess.
 */
describe('techniques 4, 5 and 6 — where they actually fire (§7)', () => {
  const techniquesFor = (level: number): readonly string[] => {
    const size = sizeForLevel(level);
    const puzzle = generatePuzzle(levelSeed(level), size, specForLevel(level));
    return solve(new Array<number>(size * size).fill(EMPTY), puzzle.table).techniques;
  };

  it('④ the hidden single: the digit a run must hold, and the one cell left for it', () => {
    expect(techniquesFor(1)).toContain('hidden-single');
    expect(techniquesFor(50)).toContain('hidden-single');
  });

  it('⑥ partial-sum tightening: levels 14 and 20 do not finish without it', () => {
    expect(techniquesFor(14)).toContain('sum-tightening');
    expect(techniquesFor(20)).toContain('sum-tightening');
  });

  it('⑤ the naked pair: rare, and levels 77 and 91 want it', () => {
    expect(techniquesFor(77)).toContain('naked-pair');
    expect(techniquesFor(91)).toContain('naked-pair');
  });

  it('escalates cheapest-first: a board that needs a deep rung used the cheap ones too', () => {
    const used = techniquesFor(77);
    expect(used).toContain('intersection');
    expect(used).toContain('naked-single');
    // The list comes back in ladder order, never in the order they fired.
    expect([...used]).toEqual(TECHNIQUES.filter((technique) => used.includes(technique)));
  });
});

/**
 * The soundness of §7, which is where the whole no-guess promise comes from:
 * a technique may only write a digit every legal completion agrees on, and may
 * only rule out one no completion uses. Checked on real boards from positions
 * the player could actually be in — for a board with one answer, "every legal
 * completion" is that answer.
 */
describe('soundness: never a digit the puzzle has not got (§7)', () => {
  it('places only the answer, and never rules the answer out', () => {
    const rng = createRng('soundness');
    for (const level of [3, 18, 27, 44, 61, 70, 88, 100]) {
      const size = sizeForLevel(level);
      const puzzle = generatePuzzle(levelSeed(level), size, specForLevel(level));
      const white = [...puzzle.table.white];
      for (let trial = 0; trial < 25; trial++) {
        const entries = new Array<number>(size * size).fill(EMPTY);
        for (const index of shuffled(white, rng).slice(0, Math.floor(rng() * white.length))) {
          entries[index] = puzzle.solution[index]!;
        }
        for (const step of findSteps(entries, puzzle.table)) {
          if (step.kind === 'placement') {
            expect(step.value, `level ${level} cell ${step.index}`).toBe(
              puzzle.solution[step.index],
            );
            continue;
          }
          for (const { index, digits } of step.eliminations) {
            expect(digits, `level ${level} cell ${index}`).not.toContain(puzzle.solution[index]);
          }
        }
      }
    }
  });

  it('reaches the one answer from an empty board, on a board from every band', () => {
    for (const level of [1, 20, 21, 65, 66, 100]) {
      const size = sizeForLevel(level);
      const puzzle = generatePuzzle(levelSeed(level), size, specForLevel(level));
      const result = solve(new Array<number>(size * size).fill(EMPTY), puzzle.table);
      expect(result.solved, `level ${level}`).toBe(true);
      expect(result.entries, `level ${level}`).toEqual([...puzzle.solution]);
      expect(result.proved, `level ${level}`).toBe(puzzle.table.white.length);
    }
  });

  it('calls a board it cannot finish unfinished, never solved', () => {
    // Two 2-cell runs crossing, every clue in the middle of the table: 5, 7,
    // 6, 6 admits two answers, so no sound technique may settle it.
    const layout = layoutOf('###', '#..', '#..');
    const table = tableOf(layout, gridOf('...', '.14', '.52'));
    const result = solve(emptyGrid(layout), table);
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(false);
    expect(isFullyDetermined(emptyGrid(layout), table)).toBe(false);
  });
});

describe('candidates start from rule 1 alone (§7)', () => {
  const LAYOUT = layoutOf('###', '#..', '#..');
  const TABLE = tableOf(LAYOUT, gridOf('...', '.92', '.31'));

  it('gives an untouched cell every digit, whatever its clues say', () => {
    const candidates = computeCandidates(emptyGrid(LAYOUT), TABLE)!;
    expect(digitsOf(candidates[4]!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(candidates[0]).toBe(0);
  });

  it('takes a written digit off the rest of both runs, and nothing else', () => {
    const candidates = computeCandidates(gridOf('...', '.9.', '...'), TABLE)!;
    expect(digitsOf(candidates[5]!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(digitsOf(candidates[7]!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(digitsOf(candidates[8]!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('refuses a board that already contradicts itself', () => {
    // A digit twice in one run, a run written past its clue, a full run at the
    // wrong number, and a digit sitting on a clue cell.
    expect(computeCandidates(gridOf('...', '.11', '...'), TABLE)).toBeNull();
    expect(computeCandidates(gridOf('...', '.9.', '.9.'), TABLE)).toBeNull();
    expect(computeCandidates(gridOf('...', '.12', '...'), TABLE)).toBeNull();
    expect(computeCandidates(gridOf('..1', '...', '...'), TABLE)).toBeNull();
    expect(computeCandidates([1, 2], TABLE)).toBeNull();
  });
});

describe('the hint (§6)', () => {
  const size = sizeForLevel(30);
  const puzzle = generatePuzzle(levelSeed(30), size, specForLevel(30));
  const empty = new Array<number>(size * size).fill(EMPTY);

  it('offers a step on an untouched board — the puzzle is solvable, so it must', () => {
    const hint = findHint(empty, puzzle.table);
    expect(hint?.kind).toBe('step');
  });

  /**
   * A break comes first, and not as a preference: once a run repeats a digit
   * the candidate sets the techniques start from are contradictory, so there
   * is no deduction left to offer.
   */
  it('shows the break first when the board already has one', () => {
    const run = puzzle.table.runs.find((candidate) => candidate.cells.length >= 2)!;
    const broken = [...empty];
    broken[run.cells[0]!] = 5;
    broken[run.cells[1]!] = 5;
    const hint = findHint(broken, puzzle.table);
    expect(hint?.kind).toBe('violation');
    if (hint?.kind !== 'violation') throw new Error('expected a violation');
    expect(hint.cells).toContain(run.cells[0]);
    expect(findStep(broken, puzzle.table)).toBeNull();
  });

  it('offers nothing on a finished board', () => {
    expect(findHint([...puzzle.solution], puzzle.table)).toBeNull();
  });
});

/**
 * Measured, not assumed, and it is the reason §6's Hint reads the way it does:
 * over ~1.15 million positions — random subsets of the answer on shipped
 * boards, random subsets on random fills at all three sizes and densities, and
 * random legal-but-wrong player entries — the first step the ladder returns is
 * always one of the cheap three. The deep rungs need candidate sets narrower
 * than rule 1 alone can produce, and a position handed in as entries has only
 * rule 1 behind it.
 *
 * A regression here would be interesting rather than wrong: if a deep rung
 * starts firing first, the Hint has gained a sentence it never used to say,
 * and §6's wording should be checked against it.
 */
describe('what the Hint can actually reach (§6, §7)', () => {
  it('always opens with the fixed partition, the intersection or a naked single', () => {
    const rng = createRng('reach');
    const seen = new Set<string>();
    for (const level of [1, 12, 24, 39, 55, 67, 82, 99]) {
      const size = sizeForLevel(level);
      const puzzle = generatePuzzle(levelSeed(level), size, specForLevel(level));
      const white = [...puzzle.table.white];
      for (let trial = 0; trial < 120; trial++) {
        const entries = new Array<number>(size * size).fill(EMPTY);
        for (const index of shuffled(white, rng).slice(0, Math.floor(rng() * white.length))) {
          entries[index] = puzzle.solution[index]!;
        }
        const step = findStep(entries, puzzle.table);
        if (step !== null) seen.add(step.technique);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const technique of seen) {
      expect(['fixed-partition', 'intersection', 'naked-single']).toContain(technique);
    }
    expect(seen.has('hidden-single')).toBe(false);
    expect(seen.has('naked-pair')).toBe(false);
    expect(seen.has('sum-tightening')).toBe(false);
  });
});
