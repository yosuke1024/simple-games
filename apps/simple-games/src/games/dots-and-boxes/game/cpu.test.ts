/**
 * The CPU's three tiers (docs/DOTS_AND_BOXES_RULES.md §4), checked as
 * properties over many positions rather than a few hand-picked ones: every
 * reply is legal, a free box is always taken, a box is never handed over
 * while a safe line exists, and when every line hands something over the
 * reply hands over the least — measured by an independent greedy replay
 * written on the engine, not on the CPU's own bookkeeping. The work of a
 * reply is bounded by count, not by a stopwatch (docs/SUDOKU_RULES.md §7).
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuMove, cpuCost } from './cpu';
import { claim, openEdges, sidesDrawn } from './engine';
import { createRng } from './rng';
import {
  BOXES_FOR,
  boxesOfEdge,
  CPU,
  edgesOfBox,
  emptyBoard,
  opponentOf,
  PLAYER,
  type Board,
  type Side,
} from './types';

/** How many boxes a line closes. */
const closes = (board: Board, edge: number): number =>
  boxesOfEdge(board.n, edge).filter((box) => sidesDrawn(board, box) === 3).length;

/** A line that gives no box its third side. */
const isSafe = (board: Board, edge: number): boolean =>
  boxesOfEdge(board.n, edge).every((box) => sidesDrawn(board, box) < 2);

/**
 * Every position of one game, before each of its lines, turns kept by the
 * rules (§2). A careless game draws anywhere; a `careful` one closes a box
 * when it can and otherwise avoids a box's third side while it can — the way
 * people play, and the only way to reach the endgame where every line hands
 * something over, which careless play almost never arrives at.
 */
function playedGame(n: number, seed: string, careful: boolean): Board[] {
  const rng = createRng(seed);
  const pick = (edges: readonly number[]) => edges[Math.floor(rng() * edges.length)]!;
  const seen: Board[] = [];
  let board = emptyBoard(n);
  let side: Side = PLAYER;
  for (;;) {
    const open = openEdges(board);
    if (open.length === 0) return seen;
    seen.push(board);
    let edge = pick(open);
    if (careful) {
      const closing = open.filter((e) => closes(board, e) > 0);
      const safe = open.filter((e) => isSafe(board, e));
      edge = closing.length > 0 ? pick(closing) : safe.length > 0 ? pick(safe) : edge;
    }
    const outcome = claim(board, side, edge)!;
    board = outcome.board;
    if (!outcome.keepsTurn) side = opponentOf(side);
  }
}

/** The boxes the opponent takes after `edge`, replayed on the engine. */
function givenAway(board: Board, edge: number): number {
  let next = claim(board, CPU, edge)!.board;
  let given = 0;
  for (;;) {
    const closing = openEdges(next).find((e) => closes(next, e) > 0);
    if (closing === undefined) return given;
    const outcome = claim(next, PLAYER, closing)!;
    given += outcome.completed.length;
    next = outcome.board;
  }
}

interface View {
  readonly board: Board;
  readonly seed: string;
  readonly moveCount: number;
}

/**
 * Every position worth asking about: all three sizes, careless and careful
 * games, opening to last line. Built once and shared by the tests below.
 */
const POSITIONS: readonly View[] = (() => {
  const out: View[] = [];
  for (const n of Object.values(BOXES_FOR)) {
    for (let game = 0; game < 16; game++) {
      const seed = `cpu-prop-${n}-${game}`;
      for (const [moveCount, board] of playedGame(n, seed, game % 2 === 1).entries()) {
        out.push({ board, seed, moveCount });
      }
    }
  }
  return out;
})();

describe('the CPU’s line (§4)', () => {
  it('is always an open edge, on every size', () => {
    let asked = 0;
    for (const view of POSITIONS) {
      const edge = chooseCpuMove(view);
      expect(view.board.edges[edge], `${view.seed} @${view.moveCount}`).toBe('0');
      asked += 1;
    }
    expect(asked).toBeGreaterThan(300);
  });

  it('always takes a free box, two at once when it can', () => {
    let seen = 0;
    for (const view of POSITIONS) {
      const best = Math.max(...openEdges(view.board).map((e) => closes(view.board, e)));
      if (best === 0) continue;
      seen += 1;
      expect(closes(view.board, chooseCpuMove(view))).toBe(best);
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('never hands over a box while a safe line exists', () => {
    let seen = 0;
    for (const view of POSITIONS) {
      const open = openEdges(view.board);
      if (open.some((e) => closes(view.board, e) > 0)) continue;
      if (!open.some((e) => isSafe(view.board, e))) continue;
      seen += 1;
      expect(isSafe(view.board, chooseCpuMove(view))).toBe(true);
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('hands over the fewest boxes when every line hands over some', () => {
    let seen = 0;
    for (const view of POSITIONS) {
      const open = openEdges(view.board);
      if (open.some((e) => closes(view.board, e) > 0 || isSafe(view.board, e))) continue;
      seen += 1;
      const fewest = Math.min(...open.map((e) => givenAway(view.board, e)));
      expect(givenAway(view.board, chooseCpuMove(view))).toBe(fewest);
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('prefers the line that closes two boxes over one that closes one', () => {
    const n = 3;
    // Box (0,0) needs its right side, and so does the pair (1,0)/(1,1),
    // which share their missing line.
    let board = emptyBoard(n);
    const pairShared = edgesOfBox(n, 1, 0)[3];
    const lines = [
      ...edgesOfBox(n, 0, 0).slice(0, 3),
      ...edgesOfBox(n, 1, 0).filter((e) => e !== pairShared),
      ...edgesOfBox(n, 1, 1).filter((e) => e !== pairShared),
    ];
    for (const edge of new Set(lines)) board = claim(board, PLAYER, edge)!.board;
    for (let moveCount = 0; moveCount < 20; moveCount++) {
      expect(chooseCpuMove({ board, seed: 'two-at-once', moveCount })).toBe(pairShared);
    }
  });

  it('is deterministic for one seed and move count', () => {
    for (const view of POSITIONS) {
      expect(chooseCpuMove(view)).toBe(chooseCpuMove(view));
    }
  });

  it('stays inside a small, counted budget on the largest board', () => {
    // The bound is work, not milliseconds (docs/SUDOKU_RULES.md §7, issue
    // #158): lines drawn by the choice, candidates and simulated replies
    // together. Late 5×5 positions are the worst case — every candidate is
    // simulated there.
    let worst = 0;
    let replies = 0;
    const games = Array.from({ length: 40 }, (_, game) => playedGame(5, `budget-${game}`, true));
    const started = performance.now();
    for (const [game, boards] of games.entries()) {
      for (const [moveCount, board] of boards.entries()) {
        chooseCpuMove({ board, seed: `budget-${game}`, moveCount });
        worst = Math.max(worst, cpuCost.work);
        replies += 1;
      }
    }
    const elapsedMs = performance.now() - started;
    expect(worst).toBeLessThan(5_000);
    expect(worst).toBeGreaterThan(0);
    // Reported for a reader, not judged: see the comment above.
    console.log(
      `dots and boxes CPU: worst ${worst} lines of work over ${replies} 5×5 replies, ` +
        `${(elapsedMs / replies).toFixed(3)}ms average — reported, not asserted`,
    );
  });
});
