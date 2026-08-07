/**
 * What the hard CPU costs (docs/GOMOKU_RULES.md §4).
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
 * machine this was written on, against ~283ms here. That measurement belongs
 * in a commit message and a rule document, not in an assertion that fails
 * when a runner is busy.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { candidateMoves, chooseCpuMove, HARD_NODE_LIMIT, searchCost } from './cpu';
import { placeStone } from './engine';
import { createRng } from './rng';
import { BLACK, WHITE, emptyBoard, opponentOf, type Board, type Player } from './types';

/** Plays `stones` pseudo-random moves to reach a middlegame worth measuring. */
function playOut(stones: number, seed: string): { board: Board; player: Player } {
  const rng = createRng(seed);
  let board = placeStone(emptyBoard(), BLACK, 7 * 15 + 7)!;
  let player: Player = WHITE;
  for (let move = 1; move < stones; move++) {
    const open = candidateMoves(board);
    if (open.length === 0) break;
    board = placeStone(board, player, open[Math.floor(rng() * open.length)]!)!;
    player = opponentOf(player);
  }
  return { board, player };
}

const POSITIONS = Array.from({ length: 8 }, (_, i) => playOut(10 + i * 2, `bench-${i}`));

const reply = (board: Board, player: Player) =>
  chooseCpuMove({ board, player, difficulty: 'hard', seed: 'bench', moveCount: 20 });

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
 * blocks over the same positions, forty searches for what needs sixteen — and CI
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
  for (const { board, player } of POSITIONS) {
    expect(reply(board, player)).not.toBeNull();
    const nodes = searchCost.nodes;
    reply(board, player);
    costs.push({ nodes, again: searchCost.nodes });
  }
  msPerReply = (performance.now() - started) / (POSITIONS.length * 2);
}, 120_000);

describe('the hard CPU keeps to its budget', () => {
  it('never visits more nodes than it is allowed', () => {
    for (const cost of costs) expect(cost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
  });

  it('spends exactly the same work twice — the budget is not luck', () => {
    for (const cost of costs) expect(cost.again).toBe(cost.nodes);
  });

  it('actually uses the budget — a search that stopped early proves nothing', () => {
    expect(Math.max(...costs.map((cost) => cost.nodes))).toBeGreaterThan(HARD_NODE_LIMIT / 2);
  });

  it('reports what it took in wall-clock, without judging it', () => {
    console.log(
      `gomoku hard reply: ${msPerReply.toFixed(1)}ms average over ${POSITIONS.length * 2} ` +
        `replies (node limit ${HARD_NODE_LIMIT}) — reported, not asserted`,
    );
    expect(costs).toHaveLength(POSITIONS.length);
  });
});
