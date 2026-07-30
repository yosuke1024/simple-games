/**
 * The play rules of docs/SUDOKU_RULES.md §3, §4, §9, §10, §11 — including the
 * ones the brand insists on: no mistake limit, no game over, undo that does
 * not launder a mistake, and no streak anywhere.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dayDifference, localDateString } from './daily';
import {
  conflictingCells,
  digitCount,
  fillNotes,
  hasNote,
  isSolved,
  mistakenCells,
  toGrid,
  valueAt,
} from './engine';
import { findHint } from './hint';
import { difficultyForLevel, levelSeed, MAX_LEVEL, clampLevel } from './levels';
import { decodeBoard, decodeSolution, encodeBoard, encodeSolution } from './serialize';
import {
  canUndo,
  countHintUse,
  createDailySession,
  createLevelSession,
  eraseCell,
  placeDigit,
  restartSession,
  restoreSession,
  toggleCellNote,
  undo,
  type SudokuSession,
} from './session';
import { CELLS, type Digit } from './types';

const firstEmpty = (session: SudokuSession): number => {
  for (let i = 0; i < CELLS; i++) if (valueAt(session.board, i) === 0) return i;
  throw new Error('no empty cell');
};

const wrongDigitFor = (session: SudokuSession, index: number): Digit => {
  const correct = session.solution[index]!;
  return ((correct % 9) + 1) as Digit;
};

/** Plays the whole puzzle from its solution. */
const solveFully = (start: SudokuSession): SudokuSession => {
  let session = start;
  for (let i = 0; i < CELLS; i++) {
    if (valueAt(session.board, i) !== 0) continue;
    const next = placeDigit(session, i, session.solution[i]! as Digit);
    if (next) session = next;
  }
  return session;
};

describe('createLevelSession', () => {
  it('builds a playable session with the level tier and seed', () => {
    const session = createLevelSession(1);
    expect(session.mode).toBe('level');
    expect(session.level).toBe(1);
    expect(session.dailyDate).toBeNull();
    expect(session.seed).toBe(levelSeed(1));
    expect(session.difficulty).toBe(difficultyForLevel(1));
    expect(session.status).toBe('playing');
    expect(session.mistakeCount).toBe(0);
    expect(session.hintCount).toBe(0);
    expect(session.elapsedSeconds).toBe(0);
    expect(session.history).toEqual([]);
  });

  it('clamps out-of-range levels instead of failing', () => {
    expect(createLevelSession(0).level).toBe(0);
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(5000)).toBe(MAX_LEVEL);
    expect(createLevelSession(-5).seed).toBe(levelSeed(1));
  });

  it('restart rebuilds the identical puzzle', () => {
    const session = createLevelSession(7);
    const restarted = restartSession(session);
    expect(restarted.board.givens).toEqual(session.board.givens);
    expect(restarted.solution).toEqual(session.solution);
    expect(restarted.mistakeCount).toBe(0);
  });
});

describe('createDailySession', () => {
  it('is medium every day and carries the date', () => {
    const monday = createDailySession('2026-08-03');
    const saturday = createDailySession('2026-08-08');
    expect(monday.difficulty).toBe(DAILY_DIFFICULTY);
    expect(saturday.difficulty).toBe(DAILY_DIFFICULTY);
    expect(monday.difficulty).toBe(saturday.difficulty);
    expect(monday.dailyDate).toBe('2026-08-03');
    expect(monday.level).toBeNull();
  });

  it('gives different days different puzzles', () => {
    const a = createDailySession('2026-08-03');
    const b = createDailySession('2026-08-04');
    expect(a.board.givens).not.toEqual(b.board.givens);
  });
});

describe('placing digits', () => {
  it('fills an empty cell and leaves clue cells alone', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    const next = placeDigit(session, index, session.solution[index]! as Digit)!;
    expect(valueAt(next.board, index)).toBe(session.solution[index]);
    expect(next.mistakeCount).toBe(0);

    const clue = session.board.givens.findIndex((value) => value !== 0);
    expect(placeDigit(session, clue, 5)).toBeNull();
  });

  it('counts a wrong digit as a mistake but keeps playing (§4)', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    const next = placeDigit(session, index, wrongDigitFor(session, index))!;
    expect(next.mistakeCount).toBe(1);
    expect(next.status).toBe('playing');
    // No limit: three more mistakes change nothing but the count.
    let after = next;
    for (const cell of [index, index, index]) {
      const again = placeDigit(after, cell, ((valueAt(after.board, cell) % 9) + 1) as Digit);
      if (again) after = again;
    }
    expect(after.mistakeCount).toBeGreaterThan(1);
    expect(after.status).toBe('playing');
  });

  it('clears the digit from peer notes when placed (§3)', () => {
    const session = fillNotesSession(createLevelSession(3));
    const index = firstEmpty(session);
    const digit = session.solution[index]! as Digit;
    const next = placeDigit(session, index, digit)!;
    // The cell itself keeps no notes, and no peer still lists that digit.
    expect(next.board.notes[index]).toBe(0);
    for (let peer = 0; peer < CELLS; peer++) {
      if (peer === index) continue;
      const sharesUnit = toGrid(next.board) && peerOf(index, peer);
      if (sharesUnit) expect(hasNote(next.board, peer, digit)).toBe(false);
    }
  });

  it('rejects a no-op re-entry of the same digit', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    const digit = session.solution[index]! as Digit;
    const next = placeDigit(session, index, digit)!;
    expect(placeDigit(next, index, digit)).toBeNull();
  });
});

