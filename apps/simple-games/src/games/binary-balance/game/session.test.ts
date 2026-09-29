/**
 * One puzzle's life (docs/BINARY_BALANCE_RULES.md §2, §4, §8, §10): seeds,
 * the tap, the win booked exactly once, Retry, the hint that never writes,
 * and a clock that only moves forward.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doHintUse,
  doTap,
  hintFor,
  newSeedToken,
  restartSession,
  restoreSession,
  violationsOf,
  withElapsedSeconds,
  type BinaryBalanceSession,
} from './session';
import { EMPTY, SIZE_FOR } from './types';

const easy = () => createDifficultySession('easy', 'binary-balance-easy-golden');

/** Taps a cell round to a given value (one tap = circle, two = square). */
function write(session: BinaryBalanceSession, index: number, value: 0 | 1): BinaryBalanceSession {
  let next = doTap(session, index)!;
  if (value === 1) next = doTap(next, index)!;
  return next;
}

/** Fills every open cell with the answer, the way a player would. */
function solveByTapping(session: BinaryBalanceSession): BinaryBalanceSession {
  let next = session;
  session.givens.forEach((given, index) => {
    if (given === EMPTY) next = write(next, index, session.solution[index]!);
  });
  return next;
}

describe('seeds and sizes (§1, §10)', () => {
  it('seeds a difficulty game from its difficulty and a token', () => {
    expect(difficultySeed('hard', 'abc')).toBe('binary-balance-hard-abc');
    expect(newSeedToken(0, () => 0)).toBe('0-0');
    const session = createDifficultySession('hard');
    expect(session.seed).toMatch(/^binary-balance-hard-/);
    expect(session.size).toBe(6);
  });

  it('deals the daily at medium, a 6×6, from the date alone', () => {
    const daily = createDailySession('2026-08-02');
    expect(daily.seed).toBe(dailySeed('2026-08-02'));
    expect(daily.seed).toBe('binary-balance-daily-2026-08-02');
    expect(daily.difficulty).toBe(DAILY_DIFFICULTY);
    expect(daily.size).toBe(SIZE_FOR.medium);
    expect(daily.mode).toBe('daily');
  });

  it('starts with nothing written, no hints, no time, and at least one link', () => {
    const session = easy();
    expect(session.marks.every((mark) => mark === EMPTY)).toBe(true);
    expect(session).toMatchObject({ status: 'playing', hintCount: 0, elapsedSeconds: 0 });
    expect(session.links.length).toBeGreaterThan(0);
  });
});

describe('the tap and the win (§2, §4)', () => {
  it('never moves a given', () => {
    const session = easy();
    const given = session.givens.findIndex((cell) => cell !== EMPTY);
    expect(doTap(session, given)).toBeNull();
  });

  it('solves on the last right mark, exactly once', () => {
    const solved = solveByTapping(easy());
    expect(solved.status).toBe('solved');
    const open = solved.givens.findIndex((cell) => cell === EMPTY);
    expect(doTap(solved, open)).toBeNull();
    expect(hintFor(solved)).toBeNull();
  });

  it('shows a broken rule the moment it is written (§9)', () => {
    let session = easy();
    // Row 1 is '..0...': three squares on its open end.
    for (const index of [3, 4, 5]) session = write(session, index, 1);
    expect(violationsOf(session).any).toBe(true);
    expect(session.status).toBe('playing');
  });

  it('re-derives the win on restore rather than trusting a saved status', () => {
    const solved = solveByTapping(easy());
    const { status: _status, ...data } = solved;
    expect(restoreSession(data).status).toBe('solved');
    expect(restoreSession({ ...data, marks: easy().marks }).status).toBe('playing');
  });
});

describe('Retry (§10)', () => {
  it('deals the same board again from a clean slate', () => {
    const played = withElapsedSeconds(doHintUse(write(easy(), 0, 1)), 30);
    const again = restartSession(played);
    expect(again.seed).toBe(played.seed);
    expect(again.givens).toEqual(played.givens);
    expect(again.links).toEqual(played.links);
    expect(again.marks.every((mark) => mark === EMPTY)).toBe(true);
    expect(again).toMatchObject({ hintCount: 0, elapsedSeconds: 0 });

    const daily = restartSession(write(createDailySession('2026-08-03'), 0, 0));
    expect(daily.dailyDate).toBe('2026-08-03');
    expect(daily.marks.every((mark) => mark === EMPTY)).toBe(true);
  });
});

describe('the hint and the clock (§8, §10)', () => {
  it('counts hints and writes nothing', () => {
    const session = easy();
    const hint = hintFor(session);
    expect(hint).not.toBeNull();
    expect(session.marks.every((mark) => mark === EMPTY)).toBe(true);
    expect(doHintUse(doHintUse(session)).hintCount).toBe(2);
  });

  it('only ever moves the clock forward', () => {
    const session = withElapsedSeconds(easy(), 12.7);
    expect(session.elapsedSeconds).toBe(12);
    expect(withElapsedSeconds(session, 5).elapsedSeconds).toBe(12);
    expect(withElapsedSeconds(session, 12)).toBe(session);
  });
});
