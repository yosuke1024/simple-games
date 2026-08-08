/**
 * The match: hands one after another, the score carried between them, the deal
 * passing to whoever won, and a hundred points ending it.
 *
 * The matches below are played out rather than stubbed, by a scripted player
 * that reads the same view the CPU does. That keeps the test honest as the
 * rules move — there is no hand-written move list here that could stop being
 * legal for reasons other than a rule changing — and it exercises the `do*`
 * wrappers the screen will actually call.
 */
import { describe, expect, it } from 'vitest';
import type { Card } from './cards';
import { buildCpuView, chooseCpuAction } from './cpu';
import { discardCard, drawFromStock, passUpcard } from './engine';
import { decodeHand, encodeHand } from './serialize';
import * as sessionModule from './session';
import {
  applyCpuStep,
  canDealNextHand,
  createSession,
  cpuViewOf,
  doDiscard,
  doDrawDiscard,
  doDrawStock,
  doKnock,
  doNextHand,
  doPassUpcard,
  doTakeUpcard,
  isCpuTurn,
  restoreSession,
  type GinRummySession,
  type TurnOutcome,
} from './session';
import { createRng } from './rng';
import { CPU, DIFFICULTIES, MATCH_TARGET, YOU, type Difficulty, type HandAction } from './types';

/** Routes an action through the player-facing wrappers, as the screen would. */
function playerAction(session: GinRummySession, action: HandAction): TurnOutcome | null {
  switch (action.kind) {
    case 'take-upcard':
      return doTakeUpcard(session);
    case 'pass-upcard':
      return doPassUpcard(session);
    case 'draw-stock':
      return doDrawStock(session);
    case 'draw-discard':
      return doDrawDiscard(session);
    case 'discard':
      return doDiscard(session, action.card);
    case 'knock':
      return doKnock(session, action.card);
    default:
      return null;
  }
}

/** One action by whoever is to move, or the next deal when a hand has settled. */
function step(session: GinRummySession): GinRummySession {
  if (canDealNextHand(session)) return doNextHand(session)!;
  if (isCpuTurn(session)) return applyCpuStep(session)!.session;
  const view = buildCpuView(session.hand, YOU, 'easy', session.scores);
  const tieBreak = createRng(`${session.seed}:you:${session.moveCount}`)();
  return playerAction(session, chooseCpuAction(view, tieBreak)!)!.session;
}

const STEP_LIMIT = 20_000;

interface Played {
  readonly session: GinRummySession;
  /** One entry per deal: the dealer, and how the hand before it ended. */
  readonly deals: { dealer: number; previous: string | null; winner: number | null }[];
}

function playMatch(difficulty: Difficulty, seed: string): Played {
  let session = createSession(difficulty, seed);
  const deals: Played['deals'] = [{ dealer: session.hand.dealer, previous: null, winner: null }];
  for (let taken = 0; taken < STEP_LIMIT && session.status === 'playing'; taken++) {
    const before = session.handNumber;
    const previousResult = session.lastHand;
    session = step(session);
    if (session.handNumber !== before) {
      deals.push({
        dealer: session.hand.dealer,
        previous: previousResult?.kind ?? null,
        winner: previousResult?.winner ?? null,
      });
    }
  }
  return { session, deals };
}