/** Helper: notes filled everywhere, so peer-clearing is observable. */
function fillNotesSession(session: SudokuSession): SudokuSession {
  return { ...session, board: fillNotes(session.board) };
}

function peerOf(a: number, b: number): boolean {
  const row = (i: number) => Math.floor(i / 9);
  const col = (i: number) => i % 9;
  const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
  return row(a) === row(b) || col(a) === col(b) || box(a) === box(b);
}

describe('erasing and notes', () => {
  it('erases a player entry but never a clue', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    const filled = placeDigit(session, index, session.solution[index]! as Digit)!;
    const erased = eraseCell(filled, index)!;
    expect(valueAt(erased.board, index)).toBe(0);

    const clue = session.board.givens.findIndex((value) => value !== 0);
    expect(eraseCell(session, clue)).toBeNull();
    // Nothing to erase in an untouched empty cell.
    expect(eraseCell(session, index)).toBeNull();
  });

  it('toggles a note on and off', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    const added = toggleCellNote(session, index, 5)!;
    expect(hasNote(added.board, index, 5)).toBe(true);
    const removed = toggleCellNote(added, index, 5)!;
    expect(hasNote(removed.board, index, 5)).toBe(false);
  });

  it('refuses notes on clue cells and on cells holding an entry', () => {
    const session = createLevelSession(3);
    const clue = session.board.givens.findIndex((value) => value !== 0);
    expect(toggleCellNote(session, clue, 4)).toBeNull();

    const index = firstEmpty(session);
    const filled = placeDigit(session, index, session.solution[index]! as Digit)!;
    expect(toggleCellNote(filled, index, 4)).toBeNull();
  });
});

describe('undo (§4)', () => {
  it('restores the previous board', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    expect(canUndo(session)).toBe(false);
    const filled = placeDigit(session, index, session.solution[index]! as Digit)!;
    expect(canUndo(filled)).toBe(true);
    const undone = undo(filled)!;
    expect(valueAt(undone.board, index)).toBe(0);
    expect(canUndo(undone)).toBe(false);
    expect(undo(undone)).toBeNull();
  });

  it('does not take back a mistake or a hint', () => {
    const session = createLevelSession(3);
    const index = firstEmpty(session);
    const wrong = placeDigit(session, index, wrongDigitFor(session, index))!;
    const hinted = countHintUse(wrong);
    const undone = undo(hinted)!;
    expect(undone.mistakeCount).toBe(1);
    expect(undone.hintCount).toBe(1);
  });
});

describe('solving (§2)', () => {
  it('reaches solved when the last correct digit lands', () => {
    const session = solveFully(createLevelSession(2));
    expect(session.status).toBe('solved');
    expect(isSolved(session.board)).toBe(true);
    expect(mistakenCells(session.board, session.solution).size).toBe(0);
    expect(conflictingCells(session.board).size).toBe(0);
    // A solved game accepts no more moves.
    expect(placeDigit(session, 0, 1)).toBeNull();
    expect(eraseCell(session, 0)).toBeNull();
  });

  it('shows a duplicate as a conflict regardless of the mistake setting', () => {
    const session = createLevelSession(3);
    const clue = session.board.givens.findIndex((value) => value !== 0);
    const digit = session.board.givens[clue]! as Digit;
    // Put the same digit in a peer of that clue.
    const peer = [...Array(CELLS).keys()].find(
      (i) => i !== clue && peerOf(clue, i) && valueAt(session.board, i) === 0,
    )!;
    const next = placeDigit(session, peer, digit)!;
    const conflicts = conflictingCells(next.board);
    expect(conflicts.has(peer)).toBe(true);
    expect(conflicts.has(clue)).toBe(true);
  });

  it('counts digits for the pad (§3)', () => {
    const session = createLevelSession(3);
    for (let digit = 1 as Digit; digit <= 9; digit = (digit + 1) as Digit) {
      const count = digitCount(session.board, digit);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(9);
    }
    const solved = solveFully(session);
    for (let digit = 1 as Digit; digit <= 9; digit = (digit + 1) as Digit) {
      expect(digitCount(solved.board, digit)).toBe(9);
    }
  });
});

