import { describe, expect, it } from 'vitest';
import { isValidLayout } from './layout';
import { MAX_LEVEL, sizeForLevel, tilesForLevel } from './levels';
import {
  createDailySession,
  createLevelSession,
  isFaceUp,
  isMemorising,
  nextTarget,
  retrySession,
  tapCell,
  type RecallSession,
} from './session';
import { EMPTY } from './types';

/** Taps the cell holding `value`, asserting the tap was accepted. */
function tapValue(session: RecallSession, value: number): RecallSession {
  const index = session.layout.indexOf(value);
  expect(index).toBeGreaterThanOrEqual(0);
  const next = tapCell(session, index);
  expect(next).not.toBeNull();
  return next!;
}

/** Plays a whole round correctly. */
function playThrough(start: RecallSession): RecallSession {
  let session = start;
  for (let value = 1; value <= start.tileCount; value++) session = tapValue(session, value);
  return session;
}

describe('a round (docs/NUMBER_RECALL_RULES.md §2, §3)', () => {
  it('starts with every tile showing, and no clock running against them', () => {
    const session = createLevelSession(1);
    expect(isMemorising(session)).toBe(true);
    for (let index = 0; index < session.layout.length; index++) {
      const hasTile = session.layout[index] !== EMPTY;
      expect(isFaceUp(session, index)).toBe(hasTile);
    }
    expect(nextTarget(session)).toBe(1);
  });

  it('hides the rest the moment 1 is tapped — the player ends the look (§3)', () => {
    let session = createLevelSession(1);
    session = tapValue(session, 1);

    expect(isMemorising(session)).toBe(false);
    expect(isFaceUp(session, session.layout.indexOf(1))).toBe(true);
    expect(isFaceUp(session, session.layout.indexOf(2))).toBe(false);
    expect(isFaceUp(session, session.layout.indexOf(3))).toBe(false);
    expect(nextTarget(session)).toBe(2);
  });

  it('clears once 1..K have all been tapped in order', () => {
    for (const level of [1, 15, 16, 55, 56, 100]) {
      const done = playThrough(createLevelSession(level));
      expect(done.status).toBe('cleared');
      expect(done.revealedCount).toBe(done.tileCount);
      expect(nextTarget(done)).toBeNull();
    }
  });

  it('ends the round on a wrong tile and marks the one that was wanted (§4)', () => {
    const session = createLevelSession(20); // four tiles or more
    const started = tapValue(session, 1);

    const failed = tapCell(started, started.layout.indexOf(3));
    expect(failed?.status).toBe('failed');
    expect(failed?.expectedIndex).toBe(started.layout.indexOf(2));
    // The answer is on show, all of it (§4).
    for (let index = 0; index < failed!.layout.length; index++) {
      expect(isFaceUp(failed!, index)).toBe(failed!.layout[index] !== EMPTY);
    }
  });

  it('ignores an empty cell rather than failing the round (§3)', () => {
    const session = createLevelSession(1);
    const empty = session.layout.indexOf(EMPTY);
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(tapCell(session, empty)).toBeNull();
  });

  it('ignores a tile that is already face up, and an index off the board', () => {
    let session = createLevelSession(1);
    session = tapValue(session, 1);
    expect(tapCell(session, session.layout.indexOf(1))).toBeNull();
    expect(tapCell(session, -1)).toBeNull();
    expect(tapCell(session, 999)).toBeNull();
  });

  it('ignores taps once the round is over, either way', () => {
    const cleared = playThrough(createLevelSession(1));
    expect(tapCell(cleared, cleared.layout.indexOf(1))).toBeNull();

    const started = tapValue(createLevelSession(20), 1);
    const failed = tapCell(started, started.layout.indexOf(3))!;
    expect(tapCell(failed, failed.layout.indexOf(2))).toBeNull();
  });
});

describe('retrying (docs/NUMBER_RECALL_RULES.md §8)', () => {
  it('gives the same level a different layout — never the one just revealed', () => {
    const first = createLevelSession(30);
    const again = retrySession(first);

    expect(again.level).toBe(30);
    expect(again.size).toBe(first.size);
    expect(again.tileCount).toBe(first.tileCount);
    expect(again.attempt).toBe(1);
    expect(again.status).toBe('playing');
    expect(again.revealedCount).toBe(0);
    // The difficulty is identical and the question is not.
    expect(again.layout).not.toEqual(first.layout);
  });

  it('keeps a daily on its own date while changing the layout', () => {
    const daily = createDailySession('2026-08-07');
    const again = retrySession(daily);
    expect(again.mode).toBe('daily');
    expect(again.dailyDate).toBe('2026-08-07');
    expect(again.size).toBe(5);
    expect(again.tileCount).toBe(9);
    expect(again.layout).not.toEqual(daily.layout);
  });

  it('is deterministic: the same attempt is the same layout on every device', () => {
    expect(createLevelSession(30, 3).layout).toEqual(createLevelSession(30, 3).layout);
    expect(createDailySession('2026-08-07', 2).layout).toEqual(
      createDailySession('2026-08-07', 2).layout,
    );
  });

  it('builds a valid layout at every level and for several attempts', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (const attempt of [0, 1, 5]) {
        const session = createLevelSession(level, attempt);
        expect(isValidLayout(session.layout, sizeForLevel(level), tilesForLevel(level))).toBe(true);
      }
    }
  });

  it('clamps a level outside the ladder instead of throwing', () => {
    expect(createLevelSession(0).level).toBe(1);
    expect(createLevelSession(9999).level).toBe(100);
    expect(createLevelSession(5, -2).attempt).toBe(0);
  });

  it('gives every daily the same shape (§9: no weekday curve)', () => {
    for (const date of ['2026-01-01', '2026-08-07', '2026-12-31']) {
      const daily = createDailySession(date);
      expect(daily.size).toBe(5);
      expect(daily.tileCount).toBe(9);
    }
  });
});