describe('a match is a run of hands', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`reaches a hundred points and stops, against ${difficulty}`, () => {
      const { session } = playMatch(difficulty, `gin-match-${difficulty}`);
      expect(session.status).not.toBe('playing');
      const [you, cpu] = session.scores;
      expect(Math.max(you, cpu)).toBeGreaterThanOrEqual(MATCH_TARGET);
      expect(Math.min(you, cpu)).toBeLessThan(MATCH_TARGET);
      expect(session.status).toBe(you >= MATCH_TARGET ? 'won' : 'lost');
      expect(session.handNumber).toBeGreaterThan(1);
    });
  }

  it('carries the score from hand to hand and only ever adds to it', () => {
    let session = createSession('normal', 'gin-carry');
    let previous: readonly [number, number] = session.scores;
    let hands = 0;
    for (let taken = 0; taken < STEP_LIMIT && session.status === 'playing'; taken++) {
      const before = session.handNumber;
      session = step(session);
      expect(session.scores[YOU]).toBeGreaterThanOrEqual(previous[YOU]);
      expect(session.scores[CPU]).toBeGreaterThanOrEqual(previous[CPU]);
      previous = session.scores;
      if (session.handNumber !== before) hands += 1;
    }
    expect(hands).toBeGreaterThan(1);
    // The score moves the moment a hand settles, not when the next is dealt:
    // the result screen shows the real standings.
    expect(session.scores[YOU] + session.scores[CPU]).toBeGreaterThanOrEqual(MATCH_TARGET);
  });

  it('passes the deal to the hand’s winner', () => {
    let seen = 0;
    for (const difficulty of DIFFICULTIES) {
      const { deals } = playMatch(difficulty, `gin-dealer-${difficulty}`);
      for (let index = 1; index < deals.length; index++) {
        const deal = deals[index]!;
        expect(deal.previous).not.toBeNull();
        if (deal.previous === 'dead') expect(deal.dealer).toBe(deals[index - 1]!.dealer);
        else {
          expect(deal.dealer).toBe(deal.winner);
          seen += 1;
        }
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it('keeps the deal, and the score, when a hand dies', () => {
    // Neither side knocks, so the stock runs down to two and the hand is
    // void. Played through the engine because no CPU would ever sit on a
    // knocking hand this long.
    const base = createSession('normal', 'gin-dead');
    let hand = passUpcard(passUpcard(base.hand)!)!;
    while (hand.phase !== 'over') {
      hand =
        hand.phase === 'draw'
          ? drawFromStock(hand)!
          : discardCard(
              hand,
              hand.hands[hand.turn].find((c) => c !== hand.takenFromDiscard)!,
            )!;
    }

    const session = restoreSession({ ...base, hand });
    expect(session.lastHand!.kind).toBe('dead');
    expect(session.lastHand!.points).toBe(0);
    expect(session.scores).toEqual([0, 0]);

    const next = doNextHand(session)!;
    expect(next.hand.dealer).toBe(hand.dealer);
    expect(next.handNumber).toBe(base.handNumber + 1);
    expect(next.scores).toEqual(session.scores);
    expect(next.lastHand).toBeNull();
  });
});

describe('the CPU’s turn', () => {
  it('is refused when it is not the CPU’s turn', () => {
    let session = createSession('normal', 'gin-turn');
    // The first hand opens on whoever is not the dealer.
    while (!isCpuTurn(session)) session = step(session);
    expect(applyCpuStep(session)).not.toBeNull();

    let players = session;
    while (isCpuTurn(players)) players = step(players);
    expect(applyCpuStep(players)).toBeNull();
  });

  it('is refused for the player’s wrappers when the CPU holds the turn', () => {
    let session = createSession('normal', 'gin-turn-2');
    while (!isCpuTurn(session)) session = step(session);
    expect(doDrawStock(session)).toBeNull();
    expect(doTakeUpcard(session)).toBeNull();
    expect(doPassUpcard(session)).toBeNull();
    expect(doDiscard(session, session.hand.hands[CPU][0]!)).toBeNull();
    expect(doKnock(session, session.hand.hands[CPU][0]!)).toBeNull();
  });

  it('draws and then discards — two beats, not one', () => {
    let session = createSession('normal', 'gin-beats');
    while (!isCpuTurn(session) || session.hand.phase !== 'draw') session = step(session);
    const drew = applyCpuStep(session)!;
    expect(['draw-stock', 'draw-discard']).toContain(drew.event.kind);
    expect(drew.session.hand.phase).toBe('discard');
    expect(drew.session.hand.turn).toBe(CPU);

    const put = applyCpuStep(drew.session)!;
    expect(['discard', 'knock', 'gin']).toContain(put.event.kind);
  });
});

describe('suspend and resume', () => {
  const resumed = (session: GinRummySession): GinRummySession =>
    restoreSession({
      seed: session.seed,
      difficulty: session.difficulty,
      hand: decodeHand(encodeHand(session.hand))!,
      handNumber: session.handNumber,
      scores: session.scores,
      moveCount: session.moveCount,
      elapsedSeconds: session.elapsedSeconds,
    });

  it('comes back to the same match, mid-hand', () => {
    let session = createSession('hard', 'gin-resume');
    for (let taken = 0; taken < 15; taken++) session = step(session);
    expect(session.hand.phase).not.toBe('over');
    expect(resumed(session)).toEqual(session);
  });

  it('comes back on the CPU’s turn, into the same reply', () => {
    let session = createSession('hard', 'gin-resume-cpu');
    while (!isCpuTurn(session)) session = step(session);
    const restored = resumed(session);
    expect(isCpuTurn(restored)).toBe(true);
    expect(cpuViewOf(restored)).toEqual(cpuViewOf(session));
    expect(applyCpuStep(restored)!.session.hand).toEqual(applyCpuStep(session)!.session.hand);
  });

  it('comes back on a settled hand, with the result recomputed rather than stored', () => {
    let session = createSession('normal', 'gin-resume-over');
    while (session.hand.phase !== 'over') session = step(session);
    expect(session.lastHand).not.toBeNull();
    const restored = resumed(session);
    expect(restored.lastHand).toEqual(session.lastHand);
    expect(canDealNextHand(restored)).toBe(true);
  });

  it('reads the match verdict back out of the score', () => {
    const session = createSession('easy', 'gin-resume-status');
    const won = restoreSession({ ...session, scores: [MATCH_TARGET, 12] });
    const lost = restoreSession({ ...session, scores: [12, MATCH_TARGET + 8] });
    expect(won.status).toBe('won');
    expect(lost.status).toBe('lost');
    expect(restoreSession({ ...session, scores: [99, 99] }).status).toBe('playing');
  });
});

describe('a finished match takes no more moves', () => {
  const finished = (): GinRummySession => {
    const session = createSession('normal', 'gin-finished');
    return restoreSession({ ...session, scores: [MATCH_TARGET + 3, 40] });
  };

  it('refuses every action, the next deal included', () => {
    const session = finished();
    expect(session.status).toBe('won');
    const anyCard: Card = session.hand.hands[YOU][0]!;
    expect(doTakeUpcard(session)).toBeNull();
    expect(doPassUpcard(session)).toBeNull();
    expect(doDrawStock(session)).toBeNull();
    expect(doDrawDiscard(session)).toBeNull();
    expect(doDiscard(session, anyCard)).toBeNull();
    expect(doKnock(session, anyCard)).toBeNull();
    expect(doNextHand(session)).toBeNull();
    expect(applyCpuStep(session)).toBeNull();
    expect(canDealNextHand(session)).toBe(false);
    expect(isCpuTurn(session)).toBe(false);
  });
});

describe('there is no undo', () => {
  /**
   * Not an oversight and not a to-do. Taking a move back after seeing the
   * reply would hand back a card you now know the opponent wanted, and no
   * take-back undoes knowing it. The absence is the feature, so it is pinned
   * here: adding an undo to this module has to break this test first.
   */
  it('is not in the session’s API at all', () => {
    const exported = Object.keys(sessionModule);
    expect(exported).not.toContain('undo');
    expect(exported).not.toContain('canUndo');
    expect(exported.some((name) => /undo/i.test(name))).toBe(false);
  });

  it('and no session carries a history to undo from', () => {
    const session = createSession('normal', 'gin-no-history');
    expect(Object.keys(session)).not.toContain('history');
  });
});

describe('the seed pins the match down', () => {
  it('deals and answers identically for the same seed', () => {
    const first = playMatch('hard', 'gin-repeatable');
    const second = playMatch('hard', 'gin-repeatable');
    expect(second.session).toEqual(first.session);
  });

  it('deals a different match for a different seed', () => {
    const other = playMatch('hard', 'gin-repeatable-2');
    const first = playMatch('hard', 'gin-repeatable');
    expect(other.session.hand).not.toEqual(first.session.hand);
  });
});
