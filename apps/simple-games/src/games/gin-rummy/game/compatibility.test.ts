/**
 * Golden matches — the v1 contract for Gin Rummy's deal, its opponent and its
 * saved-game format.
 *
 * These strings pin the whole chain at once: the PRNG, the exact shape of the
 * seed strings, the shuffle of fifty-two cards, who deals first, what each
 * strength plays, how the settlement divides the points, and the bytes a
 * suspended match is written as.
 *
 * If this test fails, the thing to fix is the implementation, not the
 * expectation. Regenerating these strings changes what a saved match resumes
 * into and what a recorded win against "Hard" was won against — it silently
 * rewrites games players have already played. Doing it anyway is a decision to
 * make deliberately and to state in the commit message, including what it
 * costs them.
 *
 * The scripted player takes the same view the CPU does and plays it at easy,
 * so the match is fixed without a hand-written move list that could stop being
 * legal for reasons other than the rules changing.
 */
import { describe, expect, it } from 'vitest';
import { buildCpuView, chooseCpuAction } from './cpu';
import { dealHand } from './engine';
import { createRng } from './rng';
import { encodeHand } from './serialize';
import {
  applyCpuStep,
  canDealNextHand,
  createSession,
  doDiscard,
  doDrawDiscard,
  doDrawStock,
  doKnock,
  doNextHand,
  doPassUpcard,
  doTakeUpcard,
  firstDealerOf,
  isCpuTurn,
  type GinRummySession,
} from './session';
import {
  CPU,
  DEAD_HAND_STOCK,
  GIN_BONUS,
  HAND_SIZE,
  INITIAL_STOCK,
  KNOCK_LIMIT,
  MATCH_TARGET,
  UNDERCUT_BONUS,
  YOU,
  type Difficulty,
  type HandAction,
} from './types';

const SEED = 'gin-golden';

function playerAction(session: GinRummySession, action: HandAction): GinRummySession {
  switch (action.kind) {
    case 'take-upcard':
      return doTakeUpcard(session)!.session;
    case 'pass-upcard':
      return doPassUpcard(session)!.session;
    case 'draw-stock':
      return doDrawStock(session)!.session;
    case 'draw-discard':
      return doDrawDiscard(session)!.session;
    case 'discard':
      return doDiscard(session, action.card)!.session;
    default:
      return doKnock(session, action.card)!.session;
  }
}

function step(session: GinRummySession): GinRummySession {
  if (canDealNextHand(session)) return doNextHand(session)!;
  if (isCpuTurn(session)) return applyCpuStep(session)!.session;
  const view = buildCpuView(session.hand, YOU, 'easy', session.scores);
  const tieBreak = createRng(`${session.seed}:you:${session.moveCount}`)();
  return playerAction(session, chooseCpuAction(view, tieBreak)!);
}

interface Trace {
  readonly status: string;
  readonly scores: readonly number[];
  readonly handNumber: number;
  readonly moveCount: number;
  /** One entry per hand: how it ended, who took it, and for how much. */
  readonly hands: string;
}

function playMatch(difficulty: Difficulty): Trace {
  let session = createSession(difficulty, SEED);
  const hands: string[] = [];
  let last = session.lastHand;
  for (let taken = 0; taken < 20_000 && session.status === 'playing'; taken++) {
    session = step(session);
    if (session.lastHand !== null && session.lastHand !== last) {
      const { kind, winner, points } = session.lastHand;
      hands.push(`${kind}:${winner ?? '-'}:${points}`);
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
  it('picks the same first dealer for a seed', () => {
    expect(firstDealerOf(SEED)).toBe(CPU);
    expect(firstDealerOf('gin-golden-b')).toBe(YOU);
  });

  it('pins the first hand of a fixed seed', () => {
    expect(encodeHand(dealHand(SEED, 1, CPU))).toBe(
      '1/10un0/--/01090a0e0r1115191d1e/050d0g0o0u0x0y0z1314/000q0p0f0w0t0n17160612030h1f100j180m1b071c0k0i0l0s0c0v0408021a/0b/u-0b',
    );
  });

  it('pins a later hand of the same seed, dealt from the other side', () => {
    expect(encodeHand(dealHand(SEED, 3, YOU))).toBe(
      '1/01un0/--/040j0m0r0u0w12141c1d/000305060g0h0l0p161b/080q0s0e0d13171f0c0n0z02100k110y090v0a07191e0f1a0x0t0b010i1518/0o/u-0o',
    );
  });
});

describe('matches that must never change (v1)', () => {
  it('plays the same match at easy', () => {
    expect(playMatch('easy')).toEqual({
      status: 'lost',
      scores: [89, 128],
      handNumber: 12,
      moveCount: 371,
      hands:
        'knock:0:4 knock:0:36 knock:1:23 knock:0:20 knock:0:12 knock:0:15 ' +
        'knock:1:48 knock:1:9 knock:1:14 knock:0:2 knock:1:3 knock:1:31',
    });
  });

  it('plays the same match at normal', () => {
    expect(playMatch('normal')).toEqual({
      status: 'lost',
      scores: [52, 109],
      handNumber: 8,
      moveCount: 256,
      hands:
        'knock:0:4 knock:0:10 knock:0:6 knock:0:11 knock:0:2 knock:0:19 ' + 'gin:1:92 knock:1:17',
    });
  });

  it('plays the same match at hard', () => {
    // Hard loses fewer hands and fewer turns to get there; that it lost this
    // particular match to a seed is not a claim about its strength, only that
    // it plays this one the same way every time.
    expect(playMatch('hard')).toEqual({
      status: 'won',
      scores: [113, 11],
      handNumber: 5,
      moveCount: 128,
      hands: 'gin:0:50 knock:0:10 knock:1:11 knock:0:9 knock:0:44',
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
    expect(HAND_SIZE).toBe(10);
    expect(INITIAL_STOCK).toBe(31);
    expect(KNOCK_LIMIT).toBe(10);
    expect(GIN_BONUS).toBe(25);
    expect(UNDERCUT_BONUS).toBe(25);
    expect(MATCH_TARGET).toBe(100);
    expect(DEAD_HAND_STOCK).toBe(2);
  });
});

describe('the saved-game format (v1)', () => {
  it('writes a hand as version, flags, taken card, four piles and the log', () => {
    const text = encodeHand(dealHand(SEED, 1, CPU));
    const fields = text.split('/');
    expect(fields[0]).toBe('1');
    // dealer 1, turn 0, phase 'upcard', ending 'none', no forced stock draw.
    expect(fields[1]).toBe('10un0');
    expect(fields[2]).toBe('--');
    // Ten cards each, thirty-one face down, one turned, one log entry.
    expect(fields[3]).toHaveLength(HAND_SIZE * 2);
    expect(fields[4]).toHaveLength(HAND_SIZE * 2);
    expect(fields[5]).toHaveLength(INITIAL_STOCK * 2);
    expect(fields[6]).toHaveLength(2);
    expect(fields[7]).toBe('u-0b');
  });
});
