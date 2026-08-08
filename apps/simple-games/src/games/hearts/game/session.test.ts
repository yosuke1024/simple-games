/**
 * The match: the pass, the tricks, hands one after another, the four scores
 * carried between them, and a hundred points ending it.
 *
 * The matches below are played out rather than stubbed, by a scripted player
 * that reads the same view the CPU seats do. That keeps the test honest as the
 * rules move — there is no hand-written move list here that could stop being
 * legal for reasons other than a rule changing — and it exercises the `do*`
 * wrappers the screen will actually call.
 */
import { describe, expect, it } from 'vitest';
import type { Card } from './cards';
import { chooseCpuAction } from './cpu';
import { decodeHand, encodeHand } from './serialize';
import * as sessionModule from './session';
import {
  applyCpuStep,
  canCollectTrick,
  canConfirmPass,
  canDealNextHand,
  cpuSeatToAct,
  cpuViewOf,
  createSession,
  doCollectTrick,
  doConfirmPass,
  doNextHand,
  doPlayCard,
  doSelectPassCard,
  doUnselectPassCard,
  isCpuTurn,
  matchSeed,
  newSeedToken,
  playableCards,
  restoreSession,
  statusOf,
  type HeartsSession,
} from './session';
import {
  DIFFICULTIES,
  HAND_PENALTY_TOTAL,
  MATCH_TARGET,
  PASS_SIZE,
  SEATS,
  seatToPlay,
  TRICKS_PER_HAND,
  YOU,
  type BySeat,
  type Difficulty,
} from './types';

/** One beat by whoever is due one: a CPU seat, the table, or the player. */
function step(session: HeartsSession): HeartsSession {
  if (canDealNextHand(session)) return doNextHand(session)!;
  if (canCollectTrick(session)) return doCollectTrick(session)!.session;
  if (isCpuTurn(session)) return applyCpuStep(session)!.session;

  const view = cpuViewOf(session, YOU);
  const action = chooseCpuAction({ ...view, difficulty: 'easy' }, 0.5)!;
  if (action.kind === 'pass') {
    const chosen = action.cards.reduce<HeartsSession>(
      (state, card) => doSelectPassCard(state, card)!,
      session,
    );
    return doConfirmPass(chosen)!.session;
  }
  return doPlayCard(session, action.card)!.session;
}

const STEP_LIMIT = 20_000;

function playMatch(difficulty: Difficulty, seed: string): HeartsSession {
  let session = createSession(difficulty, seed);
  for (let taken = 0; taken < STEP_LIMIT && session.status === 'playing'; taken++) {
    session = step(session);
  }
  return session;
}

describe('a match is a run of hands', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`reaches a hundred points and stops, against ${difficulty}`, () => {
      const session = playMatch(difficulty, `hearts-match-${difficulty}`);
      expect(session.status).not.toBe('playing');
      expect(Math.max(...session.scores)).toBeGreaterThanOrEqual(MATCH_TARGET);
      expect(session.handNumber).toBeGreaterThan(1);
      const lowest = Math.min(...session.scores);
      const winners = SEATS.filter((seat) => session.scores[seat] === lowest);
      const verdict = !winners.includes(YOU) ? 'lost' : winners.length === 1 ? 'won' : 'draw';
      expect(session.status).toBe(verdict);
    });
  }

  it('adds exactly twenty-six points to the table for every hand played', () => {
    let session = createSession('normal', 'hearts-carry');
    let hands = 0;
    for (let taken = 0; taken < STEP_LIMIT && session.status === 'playing'; taken++) {
      const before = session.handNumber;
      const scoresBefore = session.scores;
      session = step(session);
      // Four seats, and no seat's total ever comes down.
      for (const seat of SEATS) {
        expect(session.scores[seat]).toBeGreaterThanOrEqual(scoresBefore[seat]);
      }
      if (session.handNumber !== before) hands += 1;
    }
    expect(hands).toBeGreaterThan(1);
    const total = session.scores.reduce((a, b) => a + b, 0);
    // Twenty-six a hand normally; a moon puts seventy-eight on instead, so the
    // total is a multiple of twenty-six either way.
    expect(total % HAND_PENALTY_TOTAL).toBe(0);
    expect(total / HAND_PENALTY_TOTAL).toBeGreaterThanOrEqual(session.handNumber);
  });

  it('turns the pass with the hand number, and skips it on the fourth', () => {
    let session = createSession('normal', 'hearts-rotation');
    const offsets: number[] = [session.hand.passOffset];
    while (session.handNumber < 5 && session.status === 'playing') {
      const before = session.handNumber;
      session = step(session);
      if (session.handNumber !== before) offsets.push(session.hand.passOffset);
    }
    expect(offsets.slice(0, 5)).toEqual([1, 3, 2, 0, 1]);
  });

  it('deals the next hand only once the last one has been scored', () => {
    let session = createSession('normal', 'hearts-next');
    expect(doNextHand(session)).toBeNull();
    while (session.hand.phase !== 'over') session = step(session);
    expect(canDealNextHand(session)).toBe(true);
    expect(session.lastHand).not.toBeNull();
    const next = doNextHand(session)!;
    expect(next.handNumber).toBe(session.handNumber + 1);
    expect(next.lastHand).toBeNull();
    expect(next.scores).toEqual(session.scores);
  });
});

