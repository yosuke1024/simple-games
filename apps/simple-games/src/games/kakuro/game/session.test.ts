/**
 * Session rules of docs/KAKURO_RULES.md §2, §4, §5, §6, §9, §10 and §11.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayDifference, localDateString } from './daily';
import { hasNote } from './engine';
import {
  UNDO_HISTORY_LIMIT,
  canUndo,
  cluesOf,
  createDailySession,
  createLevelSession,
  doErase,
  doHintUse,
  doPlace,
  doToggleNote,
  doUndo,
  hintFor,
  mistakesOf,
  restartSession,
  restoreSession,
  runsAt,
  violationsOf,
  withElapsedSeconds,
  type KakuroSession,
} from './session';
import { EMPTY, isWhite, type Digit } from './types';

/** Writes the answer the only way a player can: one digit at a time. */
function solveByPlacing(session: KakuroSession): KakuroSession {
  let current = session;
  for (const index of session.table.white) {
    const next = doPlace(current, index, session.solution[index] as Digit);
    if (next !== null) current = next;
  }
  return current;
}

const firstWhite = (session: KakuroSession): number => session.table.white[0]!;
const firstClue = (session: KakuroSession): number =>
  session.layout.cells.findIndex((_, index) => !isWhite(session.layout, index));

describe('sessions (§9)', () => {
  it('creates a level session sized by its band', () => {
    const early = createLevelSession(1);
    expect(early.size).toBe(6);
    expect(early.level).toBe(1);
    expect(early.dailyDate).toBeNull();
    expect(early.seed).toBe('kakuro-level-1');
    expect(early.board.entries.every((entry) => entry === EMPTY)).toBe(true);
    expect(early.board.notes.every((mask) => mask === 0)).toBe(true);
    expect(early.history).toEqual([]);
    expect(early.status).toBe('playing');
    expect(early.mistakeCount).toBe(0);
    expect(early.hintCount).toBe(0);
    expect(early.elapsedSeconds).toBe(0);

    expect(createLevelSession(21).size).toBe(8);
    expect(createLevelSession(66).size).toBe(10);
  });

  /**
   * The absence that makes this game different from its three siblings (§1):
   * nothing is handed over. Every white cell starts empty and belongs to the
   * player, and the clues are the whole of the puzzle.
   */
  it('hands the player no digits at all, only clues', () => {
    const session = createLevelSession(2);
    expect(session.board.entries.filter((entry) => entry !== EMPTY)).toHaveLength(0);
    const clues = cluesOf(session);
    const drawn = clues.filter(
      (clue) => clue !== null && (clue.right !== null || clue.down !== null),
    );
    expect(drawn.length).toBe(new Set(session.table.runs.map((run) => run.clue)).size);
    // Every run's clue is drawn on a clue cell, never on a white one.
    for (const run of session.table.runs) {
      expect(isWhite(session.layout, run.clue)).toBe(false);
      const clue = clues[run.clue]!;
      expect(run.axis === 'row' ? clue.right : clue.down).toBe(run.sum);
    }
    expect(clues[firstWhite(session)]).toBeNull();
  });

  it('creates a daily session for a date, 8×8 every day', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(8);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.level).toBeNull();
    expect(session.seed).toBe('kakuro-daily-2026-08-01');
  });

  it('gives different days different boards', () => {
    expect(createDailySession('2026-08-03').solution).not.toEqual(
      createDailySession('2026-08-04').solution,
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
    expect(createLevelSession(7).solution).toEqual(createLevelSession(7).solution);
    expect(createLevelSession(7).layout).toEqual(createLevelSession(7).layout);
    expect(createLevelSession(7).solution).not.toEqual(createLevelSession(8).solution);
  });

  it('hands the player a board that is neither finished nor broken', () => {
    const session = createLevelSession(5);
    expect(session.table.white.length).toBeGreaterThan(0);
    expect(violationsOf(session).any).toBe(false);
    expect(mistakesOf(session).size).toBe(0);
  });

  /** §4: selecting a cell lights both of its runs, and a clue cell has none. */
  it('names the two runs a cell belongs to, and none for a clue cell', () => {
    const session = createLevelSession(3);
    const index = firstWhite(session);
    const [row, col] = runsAt(session, index);
    expect(session.table.runs[row!]!.cells).toContain(index);
    expect(session.table.runs[col!]!.cells).toContain(index);
    expect(session.table.runs[row!]!.axis).toBe('row');
    expect(session.table.runs[col!]!.axis).toBe('col');
    expect(runsAt(session, firstClue(session))).toEqual([]);
    expect(runsAt(session, -1)).toEqual([]);
  });

  it('restarts to the same puzzle with a clean board', () => {
    const session = createLevelSession(5);
    const played = withElapsedSeconds(doPlace(session, firstWhite(session), 1)!, 30);
    const restarted = restartSession(played);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.layout).toEqual(session.layout);
    expect(restarted.board).toEqual(session.board);
    expect(restarted.elapsedSeconds).toBe(0);
    // A daily restarts to the same day.
    const daily = createDailySession('2026-08-05');
    expect(restartSession(daily).seed).toBe(daily.seed);
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
  const free = firstWhite(session);

  it('writes a digit and refuses everything that changes nothing', () => {
    const played = doPlace(session, free, 1)!;
    expect(played.board.entries[free]).toBe(1);
    expect(doPlace(played, free, 1)).toBeNull();
    expect(doPlace(session, firstClue(session), 1)).toBeNull();
    expect(doPlace(session, -1, 1)).toBeNull();
    expect(doPlace(session, 999, 1)).toBeNull();
  });

  it('refuses a digit outside 1..9, at every size', () => {
    expect(doPlace(session, free, 0 as Digit)).toBeNull();
    expect(doPlace(session, free, 10 as Digit)).toBeNull();
    expect(doToggleNote(session, free, 0 as Digit)).toBeNull();
    expect(doToggleNote(session, free, 10 as Digit)).toBeNull();
  });

  it('counts a wrong digit without punishing it (§5)', () => {
    const wrong = ((session.solution[free]! % 9) + 1) as Digit;
    const played = doPlace(session, free, wrong)!;
    expect(played.mistakeCount).toBe(1);
    expect(mistakesOf(played)).toEqual(new Set([free]));
    expect(played.status).toBe('playing');
    // Correcting it does not take the mistake back.
    expect(doPlace(played, free, session.solution[free] as Digit)!.mistakeCount).toBe(1);
  });

  it('erases an entry and its notes, and refuses an empty cell', () => {
    const noted = doToggleNote(session, free, 2)!;
    expect(hasNote(noted.board, free, 2)).toBe(true);
    const cleared = doErase(noted, free)!;
    expect(hasNote(cleared.board, free, 2)).toBe(false);
    expect(doErase(cleared, free)).toBeNull();
    expect(doErase(session, firstClue(session))).toBeNull();
  });

  it('refuses a note on a cell that already shows a digit (§4)', () => {
    const played = doPlace(session, free, 1)!;
    expect(doToggleNote(played, free, 2)).toBeNull();
    expect(doToggleNote(session, firstClue(session), 2)).toBeNull();
  });
});

