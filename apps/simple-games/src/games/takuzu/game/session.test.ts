/**
 * Session rules of docs/TAKUZU_RULES.md §2, §4, §7, §8 and §11.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayDifference, localDateString } from './daily';
import {
  boardOf,
  createDailySession,
  createLevelSession,
  doHintUse,
  doTap,
  hintFor,
  restartSession,
  restoreSession,
  violationsOf,
  withElapsedSeconds,
  type TakuzuSession,
} from './session';
import { EMPTY, ONE, ZERO } from './types';

/** Writes the answer the only way a player can: one tap per digit, two for a one. */
function solveByTapping(session: TakuzuSession): TakuzuSession {
  let current = session;
  session.solution.forEach((value, index) => {
    if (session.givens[index] !== EMPTY) return;
    for (let tap = 0; tap < (value === ZERO ? 1 : 2); tap++) {
      const next = doTap(current, index);
      if (next !== null) current = next;
    }
  });
  return current;
}

describe('sessions (§7)', () => {
  it('creates a level session sized by its band', () => {
    const early = createLevelSession(1);
    expect(early.size).toBe(6);
    expect(early.level).toBe(1);
    expect(early.seed).toBe('takuzu-level-1');
    expect(early.marks.every((mark) => mark === EMPTY)).toBe(true);
    expect(early.status).toBe('playing');
    expect(early.hintCount).toBe(0);
    expect(early.elapsedSeconds).toBe(0);

    expect(createLevelSession(40).size).toBe(8);
    expect(createLevelSession(100).size).toBe(10);
  });

  it('creates a daily session for a date, 8×8 every day', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(8);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.level).toBeNull();
    expect(session.seed).toBe('takuzu-daily-2026-08-01');
  });

  it('gives different days different boards', () => {
    expect(createDailySession('2026-08-03').givens).not.toEqual(
      createDailySession('2026-08-04').givens,
    );
  });

  it('formats, shifts and subtracts local dates', () => {
    expect(localDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-08-03', '2026-08-04')).toBe(1);
    expect(dayDifference('2026-08-04', '2026-08-03')).toBe(-1);
    expect(dayDifference('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('is a pure function of its seed — the same level is the same puzzle', () => {
    expect(createLevelSession(17).givens).toEqual(createLevelSession(17).givens);
    expect(createLevelSession(17).solution).toEqual(createLevelSession(17).solution);
    expect(createDailySession('2026-08-01').givens).toEqual(
      createDailySession('2026-08-01').givens,
    );
    expect(createLevelSession(17).givens).not.toEqual(createLevelSession(18).givens);
  });

  it('hands the player a board that is neither empty nor finished', () => {
    const session = createLevelSession(50);
    const givens = session.givens.filter((given) => given !== EMPTY).length;
    expect(givens).toBeGreaterThan(0);
    expect(givens).toBeLessThan(session.solution.length);
    expect(violationsOf(session).any).toBe(false);
  });

  it('restarts to the same puzzle with a clean board', () => {
    const session = createLevelSession(5);
    const played = doTap(session, session.givens.indexOf(EMPTY))!;
    const restarted = restartSession(played);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.givens).toEqual(session.givens);
    expect(restarted.marks.every((mark) => mark === EMPTY)).toBe(true);
  });

  it('restores from persisted state and re-derives the win (§11)', () => {
    const solved = solveByTapping(createLevelSession(3));
    expect(solved.status).toBe('solved');
    const { status: _status, ...persisted } = solved;
    expect(restoreSession(persisted).status).toBe('solved');

    const { status: _fresh, ...unplayed } = createLevelSession(3);
    expect(restoreSession(unplayed).status).toBe('playing');
  });
});

describe('taps and the win (§2, §4)', () => {
  const session = createLevelSession(2);
  const free = session.givens.indexOf(EMPTY);

  it('cycles a cell and leaves the givens where they are', () => {
    const zero = doTap(session, free)!;
    expect(zero.marks[free]).toBe(ZERO);
    expect(boardOf(zero)[free]).toBe(ZERO);
    const one = doTap(zero, free)!;
    expect(one.marks[free]).toBe(ONE);
    expect(doTap(one, free)!.marks[free]).toBe(EMPTY);

    const given = session.givens.findIndex((mark) => mark !== EMPTY);
    expect(doTap(session, given)).toBeNull();
    expect(doTap(session, -1)).toBeNull();
    expect(doTap(session, 999)).toBeNull();
  });

  it('marks never overwrite the givens they sit beside (§11)', () => {
    const played = doTap(session, free)!;
    played.givens.forEach((given, index) => {
      if (given !== EMPTY) expect(played.marks[index]).toBe(EMPTY);
    });
  });

  /**
   * The transition into 'solved' happens exactly once, because there is no way
   * back out of it: every later tap is refused. That is what lets the owner
   * book the completion on the edge and never again.
   */
  it('turns solved once, and then refuses every move', () => {
    const solved = solveByTapping(createLevelSession(4));
    expect(solved.status).toBe('solved');
    expect(violationsOf(solved).any).toBe(false);
    for (let index = 0; index < solved.marks.length; index++) {
      expect(doTap(solved, index)).toBeNull();
    }
  });

  it('does not call a board solved while a cell is still empty', () => {
    const solved = solveByTapping(createLevelSession(6));
    const { status: _status, ...persisted } = solved;
    const marks = [...persisted.marks];
    marks[solved.givens.indexOf(EMPTY)] = EMPTY;
    expect(restoreSession({ ...persisted, marks }).status).toBe('playing');
  });
});

describe('hints (§8)', () => {
  it('offers a step on a fresh board, and agrees with the solution', () => {
    const session = createLevelSession(30);
    const hint = hintFor(session);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step') {
      expect(hint.step.value).toBe(session.solution[hint.step.index]);
      expect(session.givens[hint.step.index]).toBe(EMPTY);
    }
  });

  it('counts uses without limiting them (§8)', () => {
    let session = createLevelSession(1);
    expect(session.hintCount).toBe(0);
    for (let use = 1; use <= 5; use++) {
      session = doHintUse(session);
      expect(session.hintCount).toBe(use);
      expect(hintFor(session)).not.toBeNull();
    }
  });

  it('offers nothing once the puzzle is solved', () => {
    expect(hintFor(solveByTapping(createLevelSession(7)))).toBeNull();
  });
});

describe('the clock is carried, never read (§10)', () => {
  it('takes the owner’s seconds and only ever moves forward', () => {
    const session = createLevelSession(1);
    const ticked = withElapsedSeconds(session, 42.7);
    expect(ticked.elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(ticked, 10).elapsedSeconds).toBe(42);
    expect(withElapsedSeconds(ticked, 42)).toBe(ticked);
    expect(withElapsedSeconds(ticked, 100).elapsedSeconds).toBe(100);
  });

  it('carries the seconds across a tap, and drops them on a restart', () => {
    const session = withElapsedSeconds(createLevelSession(1), 90);
    const played = doTap(session, session.givens.indexOf(EMPTY))!;
    expect(played.elapsedSeconds).toBe(90);
    expect(restartSession(played).elapsedSeconds).toBe(0);
  });
});
