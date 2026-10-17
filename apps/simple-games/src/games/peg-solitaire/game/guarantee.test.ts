/**
 * The promises of docs/PEG_SOLITAIRE_RULES.md §3 and §8, measured rather
 * than assumed:
 *
 * - every problem the game deals can be solved — one peg left, in the target;
 * - the bundled triangle table is exactly what this game's generator makes,
 *   and an independent oracle, reading the board from its own coordinates
 *   with a different search, finds the same 54 of 225 pairings and no other;
 * - the cross's one problem is solved and replayed, by the solver's answer
 *   and by a fixed solution written down once;
 * - no problem promises a unique solution, and none is a near-giveaway;
 * - the deal is deterministic, covers the whole table, and "New board" never
 *   deals the board it replaces;
 * - all of it inside a work budget, measured in nodes (§14).
 *
 * Nothing is sampled: every pairing of the triangle is searched, every
 * adopted problem is solved and replayed, and the cross has one problem.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH, ENGLISH_CENTER, TRIANGLE, type BoardGeometry } from './boards';
import { initialPegs } from './engine';
import { ENGLISH_SOLUTION, englishNotation, parseEnglishJumps } from './fixtures';
import { enumerateSolvableProblems } from './generator';
import {
  ENGLISH_PROBLEM,
  TRIANGLE_PROBLEMS,
  dealProblem,
  dealSeed,
  findProblem,
  sameProblem,
} from './problems';
import { applyMove, createSession } from './session';
import { solve } from './solver';
import type { BoardKind, Problem } from './types';

// ---------- the independent oracle ----------

/**
 * A board read from coordinates alone — never from boards.ts' direction
 * tables or jump list. Holes are listed in the same row-by-row order (that
 * order is the save format, pinned by compatibility.test.ts), and a jump
 * line is any three holes where the second is the first plus one unit step
 * and the third the first plus two:
 * - the cross: the step is one of (±1, 0), (0, ±1) on the 7×7 grid;
 * - the triangle: holes carry barycentric coordinates (apex distance,
 *   left distance, right distance, summing to 4), and the step is any
 *   permutation of (1, −1, 0) — the lattice's three lines, both ways.
 */
interface OracleBoard {
  readonly size: number;
  readonly lines: readonly (readonly [number, number, number])[];
}

function oracleBoard(
  coords: readonly (readonly number[])[],
  steps: readonly (readonly number[])[],
): OracleBoard {
  const key = (c: readonly number[]) => c.join(',');
  const index = new Map(coords.map((c, i) => [key(c), i]));
  const lines: [number, number, number][] = [];
  coords.forEach((a, i) => {
    for (const step of steps) {
      const j = index.get(key(a.map((v, n) => v + step[n]!)));
      const k = index.get(key(a.map((v, n) => v + 2 * step[n]!)));
      if (j !== undefined && k !== undefined) lines.push([i, j, k]);
    }
  });
  return { size: coords.length, lines };
}

const ORACLE_CROSS = (() => {
  const coords: number[][] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++)
      if (Math.abs(r - 3) <= 1 || Math.abs(c - 3) <= 1) coords.push([r, c]);
  }
  return oracleBoard(coords, [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]);
})();

const ORACLE_TRIANGLE = (() => {
  const coords: number[][] = [];
  for (let r = 0; r < 5; r++) for (let p = 0; p <= r; p++) coords.push([r - p, p, 4 - r]);
  const steps: number[][] = [];
  for (const a of [-1, 0, 1]) {
    for (const b of [-1, 0, 1]) {
      const c = -a - b;
      if (new Set([a, b, c]).size === 3) steps.push([a, b, c]);
    }
  }
  return oracleBoard(coords, steps);
})();

/** A board's lines as sorted "from,over,to" strings, so two readings compare as sets. */
const lineSet = (lines: readonly (readonly [number, number, number])[]) =>
  lines.map((line) => line.join(',')).sort();
const tableLines = (geometry: BoardGeometry) =>
  lineSet(geometry.jumps.map(({ from, over, to }) => [from, over, to] as const));

/** Bit i set = a peg in hole i. Both boards fit: the cross is checked by replay only. */
const bit = (i: number) => 1 << i;

