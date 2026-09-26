/**
 * A turn and a game (docs/YACHT_RULES.md §2, §4): the first throw takes all
 * five, kept dice stay put, three throws is the limit, a box is used once,
 * and twelve boxes end the game.
 */
import { describe, expect, it } from 'vitest';
import { scoreFor } from './engine';
import {
  canHold,
  canRoll,
  createSession,
  drawFaces,
  gameSeed,
  restoreSession,
  roll,
  score,
  statusOf,
  toggleHold,
  totalOf,
  turnsPlayed,
  type YachtSession,
} from './session';
import { CATEGORIES } from './types';

const SEED = 'yacht-session-test';

/** Rolls, asserting the throw was allowed. */
const rolled = (session: YachtSession): YachtSession => {
  const next = roll(session);
  expect(next).not.toBeNull();
  return next!;
};

const held = (session: YachtSession, index: number): YachtSession => {
  const next = toggleHold(session, index);
  expect(next).not.toBeNull();
  return next!;
};

describe('a fresh sheet', () => {
  it('starts before the first throw, with nothing kept and nothing scored', () => {
    const session = createSession(SEED);
    expect(session.rollsUsed).toBe(0);
    expect(session.rollIndex).toBe(0);
    expect(session.held).toEqual([false, false, false, false, false]);
    expect(session.scores).toHaveLength(12);
    expect(session.scores.every((points) => points === null)).toBe(true);
    expect(statusOf(session)).toBe('playing');
    expect(turnsPlayed(session)).toBe(0);
    expect(totalOf(session)).toBe(0);
  });

  it('seeds every new game differently, under the game’s own prefix (§4)', () => {
    expect(gameSeed('abc')).toBe('yacht-abc');
    expect(createSession().seed).toMatch(/^yacht-/);
  });

  it('cannot keep or score before the first throw (§2)', () => {
    const session = createSession(SEED);
    expect(canHold(session)).toBe(false);
    expect(toggleHold(session, 0)).toBeNull();
    for (const category of CATEGORIES) expect(score(session, category)).toBeNull();
  });
});

