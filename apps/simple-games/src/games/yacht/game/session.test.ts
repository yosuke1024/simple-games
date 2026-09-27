/**
 * A turn and a match (docs/YACHT_RULES.md §1, §2, §4): the first throw takes
 * all five, kept dice stay put, three throws is the limit, a box is used
 * once, the player always throws first, and both sheets full ends the match.
 */
import { describe, expect, it } from 'vitest';
import { scoreFor } from './engine';
import {
  applyCpuStep,
  canHold,
  canRoll,
  canScore,
  createSession,
  cpuTotalOf,
  drawFaces,
  filledCount,
  gameSeed,
  outcomeOf,
  restoreSession,
  roll,
  score,
  setHolds,
  sheetOf,
  statusOf,
  toggleHold,
  toMove,
  totalOf,
  turnsPlayed,
  type YachtSession,
} from './session';
import { CATEGORIES, type Seat } from './types';

const SEED = 'yacht-session-test';

/** Rolls for `seat` (the player by default), asserting the throw was allowed. */
const rolled = (session: YachtSession, seat: Seat = 'player'): YachtSession => {
  const next = roll(session, seat);
  expect(next).not.toBeNull();
  return next!;
};

/** Toggles a hold for `seat` (the player by default), asserting it was allowed. */
const held = (session: YachtSession, index: number, seat: Seat = 'player'): YachtSession => {
  const next = toggleHold(session, seat, index);
  expect(next).not.toBeNull();
  return next!;
};

/** Plays the CPU's whole turn to its end, one `applyCpuStep` beat at a time. */
function finishCpuTurn(session: YachtSession): YachtSession {
  let current = session;
  while (statusOf(current) === 'playing' && toMove(current) === 'cpu') {
    const next = applyCpuStep(current);
    expect(next).not.toBeNull();
    current = next!;
  }
  return current;
}

describe('a fresh sheet', () => {
  it('starts before the first throw, with nothing kept and nothing scored', () => {
    const session = createSession(SEED);
    expect(session.rollsUsed).toBe(0);
    expect(session.rollIndex).toBe(0);
    expect(session.held).toEqual([false, false, false, false, false]);
    expect(session.scores).toHaveLength(12);
    expect(session.cpuScores).toHaveLength(12);
    expect(session.scores.every((points) => points === null)).toBe(true);
    expect(session.cpuScores.every((points) => points === null)).toBe(true);
    expect(statusOf(session)).toBe('playing');
    expect(turnsPlayed(session)).toBe(0);
    expect(totalOf(session)).toBe(0);
    expect(cpuTotalOf(session)).toBe(0);
    // The player always throws first (§1).
    expect(toMove(session)).toBe('player');
  });

  it('seeds every new game differently, under the game’s own prefix (§4)', () => {
    expect(gameSeed('abc')).toBe('yacht-abc');
    expect(createSession().seed).toMatch(/^yacht-/);
  });

  it('cannot keep or score before the first throw (§2)', () => {
    const session = createSession(SEED);
    expect(canHold(session, 'player')).toBe(false);
    expect(toggleHold(session, 'player', 0)).toBeNull();
    for (const category of CATEGORIES) expect(score(session, 'player', category)).toBeNull();
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
    expect(canRoll(session, 'player')).toBe(false);
    expect(roll(session, 'player')).toBeNull();
  });

  it('has nothing to keep after the third throw', () => {
    const session = rolled(rolled(rolled(createSession(SEED))));
    expect(canHold(session, 'player')).toBe(false);
    expect(toggleHold(session, 'player', 0)).toBeNull();
  });

  it('cannot throw with all five kept', () => {
    let session = rolled(createSession(SEED));
    for (let index = 0; index < 5; index++) session = held(session, index);
    expect(canRoll(session, 'player')).toBe(false);
    expect(roll(session, 'player')).toBeNull();
    // Letting one go makes the throw possible again.
    expect(roll(held(session, 2), 'player')).not.toBeNull();
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
    expect(toggleHold(session, 'player', -1)).toBeNull();
    expect(toggleHold(session, 'player', 5)).toBeNull();
    expect(toggleHold(session, 'player', 1.5)).toBeNull();
  });
});

