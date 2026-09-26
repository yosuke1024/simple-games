/**
 * The CPU's line (docs/DOTS_AND_BOXES_RULES.md §4). One strength, three
 * tiers, no search tree:
 *
 *   1. an edge that closes a box — two at once first;
 *   2. otherwise a "safe" edge, one that gives no box its third side;
 *   3. otherwise the edge that hands over the fewest boxes, found by letting
 *      the opponent greedily take every box that closes after it.
 *
 * Deliberately no chain/loop endgame theory (the double-cross, §11): the CPU
 * is meant to be a fair opponent inside the 450ms beat, not an unbeatable one.
 *
 * Everything here is deterministic per seed: ties inside a tier go to the
 * first edge of a seeded shuffle, so the same game replayed gives the same
 * reply — which is what makes Undo a take-back rather than a reroll (§5).
 */
import { createRng, shuffled } from './rng';
import { boxesOfEdge, edgesOfBox, EDGE_OPEN, isDrawn, type Board } from './types';

/**
 * What the last choice actually cost, in edges drawn — the candidates tried
 * plus every edge the greedy replies drew in simulation. Exported so the test
 * can judge the CPU by its work rather than by a stopwatch
 * (docs/SUDOKU_RULES.md §7, the same call Connect Four's `searchCost` makes).
 * Written once per choice, so it is only meaningful immediately after one.
 */
export const cpuCost = { work: 0 };

export interface CpuView {
  readonly board: Board;
  readonly seed: string;
  /** The game's move counter — the draw's second half (§4). */
  readonly moveCount: number;
}

/** Sides drawn per box, for the whole board at once. */
function sideCounts(board: Board): Uint8Array {
  const { n } = board;
  const counts = new Uint8Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      let drawn = 0;
      for (const edge of edgesOfBox(n, row, col)) if (isDrawn(board.edges[edge])) drawn += 1;
      counts[row * n + col] = drawn;
    }
  }
  return counts;
}

/**
 * The boxes the opponent takes if the CPU draws `edge` and the opponent then
 * keeps drawing whichever edge closes a box, until none does (§4, tier 3).
 * The set of boxes that greedy run reaches does not depend on the order it
 * takes them in — drawing a closing edge never un-closes another — so the
 * count is the same whichever box the stack happens to pop first.
 */
function boxesGivenAway(
  board: Board,
  counts: Uint8Array,
  edge: number,
  budget: { work: number },
): number {
  const { n } = board;
  const sides = counts.slice();
  const drawn = new Uint8Array(board.edges.length);
  for (let e = 0; e < board.edges.length; e++) drawn[e] = board.edges[e] === EDGE_OPEN ? 0 : 1;

  const ready: number[] = [];
  const draw = (e: number): number => {
    drawn[e] = 1;
    budget.work += 1;
    let closed = 0;
    for (const box of boxesOfEdge(n, e)) {
      sides[box] = sides[box]! + 1;
      if (sides[box] === 4) closed += 1;
      else if (sides[box] === 3) ready.push(box);
    }
    return closed;
  };

  // The CPU's own line closes nothing in this tier (tier 1 would have taken
  // it), so everything counted below is the opponent's.
  draw(edge);
  let given = 0;
  while (ready.length > 0) {
    const box = ready.pop()!;
    if (sides[box] !== 3) continue;
    const row = Math.floor(box / n);
    const col = box % n;
    const missing = edgesOfBox(n, row, col).find((e) => drawn[e] === 0)!;
    given += draw(missing);
  }
  return given;
}

/**
 * The CPU's chosen edge (§4). Never called on a finished board: a board with
 * no open edge never gets a turn.
 */
export function chooseCpuMove(view: CpuView): number {
  const { board, seed, moveCount } = view;
  const { n } = board;
  const counts = sideCounts(board);
  const open: number[] = [];
  for (let edge = 0; edge < board.edges.length; edge++) {
    if (board.edges[edge] === EDGE_OPEN) open.push(edge);
  }
  const order = shuffled(open, createRng(`${seed}:cpu:${moveCount}`));
  const budget = { work: 0 };

  // 1. Close a box, two at once if the board offers it.
  let closing = -1;
  let closingCount = 0;
  for (const edge of order) {
    let closes = 0;
    for (const box of boxesOfEdge(n, edge)) if (counts[box] === 3) closes += 1;
    if (closes > closingCount) {
      closing = edge;
      closingCount = closes;
      if (closes === 2) break;
    }
  }
  if (closing >= 0) {
    cpuCost.work = budget.work;
    return closing;
  }

  // 2. A line that gives no box its third side.
  for (const edge of order) {
    if (boxesOfEdge(n, edge).every((box) => counts[box]! < 2)) {
      cpuCost.work = budget.work;
      return edge;
    }
  }

  // 3. Every line gives something away: give away the least.
  let chosen = order[0]!;
  let fewest = Infinity;
  for (const edge of order) {
    const given = boxesGivenAway(board, counts, edge, budget);
    if (given < fewest) {
      fewest = given;
      chosen = edge;
    }
  }
  cpuCost.work = budget.work;
  return chosen;
}