describe('throwing and keeping (§2, §4)', () => {
  it('throws all five on the first throw, from the seed and the throw number', () => {
    const first = rolled(createSession(SEED));
    expect(first.dice).toEqual(drawFaces(SEED, 0));
    expect(first.rollIndex).toBe(1);
    expect(first.rollsUsed).toBe(1);
    for (const face of first.dice) {
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
    }
  });

  it('leaves kept dice alone and throws the rest from the next draw', () => {
    let session = rolled(createSession(SEED));
    const before = session.dice;
    session = held(session, 0);
    session = held(session, 3);
    session = rolled(session);

    const draw = drawFaces(SEED, 1);
    expect(session.dice).toEqual([before[0], draw[1], draw[2], before[3], draw[4]]);
    // The hold survives the throw: the player decides again, not the game.
    expect(session.held).toEqual([true, false, false, true, false]);
  });

  it('draws all five every throw, so the holds never shift what the others get', () => {
    // Same seed, same throw number, different holds: every unkept position
    // lands on the same face either way.
    const start = rolled(createSession(SEED));
    const keepOne = rolled(held(start, 2));
    const keepThree = rolled(held(held(held(start, 0), 1), 4));
    const draw = drawFaces(SEED, 1);
    expect(keepOne.dice[0]).toBe(draw[0]);
    expect(keepOne.dice[4]).toBe(draw[4]);
    expect(keepThree.dice[2]).toBe(draw[2]);
    expect(keepThree.dice[3]).toBe(draw[3]);
  });

  it('lets a die go again with a second tap', () => {
    const session = rolled(createSession(SEED));
    const kept = held(session, 1);
    expect(kept.held[1]).toBe(true);
    expect(held(kept, 1).held[1]).toBe(false);
  });

  it('allows three throws and no fourth', () => {
    let session = rolled(createSession(SEED));
    session = rolled(session);
    session = rolled(session);
    expect(session.rollsUsed).toBe(3);
    expect(canRoll(session)).toBe(false);
    expect(roll(session)).toBeNull();
  });

  it('has nothing to keep after the third throw', () => {
    const session = rolled(rolled(rolled(createSession(SEED))));
    expect(canHold(session)).toBe(false);
    expect(toggleHold(session, 0)).toBeNull();
  });

  it('cannot throw with all five kept', () => {
    let session = rolled(createSession(SEED));
    for (let index = 0; index < 5; index++) session = held(session, index);
    expect(canRoll(session)).toBe(false);
    expect(roll(session)).toBeNull();
    // Letting one go makes the throw possible again.
    expect(roll(held(session, 2))).not.toBeNull();
  });

  it('ignores a stale hold on the first throw of a turn', () => {
    // A restored or hand-built session can carry holds into a turn's start;
    // the first throw takes all five regardless (§2).
    const stale: YachtSession = { ...createSession(SEED), held: [true, true, true, true, true] };
    const first = rolled(stale);
    expect(first.dice).toEqual(drawFaces(SEED, 0));
    expect(first.held).toEqual([false, false, false, false, false]);
  });

  it('lands evenly on the six faces', () => {
    // Floor of a uniform [0, 1) float times six: no modulo bias to correct
    // for. A loose band over 6,000 faces catches a broken draw, not noise.
    const counts = [0, 0, 0, 0, 0, 0];
    for (let index = 0; index < 1200; index++) {
      for (const face of drawFaces(SEED, index)) counts[face - 1]! += 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('refuses a die that does not exist', () => {
    const session = rolled(createSession(SEED));
    expect(toggleHold(session, -1)).toBeNull();
    expect(toggleHold(session, 5)).toBeNull();
    expect(toggleHold(session, 1.5)).toBeNull();
  });
});

describe('scoring a box (§2, §3)', () => {
  it('puts the dice’s points in the box and starts the next turn', () => {
    let session = rolled(createSession(SEED));
    session = held(session, 0);
    const dice = session.dice;
    session = score(session, 'choice')!;

    expect(session.scores[CATEGORIES.indexOf('choice')]).toBe(scoreFor('choice', dice));
    expect(session.rollsUsed).toBe(0);
    expect(session.held).toEqual([false, false, false, false, false]);
    expect(turnsPlayed(session)).toBe(1);
    // The throw count runs across turns; it never goes back (§4).
    expect(session.rollIndex).toBe(1);
  });

  it('takes a zero in a box whose condition is not met', () => {
    // Find a first throw that is not a Yacht, which nearly every seed gives.
    const session = rolled(createSession(SEED));
    expect(scoreFor('yacht', session.dice)).toBe(0);
    expect(score(session, 'yacht')!.scores[CATEGORIES.indexOf('yacht')]).toBe(0);
  });

  it('uses each box once', () => {
    let session = rolled(createSession(SEED));
    session = score(session, 'ones')!;
    session = rolled(session);
    expect(score(session, 'ones')).toBeNull();
    expect(score(session, 'twos')).not.toBeNull();
  });

  it('ends after twelve turns with the boxes’ total, and then refuses everything', () => {
    let session = createSession(SEED);
    let expected = 0;
    for (const category of CATEGORIES) {
      expect(statusOf(session)).toBe('playing');
      session = rolled(session);
      expected += scoreFor(category, session.dice);
      session = score(session, category)!;
    }
    expect(turnsPlayed(session)).toBe(12);
    expect(statusOf(session)).toBe('finished');
    expect(totalOf(session)).toBe(expected);

    expect(roll(session)).toBeNull();
    expect(canRoll(session)).toBe(false);
    for (const category of CATEGORIES) expect(score(session, category)).toBeNull();
  });
});

describe('restoring a session (§7)', () => {
  const midTurn = (): YachtSession => {
    let session = rolled(createSession(SEED));
    session = score(session, 'choice')!;
    session = held(rolled(session), 1);
    return session;
  };

  it('gives back a session that could have been played', () => {
    const session = midTurn();
    expect(restoreSession(session)).toEqual(session);
  });

  it('refuses holds before the first throw of a turn', () => {
    const session = { ...createSession(SEED), held: [false, true, false, false, false] };
    expect(restoreSession(session)).toBeNull();
  });

  it('refuses a box holding points no throw could score there', () => {
    const scores = [...midTurn().scores];
    scores[CATEGORIES.indexOf('fours')] = 13;
    expect(restoreSession({ ...midTurn(), scores })).toBeNull();
  });

  it('refuses a throw count the sheet cannot explain', () => {
    // One box filled (one to three throws) and two throws this turn: between
    // 3 and 5 throws in all.
    const session = { ...midTurn(), rollsUsed: 2 as const };
    expect(restoreSession({ ...session, rollIndex: 2 })).toBeNull();
    expect(restoreSession({ ...session, rollIndex: 3 })).not.toBeNull();
    expect(restoreSession({ ...session, rollIndex: 5 })).not.toBeNull();
    expect(restoreSession({ ...session, rollIndex: 6 })).toBeNull();
  });
});
