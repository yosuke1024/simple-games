/**
 * Golden matches — the v1 contract for Hearts' deal, its opponents and its
 * saved-game format.
 *
 * These strings pin the whole chain at once: the PRNG, the exact shape of the
 * seed strings, the shuffle of fifty-two cards, which way the pass turns, what
 * each strength gives away and plays, how the twenty-six points are shared
 * out, and the bytes a suspended match is written as.
 *
 * If this test fails, the thing to fix is the implementation, not the
 * expectation. Regenerating these strings changes what a saved match resumes
 * into and what a recorded win against "Hard" was won against — it silently
 * rewrites games players have already played. Doing it anyway is a decision to
 * make deliberately and to state in the commit message, including what it
 * costs them.
 *
 * The scripted player takes the same view the CPU seats do and plays it at
 * easy, so the match is fixed without a hand-written move list that could stop
 * being legal for reasons other than the rules changing.
 */
import { describe, expect, it } from 'vitest';
import { QUEEN_PENALTY } from './cards';
import { chooseCpuAction } from './cpu';
import { dealHand } from './engine';
import { encodeHand } from './serialize';
import {
  applyCpuStep,
  canCollectTrick,
  canDealNextHand,
  createSession,
  cpuViewOf,
  doCollectTrick,
  doConfirmPass,
  doNextHand,
  doPlayCard,
  doSelectPassCard,
  isCpuTurn,
  type HeartsSession,
} from './session';
import {
  HAND_PENALTY_TOTAL,
  HAND_SIZE,
  MATCH_TARGET,
  PASS_CYCLE,
  PASS_SIZE,
  SEAT_COUNT,
  TRICKS_PER_HAND,
  YOU,
  type Difficulty,
} from './types';

const SEED = 'hearts-golden';

/** One beat by whoever is due one, with the player scripted at easy. */
function step(session: HeartsSession): HeartsSession {
  if (canDealNextHand(session)) return doNextHand(session)!;
  if (canCollectTrick(session)) return doCollectTrick(session)!.session;
  if (isCpuTurn(session)) return applyCpuStep(session)!.session;

  const action = chooseCpuAction({ ...cpuViewOf(session, YOU), difficulty: 'easy' }, 0.5)!;
  if (action.kind === 'pass') {
    const chosen = action.cards.reduce<HeartsSession>(
      (state, card) => doSelectPassCard(state, card)!,
      session,
    );
    return doConfirmPass(chosen)!.session;
  }
  return doPlayCard(session, action.card)!.session;
}

interface Trace {
  readonly status: string;
  readonly scores: readonly number[];
  readonly handNumber: number;
  readonly moveCount: number;
  /** One entry per hand: what each seat took, and who swept if anybody did. */
  readonly hands: string;
}

function playMatch(difficulty: Difficulty): Trace {
  let session = createSession(difficulty, SEED);
  const hands: string[] = [];
  let last = session.lastHand;
  for (let taken = 0; taken < 20_000 && session.status === 'playing'; taken++) {
    session = step(session);
    if (session.lastHand !== null && session.lastHand !== last) {
      const { taken: points, moonShooter } = session.lastHand;
      hands.push(`${points.join(',')}${moonShooter === null ? '' : `!${moonShooter}`}`);
    }
    last = session.lastHand;
  }
  return {
    status: session.status,
    scores: session.scores,
    handNumber: session.handNumber,
    moveCount: session.moveCount,
    hands: hands.join(' '),
  };
}

describe('deals that must never change (v1)', () => {
  it('pins the first hand of a fixed seed', () => {
    expect(encodeHand(dealHand(SEED, 1))).toBe(
      '1/1p000000/06070a0c0e0f0l0o0p0s151c1d/000104080d0g0k0u0v0w0y0z16/030i0j0m0q0r10111314171b1f/0205090b0h0n0t0x1218191a1e//////',
    );
  });

  it('pins the fourth hand of the same seed, which nobody passes on', () => {
    expect(encodeHand(dealHand(SEED, 4))).toBe(
      '1/0l100000/02030a0c0u0v0x0y0z1012161d/0405060e0f0g0k0n0o0t111317/010d0h0j0p0q0r0w15181a1b1c/000708090b0i0l0m0s14191e1f//////',
    );
  });
});

describe('matches that must never change (v1)', () => {
  it('plays the same match at easy', () => {
    expect(playMatch('easy')).toEqual({
      status: 'won',
      scores: [71, 102, 79, 86],
      handNumber: 9,
      moveCount: 621,
      hands:
        '18,0,0,8 26,0,0,0!0 9,0,4,13 26,0,0,0!0 13,12,1,0 13,0,10,3 0,25,1,0 13,0,11,2 5,13,0,8',
    });
  });

  it('plays the same match at normal', () => {
    expect(playMatch('normal')).toEqual({
      status: 'lost',
      scores: [107, 80, 78, 73],
      handNumber: 9,
      moveCount: 621,
      hands:
        '13,0,4,9 26,0,0,0!0 18,0,0,8 26,0,0,0!0 13,12,1,0 17,5,0,4 16,5,5,0 13,2,11,0 17,4,5,0',
    });
  });

  it('plays the same match at hard', () => {
    expect(playMatch('hard')).toEqual({
      status: 'lost',
      scores: [114, 47, 36, 37],
      handNumber: 7,
      moveCount: 485,
      hands: '19,3,0,4 22,0,4,0 11,13,1,1 26,0,0,0!0 24,1,1,0 20,0,0,6 18,4,4,0',
    });
  });

  it('replays a match identically when it is played twice', () => {
    expect(playMatch('normal')).toEqual(playMatch('normal'));
  });
});

describe('the numbers the scores were made of (v1)', () => {
  /**
   * Named here as well as in types.ts. Move any of them and every match trace
   * above changes with it — and so does every score a player has recorded.
   */
  it('keeps the table it promises', () => {
    expect(SEAT_COUNT).toBe(4);
    expect(HAND_SIZE).toBe(13);
    expect(TRICKS_PER_HAND).toBe(13);
    expect(PASS_SIZE).toBe(3);
    expect(PASS_CYCLE).toEqual([1, 3, 2, 0]);
    expect(QUEEN_PENALTY).toBe(13);
    expect(HAND_PENALTY_TOTAL).toBe(26);
    expect(MATCH_TARGET).toBe(100);
  });
});

describe('the saved-game format (v1)', () => {
  it('writes a hand as version, flags, four hands, four selections, the trick and the tricks', () => {
    const fields = encodeHand(dealHand(SEED, 1)).split('/');
    expect(fields).toHaveLength(12);
    expect(fields[0]).toBe('1');
    // pass offset 1 (left), phase 'passing', leader 0, unbroken, none confirmed.
    expect(fields[1]).toBe('1p000000');
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      expect(fields[2 + seat]).toHaveLength(HAND_SIZE * 2);
      expect(fields[6 + seat]).toBe('');
    }
    expect(fields[10]).toBe('');
    expect(fields[11]).toBe('');
  });
});