/**
 * Undo exists here and not in Takuzu for Sudoku's reason (§5): writing a digit
 * rubs out pencil marks across two whole runs, and nothing the player can
 * press brings them back. So the test that matters is not "the digit came off"
 * but "the notes came back".
 */
describe('undo (§5)', () => {
  const session = createLevelSession(6);
  const free = firstWhite(session);

  it('has nothing to undo on a fresh board', () => {
    expect(canUndo(session)).toBe(false);
    expect(doUndo(session)).toBeNull();
  });

  it('brings back the notes a digit rubbed out', () => {
    let noted = session;
    for (const index of session.table.runs[session.table.rowRun[free]!]!.cells) {
      noted = doToggleNote(noted, index, 3)!;
    }
    expect(noted.board.notes.some((mask) => mask !== 0)).toBe(true);

    const played = doPlace(noted, free, 3)!;
    for (const index of session.table.runs[session.table.rowRun[free]!]!.cells) {
      expect(hasNote(played.board, index, 3)).toBe(false);
    }

    const undone = doUndo(played)!;
    expect(undone.board).toEqual(noted.board);
    expect(canUndo(undone)).toBe(true);
  });

  it('takes back a move, not the fact that it was made', () => {
    const wrong = ((session.solution[free]! % 9) + 1) as Digit;
    const played = doHintUse(doPlace(session, free, wrong)!);
    const undone = doUndo(played)!;
    expect(undone.board.entries[free]).toBe(EMPTY);
    expect(undone.mistakeCount).toBe(1);
    expect(undone.hintCount).toBe(1);
  });

  it('walks all the way back to the board it started on, and then stops', () => {
    let played = session;
    for (const digit of [1, 2, 3] as Digit[]) played = doPlace(played, free, digit)!;
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

    for (let index = 0; index < solved.board.entries.length; index++) {
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
    entries[firstWhite(solved)] = EMPTY;
    expect(restoreSession({ ...persisted, board: { ...persisted.board, entries } }).status).toBe(
      'playing',
    );
  });

  it('is never reached by a board that breaks a rule, however full', () => {
    const session = createLevelSession(4);
    const run = session.table.runs.find((candidate) => candidate.cells.length === 2)!;
    let broken = session;
    for (const index of session.table.white) {
      const digit = run.cells.includes(index) ? 9 : session.solution[index]!;
      const next = doPlace(broken, index, digit as Digit);
      if (next !== null) broken = next;
    }
    expect(broken.status).toBe('playing');
    expect(violationsOf(broken).any).toBe(true);
  });
});

describe('hints (§6)', () => {
  it('offers a step on a fresh board, from the player’s own position', () => {
    const session = createLevelSession(10);
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
    const played = doPlace(session, firstWhite(session), 1)!;
    expect(played.elapsedSeconds).toBe(90);
    expect(restartSession(played).elapsedSeconds).toBe(0);
  });
});