describe('scoring a box (§2, §3)', () => {
  it('puts the dice’s points in the box and starts the next turn', () => {
    let session = rolled(createSession(SEED));
    session = held(session, 0);
    const dice = session.dice;
    session = score(session, 'player', 'choice')!;

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
    expect(score(session, 'player', 'yacht')!.scores[CATEGORIES.indexOf('yacht')]).toBe(0);
  });

  it('uses each box once', () => {
    let session = rolled(createSession(SEED));
    session = score(session, 'player', 'ones')!;
    // It is the CPU's turn now (§1); play it out before the player throws again.
    session = finishCpuTurn(session);
    session = rolled(session);
    expect(score(session, 'player', 'ones')).toBeNull();
    expect(score(session, 'player', 'twos')).not.toBeNull();
  });

  it('ends when both sheets are full, and then refuses everything', () => {
    let session = createSession(SEED);
    let expectedPlayerTotal = 0;
    for (const category of CATEGORIES) {
      expect(statusOf(session)).toBe('playing');
      session = rolled(session);
      expectedPlayerTotal += scoreFor(category, session.dice);
      session = score(session, 'player', category)!;
      session = finishCpuTurn(session);
    }
    expect(turnsPlayed(session)).toBe(12);
    expect(filledCount(session.cpuScores)).toBe(12);
    expect(statusOf(session)).toBe('finished');
    expect(totalOf(session)).toBe(expectedPlayerTotal);
    expect(outcomeOf(session)).not.toBeNull();

    expect(roll(session, 'player')).toBeNull();
    expect(roll(session, 'cpu')).toBeNull();
    expect(canRoll(session, 'player')).toBe(false);
    expect(applyCpuStep(session)).toBeNull();
    for (const category of CATEGORIES) {
      expect(score(session, 'player', category)).toBeNull();
      expect(score(session, 'cpu', category)).toBeNull();
    }
  });
});

describe('seats and turns (§1, §2, §5)', () => {
  it('alternates one box at a time, the player first', () => {
    let session = createSession(SEED);
    expect(toMove(session)).toBe('player');
    session = score(rolled(session), 'player', 'ones')!;
    expect(toMove(session)).toBe('cpu');
    session = finishCpuTurn(session);
    expect(toMove(session)).toBe('player');
    expect(filledCount(session.scores)).toBe(1);
    expect(filledCount(session.cpuScores)).toBe(1);
  });

  it('refuses the CPU acting on the player’s turn', () => {
    const session = createSession(SEED);
    expect(canRoll(session, 'cpu')).toBe(false);
    expect(roll(session, 'cpu')).toBeNull();
    const thrown = rolled(session);
    expect(canHold(thrown, 'cpu')).toBe(false);
    expect(toggleHold(thrown, 'cpu', 0)).toBeNull();
    expect(setHolds(thrown, 'cpu', [true, false, false, false, false])).toBeNull();
    expect(canScore(thrown, 'cpu', 'ones')).toBe(false);
    expect(score(thrown, 'cpu', 'ones')).toBeNull();
    expect(applyCpuStep(thrown)).toBeNull();
  });

  it('refuses the player acting on the CPU’s turn', () => {
    let session = rolled(createSession(SEED));
    session = score(session, 'player', 'ones')!;
    // It is the CPU's turn now.
    expect(canRoll(session, 'player')).toBe(false);
    expect(roll(session, 'player')).toBeNull();
    expect(canScore(session, 'player', 'twos')).toBe(false);
    expect(score(session, 'player', 'twos')).toBeNull();
    // canHold/setHolds are false regardless of rollsUsed once it is not this
    // seat's turn, even right after the CPU's own first throw.
    const cpuThrew = roll(session, 'cpu')!;
    expect(canHold(cpuThrew, 'player')).toBe(false);
    expect(toggleHold(cpuThrew, 'player', 0)).toBeNull();
    expect(setHolds(cpuThrew, 'player', [true, false, false, false, false])).toBeNull();
  });

  it('sets the CPU’s whole keep in one step (§5)', () => {
    const session = rolled(createSession(SEED));
    const mask = [true, false, true, false, true];
    // Not the player's turn to move once a box has been scored — check the
    // CPU can, and the player cannot, on the CPU's own turn.
    const afterBox = score(session, 'player', 'ones')!;
    const cpuThrew = roll(afterBox, 'cpu')!;
    expect(setHolds(cpuThrew, 'cpu', mask)!.held).toEqual(mask);
    expect(setHolds(cpuThrew, 'player', mask)).toBeNull();
  });

  it('refuses setHolds before a throw, and anything but five booleans', () => {
    const session = createSession(SEED);
    // Before the first throw of the turn.
    expect(setHolds(session, 'player', [false, false, false, false, false])).toBeNull();
    const thrown = rolled(session);
    // Wrong length.
    expect(setHolds(thrown, 'player', [true, false, false])).toBeNull();
    // After the third throw, there is nothing left to keep from.
    const spent = rolled(rolled(thrown));
    expect(spent.rollsUsed).toBe(3);
    expect(setHolds(spent, 'player', [true, true, true, true, true])).toBeNull();
  });

  it('is finished only once both sheets are full, and the outcome follows the totals', () => {
    let session = createSession(SEED);
    for (const category of CATEGORIES) {
      session = score(rolled(session), 'player', category)!;
      expect(statusOf(session)).toBe('playing');
      expect(outcomeOf(session)).toBeNull();
      session = finishCpuTurn(session);
    }
    expect(statusOf(session)).toBe('finished');
    const player = totalOf(session);
    const cpu = cpuTotalOf(session);
    const outcome = outcomeOf(session);
    expect(outcome).toBe(player > cpu ? 'won' : player < cpu ? 'lost' : 'draw');
    expect(sheetOf(session, 'player')).toBe(session.scores);
    expect(sheetOf(session, 'cpu')).toBe(session.cpuScores);
  });
});