describe('the four verdicts', () => {
  const seeded = createSession('normal', 'hearts-verdict');
  const verdict = (scores: BySeat<number>) => restoreSession({ ...seeded, scores }).status;

  it('reads the lowest score, from the player’s side of the table', () => {
    expect(verdict([10, 100, 40, 50])).toBe('won');
    expect(verdict([100, 10, 40, 50])).toBe('lost');
    expect(verdict([10, 10, 100, 50])).toBe('draw');
    // A tie between two CPU seats is still a loss: the player is not lowest.
    expect(verdict([40, 10, 10, 100])).toBe('lost');
    expect(verdict([99, 99, 99, 99])).toBe('playing');
    expect(statusOf([100, 100, 100, 100])).toBe('draw');
  });
});

describe('the pass, from the player’s side', () => {
  const opening = createSession('normal', 'hearts-do-pass');

  it('takes three, puts one back, and confirms', () => {
    const mine = opening.hand.hands[YOU];
    let session = opening;
    for (const card of mine.slice(0, PASS_SIZE)) session = doSelectPassCard(session, card)!;
    expect(session.hand.selected[YOU]).toHaveLength(PASS_SIZE);
    expect(canConfirmPass(session)).toBe(true);
    expect(doSelectPassCard(session, mine[3]!)).toBeNull();

    const fewer = doUnselectPassCard(session, mine[0]!)!;
    expect(canConfirmPass(fewer)).toBe(false);
    expect(doConfirmPass(fewer)).toBeNull();

    const confirmed = doConfirmPass(session)!;
    expect(confirmed.event).toEqual({ kind: 'pass', seat: YOU });
    expect(confirmed.session.hand.confirmed[YOU]).toBe(true);
    expect(doSelectPassCard(confirmed.session, mine[3]!)).toBeNull();
  });

  it('does not count picking cards up and putting them down as beats', () => {
    const picked = doSelectPassCard(opening, opening.hand.hands[YOU][0]!)!;
    expect(picked.moveCount).toBe(opening.moveCount);
    expect(doUnselectPassCard(picked, opening.hand.hands[YOU][0]!)!.moveCount).toBe(
      opening.moveCount,
    );
  });

  it('lets the three CPU seats settle while the player is still choosing', () => {
    let session = opening;
    expect(cpuSeatToAct(session)).toBe(1);
    for (const seat of [1, 2, 3]) {
      const outcome = applyCpuStep(session)!;
      expect(outcome.event).toEqual({ kind: 'pass', seat });
      expect(outcome.exchange).toBeNull();
      session = outcome.session;
    }
    expect(isCpuTurn(session)).toBe(false);
    expect(session.hand.phase).toBe('passing');

    // The player's confirmation is the fourth, so it moves all twelve cards.
    for (const card of session.hand.hands[YOU].slice(0, PASS_SIZE)) {
      session = doSelectPassCard(session, card)!;
    }
    const outcome = doConfirmPass(session)!;
    expect(outcome.exchange).not.toBeNull();
    expect(outcome.exchange!.offset).toBe(1);
    expect(outcome.session.hand.phase).toBe('playing');
    for (const seat of SEATS) expect(outcome.exchange!.received[seat]).toHaveLength(PASS_SIZE);
  });

  it('has no pass at all on the fourth hand', () => {
    let session = createSession('normal', 'hearts-fourth');
    while (session.handNumber < 4) session = step(session);
    expect(session.hand.passOffset).toBe(0);
    expect(session.hand.phase).toBe('playing');
    expect(doSelectPassCard(session, session.hand.hands[YOU][0]!)).toBeNull();
    expect(canConfirmPass(session)).toBe(false);
    expect(doConfirmPass(session)).toBeNull();
  });
});

