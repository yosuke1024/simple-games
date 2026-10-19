/**
 * The problems this game deals (docs/PEG_SOLITAIRE_RULES.md §3, §8), and the
 * deal itself.
 *
 * - The cross has one problem: start with the middle hole empty, finish with
 *   one peg in it — the standard game. guarantee.test.ts and solver.test.ts
 *   prove it solvable by solving it and replaying the jumps through the rules.
 * - The triangle has the 54 pairings of a starting empty hole and a target
 *   hole that can end with one peg in the target, out of 15 × 15. The table
 *   below is the output of the generator (generator.ts) over the triangle's
 *   whole state space, bundled so that nothing is searched at play time;
 *   guarantee.test.ts re-runs the generator and requires this exact table,
 *   and checks it again against an independent breadth-first oracle.
 *
 * A new triangle game deals one entry, uniformly, from a seeded generator:
 * the same seed always deals the same problem (compatibility.test.ts pins a
 * few). The deal is a table lookup — there is no work to bound, and nothing
 * to fall back from.
 *
 * Saves name a problem by its board, start and target (§11); one that is not
 * in this table could not have been dealt, and is refused on load.
 */
import { ENGLISH_CENTER } from './boards';
import { createRng } from './rng';
import { isBoardKind, type BoardKind, type Problem } from './types';

export const ENGLISH_PROBLEM: Problem = {
  kind: 'english',
  start: ENGLISH_CENTER,
  target: ENGLISH_CENTER,
};

/**
 * [start, target] by hole index (boards.ts: row by row from the apex, left to
 * right — index = row × (row + 1) / 2 + place). Sorted by start, then target.
 * Generated, not written: see the header. Do not edit by hand.
 */
const TRIANGLE_PAIRS: readonly (readonly [start: number, target: number])[] = [
  [0, 0],
  [0, 6],
  [0, 9],
  [0, 12],
  [1, 1],
  [1, 5],
  [1, 10],
  [1, 13],
  [2, 2],
  [2, 3],
  [2, 11],
  [2, 14],
  [3, 2],
  [3, 3],
  [3, 8],
  [3, 11],
  [3, 14],
  [4, 12],
  [5, 1],
  [5, 5],
  [5, 7],
  [5, 10],
  [5, 13],
  [6, 0],
  [6, 6],
  [6, 9],
  [6, 12],
  [7, 5],
  [8, 3],
  [9, 0],
  [9, 6],
  [9, 9],
  [9, 12],
  [10, 1],
  [10, 5],
  [10, 10],
  [10, 13],
  [11, 2],
  [11, 3],
  [11, 11],
  [11, 14],
  [12, 0],
  [12, 4],
  [12, 6],
  [12, 9],
  [12, 12],
  [13, 1],
  [13, 5],
  [13, 10],
  [13, 13],
  [14, 2],
  [14, 3],
  [14, 11],
  [14, 14],
];

export const TRIANGLE_PROBLEMS: readonly Problem[] = TRIANGLE_PAIRS.map(([start, target]) => ({
  kind: 'triangle',
  start,
  target,
}));

export const PROBLEMS: Readonly<Record<BoardKind, readonly Problem[]>> = {
  english: [ENGLISH_PROBLEM],
  triangle: TRIANGLE_PROBLEMS,
};

export const sameProblem = (a: Problem, b: Problem): boolean =>
  a.kind === b.kind && a.start === b.start && a.target === b.target;

/**
 * The table's own entry for this board, start and target, or null when the
 * pairing is not one this game deals (§11 refuses such a save). A `kind` that
 * is not one of the two boards — say, a value read off the disk that names a
 * property every object has, like 'toString' — deals nothing either.
 */
export function findProblem(kind: unknown, start: unknown, target: unknown): Problem | null {
  if (!isBoardKind(kind)) return null;
  return (
    PROBLEMS[kind].find((problem) => problem.start === start && problem.target === target) ?? null
  );
}

/**
 * A token that makes one game's seed its own: the time of the deal and a
 * random draw, like the other titles' free-play seeds (mancala, 2048,
 * block-puzzle). The two defaults are the only clock and entropy in game/;
 * tests pass their own. The seed then pins the deal down completely.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const dealSeed = (kind: BoardKind, token: string): string =>
  `peg-solitaire-${kind}-${token}`;

/**
 * Deals one problem for `kind` from `seed` (§8). With `avoid`, the problem
 * just played is left out of the draw when there is anything else to deal,
 * so "New board" never hands back the board it replaces. The cross has one
 * problem and always deals it.
 *
 * `kind` must already be one of the two boards: the `pg.prefs` validator
 * checks a stored board with `isBoardKind` and falls back to the cross
 * (§11). Anything else is a caller's mistake and throws — it never deals
 * `undefined` or a board nobody asked for.
 */
export function dealProblem(kind: BoardKind, seed: string, avoid?: Problem): Problem {
  if (!isBoardKind(kind)) throw new TypeError(`dealProblem: not a board: ${String(kind)}`);
  const all = PROBLEMS[kind];
  const pool =
    avoid && all.length > 1 ? all.filter((problem) => !sameProblem(problem, avoid)) : all;
  const rng = createRng(seed);
  return pool[Math.floor(rng() * pool.length)]!;
}