function oracleNext(board: OracleBoard, state: number): number[] {
  const out: number[] = [];
  for (const [i, j, k] of board.lines) {
    if (state & bit(i) && state & bit(j) && !(state & bit(k))) {
      out.push((state & ~bit(i) & ~bit(j)) | bit(k));
    }
  }
  return out;
}

/**
 * Breadth-first, level by level: every position reachable from one empty
 * hole, and the holes a lone last peg can end in. Different search, different
 * board reading, no memory of dead ends — nothing shared with solver.ts.
 */
function oracleFinals(board: OracleBoard, start: number): Set<number> {
  let level = new Set([((1 << board.size) - 1) & ~bit(start)]);
  const finals = new Set<number>();
  while (level.size > 0) {
    const next = new Set<number>();
    for (const state of level) {
      if ((state & (state - 1)) === 0) finals.add(Math.log2(state));
      for (const child of oracleNext(board, state)) next.add(child);
    }
    level = next;
  }
  return finals;
}

/**
 * Counts, from the oracle's own graph, the distinct jump sequences that end
 * with one peg in `target`, and the chance that a player choosing uniformly
 * among the legal jumps at every turn ends there.
 */
function oracleWays(board: OracleBoard, start: number, target: number) {
  const memo = new Map<number, { ways: number; chance: number }>();
  const visit = (state: number): { ways: number; chance: number } => {
    const known = memo.get(state);
    if (known) return known;
    const children = oracleNext(board, state);
    let result: { ways: number; chance: number };
    if (children.length === 0) {
      const hit = state === bit(target) ? 1 : 0;
      result = { ways: hit, chance: hit };
    } else {
      let ways = 0;
      let chance = 0;
      for (const child of children) {
        const sub = visit(child);
        ways += sub.ways;
        chance += sub.chance / children.length;
      }
      result = { ways, chance };
    }
    memo.set(state, result);
    return result;
  };
  return visit(((1 << board.size) - 1) & ~bit(start));
}

/** Whether a jump is one of the oracle's lines with pegs and a hole where they belong. */
function oracleAllows(board: OracleBoard, pegs: readonly boolean[], from: number, to: number) {
  return board.lines.some(
    ([i, j, k]) => i === from && k === to && pegs[i] === true && pegs[j] === true && !pegs[k],
  );
}

/** Replays [from, to] pairs through the oracle alone: the pegs left, or null on a bad jump. */
function oracleReplay(
  board: OracleBoard,
  start: number,
  jumps: readonly (readonly [number, number])[],
) {
  const pegs = Array.from({ length: board.size }, (_, i) => i !== start);
  for (const [from, to] of jumps) {
    if (!oracleAllows(board, pegs, from, to)) return null;
    const [, over] = board.lines.find(([i, , k]) => i === from && k === to)!;
    pegs[from] = false;
    pegs[over] = false;
    pegs[to] = true;
  }
  return pegs;
}

// ---------- the generator, once ----------

/**
 * Nodes one pair's exhaustive search may cost. Measured: 15,773 at worst
 * (an unsolvable pair, whose whole reachable space is searched), p50 7,655.
 * The budget is about twice that — a regression gate on the search's work
 * (a lost dead-end memory would multiply it), not a promise about a device.
 */
const PAIR_WORK_BUDGET = 32_000;

const t0 = performance.now();
const enumeration = enumerateSolvableProblems(TRIANGLE);
const enumerationMs = performance.now() - t0;

