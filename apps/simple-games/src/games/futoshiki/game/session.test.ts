/**
 * Session rules of docs/FUTOSHIKI_RULES.md §2, §4, §5, §6, §9 and §11.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayDifference, localDateString } from './daily';
import { hasNote, valueAt } from './engine';
import {
  UNDO_HISTORY_LIMIT,
  canUndo,
  createDailySession,
  createLevelSession,
  doErase,
  doHintUse,
  doPlace,
  doToggleNote,
  doUndo,
  gridOf,
  hintFor,
  mistakesOf,
  remainingOf,
  restartSession,
  restoreSession,
  violationsOf,
  withElapsedSeconds,
  type FutoshikiSession,
} from './session';
import { EMPTY, type Digit } from './types';

/** Writes the answer the only way a player can: one digit at a time. */
function solveByPlacing(session: FutoshikiSession): FutoshikiSession {
  let current = session;
  session.solution.forEach((value, index) => {
    if (session.board.givens[index] !== EMPTY) return;
    const next = doPlace(current, index, value as Digit);
    if (next !== null) current = next;
  });
  return current;
}

const firstFree = (session: FutoshikiSession): number =>
  session.board.givens.findIndex((given) => given === EMPTY);

describe('sessions (§9)', () => {
  it('creates a level session sized by its band', () => {
    const early = createLevelSession(1);
    expect(early.size).toBe(4);
    expect(early.level).toBe(1);
    expect(early.seed).toBe('futoshiki-level-1');
    expect(early.board.entries.every((entry) => entry === EMPTY)).toBe(true);
    expect(early.board.notes.every((mask) => mask === 0)).toBe(true);
    expect(early.history).toEqual([]);
    expect(early.status).toBe('playing');
    expect(early.mistakeCount).toBe(0);
    expect(early.hintCount).toBe(0);
    expect(early.elapsedSeconds).toBe(0);

    expect(createLevelSession(30).size).toBe(5);
    expect(createLevelSession(60).size).toBe(6);
    expect(createLevelSession(100).size).toBe(7);
  });

  it('creates a daily session for a date, 6×6 every day', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(6);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.level).toBeNull();
    expect(session.seed).toBe('futoshiki-daily-2026-08-01');
  });

  it('gives different days different boards', () => {
    expect(createDailySession('2026-08-03').board.givens).not.toEqual(
      createDailySession('2026-08-04').board.givens,
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
    expect(createLevelSession(17).board.givens).toEqual(createLevelSession(17).board.givens);
    expect(createLevelSession(17).constraints).toEqual(createLevelSession(17).constraints);
    expect(createDailySession('2026-08-01').solution).toEqual(
      createDailySession('2026-08-01').solution,
    );
    expect(createLevelSession(17).board.givens).not.toEqual(createLevelSession(18).board.givens);
  });

  it('hands the player a board that is neither empty nor finished, and never broken', () => {
    const session = createLevelSession(50);
    const givens = session.board.givens.filter((given) => given !== EMPTY).length;
    expect(givens).toBeGreaterThan(0);
    expect(givens).toBeLessThan(session.solution.length);
    expect(session.constraints.length).toBeGreaterThan(0);
    expect(violationsOf(session).any).toBe(false);
    expect(mistakesOf(session).size).toBe(0);
  });

  it('restarts to the same puzzle with a clean board', () => {
    const session = createLevelSession(5);
    const played = doPlace(session, firstFree(session), 1)!;
    const restarted = restartSession(played);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.constraints).toEqual(session.constraints);
    expect(restarted.board).toEqual(session.board);
    expect(restarted.elapsedSeconds).toBe(0);
  });

  it('restores from persisted state, re-derives the win and drops the undo stack (§11)', () => {
    const solved = solveByPlacing(createLevelSession(3));
    expect(solved.status).toBe('solved');
    const { status: _status, history: _history, ...persisted } = solved;
    const restored = restoreSession(persisted);
    expect(restored.status).toBe('solved');
    expect(restored.history).toEqual([]);
    expect(canUndo(restored)).toBe(false);

    const { status: _fresh, history: _stack, ...unplayed } = createLevelSession(3);
    expect(restoreSession(unplayed).status).toBe('playing');
  });
});

describe('writing digits (§4, §5)', () => {
  const session = createLevelSession(2);
  const free = firstFree(session);

  it('writes a digit and refuses everything that changes nothing', () => {
    const played = doPlace(session, free, 1)!;
    expect(valueAt(played.board, free)).toBe(1);
    expect(gridOf(played)[free]).toBe(1);
    expect(doPlace(played, free, 1)).toBeNull();

    const given = session.board.givens.findIndex((mark) => mark !== EMPTY);
    expect(doPlace(session, given, 1)).toBeNull();
    expect(doPlace(session, -1, 1)).toBeNull();
    expect(doPlace(session, 999, 1)).toBeNull();
  });

  it('refuses a digit this board has not got', () => {
    expect(doPlace(session, free, 5 as Digit)).toBeNull();
    expect(doPlace(session, free, 0 as Digit)).toBeNull();
    expect(doToggleNote(session, free, 5 as Digit)).toBeNull();
  });

  it('counts a wrong digit without punishing it (§5)', () => {
    const wrong = (session.solution[free]! % session.size) + 1;
    const played = doPlace(session, free, wrong as Digit)!;
    expect(played.mistakeCount).toBe(1);
    expect(mistakesOf(played)).toEqual(new Set([free]));
    expect(played.status).toBe('playing');
    expect(doPlace(played, free, session.solution[free] as Digit)!.mistakeCount).toBe(1);
  });

  it('counts what the pad has left to place (§4)', () => {
    const before = remainingOf(session, 1);
    expect(before).toBe(session.size - gridOf(session).filter((value) => value === 1).length);
    expect(remainingOf(doPlace(session, free, 1)!, 1)).toBe(before - 1);
  });

  it('erases an entry and its notes, and refuses an empty cell', () => {
    const noted = doToggleNote(session, free, 2)!;
    expect(hasNote(noted.board, free, 2)).toBe(true);
    const cleared = doErase(noted, free)!;
    expect(hasNote(cleared.board, free, 2)).toBe(false);
    expect(doErase(cleared, free)).toBeNull();
  });
});

