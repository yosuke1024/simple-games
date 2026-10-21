/**
 * Golden games: what the CPU answers, for one seed, at each strength
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §4.1, §5, §8).
 *
 * Three things rest on these literals. The statistics were set against these
 * opponents, and a win over Hard only means something if Hard still plays
 * the same way. Undo is a take-back because the CPU is decided by the seed
 * and the move count — a CPU that rerolls turns a take-back into a slot
 * machine (§5). And a saved match is a move list replayed through the same
 * rules and answered by the same CPU (§8): a change here makes a resumed
 * match answer differently from the one that was saved.
 *
 * The test player is fixed without a hand-written move list that could stop
 * being legal for reasons other than the CPU changing: on its n-th turn it
 * plays legal move number 5n (mod the count), lowest cell first.
 *
 * This pins released behaviour; do not edit these literals to go green. If a
 * change to the rules, the search, the move order, the evaluation or the
 * node limit is intended, regenerate them and say so in the commit message,
 * along with what it costs existing players and saved matches.
 */
import { describe, expect, it } from 'vitest';
import {
  chooseCpuMove,
  EASY_TOP_CHOICES,
  HARD_NODE_LIMIT,
  NORMAL_MAX_DEPTH,
  WEIGHTS,
  WIN,
} from './cpu';
import { createRng } from './rng';
import { toSavedGame } from './serialize';
import { applyCpuMove, applyPlayerMove, createSession, isCpuTurn } from './session';
import type { Difficulty } from './types';

const SEED = 'nested-tic-tac-toe-golden';

function playOut(difficulty: Difficulty, playerGoesFirst: boolean) {
  let session = createSession(difficulty, playerGoesFirst, SEED);
  let turn = 0;
  while (session.status === 'playing') {
    if (isCpuTurn(session)) {
      session = applyCpuMove(session)!.session;
    } else {
      const { legal } = session.view;
      session = applyPlayerMove(session, legal[(5 * turn) % legal.length]!)!.session;
      turn += 1;
    }
  }
  return { moves: session.moves.join(','), status: session.status };
}

describe('the seeded stream that must never change', () => {
  it('draws the same first values for one seed', () => {
    const rng = createRng(`${SEED}:cpu:0`);
    expect([rng(), rng(), rng()]).toEqual(GOLDEN_RNG);
  });
});

describe('games that must never change', () => {
  // One `it()` per game: each plays out on its own session with nothing
  // shared, and keeps the hard ones well inside the default timeout.
  it('finishes the same way at easy', () => {
    expect(playOut('easy', true)).toEqual(GOLDEN.easy);
  });

  it('finishes the same way at normal', () => {
    expect(playOut('normal', true)).toEqual(GOLDEN.normal);
  });

  it('finishes the same way at normal, the player going second', () => {
    expect(playOut('normal', false)).toEqual(GOLDEN.normalSecond);
  });

  it('finishes the same way at hard', () => {
    expect(playOut('hard', true)).toEqual(GOLDEN.hard);
  }, 30_000);

  it('answers an opening move the same way for one seed', () => {
    expect(chooseCpuMove({ moves: [40], difficulty: 'hard', seed: SEED })).toBe(
      GOLDEN.hardReplyTo40,
    );
    expect(chooseCpuMove({ moves: [], difficulty: 'hard', seed: SEED })).toBe(GOLDEN.hardOpening);
  });
});

describe('the saved record that must never change (§8.1)', () => {
  it('keeps the v1 shape and field order', () => {
    let session = createSession('easy', false, SEED);
    session = applyCpuMove(session)!.session;
    session = applyPlayerMove(session, session.view.legal[0]!)!.session;
    expect(
      JSON.stringify(toSavedGame({ ...session, elapsedSeconds: 42 }, 1_760_000_000_000)!),
    ).toBe(GOLDEN.savedRecord);
  });
});

describe('the constants the games above were played under', () => {
  it('keeps the node limit, the depths and the weights (§4.1, §4.2, §4.3)', () => {
    // Raising the limit changes what Normal and Hard play — and what a
    // low-spec phone spends on one reply.
    expect(HARD_NODE_LIMIT).toBe(40_000);
    expect(NORMAL_MAX_DEPTH).toBe(3);
    expect(EASY_TOP_CHOICES).toBe(3);
    expect(WIN).toBe(1_000_000);
    expect(WEIGHTS).toEqual({
      BIG_1: 40,
      BIG_2: 300,
      BOARD_OWN: 25,
      SMALL_2: 6,
      SMALL_1: 1,
      FREE_MOVE: 15,
      TAKE_NEXT: 20,
    });
  });
});

const GOLDEN_RNG = [0.030006896005943418, 0.5551981523167342, 0.9372729165479541];

const GOLDEN = {
  easy: {
    moves:
      '0,2,23,45,5,49,42,56,22,44,79,63,1,9,3,35,72,6,60,55,12,32,53,78,54,7,65,21,27,4,41,46,' +
      '14,47,19,17,73,13,43,70,69,62,74,20,25,67,36,64,39,30,28,29,59,58,61,57',
    status: 'draw',
  },
  normal: {
    moves:
      '0,6,59,48,28,11,24,62,74,25,70,68,52,67,44,73,9,4,41,50,47,19,17,79,63,2,26,76,36,22,40,49',
    status: 'lost',
  },
  normalSecond: {
    moves:
      '40,36,8,77,48,28,10,17,74,20,18,1,16,66,33,62,73,14,50,49,43,65,26,75,30,27,5,53,72,6,55,9,' +
      '2,22,37',
    status: 'lost',
  },
  hard: {
    moves:
      '0,6,59,48,28,10,17,76,38,26,73,11,24,62,72,7,67,41,51,58,37,9,2,23,50,47,25,69,60,54,1,77,' +
      '45,75,33,20,64,39,32,52,70,40',
    status: 'lost',
  },
  hardReplyTo40: 42,
  hardOpening: 40,
  savedRecord:
    '{"schemaVersion":1,"seed":"nested-tic-tac-toe-golden","difficulty":"easy","playerGoesFirst":false,' +
    '"moves":[40,36],"elapsedSeconds":42,"savedAt":1760000000000}',
};