const pct = (sorted: readonly number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

describe('the triangle’s problems (§8)', () => {
  it('bundles exactly what the generator makes', () => {
    expect(enumeration.problems).toEqual(TRIANGLE_PROBLEMS);
    expect(TRIANGLE_PROBLEMS).toHaveLength(54);
    expect(enumeration.work).toHaveLength(15 * 15);
  });

  it('decides every pairing inside the limit and the budget', () => {
    expect(enumeration.capped).toEqual([]);
    const nodes = enumeration.work.map((pair) => pair.nodes).sort((a, b) => a - b);
    const solved = enumeration.work.filter((pair) => pair.status === 'solved');
    const unsolvable = enumeration.work.filter((pair) => pair.status === 'unsolvable');
    const total = nodes.reduce((a, b) => a + b, 0);
    console.log(
      `[peg-solitaire] triangle: ${enumeration.work.length} pairs, ${solved.length} solvable, ` +
        `${unsolvable.length} unsolvable, ${enumeration.capped.length} capped; nodes per pair ` +
        `p50=${pct(nodes, 0.5)} p90=${pct(nodes, 0.9)} max=${nodes[nodes.length - 1]} ` +
        `total=${total}; ${enumerationMs.toFixed(0)} ms for the whole table`,
    );
    expect(nodes[nodes.length - 1]).toBeLessThan(PAIR_WORK_BUDGET);
  });

  it('reads the same 36 lines from coordinates as the jump table holds', () => {
    // The same set of (from, over, to), not just the same count (§2).
    expect(lineSet(ORACLE_TRIANGLE.lines)).toEqual(tableLines(TRIANGLE));
    expect(ORACLE_TRIANGLE.lines).toHaveLength(36);
  });

  it('agrees with the independent oracle on all 225 pairings', () => {
    for (let start = 0; start < 15; start++) {
      const finals = oracleFinals(ORACLE_TRIANGLE, start);
      for (let target = 0; target < 15; target++) {
        const adopted = TRIANGLE_PROBLEMS.some((p) => p.start === start && p.target === target);
        expect(adopted, `start ${start}, target ${target}`).toBe(finals.has(target));
      }
    }
  });

  it.each(
    TRIANGLE_PROBLEMS.map((problem) => ({
      ...problem,
      name: `${problem.start}→${problem.target}`,
    })),
  )('solves $name and replays the answer through the rules and the oracle', (problem) => {
    const result = solve(TRIANGLE, initialPegs(TRIANGLE, problem.start), problem.target);
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    let session = createSession(problem);
    for (const jump of result.jumps) session = applyMove(session, jump.from, jump.to)!;
    expect(session.outcome).toEqual({ kind: 'perfect', remaining: 1 });
    const pegs = oracleReplay(
      ORACLE_TRIANGLE,
      problem.start,
      result.jumps.map((jump) => [jump.from, jump.to]),
    );
    expect(pegs?.filter(Boolean)).toHaveLength(1);
    expect(pegs?.[problem.target]).toBe(true);
  });

  it('promises no unique solution, and deals no giveaway', () => {
    // Informational facts about each problem, from the oracle's own graph:
    // how many jump sequences clear it, and how often uniform random play
    // would. Pinned at the measured extremes so a change to the table or the
    // rules shows up here (§8 lists the classes).
    const facts = TRIANGLE_PROBLEMS.map((problem) => ({
      problem,
      ...oracleWays(ORACLE_TRIANGLE, problem.start, problem.target),
    }));
    const ways = facts.map((f) => f.ways).sort((a, b) => a - b);
    const chances = facts.map((f) => f.chance).sort((a, b) => a - b);
    console.log(
      `[peg-solitaire] triangle problems: winning sequences min=${ways[0]} ` +
        `p50=${pct(ways, 0.5)} max=${ways[ways.length - 1]}; random play clears ` +
        `min=${(chances[0]! * 100).toFixed(4)}% p50=${(pct(chances, 0.5) * 100).toFixed(4)}% ` +
        `max=${(chances[chances.length - 1]! * 100).toFixed(4)}%`,
    );
    // More than one way through every problem: solutions are not unique, and
    // nothing in the game says they are.
    expect(ways[0]).toBe(720);
    expect(ways[ways.length - 1]).toBe(51_452);
    // Not a giveaway: random play clears even the kindest problem under 1% of the time.
    expect(chances[chances.length - 1]).toBeLessThan(0.01);
    expect(chances[0]).toBeGreaterThan(0);
  });
});

describe('the cross’s problem (§8)', () => {
  it('is the standard one: middle empty, one peg left in the middle', () => {
    expect(ENGLISH_PROBLEM).toEqual({
      kind: 'english',
      start: ENGLISH_CENTER,
      target: ENGLISH_CENTER,
    });
    // The oracle's 76 lines are the jump table's, as a set (§2).
    expect(lineSet(ORACLE_CROSS.lines)).toEqual(tableLines(ENGLISH));
    expect(ORACLE_CROSS.lines).toHaveLength(76);
  });

  it('is solved by the solver, and the answer passes the rules and the oracle', () => {
    const result = solve(ENGLISH, initialPegs(ENGLISH, ENGLISH_CENTER), ENGLISH_CENTER);
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    const pairs = result.jumps.map((jump): [number, number] => [jump.from, jump.to]);
    const pegs = oracleReplay(ORACLE_CROSS, ENGLISH_CENTER, pairs);
    expect(pegs, englishNotation(result.jumps)).not.toBeNull();
    expect(pegs!.filter(Boolean)).toHaveLength(1);
    expect(pegs![ENGLISH_CENTER]).toBe(true);
  });

  it('is cleared by the solution written down once, through the rules and the oracle', () => {
    const pairs = parseEnglishJumps(ENGLISH_SOLUTION);
    expect(pairs).toHaveLength(31);
    let session = createSession(ENGLISH_PROBLEM);
    for (const [from, to] of pairs) session = applyMove(session, from, to)!;
    expect(session.outcome).toEqual({ kind: 'perfect', remaining: 1 });
    const pegs = oracleReplay(ORACLE_CROSS, ENGLISH_CENTER, pairs);
    expect(pegs!.filter(Boolean)).toHaveLength(1);
    expect(pegs![ENGLISH_CENTER]).toBe(true);
  });
});

describe('the deal (§8)', () => {
  const SEEDS = 10_800; // 200 per triangle problem
  const dealt = Array.from({ length: SEEDS }, (_, n) =>
    dealProblem('triangle', dealSeed('triangle', `quality-${n}`)),
  );

  it('deals only from the verified table, and every problem in it', () => {
    const counts = new Map<Problem, number>();
    for (const problem of dealt) {
      expect(TRIANGLE_PROBLEMS).toContain(problem);
      counts.set(problem, (counts.get(problem) ?? 0) + 1);
    }
    expect(counts.size).toBe(TRIANGLE_PROBLEMS.length);
    const expected = SEEDS / TRIANGLE_PROBLEMS.length;
    const values = [...counts.values()].sort((a, b) => a - b);
    console.log(
      `[peg-solitaire] deal over ${SEEDS} seeds: each problem ${values[0]}–${values[values.length - 1]} ` +
        `times (uniform would be ${expected})`,
    );
    // Uniform: every problem within ±30% of its share (deterministic seeds, so not flaky).
    expect(values[0]).toBeGreaterThan(expected * 0.7);
    expect(values[values.length - 1]).toBeLessThan(expected * 1.3);
  });

  it('is deterministic: the same seed deals the same problem', () => {
    for (let n = 0; n < 50; n++) {
      const seed = dealSeed('triangle', `repeat-${n}`);
      expect(dealProblem('triangle', seed)).toBe(dealProblem('triangle', seed));
    }
  });

  it('never deals the board it replaces', () => {
    for (const current of TRIANGLE_PROBLEMS) {
      for (let n = 0; n < 40; n++) {
        const next = dealProblem('triangle', dealSeed('triangle', `next-${n}`), current);
        expect(sameProblem(next, current)).toBe(false);
        expect(TRIANGLE_PROBLEMS).toContain(next);
      }
    }
  });

  it('refuses a kind that is not a board, and never deals undefined', () => {
    // A stored board is checked before it gets here (pg.prefs, §11); a value
    // that slipped through fails loudly instead of dealing nothing.
    for (const kind of ['toString', 'constructor', '__proto__', 'foo', '']) {
      expect(() => dealProblem(kind as BoardKind, dealSeed('triangle', 'x')), kind).toThrow(
        TypeError,
      );
      expect(findProblem(kind, 0, 0), kind).toBeNull();
    }
    expect(findProblem('triangle', 0, 0)).toBe(TRIANGLE_PROBLEMS[0]);
  });

  it('always deals the cross its one problem', () => {
    for (let n = 0; n < 20; n++) {
      const seed = dealSeed('english', `any-${n}`);
      expect(dealProblem('english', seed)).toBe(ENGLISH_PROBLEM);
      expect(dealProblem('english', seed, ENGLISH_PROBLEM)).toBe(ENGLISH_PROBLEM);
    }
  });
});