describe('restoring a session (§8)', () => {
  const midTurn = (): YachtSession => {
    let session = rolled(createSession(SEED));
    session = score(session, 'player', 'choice')!;
    session = finishCpuTurn(session);
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

  it('refuses the same on the CPU’s sheet', () => {
    const cpuScores = [...midTurn().cpuScores];
    cpuScores[CATEGORIES.indexOf('sixes')] = 7;
    expect(restoreSession({ ...midTurn(), cpuScores })).toBeNull();
  });

  it('refuses a throw count the sheet cannot explain', () => {
    // Two boxes filled between the two sheets (one each) and two throws this
    // turn: between 4 and 8 throws in all.
    const session = { ...midTurn(), rollsUsed: 2 as const };
    expect(restoreSession({ ...session, rollIndex: 3 })).toBeNull();
    expect(restoreSession({ ...session, rollIndex: 4 })).not.toBeNull();
    expect(restoreSession({ ...session, rollIndex: 8 })).not.toBeNull();
    expect(restoreSession({ ...session, rollIndex: 9 })).toBeNull();
  });

  it('refuses a CPU sheet fuller than the player’s (§1)', () => {
    const base = createSession(SEED);
    const scores = [...base.scores];
    scores[CATEGORIES.indexOf('ones')] = 0;
    const cpuScores = [...base.cpuScores];
    cpuScores[CATEGORIES.indexOf('ones')] = 0;
    cpuScores[CATEGORIES.indexOf('twos')] = 0;
    // Three boxes filled in all, no throws yet this turn: 3 to 9 throws would
    // otherwise be in bounds — it is the seat imbalance alone that refuses this.
    const session: YachtSession = { ...base, scores, cpuScores, rollsUsed: 0, rollIndex: 3 };
    expect(restoreSession(session)).toBeNull();
  });

  it('refuses a player sheet more than one box ahead of the CPU’s (§1)', () => {
    const base = createSession(SEED);
    const scores = [...base.scores];
    scores[CATEGORIES.indexOf('ones')] = 0;
    scores[CATEGORIES.indexOf('twos')] = 0;
    // Two boxes filled in all, no throws yet this turn: 2 to 6 throws would
    // otherwise be in bounds — it is the seat imbalance alone that refuses this.
    const session: YachtSession = { ...base, scores, rollsUsed: 0, rollIndex: 2 };
    expect(restoreSession(session)).toBeNull();
  });
});
