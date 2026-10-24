/**
 * The problem generator (docs/PEG_SOLITAIRE_RULES.md §8): every pairing of a
 * starting empty hole with a target hole on a board, kept only when the
 * solver proves it can end with one peg in the target.
 *
 * It does not run at play time. Its output for the triangle is bundled as a
 * literal table (problems.ts `TRIANGLE_PROBLEMS`), and guarantee.test.ts runs
 * this function again on every test run and requires the same table — so the
 * bundled boards are this generator's own output, re-checked, never typed in
 * by hand or taken from anywhere else.
 *
 * Each pair is one exact search with its own node limit. A pair whose search
 * hits the limit is reported in `capped` and is not adopted: a problem is
 * dealt only on a proof, never on a guess. For the triangle every search
 * finishes well inside the limit (guarantee.test.ts asserts `capped` is
 * empty). The cross is not enumerated — 33 × 33 exhaustive searches over its
 * state space are far past any budget — and its one problem is verified on
 * its own (§8).
 */
import type { BoardGeometry } from './boards';
import { initialPegs } from './engine';
import { solve, SOLVER_NODE_LIMIT } from './solver';
import type { Problem } from './types';

/** What one pair's search cost and decided. */
export interface PairWork {
  readonly start: number;
  readonly target: number;
  readonly status: 'solved' | 'unsolvable' | 'capped';
  readonly nodes: number;
}

export interface Enumeration {
  /** The adopted problems, by start hole and then target hole. */
  readonly problems: readonly Problem[];
  /** Every pair searched, in the same order, with its verdict and work. */
  readonly work: readonly PairWork[];
  /** Pairs left undecided by the node limit — never adopted. */
  readonly capped: readonly PairWork[];
}

export function enumerateSolvableProblems(
  geometry: BoardGeometry,
  nodeLimit: number = SOLVER_NODE_LIMIT,
): Enumeration {
  const problems: Problem[] = [];
  const work: PairWork[] = [];
  const holes = geometry.holes.length;
  for (let start = 0; start < holes; start++) {
    const pegs = initialPegs(geometry, start);
    for (let target = 0; target < holes; target++) {
      const result = solve(geometry, pegs, target, nodeLimit);
      work.push({ start, target, status: result.status, nodes: result.nodes });
      if (result.status === 'solved') problems.push({ kind: geometry.kind, start, target });
    }
  }
  return { problems, work, capped: work.filter((pair) => pair.status === 'capped') };
}