describe('hint (§5)', () => {
  it('names a cell to fill and the unit that justifies it, without filling it', () => {
    const session = createLevelSession(3);
    const hint = findHint(session.board);
    expect(hint).not.toBeNull();
    expect(hint!.focus.length).toBeGreaterThan(0);
    if (hint!.target !== undefined) {
      // The board is untouched: a hint explains, it does not play.
      expect(valueAt(session.board, hint!.target)).toBe(0);
      expect(hint!.digit).toBe(session.solution[hint!.target]);
    }
  });

  it('has a hint available at every step of a real game', () => {
    let session = createLevelSession(4);
    let guard = 0;
    while (session.status === 'playing' && guard++ < CELLS + 5) {
      const hint = findHint(session.board);
      expect(hint, `stalled with ${guard} moves played`).not.toBeNull();
      const target = hint!.target;
      if (target === undefined) {
        // An elimination hint: apply the placement it unblocks instead.
        const index = firstEmpty(session);
        session = placeDigit(session, index, session.solution[index]! as Digit)!;
        continue;
      }
      session = placeDigit(session, target, session.solution[target]! as Digit)!;
    }
    expect(session.status).toBe('solved');
  });

  it('counts hint use and never reverts it', () => {
    const session = countHintUse(createLevelSession(3));
    expect(session.hintCount).toBe(1);
  });
});

describe('level difficulty curve (§9)', () => {
  it('keeps the first twenty levels easy', () => {
    for (let level = 1; level <= 20; level++) {
      expect(difficultyForLevel(level), `level ${level}`).toBe('easy');
    }
  });

  it('never offers hard before level 151', () => {
    for (let level = 1; level <= 150; level++) {
      expect(difficultyForLevel(level), `level ${level}`).not.toBe('hard');
    }
  });

  it('is deterministic and stays inside the tier set', () => {
    for (const level of [1, 25, 100, 200, 500, 800, 999]) {
      const first = difficultyForLevel(level);
      expect(difficultyForLevel(level)).toBe(first);
      expect(['easy', 'medium', 'hard']).toContain(first);
    }
  });

  it('mixes medium into the last band rather than going all hard', () => {
    const tiers = Array.from({ length: 299 }, (_, i) => difficultyForLevel(701 + i));
    const mediums = tiers.filter((t) => t === 'medium').length;
    const hards = tiers.filter((t) => t === 'hard').length;
    expect(mediums).toBeGreaterThan(80);
    expect(hards).toBeGreaterThan(100);
    expect(tiers.filter((t) => t === 'easy')).toHaveLength(0);
  });
});

describe('daily dates (§10)', () => {
  it('formats and shifts local dates', () => {
    expect(localDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts whole days between dates across month and DST boundaries', () => {
    expect(dayDifference('2026-08-03', '2026-08-04')).toBe(1);
    expect(dayDifference('2026-08-04', '2026-08-03')).toBe(-1);
    expect(dayDifference('2026-08-03', '2026-08-03')).toBe(0);
    expect(dayDifference('2026-03-28', '2026-03-30')).toBe(2);
    expect(dayDifference('2026-07-31', '2026-08-01')).toBe(1);
  });
});

describe('serialization (§11)', () => {
  it('round-trips a played board', () => {
    let session = createLevelSession(5);
    const index = firstEmpty(session);
    session = placeDigit(session, index, session.solution[index]! as Digit)!;
    session = toggleCellNote(session, firstEmpty(session), 7)!;

    const decoded = decodeBoard(encodeBoard(session.board));
    expect(decoded).not.toBeNull();
    expect(decoded!.givens).toEqual(session.board.givens);
    expect(decoded!.entries).toEqual(session.board.entries);
    expect(decoded!.notes).toEqual(session.board.notes);
    expect(decodeSolution(encodeSolution(session.solution))).toEqual(session.solution);
  });

  it('restores a session without its undo history', () => {
    let session = createLevelSession(5);
    const index = firstEmpty(session);
    session = placeDigit(session, index, session.solution[index]! as Digit)!;
    expect(session.history.length).toBe(1);

    const { history: _history, status: _status, ...persisted } = session;
    const restored = restoreSession(persisted);
    expect(restored.history).toEqual([]);
    expect(restored.status).toBe('playing');
    expect(valueAt(restored.board, index)).toBe(session.solution[index]);
  });

  it('fails closed on corrupt data instead of loading a broken board', () => {
    const board = createLevelSession(5).board;
    const good = encodeBoard(board);
    expect(decodeBoard({ ...good, givens: 'x'.repeat(81) })).toBeNull();
    expect(decodeBoard({ ...good, entries: '123' })).toBeNull();
    expect(decodeBoard({ ...good, notes: '1,2,3' })).toBeNull();
    // A note mask wider than nine bits cannot come from play.
    const tooWide = board.notes.map((_, i) => (i === 0 ? '1000' : '0')).join(',');
    expect(decodeBoard({ ...good, notes: tooWide })).toBeNull();
    // A clue cell that also holds an entry is impossible.
    const clue = board.givens.findIndex((value) => value !== 0);
    const entries = board.entries.map((_, i) => (i === clue ? 5 : 0));
    expect(
      decodeBoard({ ...good, entries: entries.map((v) => String(v)).join('') }),
    ).toBeNull();
    expect(decodeSolution('0'.repeat(81))).toBeNull();
  });
});
