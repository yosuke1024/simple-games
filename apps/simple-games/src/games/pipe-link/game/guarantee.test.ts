/**
 * The promises of docs/PIPE_LINK_RULES.md §4–§6, measured rather than
 * assumed, and the numbers of §14, printed with a `[pipe-link]` prefix.
 *
 * - The walk: 300 fixed seeds per tier plus 365 dailies (from 2026-10-22)
 *   go through `generatePuzzle` exactly as play does. Every board is a
 *   spanning tree of its own types, rooted on a central cell, unique, in its
 *   tier, scrambled acceptably, never a fallback, and inside its budgets.
 * - The independent check: 1,000 of those boards (250 per tier, 250 dailies)
 *   are re-counted by the union-find search of test-helpers.ts, which shares
 *   no code with the solver.
 * - The hint walk: boards solved from their scramble — and from the scramble
 *   plus random turns — by hints alone, never reaching the answer stage.
 * - The census: 1,000 trees per size, graded and counted whatever their
 *   tier, for the level distribution and the uniqueness rate.
 *
 * Difficulty seeds are minted at play time and cannot all be walked; a fixed
 * set stands in for them, while the dailies are the exact boards players see.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { isSolved } from './board';
import { DAILY_DIFFICULTY, addDays, dailySeed } from './daily';
import {
  ATTEMPT_LIMIT,
  GENERATION_WORK_LIMIT,
  TIERS,
  generatePuzzle as generatePuzzleFor,
  gradeTree,
  growTree,
  isAcceptableScramble,
  meetsTier,
  sameAsSolution,
  sourceCells,
  type AttemptOutcome,
  type GeneratedPuzzle,
} from './generator';
import { findHint } from './hint';
import { createRng } from './rng';
import { encodeOrientations, encodeTypes } from './serialize';
import { SEARCH_NODE_LIMIT, TECHNIQUE_WORK_LIMIT, countSolutions, solve } from './solver';
import { independentCount } from './test-helpers';
import { pipeMask, rotateCw } from './tiles';
import { DIFFICULTIES, PRESETS, type Difficulty } from './types';

const SEEDS_PER_TIER = 300;
const DAILY_DAYS = 365;
const FIRST_DAY = '2026-10-22';
const INDEPENDENT_PER_GROUP = 250;
const HINT_WALK_PER_GROUP = 40;
const CENSUS_TREES = 1_000;

type Group = Difficulty | 'daily';
const GROUPS: readonly Group[] = [...DIFFICULTIES, 'daily'];

/**
 * Work per board, per group: a regression gate on this fixed walk, about
 * twice its worst case (§14) — not a bound (GENERATION_WORK_LIMIT is) and not
 * a device promise.
 */
const WORK_GATE: Record<Group, number> = {
  easy: 10_000,
  medium: 150_000,
  hard: 600_000,
  daily: 150_000,
};

/** Derived seeds per board, per group: a regression gate well short of ATTEMPT_LIMIT. */
const ATTEMPT_GATE: Record<Group, number> = { easy: 10, medium: 40, hard: 100, daily: 40 };

interface Run {
  readonly name: string;
  readonly group: Group;
  readonly difficulty: Difficulty;
  readonly puzzle: GeneratedPuzzle;
  readonly ms: number;
}

function walk(): Run[] {
  const runs: Run[] = [];
  const timed = (name: string, group: Group, difficulty: Difficulty, seed: string): Run => {
    const t0 = performance.now();
    const puzzle = generatePuzzleFor(seed, difficulty);
    return { name, group, difficulty, puzzle, ms: performance.now() - t0 };
  };
  for (const difficulty of DIFFICULTIES) {
    for (let k = 1; k <= SEEDS_PER_TIER; k++) {
      const seed = `pipe-link-${difficulty}-g${k}`;
      runs.push(timed(seed, difficulty, difficulty, seed));
    }
  }
  let date = FIRST_DAY;
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push(timed(`daily ${date}`, 'daily', DAILY_DIFFICULTY, dailySeed(date)));
    date = addDays(date, 1);
  }
  return runs;
}

