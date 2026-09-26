/**
 * The search solver — the gate of docs/NUMBER_PATH_RULES.md §6: it counts the
 * paths a board admits, up to two, so the generator ships only boards with
 * exactly one.
 *
 * A depth-first walk from the path's end over the cells not yet visited. What
 * keeps it small is the pruning, applied to every candidate step before it is
 * taken (§6「一意性」):
 *
 *   1. legality — an open step onto an unvisited cell; a numbered cell only
 *      when it is the one due; K only as the very last cell;
 *   2. connectivity — every unvisited cell must still be reachable from the
 *      new end through unvisited cells, or some cell can never be covered;
 *   3. dead ends — an unvisited cell with fewer than two ways in and out
 *      (counting the new end as one) can only be the end of the path, and
 *      only K may be that;
 *   4. the next number — it must be reachable from the new end without
 *      crossing any later number, since those may not be entered yet.
 *
 * `branches` counts the nodes at which two or more candidates survived all
 * four. It is the solver's measure of how far the board is from a single
 * road, and the second axis of the tiers (§6「ティア」). `nodes` is the work,
 * and the budget generation is gated on (`solverWork`).
 */
import { cellCount, startCell } from './engine';
import type { Board, Path } from './types';

export interface SolveResult {
  /** Solutions found: 0, 1, or 2 (the search stops at the second). */
  readonly solutions: number;
  /** The one solution, when exactly one was found. */
  readonly solution: Path | null;
  /** Nodes expanded — the work of this solve. */
  readonly nodes: number;
  /** Nodes at which more than one continuation survived the pruning. */
  readonly branches: number;
}

/**
 * Nodes expanded since the last reset — the unit of work generation is
 * budgeted in. A stopwatch measures this times whatever else the machine is
 * doing; the count is a function of the seed alone and reads the same on
 * every machine, which is what lets the budget be asserted rather than merely
 * observed (TAKUZU_RULES.md §6 makes the same argument). Nothing at runtime
 * reads it.
 */
let expanded = 0;

export const solverWork = {
  read: (): number => expanded,
  reset: (): void => {
    expanded = 0;
  },
};

/**
 * Counts the completions of `prefix` on `board`, stopping at `limit`. The
 * prefix defaults to the bare start; a legal prefix of the player's own is
 * accepted too, which is how a test can ask "how many ways on from here".
 */
export function countSolutions(
  board: Board,
  prefix: Path = [startCell(board)],
  limit = 2,
): SolveResult {
  const count = cellCount(board);
  const { numbers, last, cellOf, adjacent } = board;
  const finish = cellOf[last]!;

  const visited = new Uint8Array(count);
  const seen = new Int32Array(count);
  const queue = new Int32Array(count);
  let stamp = 0;

  const path: number[] = [];
  let due = 1;
  for (const cell of prefix) {
    visited[cell] = 1;
    path.push(cell);
    if (numbers[cell] !== 0) due++;
  }

  let solutions = 0;
  let solution: Path | null = null;
  let nodes = 0;
  let branches = 0;

  /**
   * Whether the board can still be finished once `head` is the end of the
   * path, with `remaining` cells to cover and number `next` due (checks 2–4).
   */
  const viable = (head: number, remaining: number, next: number): boolean => {
    if (remaining === 0) return true;

    // 2 and 3 in one sweep: every unvisited cell reachable from the head
    // through unvisited cells, and — read as each is reached — none of them
    // but K left with fewer than two ways in and out.
    stamp++;
    let qh = 0;
    let qt = 0;
    for (const nb of adjacent[head]!) {
      if (visited[nb] === 0 && seen[nb] !== stamp) {
        seen[nb] = stamp;
        queue[qt++] = nb;
      }
    }
    while (qh < qt) {
      const cell = queue[qh++]!;
      let ways = 0;
      for (const nb of adjacent[cell]!) {
        if (visited[nb] === 0) {
          ways++;
          if (seen[nb] !== stamp) {
            seen[nb] = stamp;
            queue[qt++] = nb;
          }
        } else if (nb === head) {
          ways++;
        }
      }
      if (ways < 2 && cell !== finish) return false;
    }
    if (qt !== remaining) return false;

    // 4. The next number, reachable without crossing a later one. When only
    //    K is left to reach, the sweep above has already answered this.
    if (next === last) return true;
    const target = cellOf[next];
    if (target === undefined) return false;
    stamp++;
    qh = 0;
    qt = 0;
    for (const nb of adjacent[head]!) {
      if (visited[nb] === 0 && seen[nb] !== stamp && (numbers[nb] === 0 || nb === target)) {
        seen[nb] = stamp;
        queue[qt++] = nb;
      }
    }
    while (qh < qt) {
      const cell = queue[qh++]!;
      if (cell === target) return true;
      for (const nb of adjacent[cell]!) {
        if (visited[nb] === 0 && seen[nb] !== stamp && (numbers[nb] === 0 || nb === target)) {
          seen[nb] = stamp;
          queue[qt++] = nb;
        }
      }
    }
    return false;
  };

  const candidates: number[] = [];

  const search = (head: number, remaining: number, next: number): void => {
    if (remaining === 0) {
      if (numbers[head] === last) {
        solutions++;
        solution = solutions === 1 ? [...path] : null;
      }
      return;
    }
    if (numbers[head] === last) return;
    nodes++;

    // 1. Legal steps, then the lookahead of 2–4 on each — collected first so
    //    the node's branching is known before any child is walked.
    const from = candidates.length;
    for (const nb of adjacent[head]!) {
      if (visited[nb] !== 0) continue;
      const number = numbers[nb]!;
      if (number !== 0 && number !== next) continue;
      if (nb === finish && remaining !== 1) continue;
      visited[nb] = 1;
      const ok = viable(nb, remaining - 1, number === 0 ? next : next + 1);
      visited[nb] = 0;
      if (ok) candidates.push(nb);
    }
    const to = candidates.length;
    if (to - from >= 2) branches++;

    for (let i = from; i < to; i++) {
      const nb = candidates[i]!;
      visited[nb] = 1;
      path.push(nb);
      search(nb, remaining - 1, numbers[nb] === 0 ? next : next + 1);
      path.pop();
      visited[nb] = 0;
      if (solutions >= limit) break;
    }
    candidates.length = from;
  };

  const head = path[path.length - 1]!;
  // A prefix that has already painted itself into a corner has no completions.
  if (viable(head, count - path.length, due)) search(head, count - path.length, due);

  expanded += nodes;
  return { solutions, solution: solutions === 1 ? solution : null, nodes, branches };
}

/** Whether the board has exactly one path — the promise of §2 and §6. */
export const isUnique = (board: Board): boolean => countSolutions(board).solutions === 1;
