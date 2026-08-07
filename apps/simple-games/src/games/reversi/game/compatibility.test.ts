/**
 * Golden games: what the CPU answers, for one seed, at each strength.
 *
 * The record on the statistics screen was set against these opponents, and a
 * win over "Hard" only means something if Hard still plays the same way. The
 * same determinism is what Undo rests on (§5, §6): take a move back, play it
 * again, and the reply must be the one that came before — a CPU that rerolls
 * turns a take-back into a slot machine.
 *
 * The test player always takes the first legal cell in board order, so the
 * game is fixed without a hand-written move list that could stop being legal
 * for reasons other than the CPU changing.
 *
 * This pins released behaviour; do not edit these strings to go green. If a
 * change to the search or the evaluation is intended, regenerate them and say
 * so in the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuMove, HARD_NODE_LIMIT } from './cpu';
import { legalMovesOf } from './engine';
import { encodeBoard } from './serialize';
import { applyCpuMove, applyPlayerMove, createSession } from './session';
import { BLACK, BOARD_SIZE, initialBoard, type Difficulty } from './types';

const SEED = 'reversi-golden';

const at = (row: number, col: number) => row * BOARD_SIZE + col;

/** Four of the player's turns, each answered by the CPU. */
function playOut(difficulty: Difficulty): string {
  let session = createSession(difficulty, BLACK, SEED);
  for (let turn = 0; turn < 4; turn++) {
    const cell = legalMovesOf(session.board, BLACK)[0]!;
    session = applyPlayerMove(session, cell)!.session;
    const replied = applyCpuMove(session);
    if (replied) session = replied.session;
  }
  return encodeBoard(session.board);
}

describe('games that must never change', () => {
  it('deals the same opening position', () => {
    //   . . . . . . . .
    //   . . . W B . . .   (row 3: white d4, black e4)
    //   . . . B W . . .   (row 4: black d5, white e5)
    expect(encodeBoard(initialBoard())).toBe(
      '0000000000000000000000000002100000012000000000000000000000000000',
    );
  });

  it('answers the same way at each strength', () => {
    // Easy plays its own game; the two reading opponents agree on this short
    // opening, which is what a shallow and a deep read of the same position
    // should do when the position is not yet sharp. They part later, and the
    // point of pinning all three is that none of them may drift.
    expect(playOut('easy')).toBe(
      '0000010000001100010120000012200000222000000000000000000000000000',
    );
    expect(playOut('normal')).toBe(
      '0001000000001000222221000002200000012000000000000000000000000000',
    );
    expect(playOut('hard')).toBe(
      '0001000000001000222221000002200000012000000000000000000000000000',
    );
  });

  it('reads the same first reply for one seed and move count (§5)', () => {
    const board = applyPlayerMove(createSession('hard', BLACK, SEED), at(2, 3))!.session.board;
    expect(chooseCpuMove({ board, player: 2, difficulty: 'hard', seed: SEED, moveCount: 1 })).toBe(
      at(2, 2),
    );
  });

  it('keeps the node budget it promises (§5)', () => {
    // Named here as well as in cpu.ts: this is the bound the games above were
    // generated under, and raising it changes what Hard plays — and what a
    // low-spec phone spends on one reply.
    expect(HARD_NODE_LIMIT).toBe(12_000);
  });
});
