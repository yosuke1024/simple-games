import { describe, expect, it } from 'vitest';
import {
  createDailySession,
  createLevelSession,
  isTapped,
  nextTarget,
  restartSession,
  tapCell,
  type SchulteSession,
} from './session';
import { cellCount } from './types';

/** Taps the cell holding `value`, asserting the tap was accepted. */
function tapValue(session: SchulteSession, value: number): SchulteSession {
  const index = session.values.indexOf(value);
  expect(index).toBeGreaterThanOrEqual(0);
  const outcome = tapCell(session, index);
  expect(outcome).not.toBeNull();
  return outcome!.session;
}

/** Plays a whole round correctly. */
function playThrough(start: SchulteSession): SchulteSession {
  let session = start;
  for (let i = 0; i < cellCount(start.size); i++) {
    const target = nextTarget(session);
    expect(target).not.toBeNull();
    session = tapValue(session, target!);
  }
  return session;
}

describe('a round (docs/SCHULTE_TABLE_RULES.md §2, §3)', () => {
  it('starts on the first value of its order', () => {
    expect(nextTarget(createLevelSession(1))).toBe(1);
    expect(nextTarget(createLevelSession(16))).toBe(9); // 3x3 descending
    expect(nextTarget(createLevelSession(91))).toBe(1); // 5x5 odd-then-even
  });

  it('clears once every cell has been tapped in order', () => {
    for (const level of [1, 16, 21, 46, 56, 81, 91]) {
      const done = playThrough(createLevelSession(level));
      expect(done.status).toBe('cleared');
      expect(done.tappedCount).toBe(cellCount(done.size));
      expect(done.missCount).toBe(0);
      expect(nextTarget(done)).toBeNull();
    }
  });

  it('counts a wrong tap and changes nothing else', () => {
    const session = createLevelSession(1);
    const wrongIndex = session.values.indexOf(5);
    const outcome = tapCell(session, wrongIndex);
    expect(outcome?.hit).toBe(false);
    expect(outcome?.session.missCount).toBe(1);
    // The board did not move on: 1 is still what is wanted.
    expect(outcome?.session.tappedCount).toBe(0);
    expect(nextTarget(outcome!.session)).toBe(1);
  });

  it('ignores a cell that has already been tapped, without counting a miss', () => {
    // §3: tapping something you already cleared is not getting a number wrong.
    let session = createLevelSession(1);
    session = tapValue(session, 1);
    expect(tapCell(session, session.values.indexOf(1))).toBeNull();
    expect(session.missCount).toBe(0);
  });

  it('ignores taps once the round is over', () => {
    const done = playThrough(createLevelSession(1));
    expect(tapCell(done, 0)).toBeNull();
  });

  it('ignores an index that is not on the board', () => {
    const session = createLevelSession(1);
    expect(tapCell(session, -1)).toBeNull();
    expect(tapCell(session, 99)).toBeNull();
  });

  it('reports which cells are done, in the round’s own order', () => {
    let session = createLevelSession(16); // 3x3 descending: 9 first
    expect(isTapped(session, session.values.indexOf(9))).toBe(false);
    session = tapValue(session, 9);
    expect(isTapped(session, session.values.indexOf(9))).toBe(true);
    expect(isTapped(session, session.values.indexOf(8))).toBe(false);
    expect(isTapped(session, session.values.indexOf(1))).toBe(false);
  });
});

describe('starting and retrying', () => {
  it('rebuilds the identical board on retry (§9: the same board, free)', () => {
    const first = createLevelSession(42);
    const played = tapValue(first, nextTarget(first)!);
    const again = restartSession(played);
    expect(again.values).toEqual(first.values);
    expect(again.tappedCount).toBe(0);
    expect(again.missCount).toBe(0);
    expect(again.elapsedSeconds).toBe(0);
  });

  it('keeps a daily on its own date when retried', () => {
    const daily = createDailySession('2026-08-07');
    const again = restartSession(daily);
    expect(again.mode).toBe('daily');
    expect(again.dailyDate).toBe('2026-08-07');
    expect(again.values).toEqual(daily.values);
  });

  it('gives every daily the same shape (§8: no weekday curve)', () => {
    for (const date of ['2026-01-01', '2026-08-07', '2026-12-31']) {
      const daily = createDailySession(date);
      expect(daily.size).toBe(5);
      expect(daily.order).toBe('ascending');
    }
  });

  it('clamps a level outside the ladder instead of throwing', () => {
    expect(createLevelSession(0).level).toBe(1);
    expect(createLevelSession(9999).level).toBe(100);
  });
});