describe('the tricks, beat by beat', () => {
  /** A session on the player's turn to play a card. */
  const onMyTurn = (seed: string): HeartsSession => {
    let session = createSession('normal', seed);
    while (session.hand.phase !== 'playing' || seatToPlay(session.hand) !== YOU) {
      session = step(session);
    }
    return session;
  };

  it('offers the player exactly the cards the rules allow', () => {
    const session = onMyTurn('hearts-playable');
    const legal = playableCards(session);
    expect(legal.length).toBeGreaterThan(0);
    for (const card of session.hand.hands[YOU]) {
      expect(doPlayCard(session, card) === null).toBe(!legal.includes(card));
    }
  });

  it('refuses the player’s card while a CPU seat holds the turn', () => {
    let session = onMyTurn('hearts-not-my-turn');
    session = doPlayCard(session, playableCards(session)[0]!)!.session;
    expect(seatToPlay(session.hand)).not.toBe(YOU);
    expect(playableCards(session)).toEqual([]);
    expect(doPlayCard(session, session.hand.hands[YOU][0]!)).toBeNull();
  });

  it('leaves a finished trick on the table until it is collected', () => {
    let session = createSession('normal', 'hearts-collect');
    while (!canCollectTrick(session)) session = step(session);
    expect(session.hand.played).toHaveLength(4);
    // Nothing else is on offer: the table's beat comes before anybody's.
    expect(isCpuTurn(session)).toBe(false);
    expect(applyCpuStep(session)).toBeNull();
    expect(playableCards(session)).toEqual([]);

    const outcome = doCollectTrick(session)!;
    expect(outcome.event.kind).toBe('collect');
    if (outcome.event.kind === 'collect') {
      expect(SEATS).toContain(outcome.event.trick.winner);
      expect(outcome.session.hand.leader).toBe(outcome.event.trick.winner);
    }
    expect(outcome.session.hand.tricks).toHaveLength(session.hand.tricks.length + 1);
    expect(doCollectTrick(outcome.session)).toBeNull();
  });

  it('scores the hand on the thirteenth trick and not before', () => {
    let session = createSession('normal', 'hearts-thirteenth');
    let scored = 0;
    while (session.hand.phase !== 'over') {
      const outcome = canCollectTrick(session) ? doCollectTrick(session) : null;
      if (outcome !== null) {
        if (outcome.handResult !== null) scored += 1;
        expect(outcome.handResult === null).toBe(outcome.session.hand.phase !== 'over');
        session = outcome.session;
      } else {
        session = step(session);
      }
    }
    expect(scored).toBe(1);
    expect(session.hand.tricks).toHaveLength(TRICKS_PER_HAND);
    expect(session.scores.reduce((a, b) => a + b, 0)).toBe(
      session.lastHand!.delta.reduce((a, b) => a + b, 0),
    );
  });

  it('takes one CPU beat at a time — one seat, one card', () => {
    let session = createSession('normal', 'hearts-one-at-a-time');
    while (session.hand.phase !== 'playing') session = step(session);
    while (!isCpuTurn(session)) session = step(session);
    const before = session.hand.played.length;
    const outcome = applyCpuStep(session)!;
    expect(outcome.event.kind).toBe('play');
    expect(outcome.session.hand.played).toHaveLength(before + 1);
    expect(outcome.session.moveCount).toBe(session.moveCount + 1);
  });
});

