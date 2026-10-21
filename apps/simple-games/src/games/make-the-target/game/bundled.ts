/**
 * The bundled problems of docs/MAKE_THE_TARGET_RULES.md §6「同梱の問題」 —
 * shipped only when a problem's work budget runs out.
 *
 * Every problem here was made by this game's own generator (`generateFresh`
 * within WORK_LIMIT) from the seed beside it, `make-the-target-bundled-
 * <difficulty>-<k>` for k = 1, 2, …, skipping a seed that ran out of budget or
 * that repeats an earlier row's numbers and target — no problem is hand-made
 * or taken from anywhere else. `bundled.test.ts`
 * regenerates the seeds and expects these exact problems, and re-counts each
 * one with the enumeration that keeps no memo (test-helpers.ts) to check its
 * tier, its solution and its counts. If the generator changes, that test
 * fails here first: rewrite the table with `bundled.generate.test.ts` rather
 * than editing a problem by hand.
 *
 * One row per problem: `[k, numbers, target, solution, ways,
 * waysWithoutDivision]` — `k` names the seed, `solution` is a move string
 * (§10), and the two counts are what the fallback reports, so shipping one
 * needs no search.
 */
import type { Difficulty } from './types';

export interface BundledProblem {
  /** The seed `generateFresh` made this problem from (its provenance). */
  readonly seed: string;
  readonly numbers: readonly number[];
  readonly target: number;
  readonly solution: string;
  readonly ways: number;
  readonly waysWithoutDivision: number;
}

/** How many problems each tier bundles (§6). */
export const BUNDLED_PER_TIER = 24;

type Row = readonly [
  k: number,
  numbers: readonly number[],
  target: number,
  solution: string,
  ways: number,
  waysWithoutDivision: number,
];

/** The seed of a bundled problem (§6). */
export const bundledSeed = (difficulty: Difficulty, k: number): string =>
  `make-the-target-bundled-${difficulty}-${k}`;

