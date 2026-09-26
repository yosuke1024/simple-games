/**
 * Golden games: what the CPU answers, for two seeds, on each board.
 *
 * The record on the statistics screen was set against this opponent, and a
 * win on 5×5 only means something if the CPU still plays the same way. The
 * same determinism is what Undo rests on (§4, §5): take a line back, draw it
 * again, and the reply must be the one that came before — a CPU that rerolls
 * turns a take-back into a slot machine. A saved match resumes on the same
 * seed and move count (§8), so this is also what makes a resumed match the
 * match that was put down.
 *
 * The test player draws a rotating open edge, so the games are fixed without
 * a hand-written line list that could stop being legal for reasons other
 * than the CPU changing. It plays badly on purpose — it hands over boxes the
 * CPU must take (§4 tier 1) — so all three tiers show up in the replies.
 *
 * This pins released behaviour; do not edit these values to go green. If a
 * change to the CPU is intended, regenerate them and say so in the commit
 * message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { openEdges } from './engine';
import { applyCpuMove, applyPlayerMove, createSession, type DotsAndBoxesSession } from './session';
import { CPU, type BoardSize } from './types';

const SEED_A = 'dots-and-boxes-golden-a';
const SEED_B = 'dots-and-boxes-golden-b';

interface PlayedOut {
  /** Every CPU line, in the order it was drawn. */
  replies: number[];
  edges: string;
  boxes: string;
  status: string;
}

/** `turns` lines by the test player, each answered by the CPU's whole run. */
function playOut(size: BoardSize, seed: string, turns: number): PlayedOut {
  let session: DotsAndBoxesSession = createSession(size, seed);
  const replies: number[] = [];
  for (let turn = 0; turn < turns && session.status === 'playing'; turn++) {
    const open = openEdges(session.board);
    session = applyPlayerMove(session, open[(turn * 7) % open.length]!)!;
    while (session.status === 'playing' && session.toMove === CPU) {
      session = applyCpuMove(session)!;
      replies.push(session.lastMove!.edge);
    }
  }
  return {
    replies,
    edges: session.board.edges,
    boxes: session.board.boxes,
    status: session.status,
  };
}

describe('openings that must never change', () => {
  it('answers the same way on 3×3', () => {
    expect(playOut('small', SEED_A, 6)).toEqual({
      replies: [7, 23, 1, 10, 13, 4, 18, 8, 6],
      edges: '120021222120021001210002',
      boxes: '.c..cc...',
      status: 'playing',
    });
    expect(playOut('small', SEED_B, 6)).toEqual({
      replies: [15, 23, 14, 21, 7, 20, 1, 16],
      edges: '120010021000012221102202',
      boxes: '.c..c....',
      status: 'playing',
    });
  });

  it('answers the same way on 4×4', () => {
    expect(playOut('medium', SEED_A, 6)).toEqual({
      replies: [36, 34, 1, 37, 38, 19],
      edges: '1200000110000000100200000100000001202220',
      boxes: '................',
      status: 'playing',
    });
    expect(playOut('medium', SEED_B, 6)).toEqual({
      replies: [12, 3, 10, 25, 14, 19],
      edges: '1002000110202020001200000201000000001000',
      boxes: '................',
      status: 'playing',
    });
  });

  it('answers the same way on 5×5', () => {
    expect(playOut('large', SEED_A, 6)).toEqual({
      replies: [40, 38, 55, 20, 11, 43, 52],
      edges: '100000001002000010002000100000000100002020021000000020020000',
      boxes: '...........c.............',
      status: 'playing',
    });
    expect(playOut('large', SEED_B, 6)).toEqual({
      replies: [39, 53, 30, 51, 35, 55],
      edges: '100000001000000010000000100000200102000200010000000202020000',
      boxes: '.........................',
      status: 'playing',
    });
  });
});

describe('whole games that must never change', () => {
  // Played to the last line on 3×3, so the endgame tier — every line hands
  // something over (§4) — is pinned as well as the opening ones.
  it('finishes the same way for seed A', () => {
    expect(playOut('small', SEED_A, 100)).toEqual({
      replies: [7, 23, 1, 10, 13, 4, 18, 8, 6, 21, 22, 11, 2, 3, 15, 16],
      edges: '122221222122121221211222',
      boxes: 'ccccccccc',
      status: 'lost',
    });
  });

  it('finishes the same way for seed B', () => {
    expect(playOut('small', SEED_B, 100)).toEqual({
      replies: [15, 23, 14, 21, 7, 20, 1, 16, 19, 2, 22, 3, 10, 12, 11, 9],
      edges: '122211121222212221122222',
      boxes: 'ccccccccc',
      status: 'lost',
    });
  });
});