const runs = walk();
const inGroup = (group: Group): Run[] => runs.filter((r) => r.group === group);
const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;
};
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`;

describe('every walked board (§4, §5)', () => {
  for (const group of GROUPS) {
    it(`${group}: a spanning tree of its own types, rooted on a central cell, of the preset size`, () => {
      for (const { name, difficulty, puzzle } of inGroup(group)) {
        const { board, solution } = puzzle;
        const preset = PRESETS[difficulty];
        expect(board.width, name).toBe(preset.width);
        expect(board.height, name).toBe(preset.height);
        expect(sourceCells(preset.width, preset.height), name).toContain(board.source);
        // isSolved: every tile lit from the source, no open end, n − 1 links — a spanning tree;
        // the types have no cross and at most three pipes, so every degree is 1–3.
        expect(isSolved(board, solution), name).toBe(true);
        for (let i = 0; i < solution.length; i++) {
          expect(pipeMask(board.types[i]!, solution[i]!), name).toBeGreaterThan(0);
        }
      }
    });
  }

  for (const group of GROUPS) {
    it(`${group}: unique by the counter, in its tier by a fresh grade, and never a fallback`, () => {
      for (const { name, difficulty, puzzle } of inGroup(group)) {
        expect(puzzle.fallback, name).toBe(false);
        const count = countSolutions(puzzle.board);
        expect(count.complete && count.count === 1, name).toBe(true);
        expect(count.solutions[0], name).toEqual(puzzle.solution);
        const techniques = solve(puzzle.board);
        const graded = {
          board: puzzle.board,
          solution: puzzle.solution,
          level: techniques.level,
          l1Open: techniques.stageOf.filter((s) => s >= 2).length,
          status: techniques.status,
          solveWork: techniques.work,
        };
        expect(meetsTier(graded, TIERS[difficulty]), name).toBe(true);
        expect(graded.level).toBe(puzzle.level);
        expect(graded.l1Open).toBe(puzzle.l1Open);
      }
    });
  }

  it('starts from an acceptable scramble: not solved, at most 60 % of tiles in place', () => {
    for (const { name, puzzle } of runs) {
      expect(isAcceptableScramble(puzzle.board, puzzle.solution, puzzle.initial), name).toBe(true);
    }
  });

  it('is deterministic: the same seed is the same puzzle (first 20 of each group)', () => {
    for (const group of GROUPS) {
      for (const run of inGroup(group).slice(0, 20)) {
        const seed = run.group === 'daily' ? dailySeed(run.name.slice(6)) : run.name;
        const again = generatePuzzleFor(seed, run.difficulty);
        expect(encodeTypes(again.board.types), run.name).toBe(encodeTypes(run.puzzle.board.types));
        expect(encodeOrientations(again.initial)).toBe(encodeOrientations(run.puzzle.initial));
        expect(again.work).toBe(run.puzzle.work);
      }
    }
  });
});

describe('generation cost and rates (§4, §14)', () => {
  it('stays inside its work and attempt gates, and prints the rates', () => {
    for (const group of GROUPS) {
      const list = inGroup(group);
      const attempts = list.map((r) => r.puzzle.attempts);
      const work = list.map((r) => r.puzzle.work);
      const outcomes: Partial<Record<AttemptOutcome, number>> = {};
      for (const r of list) {
        for (const [k, v] of Object.entries(r.puzzle.outcomes)) {
          outcomes[k as AttemptOutcome] = (outcomes[k as AttemptOutcome] ?? 0) + (v ?? 0);
        }
      }
      const drawn = attempts.reduce((a, b) => a + b, 0);
      const scrambles = list.reduce((a, r) => a + r.puzzle.scrambles, 0);
      const nodes = Math.max(...list.map((r) => r.puzzle.countNodes));
      const levels: Record<number, number> = {};
      for (const r of list) levels[r.puzzle.level] = (levels[r.puzzle.level] ?? 0) + 1;
      const open = list.map((r) => r.puzzle.l1Open);
      const ms = list.map((r) => r.ms);
      const sources: Record<number, number> = {};
      for (const r of list)
        sources[r.puzzle.board.source] = (sources[r.puzzle.board.source] ?? 0) + 1;
      console.log(
        `[pipe-link] walk ${group}: ${list.length} boards, ${drawn} candidates, ` +
          `pass ${pct(list.length / drawn)}, outcomes ${JSON.stringify(outcomes)}, ` +
          `attempts p50 ${quantile(attempts, 0.5)} / p90 ${quantile(attempts, 0.9)} / max ${Math.max(...attempts)}, ` +
          `work p50 ${quantile(work, 0.5)} / p90 ${quantile(work, 0.9)} / max ${Math.max(...work)}, ` +
          `count nodes max ${nodes}, levels ${JSON.stringify(levels)}, ` +
          `L1-open min ${Math.min(...open)} / p50 ${quantile(open, 0.5)} / max ${Math.max(...open)}, ` +
          `scrambles ${scrambles} for ${list.length} (rejected ${pct((scrambles - list.length) / scrambles)}), ` +
          `fallback ${list.filter((r) => r.puzzle.fallback).length}, sources ${JSON.stringify(sources)}, ` +
          `ms p50 ${quantile(ms, 0.5).toFixed(1)} / max ${Math.max(...ms).toFixed(1)}`,
      );
      expect(Math.max(...work), group).toBeLessThan(WORK_GATE[group]);
      expect(Math.max(...attempts), group).toBeLessThanOrEqual(ATTEMPT_GATE[group]);
      expect(WORK_GATE[group]).toBeLessThan(GENERATION_WORK_LIMIT);
      expect(ATTEMPT_GATE[group]).toBeLessThan(ATTEMPT_LIMIT);
      expect(nodes).toBeLessThan(SEARCH_NODE_LIMIT);
    }
  });

  it('prints how much of each scramble sits in its answer orientation', () => {
    for (const group of GROUPS) {
      const list = inGroup(group);
      const shares = list.map(
        (r) => sameAsSolution(r.puzzle.solution, r.puzzle.initial) / r.puzzle.solution.length,
      );
      const straights = list.map(
        (r) =>
          r.puzzle.board.types.filter((t) => t === 'straight').length / r.puzzle.board.types.length,
      );
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      // Arithmetic: a straight stays in place with probability 1/2, every other tile 1/4.
      const expected = mean(straights.map((s) => s / 2 + (1 - s) / 4));
      console.log(
        `[pipe-link] scramble ${group}: in place min ${pct(Math.min(...shares))} / p50 ${pct(quantile(shares, 0.5))} / ` +
          `p90 ${pct(quantile(shares, 0.9))} / max ${pct(Math.max(...shares))}, mean ${pct(mean(shares))} ` +
          `(arithmetic expectation ${pct(expected)}), straights ${pct(mean(straights))}`,
      );
      expect(Math.max(...shares)).toBeLessThanOrEqual(0.6);
    }
  });
});

describe('the independent check (§13): 1,000 boards re-counted by a search sharing no code', () => {
  for (const group of GROUPS) {
    it(`${group}: ${INDEPENDENT_PER_GROUP} boards have exactly the one stored solution`, () => {
      let maxNodes = 0;
      for (const { name, difficulty, puzzle } of inGroup(group).slice(0, INDEPENDENT_PER_GROUP)) {
        const { width, height } = PRESETS[difficulty];
        const result = independentCount(width, height, encodeTypes(puzzle.board.types).split(''));
        expect(result.complete, name).toBe(true);
        expect(result.count, name).toBe(1);
        expect(result.solutions[0], name).toEqual(puzzle.solution);
        maxNodes = Math.max(maxNodes, result.nodes);
      }
      console.log(
        `[pipe-link] independent ${group}: ${INDEPENDENT_PER_GROUP} boards unique, max ${maxNodes} nodes`,
      );
    });
  }
});

describe('the hint walk (§6)', () => {
  const walkHints = (
    name: string,
    puzzle: GeneratedPuzzle,
    start: readonly number[],
  ): { hints: number; work: number } => {
    const { board, solution } = puzzle;
    const techniques = solve(board);
    const current = [...start];
    let hints = 0;
    while (!isSolved(board, current)) {
      const hint = findHint(board, solution, current, techniques);
      expect(hint, name).not.toBeNull();
      expect(hint!.kind, name).toBe('technique');
      expect(current[hint!.cell], name).not.toBe(solution[hint!.cell]);
      expect(hint!.orientation, name).toBe(solution[hint!.cell]);
      while (current[hint!.cell] !== hint!.orientation) {
        current[hint!.cell] = rotateCw(board.types[hint!.cell]!, current[hint!.cell]!);
      }
      hints++;
      expect(hints, name).toBeLessThanOrEqual(current.length);
    }
    expect(current).toEqual(solution);
    return { hints, work: techniques.work };
  };

  it('solves sampled boards from their scramble by hints alone, never reaching the answer stage', () => {
    let boards = 0;
    let hints = 0;
    let work = 0;
    for (const group of GROUPS) {
      for (const run of inGroup(group).slice(0, HINT_WALK_PER_GROUP)) {
        const r = walkHints(run.name, run.puzzle, run.puzzle.initial);
        boards++;
        hints += r.hints;
        work = Math.max(work, r.work);
      }
    }
    console.log(
      `[pipe-link] hint walk from the scramble: ${boards} boards, ${hints} hints, technique work max ${work}`,
    );
    expect(work).toBeLessThan(TECHNIQUE_WORK_LIMIT);
  });

  it('does the same after thirty random turns on top of the scramble', () => {
    let boards = 0;
    let hints = 0;
    for (const group of GROUPS) {
      for (const run of inGroup(group).slice(0, HINT_WALK_PER_GROUP)) {
        const rng = createRng(`turns-${run.name}`);
        const start = [...run.puzzle.initial];
        for (let t = 0; t < 30; t++) {
          const cell = Math.floor(rng() * start.length);
          start[cell] = rotateCw(run.puzzle.board.types[cell]!, start[cell]!);
        }
        if (isSolved(run.puzzle.board, start)) continue;
        hints += walkHints(run.name, run.puzzle, start).hints;
        boards++;
      }
    }
    console.log(`[pipe-link] hint walk after random turns: ${boards} boards, ${hints} hints`);
    expect(boards).toBeGreaterThan(0);
  });
});

describe('the census (§14): every tree, whatever its tier', () => {
  const CHUNKS = 4;
  const per = CENSUS_TREES / CHUNKS;
  interface Census {
    tally: Record<string, number>;
    solveWork: number;
    nodes: number;
    unique: number;
    incomplete: number;
    stuckUnique: number;
    inTier: number;
    l3Narrow: number;
    ms: number;
  }
  for (const difficulty of DIFFICULTIES) {
    const preset = PRESETS[difficulty];
    describe(`${preset.width}×${preset.height}`, () => {
      /** Per chunk, its census once it ran — for the printed line only, never asserted on. */
      const ran: (Census | undefined)[] = [];
      for (let chunk = 0; chunk < CHUNKS; chunk++) {
        it(`trees ${chunk * per}–${(chunk + 1) * per - 1} graded and counted`, () => {
          // Each chunk keeps its own census, so it passes or fails alone (`-t`, any order).
          const c0: Census = {
            tally: {},
            solveWork: 0,
            nodes: 0,
            unique: 0,
            incomplete: 0,
            stuckUnique: 0,
            inTier: 0,
            l3Narrow: 0,
            ms: 0,
          };
          const { tally } = c0;
          const t0 = performance.now();
          for (let k = chunk * per; k < (chunk + 1) * per; k++) {
            const tree = growTree(preset, createRng(`pipe-link-census-${difficulty}-${k}`));
            if (!('masks' in tree)) {
              tally.grow = (tally.grow ?? 0) + 1;
              continue;
            }
            const c = gradeTree(preset, tree, TECHNIQUE_WORK_LIMIT);
            c0.solveWork = Math.max(c0.solveWork, c.solveWork);
            const count = countSolutions(c.board);
            c0.nodes = Math.max(c0.nodes, count.nodes);
            if (!count.complete) c0.incomplete++;
            const isUnique = count.complete && count.count === 1;
            if (isUnique) c0.unique++;
            if (c.status === 'solved') {
              // Sound techniques: a decided board is unique.
              expect(isUnique).toBe(true);
              const key = `L${c.level}`;
              tally[key] = (tally[key] ?? 0) + 1;
              if (meetsTier(c, TIERS[difficulty])) c0.inTier++;
              if (c.level === 3 && c.l1Open < TIERS.hard.minL1Open) c0.l3Narrow++;
            } else {
              tally[c.status] = (tally[c.status] ?? 0) + 1;
              if (isUnique) c0.stuckUnique++;
            }
          }
          c0.ms = performance.now() - t0;
          expect(c0.incomplete).toBe(0);
          expect(c0.solveWork).toBeLessThan(TECHNIQUE_WORK_LIMIT);
          expect(Object.values(tally).reduce((a, b) => a + b, 0)).toBe(per);
          ran[chunk] = c0;
        });
      }

      afterAll(() => {
        // Printed only when every chunk ran: a partial run (`-t`) prints nothing rather than a short census.
        if (ran.filter(Boolean).length !== CHUNKS) return;
        const tally: Record<string, number> = {};
        const sum = (f: (c: Census) => number) => (ran as Census[]).reduce((a, c) => a + f(c), 0);
        const max = (f: (c: Census) => number) => Math.max(...(ran as Census[]).map(f));
        for (const c of ran as Census[]) {
          for (const [k, v] of Object.entries(c.tally)) tally[k] = (tally[k] ?? 0) + v;
        }
        const unique = sum((c) => c.unique);
        const inTier = sum((c) => c.inTier);
        console.log(
          `[pipe-link] census ${preset.width}×${preset.height}: ${CENSUS_TREES} trees, ${JSON.stringify(tally)}, ` +
            `unique ${unique} (${pct(unique / CENSUS_TREES)}), unique but stuck ${sum((c) => c.stuckUnique)}, ` +
            `L3 with L1-open under ${TIERS.hard.minL1Open} ${sum((c) => c.l3Narrow)}, count incomplete ${sum((c) => c.incomplete)}, ` +
            `in tier ${inTier} (${pct(inTier / CENSUS_TREES)}), ` +
            `solve work max ${max((c) => c.solveWork)}, count nodes max ${max((c) => c.nodes)}, ${sum((c) => c.ms).toFixed(0)} ms`,
        );
      });
    });
  }
});
