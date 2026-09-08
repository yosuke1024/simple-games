/**
 * Golden games: what the CPU answers, for one seed, at each strength.
 *
 * The record on the statistics screen was set against these opponents, and a
 * win over "Hard" only means something if Hard still plays the same way. The
 * same determinism is what Undo rests on (§4, §5): take a move back, play it
 * again, and the reply must be the one that came before — a CPU that rerolls
 * turns a take-back into a slot machine.
 *
 * The test player drops in a rotating column, so the game is fixed without a
 * hand-written move list that could stop being legal for reasons other than
 * the CPU changing. It plays badly on purpose: every opponent beats it, and
 * that is what makes the finished boards worth comparing.
 *
 * This pins released behaviour; do not edit these strings to go green. If a
 * change to the search or the evaluation is intended, regenerate them and say
 * so in the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuMove, HARD_NODE_LIMIT } from './cpu';
import { legalColumns } from './engine';
import { encodeBoard } from './serialize';
import { applyCpuMove, applyPlayerMove, createSession, type ConnectFourSession } from './session';
import { PLAYER, type Difficulty } from './types';

const SEED = 'connect-four-golden';

function playOut(difficulty: Difficulty): { board: string; status: string } {
  let session: ConnectFourSession = createSession(difficulty, PLAYER, SEED);
  for (let turn = 0; turn < 6 && session.status === 'playing'; turn++) {
    const columns = legalColumns(session.board);
    const played = applyPlayerMove(session, columns[turn % columns.length]!);
    if (!played) break;
    session = played.session;
    if (session.status !== 'playing') break;
    const replied = applyCpuMove(session);
    if (replied) session = replied.session;
  }
  return { board: encodeBoard(session.board), status: session.status };
}

describe('games that must never change', () => {
  // Three independent games, one of them at `hard`, used to be asserted
  // inside one `it()` — the same shape checkers/game/compatibility.test.ts and
  // gomoku/game/compatibility.test.ts had, and the same fix (issue #158,
  // docs/SUDOKU_RULES.md §7): each difficulty plays out on its own session
  // with nothing shared between them, so splitting into one `it()` per
  // difficulty costs nothing and keeps every case well under the default 5s
  // budget at the 3-5x parallel-run skew §7 measures.
  it('finishes the same way at easy — punishes this player identically to normal', () => {
    expect(playOut('easy')).toEqual({
      board: '000000000000000000000000000000010001112222',
      status: 'lost',
    });
  });

  it('finishes the same way at normal — punishes this player identically to easy', () => {
    expect(playOut('normal')).toEqual({
      board: '000000000000000000000000000000010001112222',
      status: 'lost',
    });
  });

  it('finishes the same way at hard — a different route from easy and normal', () => {
    expect(playOut('hard')).toEqual({
      board: '000000000000000000000000100002222001112100',
      status: 'lost',
    });
  });

  it('answers an opening drop the same way for one seed (§4)', () => {
    const board = applyPlayerMove(createSession('hard', PLAYER, SEED), 3)!.session.board;
    expect(chooseCpuMove({ board, difficulty: 'hard', seed: SEED, moveCount: 1 })).toBe(3);
  });

  it('keeps the node budget it promises (§4)', () => {
    // Named here as well as in cpu.ts: this is the bound the games above were
    // generated under, and raising it changes what Hard plays — and what a
    // low-spec phone spends on one reply.
    expect(HARD_NODE_LIMIT).toBe(30_000);
  });
});
