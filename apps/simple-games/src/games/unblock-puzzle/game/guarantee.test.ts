/**
 * The promises of docs/UNBLOCK_PUZZLE_RULES.md §7–§8, measured rather than
 * assumed, on the boards the generator actually deals: every board is legal,
 * unsolved, solvable in exactly its recorded fewest moves, in its tier on
 * both measures, inside its block bounds and its component limit; Hard is
 * harder than Medium on both measures; the same seed is the same board; an
 * Easy or Medium board is the bundled board's own puzzle exactly when it says
 * fallback, which is rare; boards seldom repeat; and the work stays inside
 * its limit.
 *
 * Fixed seeds per tier plus a year of dailies are walked, not sampled: Free
 * Play seeds are minted at play time and cannot all be walked, so a fixed set
 * stands in for them — `-g<n>` tokens and tokens of the shape `newSeedToken`
 * mints — while the dailies are the exact boards every player will see.
 * Every walked board is re-solved by the forward search (the other direction
 * from the generator's) and its solution played through the session; every
 * tenth is re-solved again by the independent brute-force oracle of
 * test-helpers.ts, and every twenty-fifth is played out by following the
 * Hint. (Every bundled board — all Hard boards and dailies, every fallback —
 * is also checked one by one by catalogue*.test.ts.)
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY } from './daily';
import { isSolved, isValidBoard } from './engine';
import {
  CHANGES_KEPT,
  CHANGE_LIMIT,
  COMPONENT_LIMIT,
  DEAL_WORK_LIMIT,
  TIERS,
  baseFor,
  componentKey,
  dailyEntry,
  dailyPuzzle,
  generatePuzzle,
  meetsBlockBounds,
  meetsTier,
  type GeneratedPuzzle,
} from './generator';
import { createRng } from './rng';
import { exploreComponent, solve } from './search';
import { encodeBoard } from './serialize';
import {
  createDailySession,
  doSlide,
  freeSeed,
  hintFor,
  moveCount,
  newSeedToken,
  type UnblockSession,
} from './session';
import { oracleSolve } from './test-helpers';
import { DIFFICULTIES, type Difficulty } from './types';

/**
 * The most work one deal can spend (§8): DEAL_WORK_LIMIT, plus one board's
 * moves past each check that stops a search (the base's way out, a listing,
 * a search-size walk), plus the scans of a component (choosing a start,
 * picking a solved board) of at most COMPONENT_LIMIT boards each. A board
 * has at most 4 moves per free cell and at most 18 free cells, so one
 * board's moves are at most 73 work.
 */
const WORK_BOUND = DEAL_WORK_LIMIT + 2 * COMPONENT_LIMIT + 3 * 73;

/**
 * Deals that fall back to the bundled board as it is (§8), per group, at
 * most. Measured on this walk (the table in §8): easy 14 of 300, medium 56
 * of 300. Hard and the daily deal a bundled board by design and never fall
 * back. A rate drifting up here means the change rule is losing its boards,
 * long before the deal stops being new.
 */
const FALLBACK_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 22,
  medium: 85,
  hard: 0,
  daily: 0,
};

/**
 * Boards dealt to an earlier seed of the same group too, at most. Measured
 * on this walk (§8): easy 1, medium 2, hard 21 of 500, the dailies 0. Two
 * Easy or Medium seeds repeat a board when they reach the same component the
 * same way, or fall back to the same bundled board; two Hard seeds when they
 * pick the same bundled board. The daily never does within the Medium list's
 * length in days: it steps through the list (`dailyEntry`).
 */
const REPEAT_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 4,
  medium: 8,
  hard: 32,
  daily: 0,
};

/** `-g<n>` seeds per tier, then seeds with tokens of the shape `newSeedToken` mints. */
const G_SEEDS = 200;
const MINTED_SEEDS: Record<Difficulty, number> = { easy: 100, medium: 100, hard: 300 };
const DAILY_DAYS = 365;
const GROUPS = [...DIFFICULTIES, 'daily'] as const;

/** 2026-10-17 00:00 UTC — the minted tokens' clock, fixed. */
const MINT_EPOCH = Date.UTC(2026, 9, 17);

