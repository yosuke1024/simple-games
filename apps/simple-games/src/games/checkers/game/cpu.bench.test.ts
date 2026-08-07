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
import { beforeAll, describe, expect, it } from 'vitest';
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

const POSITIONS = Array.from({ length: 10 }, (_, i) => playOut(12 + i, `bench-${i}`));

const reply = (board: Board, side: Side) =>
  chooseCpuTurn({ board, side, difficulty: 'hard', seed: 'bench', moveCount: 12 });

/** One position's cost, measured twice to show the number is not luck. */
interface Cost {
  readonly nodes: number;
  readonly again: number;
}

const costs: Cost[] = [];
let msPerReply = 0;

/**
 * Every reply is measured once, here, and the checks below read the numbers.
 *
 * The first version of this file ran the whole set inside each `it()` — four
 * blocks over the same positions, fifty searches for what needs twenty — and CI
 * killed it on the default five-second test timeout. Replacing a wall-clock
 * assertion with a test too slow for a wall-clock timeout is not much of an
 * improvement, so the work happens once.
 *
 * The timeout here is a guard against a hang, not a performance gate: it is
 * two orders of magnitude above what this costs, and nothing is asserted
 * about how long it took.
 */
beforeAll(() => {
  const started = performance.now();
  for (const { board, side } of POSITIONS) {
    expect(reply(board, side)).not.toBeNull();
    const nodes = searchCost.nodes;
    reply(board, side);
    costs.push({ nodes, again: searchCost.nodes });
  }
  msPerReply = (performance.now() - started) / (POSITIONS.length * 2);
}, 120_000);

describe('the hard CPU keeps to its budget', () => {
  it('never visits more nodes than it is allowed', () => {
    for (const cost of costs) expect(cost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
  });

  it('spends exactly the same work twice — the budget is not luck', () => {
    // If the cost varied run to run, the bound above would only be telling us
    // about one lucky run. It is deterministic per position, like the answer.
    for (const cost of costs) expect(cost.again).toBe(cost.nodes);
  });

  it('actually uses the budget — a search that stopped early proves nothing', () => {
    // At least one middlegame must be sharp enough to exhaust the deepening
    // loop, or the bound above would pass on a CPU that had quietly stopped
    // thinking.
    expect(Math.max(...costs.map((cost) => cost.nodes))).toBeGreaterThan(HARD_NODE_LIMIT / 2);
  });

  it('reports what it took in wall-clock, without judging it', () => {
    console.log(
      `checkers hard reply: ${msPerReply.toFixed(1)}ms average over ${POSITIONS.length * 2} ` +
        `replies (node limit ${HARD_NODE_LIMIT}) — reported, not asserted`,
    );
    expect(costs).toHaveLength(POSITIONS.length);
  });
});