describe('suspend and resume', () => {
  const resumed = (session: HeartsSession): HeartsSession =>
    restoreSession({
      seed: session.seed,
      difficulty: session.difficulty,
      hand: decodeHand(encodeHand(session.hand))!,
      handNumber: session.handNumber,
      scores: session.scores,
      moveCount: session.moveCount,
      elapsedSeconds: session.elapsedSeconds,
    });

  it('comes back mid-pass, with the player’s three still picked out', () => {
    let session = createSession('hard', 'hearts-resume-pass');
    session = applyCpuStep(session)!.session;
    for (const card of session.hand.hands[YOU].slice(0, 2)) {
      session = doSelectPassCard(session, card)!;
    }
    expect(session.hand.phase).toBe('passing');
    expect(resumed(session)).toEqual(session);
    expect(resumed(session).hand.selected[YOU]).toHaveLength(2);
  });

  it('comes back mid-trick, into the same reply from the same seat', () => {
    let session = createSession('hard', 'hearts-resume-trick');
    while (session.hand.phase !== 'playing' || session.hand.tricks.length < 2) {
      session = step(session);
    }
    while (!isCpuTurn(session)) session = step(session);
    const restored = resumed(session);
    expect(restored).toEqual(session);
    expect(isCpuTurn(restored)).toBe(true);
    expect(cpuSeatToAct(restored)).toBe(cpuSeatToAct(session));
    expect(cpuViewOf(restored, cpuSeatToAct(restored)!)).toEqual(
      cpuViewOf(session, cpuSeatToAct(session)!),
    );
    expect(applyCpuStep(restored)!.session.hand).toEqual(applyCpuStep(session)!.session.hand);
  });

  it('comes back on a finished trick that still has to be collected', () => {
    let session = createSession('normal', 'hearts-resume-collect');
    while (!canCollectTrick(session)) session = step(session);
    const restored = resumed(session);
    expect(canCollectTrick(restored)).toBe(true);
    expect(doCollectTrick(restored)!.session.hand).toEqual(doCollectTrick(session)!.session.hand);
  });

  it('comes back on a settled hand, with the score recomputed rather than stored', () => {
    let session = createSession('normal', 'hearts-resume-over');
    while (session.hand.phase !== 'over') session = step(session);
    expect(session.lastHand).not.toBeNull();
    const restored = resumed(session);
    expect(restored.lastHand).toEqual(session.lastHand);
    expect(canDealNextHand(restored)).toBe(true);
  });

  it('carries the score across hands', () => {
    let session = createSession('normal', 'hearts-resume-carry');
    while (session.handNumber < 3) session = step(session);
    expect(session.scores.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(resumed(session).scores).toEqual(session.scores);
    expect(resumed(session).handNumber).toBe(session.handNumber);
  });

  it('reads the match verdict back out of the score', () => {
    const session = createSession('easy', 'hearts-resume-status');
    expect(restoreSession({ ...session, scores: [4, MATCH_TARGET, 50, 60] }).status).toBe('won');
    expect(restoreSession({ ...session, scores: [MATCH_TARGET, 4, 50, 60] }).status).toBe('lost');
    expect(restoreSession({ ...session, scores: [99, 99, 99, 99] }).status).toBe('playing');
  });
});

describe('a finished match takes no more beats', () => {
  const finished = (): HeartsSession => {
    const session = createSession('normal', 'hearts-finished');
    return restoreSession({ ...session, scores: [4, MATCH_TARGET + 3, 40, 60] });
  };

  it('refuses every action, the next deal included', () => {
    const session = finished();
    expect(session.status).toBe('won');
    const anyCard: Card = session.hand.hands[YOU][0]!;
    expect(doSelectPassCard(session, anyCard)).toBeNull();
    expect(doUnselectPassCard(session, anyCard)).toBeNull();
    expect(doConfirmPass(session)).toBeNull();
    expect(doPlayCard(session, anyCard)).toBeNull();
    expect(doCollectTrick(session)).toBeNull();
    expect(doNextHand(session)).toBeNull();
    expect(applyCpuStep(session)).toBeNull();
    expect(canConfirmPass(session)).toBe(false);
    expect(canDealNextHand(session)).toBe(false);
    expect(canCollectTrick(session)).toBe(false);
    expect(isCpuTurn(session)).toBe(false);
    expect(playableCards(session)).toEqual([]);
  });
});

describe('there is no undo', () => {
  /**
   * Not an oversight and not a to-do. Taking a move back after watching three
   * replies would hand back a card you now know was safe, and no take-back
   * undoes knowing it. The absence is the feature, so it is pinned here:
   * adding an undo to this module has to break this test first.
   */
  it('is not in the session’s API at all', () => {
    const exported = Object.keys(sessionModule);
    expect(exported).not.toContain('undo');
    expect(exported).not.toContain('canUndo');
    expect(exported.some((name) => /undo/i.test(name))).toBe(false);
  });

  it('and no session carries a history to undo from', () => {
    const session = createSession('normal', 'hearts-no-history');
    expect(Object.keys(session)).not.toContain('history');
  });
});

describe('the seed pins the match down', () => {
  it('deals and answers identically for the same seed', () => {
    expect(playMatch('hard', 'hearts-repeatable')).toEqual(playMatch('hard', 'hearts-repeatable'));
  });

  it('deals a different match for a different seed', () => {
    expect(createSession('hard', 'hearts-repeatable').hand.hands[YOU]).not.toEqual(
      createSession('hard', 'hearts-repeatable-2').hand.hands[YOU],
    );
  });

  it('takes its clock and its coin as arguments, never from the ambient world', () => {
    expect(newSeedToken(1, () => 0)).toBe(newSeedToken(1, () => 0));
    expect(newSeedToken(1, () => 0)).not.toBe(newSeedToken(2, () => 0));
    expect(matchSeed('abc')).toBe('hearts-abc');
  });
});