// prettier-ignore
const ROWS: Record<Difficulty, readonly Row[]> = {
  easy: [
    [1, [1, 3, 3, 5], 24, '1*03+22*0', 12, 7],
    [2, [1, 1, 6, 10], 14, '2-00-13+1', 12, 12],
    [3, [1, 4, 8, 9], 13, '3-12*00+1', 36, 18],
    [4, [2, 3, 7, 9], 17, '2+11-03+0', 22, 19],
    [5, [5, 6, 8, 10], 17, '3+00+22-1', 19, 19],
    [6, [1, 3, 7, 8], 19, '1+03+00+2', 18, 17],
    [7, [3, 4, 8, 8], 20, '2*03-10-1', 8, 7],
    [8, [4, 4, 9, 10], 16, '3-20*11*2', 6, 3],
    [9, [2, 3, 4, 6], 24, '3*11+00+2', 24, 18],
    [10, [1, 3, 6, 7], 11, '2-13+11+0', 29, 23],
    [11, [1, 4, 5, 6], 14, '3*02*11-0', 28, 22],
    [12, [2, 5, 6, 6], 18, '2+00-13*1', 6, 5],
    [13, [2, 4, 6, 10], 10, '3-11+22-0', 45, 26],
    [14, [2, 2, 3, 4], 22, '3*11+22*0', 5, 5],
    [15, [1, 1, 2, 8], 11, '3+02*10+1', 36, 18],
    [16, [3, 5, 8, 9], 10, '1-03*00-2', 15, 8],
    [17, [1, 6, 6, 8], 12, '3-11*02*0', 10, 5],
    [19, [2, 4, 6, 10], 14, '1-03+22-0', 26, 19],
    [20, [8, 8, 8, 10], 14, '3-01+22-0', 5, 5],
    [21, [1, 4, 6, 10], 21, '2+11+33+0', 18, 18],
    [22, [1, 3, 4, 8], 21, '3+02*11+0', 9, 9],
    [23, [2, 2, 2, 5], 14, '3*22+00+1', 5, 5],
    [24, [1, 1, 3, 6], 10, '2-03-11*0', 38, 20],
    [25, [1, 2, 2, 7], 14, '1-03*00*2', 11, 6],
  ],
  medium: [
    [1, [3, 3, 6, 7, 9], 32, '2/14*00+33-1', 35, 5],
    [2, [5, 7, 8, 8, 9], 19, '2+33+14-01-0', 127, 119],
    [3, [2, 5, 6, 10], 47, '2/03*11-0', 2, 0],
    [4, [7, 7, 8, 9, 10], 20, '3-02+11*00-4', 42, 17],
    [5, [2, 5, 7, 9, 10], 42, '4-03-20*11+2', 80, 73],
    [6, [1, 6, 6, 10], 25, '1*22-00-3', 5, 5],
    [7, [7, 7, 8, 9], 28, '3-12/10*1', 3, 0],
    [8, [4, 8, 10, 10], 10, '1/02+33/0', 5, 0],
    [9, [5, 5, 5, 6, 7], 28, '4+20+11+33+2', 57, 45],
    [10, [3, 4, 5, 6, 10], 24, '3-14+22-00*1', 154, 83],
    [11, [1, 2, 6, 7, 8], 41, '4-00*32+13-1', 40, 29],
    [12, [6, 7, 8, 10], 14, '3+00*11/2', 5, 0],
    [13, [3, 3, 10, 10, 10], 36, '4+02+10+33+1', 31, 26],
    [14, [2, 2, 5, 8, 9], 53, '0+13*22+11+4', 97, 65],
    [15, [1, 2, 8, 10], 40, '2*00/13*1', 36, 0],
    [16, [5, 8, 10, 10], 14, '2/01/03+0', 7, 0],
    [17, [3, 5, 5, 8, 9], 44, '2-04+33+11*0', 43, 29],
    [18, [5, 5, 6, 8, 9], 30, '4-23+22-11*0', 107, 103],
    [19, [2, 4, 7, 8, 9], 45, '4-03*22-00-1', 134, 121],
    [20, [1, 3, 9, 10], 13, '2*00/13+1', 12, 0],
    [21, [2, 4, 4, 8, 9], 26, '4+23-11-02*0', 168, 90],
    [22, [2, 3, 7, 10], 26, '2*13/01+0', 2, 0],
    [23, [2, 6, 8, 8, 9], 56, '2+11+00-43*4', 121, 81],
    [24, [2, 8, 8, 10], 32, '3/01*00-2', 9, 6],
  ],
  hard: [
    [1, [2, 3, 9, 20, 24], 51, '2*03-04*00+1', 27, 13],
    [2, [7, 8, 8, 10, 24], 110, '3*01*20-42+4', 38, 37],
    [3, [1, 9, 9, 14, 21], 110, '4-21-02*00+3', 7, 7],
    [4, [4, 6, 10, 24, 25], 62, '4-13-21*00-2', 23, 13],
    [5, [6, 6, 10, 10, 12], 118, '0+14-31*22-3', 29, 25],
    [6, [6, 7, 8, 10, 18], 93, '3-14-00*22-1', 35, 35],
    [7, [6, 7, 8, 8, 19], 231, '1+00+34-23*2', 13, 13],
    [8, [1, 3, 4, 5, 21], 151, '1-03+04*00+2', 7, 7],
    [9, [8, 8, 9, 9, 22], 145, '3-01-04*00-2', 2, 2],
    [10, [3, 6, 6, 17, 25], 117, '3-24*12*01-0', 7, 3],
    [11, [3, 4, 4, 7, 23], 270, '1*24+22*33-0', 1, 1],
    [12, [5, 8, 9, 10, 25], 246, '4*32-13+11-0', 32, 32],
    [13, [6, 7, 10, 10, 25], 135, '4-23+00-12*1', 18, 18],
    [14, [2, 5, 9, 10, 18], 264, '2+14*11+00+3', 14, 14],
    [15, [5, 7, 8, 9, 24], 81, '4+13+00*22-1', 25, 19],
    [16, [2, 2, 5, 6, 19], 63, '4*33+11/00+2', 22, 21],
    [17, [3, 5, 8, 8, 20], 222, '1-04+22*33-0', 5, 5],
    [18, [3, 5, 7, 13, 21], 50, '2*00-14+33+1', 40, 40],
    [19, [4, 8, 8, 10, 25], 282, '2+04*03+10-1', 14, 11],
    [20, [2, 6, 7, 14, 19], 59, '4*13/21/22+0', 32, 22],
    [21, [5, 5, 7, 15, 23], 107, '3*20*12-44+1', 9, 8],
    [22, [2, 3, 7, 16, 21], 283, '2-04-11*33-0', 8, 8],
    [23, [3, 9, 10, 10, 20], 65, '3-01*04/20+2', 3, 0],
    [24, [6, 6, 9, 22, 25], 59, '3-02-14*11-0', 13, 12],
  ],
};

const expand = (difficulty: Difficulty): BundledProblem[] =>
  ROWS[difficulty].map(([k, numbers, target, solution, ways, waysWithoutDivision]) => ({
    seed: bundledSeed(difficulty, k),
    numbers,
    target,
    solution,
    ways,
    waysWithoutDivision,
  }));

export const BUNDLED_PROBLEMS: Record<Difficulty, readonly BundledProblem[]> = {
  easy: expand('easy'),
  medium: expand('medium'),
  hard: expand('hard'),
};