interface Run {
  readonly name: string;
  /** The seed, or for a daily its date. */
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly group: Difficulty | 'daily';
  readonly puzzle: GeneratedPuzzle;
  /** Boards a breadth-first search expands to prove the minimum (§7), from the forward search. */
  readonly explored: number;
  readonly ms: number;
}

function walk(): Run[] {
  const runs: Run[] = [];
  const timed = (name: string, seed: string, difficulty: Difficulty, group: Run['group']): Run => {
    const t0 = performance.now();
    const puzzle = group === 'daily' ? dailyPuzzle(seed) : generatePuzzle(seed, difficulty);
    const ms = performance.now() - t0;
    const forward = solve(puzzle.board, COMPONENT_LIMIT);
    const explored = forward.status === 'solved' ? forward.exploredStates : -1;
    return { name, seed, difficulty, group, puzzle, explored, ms };
  };
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= G_SEEDS; n++) {
      const seed = `unblock-puzzle-${difficulty}-g${n}`;
      runs.push(timed(seed, seed, difficulty, difficulty));
    }
    const random = createRng(`unblock-puzzle-minted-${difficulty}`);
    for (let n = 1; n <= MINTED_SEEDS[difficulty]; n++) {
      const seed = freeSeed(difficulty, newSeedToken(MINT_EPOCH + n * 7_919_000, random));
      runs.push(timed(seed, seed, difficulty, difficulty));
    }
  }
  let date = '2026-10-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push(timed(`daily ${date}`, date, DAILY_DIFFICULTY, 'daily'));
    date = addDays(date, 1);
  }
  return runs;
}

const started = performance.now();
const runs = walk();
const walkMs = performance.now() - started;

const again = (run: Run): GeneratedPuzzle =>
  run.group === 'daily' ? dailyPuzzle(run.seed) : generatePuzzle(run.seed, run.difficulty);

/**
 * The walk in consecutive slices of 100 boards, one `it()` each: re-solving,
 * listing and replaying every board is a few seconds in all, too much for one
 * case under the 5 s per-test timeout beside the rest of the suite
 * (docs/ARCHITECTURE.md「CI / リリース」). Slices, not 1,465 cases, so the
 * report stays readable.
 */
const SLICE = 100;
const slices = Array.from({ length: Math.ceil(runs.length / SLICE) }, (_, index) => {
  const part = runs.slice(index * SLICE, (index + 1) * SLICE);
  return { label: `${part[0]!.name} … ${part[part.length - 1]!.name}`, part };
});

/** A session around a dealt board, to play its solution through the session's own rules. */
const SHELL = createDailySession('2026-10-01');
const sessionOf = (puzzle: GeneratedPuzzle): UnblockSession => ({
  ...SHELL,
  start: puzzle.board,
  board: puzzle.board,
  minMoves: puzzle.minMoves,
});