/**
 * Undo exists here and not in Takuzu for Sudoku's reason (§5): writing a digit
 * rubs out pencil marks across a whole row and column, and nothing the player
 * can press brings them back. So the test that matters is not "the digit came
 * off" but "the notes came back".
 */
describe('undo (§5)', () => {
  const session = createLevelSession(40);
  const free = firstFree(session);

  it('has nothing to undo on a fresh board', () => {
    expect(canUndo(session)).toBe(false);
    expect(doUndo(session)).toBeNull();
  });

  it('brings back the notes a digit rubbed out', () => {
    let noted = session;
    const row = Math.floor(free / session.size);
    for (let col = 0; col < session.size; col++) {
      const index = row * session.size + col;
      if (session.board.givens[index] === EMPTY) noted = doToggleNote(noted, index, 3)!;
    }
    const played = doPlace(noted, free, 3)!;
    expect(noted.board.notes.some((mask) => mask !== 0)).toBe(true);
    expect(played.board.notes.every((mask) => mask === 0)).toBe(true);

    const undone = doUndo(played)!;
    expect(undone.board).toEqual(noted.board);
    expect(canUndo(undone)).toBe(true);
  });

  it('takes back a move, not the fact that it was made', () => {
    const wrong = (session.solution[free]! % session.size) + 1;
    const played = doHintUse(doPlace(session, free, wrong as Digit)!);
    const undone = doUndo(played)!;
    expect(valueAt(undone.board, free)).toBe(EMPTY);
    expect(undone.mistakeCount).toBe(1);
    expect(undone.hintCount).toBe(1);
  });

  it('walks all the way back to the board it started on, and then stops', () => {
    let played = session;
    for (let digit = 1; digit <= 3; digit++) played = doPlace(played, free, digit as Digit)!;
    for (let step = 0; step < 3; step++) played = doUndo(played)!;
    expect(played.board).toEqual(session.board);
    expect(canUndo(played)).toBe(false);
    expect(doUndo(played)).toBeNull();
  });

  it('keeps the history bounded, since a session can outlive any move count', () => {
    let played = session;
    for (let move = 0; move < UNDO_HISTORY_LIMIT + 40; move++) {
      played = move % 2 === 0 ? doPlace(played, free, 1)! : doErase(played, free)!;
    }
    expect(played.history).toHaveLength(UNDO_HISTORY_LIMIT);
  });
});

describe('the win (§2)', () => {
  /**
   * The transition into 'solved' happens exactly once, because there is no way
   * back out of it: every later move is refused, undo included. That is what
   * lets the owner book the completion on the edge and never again.
   */
  it('turns solved once, and then refuses every move', () => {
    const solved = solveByPlacing(createLevelSession(4));
    expect(solved.status).toBe('solved');
    expect(violationsOf(solved).any).toBe(false);
    expect(mistakesOf(solved).size).toBe(0);

    for (let index = 0; index < solved.board.givens.length; index++) {
      expect(doPlace(solved, index, 1)).toBeNull();
      expect(doErase(solved, index)).toBeNull();
      expect(doToggleNote(solved, index, 1)).toBeNull();
    }
    expect(canUndo(solved)).toBe(false);
    expect(doUndo(solved)).toBeNull();
  });

  it('does not call a board solved while a cell is still empty', () => {
    const solved = solveByPlacing(createLevelSession(6));
    const { status: _status, history: _history, ...persisted } = solved;
    const entries = [...persisted.board.entries];
    entries[firstFree(solved)] = EMPTY;
    expect(restoreSession({ ...persisted, board: { ...persisted.board, entries } }).status).toBe(
      'playing',
    );
  });
});

describe('hints (§6)', () => {
  it('offers a step on a fresh board, from the player’s own position', () => {
    const session = createLevelSession(30);
    const hint = hintFor(session);
    expect(hint?.kind).toBe('step');
    if (hint?.kind === 'step' && hint.step.kind === 'placement') {
      expect(hint.step.value).toBe(session.solution[hint.step.index]);
    }
  });

  it('counts uses without limiting them (§6)', () => {
    let session = createLevelSession(1);
    expect(session.hintCount).toBe(0);
    for (let use = 1; use <= 5; use++) {
      session = doHintUse(session);
      expect(session.hintCount).toBe(use);
      expect(hintFor(session)).not.toBeNull();
    }
  });

  it('offers nothing once the puzzle is solved', () => {
    expect(hintFor(solveByPlacing(createLevelSession(7)))).toBeNull();
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

  it('carries the seconds across a move, and drops them on a restart', () => {
    const session = withElapsedSeconds(createLevelSession(1), 90);
    const played = doPlace(session, firstFree(session), 1)!;
    expect(played.elapsedSeconds).toBe(90);
    expect(restartSession(played).elapsedSeconds).toBe(0);
  });
});
