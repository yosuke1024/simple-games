/**
 * Depth-first solver (docs/PEG_SOLITAIRE_RULES.md §8, §14): from a position,
 * find jumps that leave exactly one peg, in the target hole.
 *
 * Who calls it — and who does not:
 * - the generator (generator.ts), which decides from it which start/target
 *   pairs of the triangle are solvable — run by the tests, never at play
 *   time: the problems the game deals are a bundled table (problems.ts);
 * - the tests, which verify the cross's standard problem by solving it and
 *   replaying the solution through the rules.
 * The game screen never runs it. There is no Hint (§6), and nothing searches
 * in the background (docs/GAME_LIFECYCLE.md「CPU 探索」).
 *
 * The search is exact: positions proven to lead nowhere are remembered (a
 * set of peg bitmasks) and never searched twice, so an exhausted search is a
 * proof. A node limit bounds the work, and a search that hits it reports
 * 'capped' — never 'unsolvable'. The two must not be confused: the generator
 * would otherwise drop a solvable problem as unsolvable, and a test would
 * otherwise "prove" something it only gave up on.
 *
 * A node is one position visited, a repeat visit of a remembered dead
 * position included, so `nodes` is the work done and never exceeds the limit.
 */
import { isHole, type BoardGeometry } from './boards';
import type { Jump, Pegs } from './types';

/**
 * Comfortable headroom over every search the tests run (§8, §14): the
 * triangle's worst exhaustive pair visits 15,773 positions (an unsolvable
 * pair, its whole reachable space searched) and the cross's standard problem
 * is solved in 30,786. The limit exists so that a pathological call ends in
 * 'capped' instead of a stalled device.
 */
export const SOLVER_NODE_LIMIT = 200_000;

export type SolveResult =
  | { readonly status: 'solved'; readonly jumps: readonly Jump[]; readonly nodes: number }
  | { readonly status: 'unsolvable'; readonly nodes: number }
  | { readonly status: 'capped'; readonly nodes: number };

/**
 * Searches `pegs` for jumps that leave one peg in `target`, visiting at most
 * `nodeLimit` positions.
 *
 * Two inputs are a caller's mistake, not a question with an answer, and
 * throw instead of returning a verdict (an 'unsolvable' must only ever mean
 * an exhausted search):
 * - a limit that is not a whole number from 0 up — NaN or Infinity would
 *   never stop the search, so "no limit" is not something to ask for;
 * - a position of the wrong length for this board — it is not one of this
 *   board's positions at all.
 * A target that is not a hole is a real question with a proven answer: no
 * last peg can stand there, so it is 'unsolvable' without searching.
 */
export function solve(
  geometry: BoardGeometry,
  pegs: Pegs,
  target: number,
  nodeLimit: number = SOLVER_NODE_LIMIT,
): SolveResult {
  if (!Number.isSafeInteger(nodeLimit) || nodeLimit < 0) {
    throw new RangeError(`solve: the node limit must be a whole number ≥ 0, got ${nodeLimit}`);
  }
  if (pegs.length !== geometry.holes.length) {
    throw new RangeError(
      `solve: a ${geometry.kind} position has ${geometry.holes.length} holes, got ${pegs.length}`,
    );
  }
  // A target that is not a hole can never hold the last peg.
  if (!isHole(geometry, target)) return { status: 'unsolvable', nodes: 0 };

  const board = Uint8Array.from(pegs, (peg) => (peg ? 1 : 0));
  // Exact in a double up to 2^53: the cross needs 33 bits, so no bitwise ops.
  const weight = geometry.holes.map((_, i) => 2 ** i);
  let key = 0;
  let count = 0;
  board.forEach((peg, i) => {
    if (peg) {
      key += weight[i]!;
      count++;
    }
  });

  const dead = new Set<number>();
  const path: Jump[] = [];
  const jumps = geometry.jumps;
  let nodes = 0;
  let capped = false;

  const visit = (): boolean => {
    if (nodes >= nodeLimit) {
      capped = true;
      return false;
    }
    nodes++;
    if (count === 1) return board[target] === 1;
    if (dead.has(key)) return false;
    for (const jump of jumps) {
      if (!board[jump.from] || !board[jump.over] || board[jump.to]) continue;
      board[jump.from] = 0;
      board[jump.over] = 0;
      board[jump.to] = 1;
      key += weight[jump.to]! - weight[jump.from]! - weight[jump.over]!;
      count--;
      path.push(jump);
      if (visit()) return true;
      path.pop();
      count++;
      key += weight[jump.from]! + weight[jump.over]! - weight[jump.to]!;
      board[jump.from] = 1;
      board[jump.over] = 1;
      board[jump.to] = 0;
      // A capped subtree proves nothing, so nothing above it may be marked.
      if (capped) return false;
    }
    dead.add(key);
    return false;
  };

  if (visit()) return { status: 'solved', jumps: [...path], nodes };
  return capped ? { status: 'capped', nodes } : { status: 'unsolvable', nodes };
}