describe('every dealt board (§7, §8)', () => {
  it('is legal, unsolved, in its tier on both measures, inside its bounds', () => {
    for (const { name, difficulty, puzzle, explored } of runs) {
      const spec = TIERS[difficulty];
      expect(isValidBoard(puzzle.board), name).toBe(true);
      expect(isSolved(puzzle.board), name).toBe(false);
      expect(meetsTier(spec, puzzle.minMoves, explored), name).toBe(true);
      expect(meetsBlockBounds(spec, puzzle.board), name).toBe(true);
      expect(puzzle.attempts, name).toBeLessThanOrEqual(CHANGE_LIMIT);
      expect(puzzle.changes, name).toBeLessThanOrEqual(CHANGES_KEPT);
    }
  });

  it.each(slices)(
    'is solved in exactly its fewest moves by the forward search, played through the session, in a component that fits: $label',
    ({ part }) => {
      for (const { name, puzzle, difficulty } of part) {
        const forward = solve(puzzle.board, COMPONENT_LIMIT);
        expect(forward.status, name).toBe('solved');
        if (forward.status !== 'solved') continue;
        expect(forward.minMoves, name).toBe(puzzle.minMoves);
        let session = sessionOf(puzzle);
        for (const move of forward.solution) session = doSlide(session, move.block, move.to)!;
        expect(session.status, name).toBe('solved');
        expect(moveCount(session), name).toBe(puzzle.minMoves);
        // The whole component fits the Hint's limit, so no Hint on this board
        // or any board reached from it is cut short (§6); and Hard deals one
        // of the boards furthest from the exit (§7).
        const listed = exploreComponent(puzzle.board, COMPONENT_LIMIT);
        expect(listed.status, name).toBe('complete');
        if (listed.status === 'complete' && TIERS[difficulty].farthest) {
          expect(puzzle.minMoves, name).toBe(listed.component.maxDistance);
        }
      }
    },
  );

  // One case per board: an Easy or Medium deal is milliseconds, 59 of them
  // too long together for one case on a slow machine (the slices above say
  // why).
  it.each(runs.filter((_, index) => index % 25 === 0))(
    'is deterministic: the same seed is the same board — $name',
    (run) => {
      const twice = again(run);
      expect(encodeBoard(twice.board), run.name).toBe(encodeBoard(run.puzzle.board));
      expect(twice.minMoves, run.name).toBe(run.puzzle.minMoves);
      expect(twice.work, run.name).toBe(run.puzzle.work);
    },
  );

  it('deals Hard and the daily as bundled boards, and changes Easy and Medium', () => {
    for (const run of runs) {
      const bundled =
        run.group === 'daily' ? dailyEntry(run.seed) : baseFor(run.seed, run.difficulty);
      expect(run.puzzle.base, run.name).toBe(bundled.index);
      if (run.group === 'daily' || !TIERS[run.difficulty].changes) {
        expect(encodeBoard(run.puzzle.board), run.name).toBe(encodeBoard(bundled.board));
        expect(run.puzzle.minMoves, run.name).toBe(bundled.minMoves);
        expect([run.puzzle.work, run.puzzle.changes, run.puzzle.fallback], run.name).toEqual([
          0,
          0,
          false,
        ]);
      }
    }
  });

  it('is the bundled board’s own puzzle exactly when it says fallback', () => {
    // Every board of a component has the same blocks: a board whose blocks
    // differ from the bundled board's is in another component, a new puzzle.
    for (const run of runs.filter((r) => r.group !== 'daily' && TIERS[r.difficulty].changes)) {
      const base = baseFor(run.seed, run.difficulty);
      if (run.puzzle.fallback) {
        expect(encodeBoard(run.puzzle.board), run.name).toBe(encodeBoard(base.board));
        expect(run.puzzle.changes, run.name).toBe(0);
      } else {
        expect(run.puzzle.changes, run.name).toBeGreaterThan(0);
        expect(componentKey(run.puzzle.board), run.name).not.toBe(componentKey(base.board));
      }
    }
  });

  it('rarely falls back, and seldom repeats a board', () => {
    for (const group of GROUPS) {
      const subset = runs.filter((run) => run.group === group);
      const fallbacks = subset.filter((run) => run.puzzle.fallback).length;
      const distinct = new Set(subset.map((run) => encodeBoard(run.puzzle.board))).size;
      // A deal that kept fewer than CHANGES_KEPT changes before CHANGE_LIMIT
      // tries ran out stopped at its work limit.
      const capped = subset.filter(
        (run) =>
          run.puzzle.attempts > 0 &&
          run.puzzle.attempts < CHANGE_LIMIT &&
          run.puzzle.changes < CHANGES_KEPT,
      ).length;
      console.log(
        `[unblock-puzzle] ${group}: ${fallbacks}/${subset.length} fell back, ` +
          `${distinct} distinct boards, ${capped} stopped at the work limit`,
      );
      expect(fallbacks, group).toBeLessThanOrEqual(FALLBACK_BUDGET[group]);
      expect(subset.length - distinct, group).toBeLessThanOrEqual(REPEAT_BUDGET[group]);
    }
  });
});

