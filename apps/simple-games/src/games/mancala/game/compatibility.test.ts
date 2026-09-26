/**
 * Golden games: what the CPU answers, for two seeds, at each strength.
 *
 * The record on the statistics screen was set against these opponents, and a
 * win over "Hard" only means something if Hard still plays the same way. The
 * same determinism is what Undo rests on (§4, §5): take a move back, play it
 * again, and the reply must be the one that came before — a CPU that rerolls
 * turns a take-back into a slot machine.
 *
 * The test player sows a rotating choice among its legal pits, so the game is
 * fixed without a hand-written move list that could stop being legal for
 * reasons other than the CPU changing. Every CPU move — extra turns included —
 * is recorded in order, and the board the game ends on (or stands at after
 * twelve player moves) is compared whole. It plays badly on purpose: every
 * opponent beats it, and by margins that grow with the strength.
 *
 * This pins released behaviour; do not edit these strings to go green. If a
 * change to the search or the evaluation is intended, regenerate them and say
 * so in the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { HARD_NODE_LIMIT } from './cpu';
import { legalPits } from './engine';
import { applyCpuMove, applyPlayerMove, createSession, type MancalaSession } from './session';
import { PLAYER, type Difficulty } from './types';

const SEEDS = ['mancala-golden-a', 'mancala-golden-b'] as const;

interface Played {
  /** The CPU's pits, in the order it sowed them. */
  readonly cpu: string;
  /** The board after the last move, index order (types.ts). */
  readonly pits: string;
  readonly status: string;
}

function playOut(seed: string, difficulty: Difficulty): Played {
  let session: MancalaSession = createSession(difficulty, PLAYER, seed);
  const cpu: number[] = [];
  for (let turn = 0; turn < 12 && session.status === 'playing'; turn++) {
    while (session.status === 'playing' && session.toMove !== PLAYER) {
      session = applyCpuMove(session)!;
      cpu.push(session.lastMove!.pit);
    }
    if (session.status !== 'playing') break;
    const legal = legalPits(session.pits, PLAYER);
    session = applyPlayerMove(session, legal[(turn * 5) % legal.length]!)!;
  }
  while (session.status === 'playing' && session.toMove !== PLAYER) {
    session = applyCpuMove(session)!;
    cpu.push(session.lastMove!.pit);
  }
  return { cpu: cpu.join(','), pits: session.pits.join(','), status: session.status };
}

describe('games that must never change', () => {
  // One `it()` per seed and strength (issue #158): each plays out on its own
  // session with nothing shared, so a slow runner charges each case alone.
  const GOLDEN: Record<(typeof SEEDS)[number], Record<Difficulty, Played>> = {
    'mancala-golden-a': {
      easy: {
        cpu: '9,7,8,9,8,7,9,7',
        pits: '0,0,0,0,0,0,17,0,0,0,0,0,0,31',
        status: 'lost',
      },
      normal: {
        cpu: '12,8,12,7,10,8,10,12,7,7,8',
        pits: '0,0,0,0,0,0,8,0,0,0,0,0,0,40',
        status: 'lost',
      },
      hard: {
        cpu: '11,12,10,12,8,12,11,12,10,7,12,9,8,12,11,12,9,7,8,7',
        pits: '0,0,0,0,0,0,6,0,0,0,0,0,0,42',
        status: 'lost',
      },
    },
    // The second seed differs from the first only where the seeded tie-break
    // decides (§4): same strength, same test player, a different route.
    'mancala-golden-b': {
      easy: {
        cpu: '9,7,8,9,8,7,8,7',
        pits: '0,0,0,0,0,0,15,0,0,0,0,0,0,33',
        status: 'lost',
      },
      normal: {
        cpu: '12,8,12,7,10,8,10,8,7,12,8',
        pits: '0,0,0,0,0,0,8,0,0,0,0,0,0,40',
        status: 'lost',
      },
      hard: {
        cpu: '11,12,10,12,8,12,11,12,10,7,12,9,12,11,8,12,9,7,8,7',
        pits: '0,0,0,0,0,0,6,0,0,0,0,0,0,42',
        status: 'lost',
      },
    },
  };

  for (const seed of SEEDS) {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      it(`plays the same game for ${seed} at ${difficulty}`, () => {
        expect(playOut(seed, difficulty)).toEqual(GOLDEN[seed][difficulty]);
      });
    }
  }

  it('keeps the node budget it promises (§4)', () => {
    // Named here as well as in cpu.ts: this is the bound the games above were
    // generated under, and raising it changes what Hard plays — and what a
    // low-spec phone spends on one reply.
    expect(HARD_NODE_LIMIT).toBe(30_000);
  });
});
