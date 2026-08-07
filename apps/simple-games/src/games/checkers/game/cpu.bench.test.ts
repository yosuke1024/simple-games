/**
 * What the hard CPU costs (docs/CHECKERS_RULES.md §4).
 *
 * **This gate watches deterministic work, not the clock.** A wall-clock
 * threshold in `pnpm test` measures the runner it happened to land on, and a
 * shared CI machine is exactly where that goes wrong; this repository already
 * settled the question for the generation-cost tests, which bound the search
 * effort and say so — 「壁時計は判定していない」
 * (docs/RELEASE_CHECKLIST.md, docs/SUDOKU_RULES.md §7). This file follows
 * them: the assertions are on nodes visited, which is the same number on
 * every machine, and the elapsed time is printed for a reader rather than
 * judged.
 *
 * The node budget itself was chosen by measuring against the opponents
 * already shipped — Reversi ~248ms a reply and Connect Four ~301ms on the
 * machine this was written on, against ~136ms here. That measurement belongs
 * in a commit message and a rule document, not in an assertion that fails
 * when a runner is busy.
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuTurn, HARD_NODE_LIMIT, searchCost } from './cpu';
import { applyStep, legalMoves } from './engine';
import { createRng } from './rng';
import { PLAYER, initialBoard, opponentOf, type Board, type Side } from './types';

/** Plays `plies` pseudo-random turns to reach a middlegame worth measuring. */
function playOut(plies: number, seed: string): { board: Board; side: Side } {
  const rng = createRng(seed);
  let board = initialBoard();
  let side: Side = PLAYER;
  for (let ply = 0; ply < plies; ply++) {
    let moves = legalMoves(board, side);
    if (moves.length === 0) break;
    let move = moves[Math.floor(rng() * moves.length)]!;
    let outcome = applyStep(board, move);
    while (outcome.continueFrom !== null) {
      moves = legalMoves(outcome.board, side, outcome.continueFrom);
      move = moves[Math.floor(rng() * moves.length)]!;
      outcome = applyStep(outcome.board, move);
    }
    board = outcome.board;
    side = opponentOf(side);
  }
  return { board, side };
}

const POSITIONS = Array.from({ length: 12 }, (_, i) => playOut(12 + i, `bench-${i}`));

const reply = (board: Board, side: Side) =>
  chooseCpuTurn({ board, side, difficulty: 'hard', seed: 'bench', moveCount: 12 });

describe('the hard CPU keeps to its budget', () => {
  it('never visits more nodes than it is allowed', () => {
    for (const { board, side } of POSITIONS) {
      expect(reply(board, side)).not.toBeNull();
      expect(searchCost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
    }
  });

  it('spends exactly the same work twice — the budget is not luck', () => {
    // If the cost varied run to run, the bound above would only be telling us
    // about one lucky run. It is deterministic per position, like the answer.
    for (const { board, side } of POSITIONS) {
      reply(board, side);
      const first = searchCost.nodes;
      reply(board, side);
      expect(searchCost.nodes).toBe(first);
    }
  });

  it('actually uses the budget — a search that stopped early proves nothing', () => {
    // At least one middlegame must be sharp enough to exhaust the deepening
    // loop, or the bound above would pass on a CPU that had quietly stopped
    // thinking.
    const costs = POSITIONS.map(({ board, side }) => {
      reply(board, side);
      return searchCost.nodes;
    });
    expect(Math.max(...costs)).toBeGreaterThan(HARD_NODE_LIMIT / 2);
  });

  it('reports what it took in wall-clock, without judging it', () => {
    const started = performance.now();
    for (const { board, side } of POSITIONS) reply(board, side);
    const perReply = (performance.now() - started) / POSITIONS.length;
    console.log(
      `checkers hard reply: ${perReply.toFixed(1)}ms average over ${POSITIONS.length} ` +
        `positions (node limit ${HARD_NODE_LIMIT}) — reported, not asserted`,
    );
    expect(POSITIONS).toHaveLength(12);
  });
});