describe('the tiers are what they say (§7)', () => {
  const of = (group: Difficulty | 'daily', key: 'minMoves' | 'explored'): number[] =>
    runs
      .filter((run) => run.group === group)
      .map((run) => (key === 'minMoves' ? run.puzzle.minMoves : run.explored))
      .sort((a, b) => a - b);
  const median = (values: readonly number[]): number => values[Math.floor(values.length / 2)]!;

  it('Hard needs more moves than any Medium board, and searches wider', () => {
    const hard = of('hard', 'minMoves');
    const medium = of('medium', 'minMoves');
    expect(hard[0]!).toBeGreaterThan(medium[medium.length - 1]!);
    expect(hard[0]!).toBeGreaterThanOrEqual(20);
    // The measured Hard median is 24 moves; a drift below 22 is a weaker tier.
    expect(median(hard)).toBeGreaterThanOrEqual(22);
    expect(median(of('hard', 'explored'))).toBeGreaterThan(median(of('medium', 'explored')));
    expect(median(of('medium', 'minMoves'))).toBeGreaterThan(median(of('easy', 'minMoves')));
  });

  it('spreads Easy, Medium and the daily over their whole bands, not only the low end', () => {
    for (const group of ['easy', 'medium', 'daily'] as const) {
      const spec = TIERS[group === 'daily' ? DAILY_DIFFICULTY : group];
      const seen = new Set(of(group, 'minMoves'));
      for (let moves = spec.minMoves; moves <= spec.maxMoves; moves++) {
        expect(seen.has(moves), `${group} never deals ${moves}`).toBe(true);
      }
    }
  });

  it('deals the daily at medium, every day', () => {
    for (const run of runs.filter((r) => r.group === 'daily')) {
      expect(run.difficulty).toBe('medium');
      expect(meetsTier(TIERS.medium, run.puzzle.minMoves, run.explored)).toBe(true);
    }
  });
});

/**
 * One case per tenth walked board: the oracle builds strings and sets, and
 * a whole Hard component takes it milliseconds — fine per case, too much
 * for one `it()` under the 5 s per-test timeout beside the rest of the
 * suite (docs/ARCHITECTURE.md「CI / リリース」).
 */
describe('an independent brute-force oracle agrees (§8)', () => {
  it.each(runs.filter((_, index) => index % 10 === 0))(
    'agrees on the fewest moves and the search size of $name',
    ({ puzzle, explored }) => {
      expect(oracleSolve(puzzle.board)).toEqual({ minMoves: puzzle.minMoves, explored });
    },
  );
});

/**
 * The Hint followed from the dealt board to the exit, on every twenty-fifth
 * walked board — Hard included — through the session's own rules (§6): it
 * ends in exactly the fewest moves.
 */
describe('the Hint, followed (§6)', () => {
  it.each(runs.filter((_, index) => index % 25 === 0))(
    'solves $name in exactly its fewest moves',
    ({ name, puzzle }) => {
      let session = sessionOf(puzzle);
      for (let step = 0; step <= puzzle.minMoves && session.status === 'playing'; step++) {
        const hint = hintFor(session);
        expect(hint?.kind, name).toBe('move');
        if (hint?.kind !== 'move') return;
        session = doSlide(session, hint.block, hint.to)!;
      }
      expect(session.status, name).toBe('solved');
      expect(moveCount(session), name).toBe(puzzle.minMoves);
    },
  );
});

/**
 * §8 budgets a deal per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted.
 */
describe('generation cost (§8)', () => {
  const pct = (sorted: readonly number[], p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

  it('stays inside the work limit on every board', () => {
    for (const group of GROUPS) {
      const subset = runs.filter((run) => run.group === group);
      const works = subset.map((run) => run.puzzle.work).sort((a, b) => a - b);
      const times = subset.map((run) => run.ms).sort((a, b) => a - b);
      const moves = subset.map((run) => run.puzzle.minMoves).sort((a, b) => a - b);
      const worst = subset.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
      console.log(
        `[unblock-puzzle] ${group}: n=${subset.length} work p50=${pct(works, 0.5)} ` +
          `p90=${pct(works, 0.9)} max=${works[works.length - 1]} ` +
          `moves p50=${pct(moves, 0.5)} max=${moves[moves.length - 1]} ` +
          `ms p50=${pct(times, 0.5).toFixed(2)} max=${times[times.length - 1]!.toFixed(2)}`,
      );
      expect(
        worst.puzzle.work,
        `worst work ${worst.puzzle.work} at ${worst.name}`,
      ).toBeLessThanOrEqual(WORK_BOUND);
    }
    console.log(
      `[unblock-puzzle] ${runs.length} boards — ms=${walkMs.toFixed(0)} for the whole walk`,
    );
  });
});
