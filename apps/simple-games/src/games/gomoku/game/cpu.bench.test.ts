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
 * machine this was written on, against ~256ms here. That measurement belongs
 * in a commit message and a rule document, not in an assertion that fails
 * when a runner is busy.
 */
import { describe, expect, it } from 'vitest';
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

const POSITIONS = Array.from({ length: 10 }, (_, i) => playOut(10 + i * 2, `bench-${i}`));

const reply = (board: Board, player: Player) =>
  chooseCpuMove({ board, player, difficulty: 'hard', seed: 'bench', moveCount: 20 });

describe('the hard CPU keeps to its budget', () => {
  it('never visits more nodes than it is allowed', () => {
    for (const { board, player } of POSITIONS) {
      expect(reply(board, player)).not.toBeNull();
      expect(searchCost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
    }
  });

  it('spends exactly the same work twice — the budget is not luck', () => {
    for (const { board, player } of POSITIONS) {
      reply(board, player);
      const first = searchCost.nodes;
      reply(board, player);
      expect(searchCost.nodes).toBe(first);
    }
  });

  it('actually uses the budget — a search that stopped early proves nothing', () => {
    const costs = POSITIONS.map(({ board, player }) => {
      reply(board, player);
      return searchCost.nodes;
    });
    expect(Math.max(...costs)).toBeGreaterThan(HARD_NODE_LIMIT / 2);
  });

  it('reports what it took in wall-clock, without judging it', () => {
    const started = performance.now();
    for (const { board, player } of POSITIONS) reply(board, player);
    const perReply = (performance.now() - started) / POSITIONS.length;
    console.log(
      `gomoku hard reply: ${perReply.toFixed(1)}ms average over ${POSITIONS.length} ` +
        `positions (node limit ${HARD_NODE_LIMIT}) — reported, not asserted`,
    );
    expect(POSITIONS).toHaveLength(10);
  });
});
